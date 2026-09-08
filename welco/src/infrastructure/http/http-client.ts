import { locale, t } from '../../i18n'
import { API_BASE_URL, AUTH_ROUTES, isAbsoluteUrl } from '../../config/api.config'
import { requestTracker } from '../../application/request.tracker'
import { ApiError, GENERIC_OK_MESSAGES, type ApiEnvelope } from './api-error'
import type { TokenStore } from './token-store'
import type { AuthBridge } from './auth-bridge'
import type { ModalService } from '../feedback/modal.service'

export interface HttpClientDependencies {
  tokenStore: TokenStore
  authBridge: AuthBridge
  feedback: ModalService
}

export interface RequestOptions {
  headers?: Record<string, string>
  showFeedback?: boolean
  onUploadProgress?: (progress: number) => void
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

const NO_FEEDBACK_PATHS = [AUTH_ROUTES.login, AUTH_ROUTES.logout]

const MAX_RATE_LIMIT_WAIT_MS = 10_000
const MAX_429_RETRIES = 2
const MAX_429_WAIT_MS = 10_000

const isMutation = (method: HttpMethod): boolean => method !== 'GET'

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

class FixedWindowLimiter {
  private count = 0
  private windowStart = Date.now()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  acquire(): number {
    const now = Date.now()
    if (now - this.windowStart >= this.windowMs) {
      this.windowStart = now
      this.count = 0
    }
    if (this.count < this.limit) {
      this.count += 1
      return 0
    }
    return this.windowStart + this.windowMs - now
  }
}

export class HttpClient {
  private readonly tokenStore: TokenStore
  private readonly authBridge: AuthBridge
  private readonly feedback: ModalService

  private maxConcurrency = 4
  private inFlightCount = 0
  private waitQueue: (() => void)[] = []

  private rateLimiters: Record<string, FixedWindowLimiter> = {
    login: new FixedWindowLimiter(3, 60_000),
    general: new FixedWindowLimiter(60, 60_000),
  }

  private dedupeMap = new Map<string, Promise<unknown>>()

