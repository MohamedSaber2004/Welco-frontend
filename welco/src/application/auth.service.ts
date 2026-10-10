import { computed, ref } from 'vue'
import { t, type MessageKey } from '../i18n'
import { UserType, USER_TINTS, normalizeThemeMode, type User, type AuthResponseDto, type UserProfileDto } from '../domain/models/user'
import type { AuthRepository } from '../domain/ports/auth-repository'
import type {
  LoginPayload,
  RegisterPayload,
  ResendRegisterOtpPayload,
  VerifyEmailOtpPayload,
  ForgotPasswordPayload,
  VerifyPasswordOtpPayload,
  ResetPasswordPayload,
  UpdateProfilePayload,
} from '../domain/models/auth'
import { toastService } from '../infrastructure/feedback/toast.service'
import { normalizePhoneForServer } from '../utils/phone'
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

interface JwtClaims {
  sub?: string
  nameid?: string
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'?: string
  email?: string
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'?: string
  name?: string
  unique_name?: string
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'?: string
  role?: string | string[]
  roles?: string | string[]
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'?: string | string[]
  userType?: number | string
  UserType?: number | string
  companyId?: string
  CompanyId?: string
  exp?: number
  [key: string]: unknown
}

const decodeJwtPayload = (token?: string | null): JwtClaims | null => {
  if (!token || typeof token !== 'string') return null
  try {
    const parts = token.split('.')
    if (parts.length < 2 || !parts[1]) return null
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) base64 += '='
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
    return JSON.parse(json) as JwtClaims
  } catch {
    try {
      const parts = token.split('.')
      if (parts.length >= 2 && parts[1]) {
        return JSON.parse(atob(parts[1])) as JwtClaims
      }
    } catch {}
    return null
  }
}

const normalizeRolesList = (rolesInput: unknown): string[] => {
  if (!rolesInput) return []
  if (Array.isArray(rolesInput)) {
    return rolesInput.map((r) => String(r).trim()).filter(Boolean)
  }
  if (typeof rolesInput === 'string') {
    return rolesInput
      .split(/[,;|\s]+/)
      .map((r) => r.trim())
      .filter(Boolean)
  }
  return []
}

