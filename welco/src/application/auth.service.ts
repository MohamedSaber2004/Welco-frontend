import { computed, ref } from 'vue'
import { t, type MessageKey } from '../i18n'
import type { User, AuthResponseDto, UserProfileDto } from '../domain/models/user'
import { USER_TINTS, normalizeThemeMode } from '../domain/models/user'
import type { AuthRepository } from '../domain/ports/auth-repository'
import type {
  LoginPayload,
  RegisterPayload,
  VerifyEmailOtpPayload,
  ForgotPasswordPayload,
  VerifyPasswordOtpPayload,
  ResetPasswordPayload,
  UpdateProfilePayload,
} from '../domain/models/auth'
import { toastService } from '../infrastructure/feedback/toast.service'
import { ApiError } from '../infrastructure/http/api-error'
import type { TokenStore } from '../infrastructure/http/token-store'
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, SESSION_COOKIE } from '../infrastructure/http/token-store'
import type { AuthBridge } from '../infrastructure/http/auth-bridge'
import type { AttachmentService } from './attachment.service'
import {
  resolveBusinessRole as resolveBusinessRoleFn,
  resolveBusinessRoleKey as resolveBusinessRoleKeyFn,
} from '../domain/models/business-role'
import { isPendingOrg, syncPendingOrgMarker } from '../utils/pending-org-marker'
import router from '../router'

export type AuthResult = { ok: true } | { ok: false; error: string }

const TINTS = [...USER_TINTS]

export interface StoredSession {
  accessToken: string
  refreshToken: string
  refreshTokenExpiryTime: string
  accessTokenExpiresAt: string
  user: User
}

const nameToUser = (raw: AuthResponseDto | UserProfileDto): User => {
  const id = 'userId' in raw ? raw.userId : (raw as AuthResponseDto).userId
  const fullName = raw.fullName
  const email = raw.email
  const seed = `${id}${email}`.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return {
    id,
    fullName,
    email,
    phoneNumber: 'phoneNumber' in raw ? (raw.phoneNumber ?? '') : null,
    phoneCode: 'phoneCode' in raw ? (raw.phoneCode ?? null) : null,
    profilePictureName: 'profilePictureName' in raw ? (raw.profilePictureName ?? null) : null,
    userType: raw.userType,
    language: raw.language,
    themeMode: normalizeThemeMode((raw as { themeMode?: unknown }).themeMode ?? (raw as { ThemeMode?: unknown }).ThemeMode ?? null),
    isEmailConfirmed: 'isEmailConfirmed' in raw ? Boolean((raw as UserProfileDto).isEmailConfirmed) : true,
    createdAt: 'createdAt' in raw ? String((raw as UserProfileDto).createdAt) : new Date().toISOString(),
    roles: raw.roles ?? [],
    companyId: (raw as AuthResponseDto).companyId ?? (raw as UserProfileDto).companyId ?? null,
    tint: TINTS[seed % TINTS.length] ?? '#0ea5e9',
  }
}

const decodeJwtExp = (token: string): number => {
  try {
    const parts = token.split('.')
    if (parts.length < 2 || !parts[1]) return Date.now() + 3_600_000
    const payload = JSON.parse(atob(parts[1])) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + 3_600_000
  } catch {
    return Date.now() + 3_600_000
  }
}

const toMessageKey = (err: unknown, fallback: MessageKey): MessageKey => {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 404:
        // Gateway routing 404 should surface as network/config error, not as invalid credentials.
        // Only forgotPassword uses 404 to mean email not found.
        if (fallback === 'auth.errEmailNotFound') return fallback
        return 'common.networkError'
      case 429:
        return 'auth.errTooManyAttempts'
      case 0:
        return 'auth.errNetwork'
      case 401:
        // For login, 401 means invalid credentials (user not found / wrong password / email not confirmed),
        // not session expiry. Preserve the caller's fallback for login.
        if (fallback === 'auth.errInvalidCredentials') return fallback
        return 'auth.errSessionExpired'
      case 500:
      case 502:
      case 503:
      case 504:
        return 'auth.errGeneric'
    }
  }
  return fallback
}