  constructor(dependencies: HttpClientDependencies) {
    this.tokenStore = dependencies.tokenStore
    this.authBridge = dependencies.authBridge
    this.feedback = dependencies.feedback
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'GET', undefined, options)
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'POST', body, options)
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'PUT', body, options)
  }

  del<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'DELETE', undefined, options)
  }

  private resolveUrl(path: string): string {
    const rawUrl = isAbsoluteUrl(path) ? path : `${API_BASE_URL}${path}`
    // Backend validation strictly enforces [Range(1, 50)] on pageSize across all paginated endpoints.
    // Clamp any pageSize > 50 to 50 to prevent 400 Bad Request.
    if (rawUrl.includes('pageSize=')) {
      return rawUrl.replace(/pageSize=(\d+)/gi, (match, size) => {
        const num = parseInt(size, 10)
        return num > 50 ? 'pageSize=50' : match
      })
    }
    return rawUrl
  }

  private async request<T>(
    path: string,
    method: HttpMethod,
    body: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const { headers: extraHeaders, showFeedback, onUploadProgress } = options
    const mutation = isMutation(method)
    const wantsFeedback = showFeedback ?? mutation
    // For absolute URLs compare on pathname so gateway/product hosts share routing rules
    const routingPath = isAbsoluteUrl(path) ? (() => { try { return new URL(path).pathname } catch { return path } })() : path
    const silentPath = NO_FEEDBACK_PATHS.some((candidate) => routingPath.startsWith(candidate))

    // Expired access token → force logout before sending; the user must
    // sign in again. There is intentionally no silent refresh, so the
    // request below goes out anonymous (GET resolves to a safe empty
    // result, mutations surface the 401 as an error).
    if (this.tokenStore.hasAccessToken() && this.tokenStore.isAccessTokenExpired()) {
      this.tokenStore.clear()
      this.authBridge.onSessionExpired()
    }

    const headers: Record<string, string> = { ...extraHeaders, 'Accept-Language': locale.value }
    if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'

    const activeToken = this.tokenStore.getAccessToken()
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`

    const buildBody = () =>
      body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined

    const doFetch = (): Promise<Response> => {
      if (onUploadProgress && body instanceof FormData) {
        return this.uploadWithProgress(this.resolveUrl(path), method, body, headers, onUploadProgress)
      }
      const controller = new AbortController()
      const timeoutMs = method === 'GET' ? 15000 : 20000
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      return fetch(this.resolveUrl(path), {
        method,
        headers,
        body: buildBody(),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId))
    }

    const run = async (): Promise<T> => {
      await this.waitForRateLimit(path)

      for (let attempt = 0; ; attempt++) {
        let response: Response
        try {
          response = await doFetch()
        } catch (e) {
          const isAbort = e instanceof DOMException && (e as DOMException).name === 'AbortError'
          const msg = isAbort ? 'Request timed out — gateway is slow' : 'Unable to reach the server'
          const error = new ApiError(0, msg)
          if (wantsFeedback && !isAbort) this.feedback.showError(isAbort ? msg : t('common.networkError'))
          throw error
        }

        // A 401 against an expired access token means the session is dead →
        // force logout; the user must sign in again. Anonymous requests (no
        // stored token) and the login/logout endpoints never trigger this.
        // A 401 against a still-valid token is an endpoint permission quirk —
        // surface the error without logging the user out.
        if (
          response.status === 401 &&
          !silentPath &&
          this.tokenStore.hasAccessToken() &&
          this.tokenStore.isAccessTokenExpired()
        ) {
          this.tokenStore.clear()
          this.authBridge.onSessionExpired()
        }

        // ── Silent 401 for GET requests (public/auth data without valid session) ──
        // Return a safe empty paginated result so callers don't crash.
        if (response.status === 401 && method === 'GET') {
          const emptyResult = {
            isSuccess: false,
            data: [] as unknown[],
            totalCount: 0,
            pageNumber: 1,
            pageSize: 10,
            totalPages: 0,
            hasPreviousPage: false,
            hasNextPage: false,
            message: null,
            statusCode: 401,
          } as unknown as T
          return emptyResult
        }

        if (response.status === 429 && attempt < MAX_429_RETRIES) {
          const retryAfter = response.headers.get('Retry-After')
          const parsed = retryAfter ? Number(retryAfter) * 1000 : 1000 * 2 ** attempt
          const delayMs = Number.isFinite(parsed) ? Math.min(parsed, MAX_429_WAIT_MS) : 1000
          await sleep(delayMs)
          continue
        }

        // Detect HTML (gateway 404/502 returns text/html) — don't try JSON parse
        const contentType = response.headers.get('content-type') || ''
        const isHtml = contentType.includes('text/html')
        let raw: Record<string, unknown> | null = null
        if (isHtml) {
          const text = await response.text().catch(() => '')
          raw = { message: text.slice(0, 500) || `Gateway returned HTML (${response.status})`, status: response.status } as unknown as Record<string, unknown>
        } else {
          raw = (await response.json().catch(() => null)) as Record<string, unknown> | null
          // If json parse failed but body is HTML, capture it
          if (raw === null) {
            const text = await response.text().catch(() => '')
            if (text && text.trim().startsWith('<')) {
              raw = { message: `Gateway returned HTML (${response.status})`, status: response.status } as unknown as Record<string, unknown>
            }
          }
        }

        // Unified envelope: supports Welco Result {isSuccess, data, message, errors, statusCode}
        // as well as ASP.NET ProblemDetails {title, detail, status, errors} and plain data
        const pick = (obj: Record<string, unknown>, ...keys: string[]): unknown => {
          for (const k of keys) {
            if (k in obj && obj[k] !== undefined && obj[k] !== null) return obj[k]
          }
          return undefined
        }

        const normalizeErrors = (value: unknown): Record<string, string[]> | null => {
          if (!value) return null
          if (Array.isArray(value)) return { general: value as string[] }
          if (typeof value === 'object') return value as Record<string, string[]>
          return { general: [String(value)] }
        }

        let envelope: ApiEnvelope<T>
        if (raw !== null && typeof raw === 'object') {
          const hasWelco = 'isSuccess' in raw || 'IsSuccess' in raw || 'success' in raw
          const errorsRaw = pick(raw, 'errors', 'Errors')
          const rawMessage = (pick(raw, 'message', 'Message', 'detail', 'Detail', 'title', 'Title') as string | null) ?? null
          if (hasWelco) {
            const success = (pick(raw, 'isSuccess', 'IsSuccess', 'success', 'Success') as boolean) ?? response.ok
            const data = pick(raw, 'data', 'Data') as T
            const statusCode = (pick(raw, 'statusCode', 'StatusCode', 'status', 'Status') as number) ?? response.status
            envelope = { success: Boolean(success), errors: normalizeErrors(errorsRaw), data: data ?? null, message: rawMessage, statusCode }
          } else {
            envelope = {
              success: response.ok,
              errors: normalizeErrors(errorsRaw),
              data: raw as T,
              message: rawMessage,
              statusCode: (pick(raw, 'status', 'Status') as number) ?? response.status,
            }
          }
        } else {
          envelope = { success: response.ok, errors: null, data: raw as T, message: null, statusCode: response.status }
        }

        if (!response.ok || !envelope.success) {
          const flatErrors = envelope.errors
          const errorListStr = flatErrors ? Object.values(flatErrors).flat().filter(Boolean).join(', ') : null
          const errorMessage =
            envelope.message ||
            errorListStr ||
            (response.status === 404 ? 'Not found' : response.status >= 500 ? 'Server error. Please try again later' : `Request failed with status ${response.status}`)
          const error = new ApiError(response.status, errorMessage, flatErrors ?? {})
          if (wantsFeedback) this.feedback.showError(error.message)
          throw error
        }

        if (wantsFeedback && !silentPath) {
          const message =
            envelope.message && !GENERIC_OK_MESSAGES.has(envelope.message)
              ? envelope.message
              : t('common.operationDone')
          this.feedback.showSuccess(message)
        }

        // If raw is a PaginatedResult envelope (contains totalCount or TotalCount), return the full paginated object
        if (raw !== null && typeof raw === 'object' && ('totalCount' in raw || 'TotalCount' in raw)) {
          return {
            ...raw,
            isSuccess: envelope.success,
            totalCount: (pick(raw, 'totalCount', 'TotalCount') as number) ?? 0,
            totalPages: (pick(raw, 'totalPages', 'TotalPages') as number) ?? 1,
            pageNumber: (pick(raw, 'pageNumber', 'PageNumber') as number) ?? 1,
            pageSize: (pick(raw, 'pageSize', 'PageSize') as number) ?? 10,
            data: ((pick(raw, 'data', 'Data') as unknown[]) ?? []) as unknown,
          } as T
        }

        // Handle case where data is null but envelope itself is the data (plain array/object)
        if (envelope.data === null && raw !== null && typeof raw === 'object' && !('data' in raw) && !('Data' in raw)) {
          return raw as T
        }
        return envelope.data as T
      }
    }

    if (method === 'GET') {
      const langHeader = headers['Accept-Language'] ?? locale.value
      const dedupeKey = `${method} ${path} [${langHeader}]`
      const existing = this.dedupeMap.get(dedupeKey) as Promise<T> | undefined
      if (existing) return existing
      const promise = this.tracked(() => this.withSlot(run))
      this.dedupeMap.set(dedupeKey, promise)
      void promise
        .finally(() => {
          if (this.dedupeMap.get(dedupeKey) === promise) this.dedupeMap.delete(dedupeKey)
        })
        .catch(() => undefined)
      return promise
    }

    return this.tracked(() => this.withSlot(run))
  }

  private uploadWithProgress(
    url: string,
    method: HttpMethod,
    form: FormData,
    headers: Record<string, string>,
    onProgress: (ratio: number) => void,
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open(method, url)
      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value)
      }
      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable && e.total > 0) {
          const ratio = Math.min(1, e.loaded / e.total)
          onProgress(ratio)
        }
      }
      xhr.onload = () => {
        const headersObj = new Headers()
        const rawHeaders = xhr.getAllResponseHeaders()
        for (const line of rawHeaders.trim().split(/[\r\n]+/)) {
          const idx = line.indexOf(':')
          if (idx > 0) headersObj.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim())
        }
        resolve(
          new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: headersObj,
          }),
        )
      }
      xhr.onerror = () => reject(new Error('Network request failed'))
      xhr.onabort = () => reject(new Error('Request aborted'))
      xhr.timeout = 120_000
      xhr.send(form)
    })
  }

  private async tracked<T>(run: () => Promise<T>): Promise<T> {
    requestTracker.begin()
    try {
      return await run()
    } finally {
      requestTracker.settle()
    }
  }

  private async withSlot<T>(run: () => Promise<T>): Promise<T> {
    await this.acquireSlot()
    try {
      return await run()
    } finally {
      this.releaseSlot()
    }
  }

  private acquireSlot(): Promise<void> {
    if (this.inFlightCount < this.maxConcurrency) {
      this.inFlightCount += 1
      return Promise.resolve()
    }
    return new Promise((resolve) => this.waitQueue.push(resolve))
  }

  private releaseSlot(): void {
    this.inFlightCount -= 1
    const next = this.waitQueue.shift()
    if (next) next()
  }

  private policyForPath(path: string): string {
    const routingPath = isAbsoluteUrl(path) ? (() => { try { return new URL(path).pathname } catch { return path } })() : path
    if (routingPath.startsWith(AUTH_ROUTES.login)) return 'login'
    return 'general'
  }

  private async waitForRateLimit(path: string): Promise<void> {
    const waitMs = this.rateLimiters[this.policyForPath(path)]?.acquire() ?? 0
    if (waitMs <= 0) return
    if (waitMs > MAX_RATE_LIMIT_WAIT_MS) throw new ApiError(429, 'Rate limit exceeded', {}, true)
    await sleep(waitMs)
  }
}