const parseUserType = (rawType: unknown, roles: string[]): UserType => {
  if (typeof rawType === 'number' && Number.isFinite(rawType)) {
    return rawType as UserType
  }
  if (typeof rawType === 'string' && rawType.trim()) {
    const n = Number(rawType.trim())
    if (Number.isFinite(n) && n > 0) return n as UserType
    const lower = rawType.trim().toLowerCase()
    if (lower.includes('admin') || lower === 'staff') return 1 as UserType
    if (['organizationuser', 'provider', 'distributor', 'supplier', 'seller', 'vendor'].some((k) => lower.includes(k))) {
      return 2 as UserType
    }
    if (lower.includes('client') || lower.includes('buyer') || lower.includes('customer')) {
      return 4 as UserType
    }
  }
  const lowerRoles = roles.map((r) => r.toLowerCase())
  if (lowerRoles.some((r) => r.includes('admin') || r === 'staff' || r === 'superadmin')) {
    return 1 as UserType
  }
  if (lowerRoles.some((r) => ['organizationuser', 'provider', 'distributor', 'supplier', 'seller', 'vendor'].some((k) => r.includes(k)))) {
    return 2 as UserType
  }
  return 4 as UserType
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nameToUser = (raw: AuthResponseDto | UserProfileDto | User | Record<string, any> | any, token?: string): User => {
  const rawObj = (raw || {}) as Record<string, any>
  const claims = decodeJwtPayload(token || (rawObj.accessToken as string) || (rawObj.AccessToken as string))

  const id =
    String(
      rawObj.userId ||
        rawObj.UserId ||
        rawObj.id ||
        rawObj.Id ||
        claims?.sub ||
        claims?.nameid ||
        claims?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ||
        '',
    )

  const email =
    String(
      rawObj.email ||
        rawObj.Email ||
        claims?.email ||
        claims?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
        '',
    )

  const fullName =
    String(
      rawObj.fullName ||
        rawObj.FullName ||
        rawObj.name ||
        rawObj.Name ||
        claims?.name ||
        claims?.unique_name ||
        claims?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
        email ||
        'User',
    )

  const combinedRoles = Array.from(
    new Set([
      ...normalizeRolesList(rawObj.roles),
      ...normalizeRolesList(rawObj.Roles),
      ...normalizeRolesList(claims?.role),
      ...normalizeRolesList(claims?.roles),
      ...normalizeRolesList(claims?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']),
    ]),
  )

  const rawUserType = rawObj.userType ?? rawObj.UserType ?? claims?.userType ?? claims?.UserType
  const userType = parseUserType(rawUserType, combinedRoles)

  const companyId =
    (rawObj.companyId as string) ||
    (rawObj.CompanyId as string) ||
    (claims?.companyId as string) ||
    (claims?.CompanyId as string) ||
    null

  const seed = `${id}${email}`.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)

  return {
    id,
    fullName,
    email,
    phoneNumber: ((rawObj.phoneNumber || rawObj.PhoneNumber) as string) ?? null,
    phoneCode: ((rawObj.phoneCode || rawObj.PhoneCode) as string) ?? null,
    profilePictureName: ((rawObj.profilePictureName || rawObj.ProfilePictureName) as string) ?? null,
    userType,
    language: ((rawObj.language ?? rawObj.Language) as number) ?? 1,
    themeMode: normalizeThemeMode(rawObj.themeMode ?? rawObj.ThemeMode ?? null),
    isEmailConfirmed: 'isEmailConfirmed' in rawObj ? Boolean(rawObj.isEmailConfirmed) : true,
    createdAt: (rawObj.createdAt as string) || (rawObj.CreatedAt as string) || new Date().toISOString(),
    roles: combinedRoles,
    companyId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    company: ((rawObj.company || rawObj.Company) as any) || null,
    tint: TINTS[seed % TINTS.length] ?? '#0ea5e9',
  }
}

const decodeJwtExp = (token: string): number => {
  try {
    const payload = decodeJwtPayload(token)
    return typeof payload?.exp === 'number' ? payload.exp * 1000 : Date.now() + 3_600_000
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

    const isSamePasswordError = (msg: string | null | undefined): boolean => {
      if (!msg) return false
      const lower = msg.toLowerCase()
      return (
        lower.includes('same password') ||
        lower.includes('previous password') ||
        lower.includes('current password') ||
        lower.includes('cannot reuse') ||
        lower.includes('password history') ||
        lower.includes('cannot be the same') ||
        lower.includes('نفس كلمة المرور') ||
        lower.includes('كلمة المرور السابقة') ||
        lower.includes('كلمة المرور الحالية')
      )
    }
    if (isSamePasswordError(err.message)) return t('auth.errPasswordSameAsCurrent')
    if (err.errors) {
      for (const vals of Object.values(err.errors)) {
        for (const m of vals as string[]) {
          if (isSamePasswordError(m)) return t('auth.errPasswordSameAsCurrent')
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
    // Expired access token → try silent refresh first; force logout only when refresh fails.
    this.sessionTimer = setInterval(() => {
      void (async () => {
        if (!this.isAuthenticated) return
        if (this.redirectingToLogin) return
        if (this.tokenStore.isAccessTokenExpired()) {
          const refreshed = await this.trySilentRefresh()
          if (!refreshed) this.handleSessionExpired()
        }
      })()
    }, 30_000)
  }

  get isAuthenticated(): boolean {
    return this.user.value !== null
  }

  readonly isAdmin = computed(() => {
    const u = this.user.value
    if (!u) return false
    const lowerRoles = (u.roles || []).map((r) => String(r).toLowerCase())
    return (
      lowerRoles.some((r) => r.includes('admin') || r === 'staff' || r === 'superadmin') ||
      Number(u.userType) === 1
    )
  })

  readonly isOrganizationUser = computed(() => {
    const u = this.user.value
    if (!u) return false
    const lowerRoles = (u.roles || []).map((r) => String(r).toLowerCase())
    return (
      lowerRoles.some((r) =>
        ['organizationuser', 'provider', 'distributor', 'supplier', 'seller', 'vendor'].some(
          (k) => r.includes(k),
        ),
      ) ||
      Number(u.userType) === 2 ||
      Boolean(u.companyId || u.company?.id)
    )
  })

  /** Provider / Distributor — the seller supplying goods on the platform. */
  readonly isProvider = computed(() => {
    const u = this.user.value
    if (!u) return false
    if (this.isAdmin.value) return false
    return (
      this.isOrganizationUser.value ||
      Boolean(u.companyId || u.company?.id)
    )
  })

  /** Client — the buyer purchasing products on the site. */
  readonly isClient = computed(() => {
    const u = this.user.value
    if (!u) return false
    if (this.isAdmin.value || this.isProvider.value) return false
    return true
  })

  /** Buyer = Client */
  readonly isBuyer = computed(() => this.isClient.value)

  /** Seller = Provider (supplies goods to the platform) */
  readonly isSeller = computed(() => this.isProvider.value)

  /** Staff = Admin or Sales (internal platform management) */
  readonly isStaff = computed(() => this.isAdmin.value)

  /**
   * 4 business roles derived on top of the backend UserTypes:
   * Admin, Sales, Provider (Seller), Client (Buyer).
   */
  private toBusinessCtx(company?: { id?: string | null; type?: number; status?: unknown } | null) {
    const u = this.user.value
    return {
      userType: u?.userType ?? null,
      roles: u?.roles ?? [],
      companyId: u?.companyId ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      company: (company ?? u?.company ?? null) as any,
    }
  }

  /** Suitable landing dashboard per role. Single source of truth for post-login + guestOnly redirects. */
  getDashboardRouteName(): string {
    if (this.isAdmin.value) return 'admin-dashboard'
    if (this.isProvider.value) return 'provider-quotes'
    if (this.isClient.value) return 'account'
    return 'home'
  }

  /**
   * Validate a `?redirect=` target against the current role so login never
   * pushes a buyer into /admin or /provider (or a seller into /account) just to bounce.
   * Mirrors the guards in `src/router/index.ts`.
   */
  canAccessPath(path: string): boolean {
    if (!path || !path.startsWith('/')) return false
    const clean = path.split('?')[0]?.split('#')[0] ?? '/'
    if (clean.startsWith('/admin')) return this.isAdmin.value
    if (clean.startsWith('/provider')) return this.isProvider.value || this.isAdmin.value
    if (clean.startsWith('/account') || clean === '/wishlist') return this.isClient.value && this.isAuthenticated
    if (clean === '/cart' || clean === '/checkout') return this.isClient.value
    return true
  }

  /** Pending org (no company + marker) has no dashboard yet — land on home. */
  isPendingApproval(): boolean {
    const u = this.user.value
    return !!u && this.isOrganizationUser.value && !u.companyId && isPendingOrg(u.email)
  }

  /** Whether the signed-in user already has a linked provider company. */
  readonly hasLinkedCompany = computed(() => !!(this.user.value?.companyId || this.user.value?.company?.id))

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
    // Proactive silent rotation when the access token is expiring soon
    // (5 min window); falls back to force logout when refresh fails.
    const accessToken = this.tokenStore.getAccessToken()
    if (accessToken) {
      const expSec = Math.floor(decodeJwtExp(accessToken) / 1000)
      if (this.tokenStore.isExpiringSoon(expSec)) {
        const refreshed = await this.trySilentRefresh()
        if (refreshed) return true
      }
    }
    // Expired access token → force logout; the user must sign in again.
    if (this.tokenStore.isAccessTokenExpired()) {
      this.handleSessionExpired()
      return false
    }
    return true
  }

  private async trySilentRefresh(): Promise<boolean> {
    try {
      const refreshToken = this.tokenStore.getRefreshToken()
      if (!refreshToken || this.tokenStore.isRefreshTokenExpired()) return false
      const data = await this.authRepository.refreshToken({ refreshToken })
      if (!data?.accessToken) return false
      this.tokenStore.setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || refreshToken,
        refreshTokenExpiryTime:
          data.refreshTokenExpiryTime || this.tokenStore.getRefreshTokenExpiryTime(),
      })
      if (this.session) {
        this.session.accessToken = data.accessToken
        this.session.refreshToken = data.refreshToken || refreshToken
        this.session.refreshTokenExpiryTime =
          data.refreshTokenExpiryTime || this.session.refreshTokenExpiryTime
        this.session.accessTokenExpiresAt = new Date(decodeJwtExp(data.accessToken)).toISOString()
        this.tokenStore.saveSession(this.session)
      }
      return true
    } catch {
      return false
    }
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
      this.user.value = nameToUser(session.user, session.accessToken)
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
    const user = nameToUser(auth, auth.accessToken)
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
    const token = this.tokenStore.getAccessToken() || this.session?.accessToken
    const user = nameToUser(profile, token)
    syncPendingOrgMarker(user)
    if (this.session) {
      this.session.user = user
      this.tokenStore.saveSession(this.session)
    }
    // Skip replacement when nothing changed: every replacement notifies all
    // `user` watchers app-wide, and any watcher that writes back (e.g. theme
    // persistence) would otherwise ping-pong into an infinite request loop.
    const prev = this.user.value
    if (prev && JSON.stringify(prev) === JSON.stringify(user)) return
    this.user.value = user
  }

  async register(payload: RegisterPayload): Promise<AuthResult> {
    try {
      // Send the canonical phone form so the backend's uniqueness check matches
      // regardless of how the number was typed ("+971 50 123 4567" vs "00971...").
      const normalized: RegisterPayload = {
        ...payload,
        phoneNumber: normalizePhoneForServer(payload.phoneNumber),
      }
      await this.authRepository.register(normalized)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: toErrorMessage(err, 'auth.errGeneric') }
    }
  }

  async resendRegisterOtp(payload: ResendRegisterOtpPayload): Promise<AuthResult> {
    try {
      await this.authRepository.resendRegisterOtp(payload)
      toastService.success(t('auth.codeSent'))
      return { ok: true }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return { ok: false, error: t('auth.errEmailNotFound') }
      }
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