const toErrorMessage = (err: unknown, fallbackKey: MessageKey): string => {
  if (err instanceof ApiError) {
    // Map distributor gate keys to proper translations
    const distributorKeyMap: Record<string, MessageKey> = {
      'DistributorApplication.PendingApproval': 'distributor.pendingApproval',
      'DistributorApplication.NotApplied': 'distributor.notApplied',
      'DistributorApplication.CompanyNotApproved': 'distributor.companyNotApproved',
    }
    const checkDistributorKey = (msg: string | null | undefined): string | null => {
      if (!msg) return null
      for (const [k, v] of Object.entries(distributorKeyMap)) {
        if (msg.includes(k)) return t(v)
      }
      return null
    }
    const mapped = checkDistributorKey(err.message)
    if (mapped) return mapped
    if (err.errors) {
      for (const vals of Object.values(err.errors)) {
        for (const m of vals as string[]) {
          const mk = checkDistributorKey(m)
          if (mk) return mk
        }
      }
    }

    if (err.status === 404) {
      // Prefer server-provided message/errors for genuine 404s
      if (err.errors && Object.keys(err.errors).length > 0) {
        const msgs = Object.values(err.errors).flat().filter(Boolean)
        if (msgs.length > 0) return msgs.join(', ')
      }
      if (err.message && err.message !== 'Not found' && !err.message.startsWith('Request failed with status')) {
        return err.message
      }
      return t(toMessageKey(err, fallbackKey))
    }
    if (err.errors && Object.keys(err.errors).length > 0) {
      const msgs = Object.values(err.errors).flat().filter(Boolean)
      if (msgs.length > 0) return msgs.join(', ')
    }
    if (err.message && !err.message.startsWith('Request failed with status') && !err.message.includes('404')) {
      return err.message
    }
    return t(toMessageKey(err, fallbackKey))
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  return t(fallbackKey)
}

export class AuthService {
  readonly user = ref<User | null>(null)
  readonly isLoadingProfile = ref(false)

  private readonly authRepository: AuthRepository
  private readonly tokenStore: TokenStore
  private readonly authBridge: AuthBridge
  private readonly attachmentService?: AttachmentService

  private session: StoredSession | null = null
  private sessionTimer: ReturnType<typeof setInterval> | null = null
  private redirectingToLogin = false

  constructor(
    authRepository: AuthRepository,
    tokenStore: TokenStore,
    authBridge: AuthBridge,
    attachmentService?: AttachmentService,
  ) {
    this.authRepository = authRepository
    this.tokenStore = tokenStore
    this.authBridge = authBridge
    this.attachmentService = attachmentService

    this.restore()
    this.authBridge.bind({
      onSessionExpired: () => this.handleSessionExpired(),
    })
    this.startSessionWatcher()
    this.bindCrossTabSync()
  }

  /**
   * Keeps sibling tabs in sync through localStorage events:
   * - Session/tokens cleared elsewhere (logout in another tab) → log out here too.
   * - Tokens changed elsewhere → adopt them, then force logout if expired.
   */
  private bindCrossTabSync(): void {
    if (typeof window === 'undefined') return
    window.addEventListener('storage', (e: StorageEvent) => {
      if (!e.key || ![SESSION_COOKIE, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE].includes(e.key)) return
      if (e.newValue === null) {
        if (this.isAuthenticated) this.handleSessionExpired('auth.signedOutElsewhere')
      } else {
        this.tokenStore.reloadFromStorage()
        if (this.isAuthenticated && this.tokenStore.isAccessTokenExpired()) {
          this.handleSessionExpired()
        }
      }
    })
  }

  private startSessionWatcher(): void {
    if (typeof window === 'undefined') return
    if (this.sessionTimer) clearInterval(this.sessionTimer)
    // Expired access token → force logout; the user must sign in again.
    // There is intentionally no silent refresh.
    this.sessionTimer = setInterval(() => {
      if (!this.isAuthenticated) return
      if (this.tokenStore.isAccessTokenExpired()) {
        this.handleSessionExpired()
      }
    }, 30_000)
  }

  get isAuthenticated(): boolean {
    return this.user.value !== null
  }

  readonly isAdmin = computed(() => {
    const u = this.user.value
    if (!u) return false
    return u.roles.map((r) => r.toLowerCase()).includes('admin') || u.userType === 1
  })

  /** OrganizationUser — the B2B buyer / company user (UserType 2). */
  readonly isOrganizationUser = computed(() => {
    const u = this.user.value
    if (!u) return false
    return u.roles.map((r) => r.toLowerCase()).includes('organizationuser') || u.userType === 2
  })

  /** WelcoStaff — internal operations role (UserType 3). */
  readonly isWelcoStaff = computed(() => {
    const u = this.user.value
    if (!u) return false
    return u.roles.map((r) => r.toLowerCase()).includes('welcostaff') || u.userType === 3
  })

  /**
   * 4 business roles derived on top of the 3 backend UserTypes:
   * Admin, Provider/Distributor (OrgUser + company), Customer (buyer,
   * OrgUser without company), WelcoStaff. The Provider IS the Company
   * of a distributor / organization user (see business-role.ts).
   */
  private toBusinessCtx(company?: { id?: string | null; type?: number; status?: unknown } | null) {
    const u = this.user.value
    return {
      userType: u?.userType ?? null,
      roles: u?.roles ?? [],
      companyId: u?.companyId ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      company: (company ?? null) as any,
    }
  }

  /** Seller = internal roles that live in /admin console. */
  readonly isSeller = computed(() => this.isAdmin.value || this.isWelcoStaff.value)

  /** Suitable landing dashboard per role. Single source of truth for post-login + guestOnly redirects. */
  getDashboardRouteName(): string {
    if (this.isSeller.value) return 'admin-dashboard'
    if (this.isOrganizationUser.value) return 'account'
    return 'home'
  }

  /**
   * Validate a `?redirect=` target against the current role so login never
   * pushes a buyer into /admin (or a seller into /account) just to bounce.
   * Mirrors the guards in `src/router/index.ts`.
   */
  canAccessPath(path: string): boolean {
    if (!path || !path.startsWith('/')) return false
    const clean = path.split('?')[0]?.split('#')[0] ?? '/'
    if (clean.startsWith('/admin')) return this.isSeller.value
    if (clean.startsWith('/account') || clean === '/wishlist') return !this.isSeller.value && this.isAuthenticated
    if (clean === '/cart' || clean === '/checkout') return !this.isSeller.value
    return true
  }

  /** Pending org (no company + marker) has no dashboard yet — land on home. */
  isPendingApproval(): boolean {
    const u = this.user.value
    return !!u && this.isOrganizationUser.value && !u.companyId && isPendingOrg(u.email)
  }

  /** Obsolete Customer role — always false in current architecture. */
  readonly isCustomer = computed(() => false)

  /** Provider/Distributor — OrganizationUser. */
  readonly isProvider = computed(() => {
    const u = this.user.value
    if (!u) return false
    if (this.isAdmin.value || this.isWelcoStaff.value) return false
    return this.isOrganizationUser.value
  })

  /** Whether the signed-in user already has a linked provider company. */
  readonly hasLinkedCompany = computed(() => !!this.user.value?.companyId)

  /** Precise business role once the company detail is known (pass myCompany). */
  resolveBusinessRole(company?: { id?: string | null; type?: number; status?: unknown } | null) {
    return resolveBusinessRoleFn(this.toBusinessCtx(company))
  }

  /** i18n key (under `admin.*`) for the current business role. */
  resolveBusinessRoleKey(company?: { id?: string | null; type?: number; status?: unknown } | null) {
    return resolveBusinessRoleKeyFn(this.toBusinessCtx(company))
  }

  hasRole(role: string): boolean {
    return this.user.value?.roles.map((r) => r.toLowerCase()).includes(role.toLowerCase()) ?? false
  }

  async ensureValidSession(): Promise<boolean> {
    if (!this.user.value) return false
    // Expired access token → force logout; the user must sign in again.
    if (this.tokenStore.isAccessTokenExpired()) {
      this.handleSessionExpired()
      return false
    }
    return true
  }

  private restore(): void {
    const session = this.tokenStore.getSession<StoredSession>()
    if (session?.accessToken && session?.user) {
      this.tokenStore.setTokens({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        refreshTokenExpiryTime: session.refreshTokenExpiryTime,
      })
      // Stored access token already expired (e.g. returning after a long
      // absence) → drop the session; the user must sign in again.
      if (this.tokenStore.isAccessTokenExpired()) {
        this.expireSession()
        return
      }
      this.session = session
      this.user.value = session.user
      // Hydrate full profile (with profilePictureName) in background after restore
      if (typeof window !== 'undefined') {
        setTimeout(() => void this.loadProfile().catch(() => {}), 300)
      }
    } else if (this.tokenStore.hasAccessToken()) {
      if (this.tokenStore.isAccessTokenExpired()) {
        this.expireSession()
      }
    }
  }

  private persistSession(auth: AuthResponseDto): void {
    const user = nameToUser(auth)
    // Approval self-heals the pending-org marker (Customer vs pending org
    // can't be told apart by the backend — it has no Customer role).
    syncPendingOrgMarker(user)
    const accessExp = new Date(decodeJwtExp(auth.accessToken)).toISOString()
    this.session = {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      refreshTokenExpiryTime: auth.refreshTokenExpiryTime,
      accessTokenExpiresAt: accessExp,
      user,
    }
    this.user.value = user
    this.tokenStore.setTokens({
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      refreshTokenExpiryTime: auth.refreshTokenExpiryTime,
    })
    this.tokenStore.saveSession(this.session)
  }

  private updateUserFromProfile(profile: UserProfileDto): void {
    const user = nameToUser(profile)
    syncPendingOrgMarker(user)
    if (this.session) {
      this.session.user = user
      this.tokenStore.saveSession(this.session)
    }
    this.user.value = user
  }

  async register(payload: RegisterPayload): Promise<AuthResult> {
    try {
      await this.authRepository.register(payload)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: toErrorMessage(err, 'auth.errGeneric') }
    }
  }

  async login(payload: LoginPayload): Promise<AuthResult> {
    try {
      const data = await this.authRepository.login(payload)
      this.persistSession(data)
      toastService.success(t('auth.welcomeBackToast'))
      // Fetch full profile (with profilePictureName) right after login for header avatar
      void this.loadProfile().catch(() => {})
      return { ok: true }
    } catch (err) {
      return { ok: false, error: toErrorMessage(err, 'auth.errInvalidCredentials') }
    }
  }

  async verifyEmailOtp(payload: VerifyEmailOtpPayload): Promise<AuthResult> {
    try {
      const data = await this.authRepository.verifyEmailOtp(payload)
      if (data && typeof data === 'object') {
        const token = (data as { accessToken?: string; AccessToken?: string }).accessToken || (data as { accessToken?: string; AccessToken?: string }).AccessToken
        if (token && typeof token === 'string' && token.trim()) {
          this.persistSession(data)
        }
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: toErrorMessage(err, 'auth.errInvalidOtp') }
    }
  }

  async forgotPassword(payload: ForgotPasswordPayload): Promise<AuthResult> {
    try {
      await this.authRepository.forgotPassword(payload)
      return { ok: true }
    } catch (err) {
      const fallback = err instanceof ApiError && err.status === 404 ? 'auth.errEmailNotFound' : 'auth.errGeneric'
      return { ok: false, error: toErrorMessage(err, fallback) }
    }
  }

  async verifyPasswordOtp(payload: VerifyPasswordOtpPayload): Promise<AuthResult> {
    try {
      await this.authRepository.verifyPasswordOtp(payload)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: toErrorMessage(err, 'auth.errInvalidOtp') }
    }
  }

  async resetPassword(payload: ResetPasswordPayload): Promise<AuthResult> {
    try {
      await this.authRepository.resetPassword(payload)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: toErrorMessage(err, 'auth.errGeneric') }
    }
  }

  async loadProfile(): Promise<AuthResult & { profile?: UserProfileDto }> {
    if (!this.user.value) return { ok: false, error: t('auth.errSessionExpired') }
    this.isLoadingProfile.value = true
    try {
      const profile = await this.authRepository.getProfile()
      this.updateUserFromProfile(profile)
      return { ok: true, profile }
    } catch (err) {
      return { ok: false, error: toErrorMessage(err, 'auth.errGeneric') }
    } finally {
      this.isLoadingProfile.value = false
    }
  }

  async updateProfile(
    payload: UpdateProfilePayload,
    opts?: { silent?: boolean },
  ): Promise<AuthResult & { profile?: UserProfileDto }> {
    if (!this.user.value) return { ok: false, error: t('auth.errSessionExpired') }
    try {
      const profile = await this.authRepository.updateProfile(payload)
      this.updateUserFromProfile(profile)
      if (!opts?.silent) toastService.success(t('profile.savedToast'))
      return { ok: true, profile }
    } catch (err) {
      return { ok: false, error: toErrorMessage(err, 'auth.errGeneric') }
    }
  }

  /**
   * Upload a profile picture via the Attachment service (place = Users),
   * then persist the returned stored name on the profile.
   * Returns the new `profilePictureName`.
   */
  async uploadProfilePicture(
    file: File,
  ): Promise<AuthResult & { profilePictureName?: string }> {
    if (!this.user.value) return { ok: false, error: t('auth.errSessionExpired') }
    if (!this.attachmentService) return { ok: false, error: t('common.networkError') }
    const { MEDIA_TYPE } = await import('../config/api.config')
    const res = await this.attachmentService.upload({ file, place: 2, fileType: MEDIA_TYPE.IMAGE })
    if (!res.ok) return { ok: false, error: res.error }
    const storedName = res.data
    const update = await this.updateProfile({ profilePictureName: storedName })
    if (!update.ok) return { ok: false, error: update.error }
    return { ok: true, profilePictureName: storedName }
  }

  expireSession(): void {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer)
      this.sessionTimer = null
    }
    this.session = null
    this.user.value = null
    this.tokenStore.clear()
  }

  private handleSessionExpired(messageKey: MessageKey = 'auth.errSessionExpired'): void {
    const hadSession = this.user.value !== null
    this.expireSession()
    if (hadSession) toastService.info(t(messageKey))
    const current = router.currentRoute.value
    if (current.name === 'login' || this.redirectingToLogin) return
    this.redirectingToLogin = true
    void router
      .push({ name: 'login', query: { redirect: current.fullPath } })
      .finally(() => {
        this.redirectingToLogin = false
      })
  }

  async logout(): Promise<void> {
    const refreshToken = this.tokenStore.getRefreshToken()
    try {
      if (refreshToken) {
        await this.authRepository.logout({ refreshToken })
      }
    } catch {
      // ignore
    } finally {
      this.expireSession()
      toastService.info(t('auth.logoutToast'))
      await router.push({ name: 'login' })
    }
  }
}
