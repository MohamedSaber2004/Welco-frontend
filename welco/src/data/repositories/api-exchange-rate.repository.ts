import { EXCHANGE_RATE_ROUTES, PRODUCT_API_BASE_URL } from '../../config/api.config'
import type { ConversionResultDto, ConvertCartTotalRequest, ConvertCartTotalResult, ExchangeRateDto, ExchangeRateSyncLogDto } from '../../domain/models/exchange-rate'
import type { ExchangeRateRepository } from '../../domain/ports/exchange-rate-repository'
import type { HttpClient } from '../../infrastructure/http/http-client'
import { ApiError } from '../../infrastructure/http/api-error'

function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if ('data' in obj && obj.data) return obj.data as T
    if ('Data' in obj && obj.Data) return obj.Data as T
    // Result wrapper with .Data
    if ('isSuccess' in obj && 'data' in obj) return obj.data as T
  }
  return raw as T
}

function normalizeList(raw: unknown): ExchangeRateDto[] {
  const data = unwrap<ExchangeRateDto[] | { data: ExchangeRateDto[] }>(raw)
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object' && 'data' in (data as Record<string, unknown>)) {
    const inner = (data as Record<string, unknown>).data
    if (Array.isArray(inner)) return inner as ExchangeRateDto[]
  }
  // Handle Result wrapper with array inside
  if (Array.isArray((raw as Record<string, unknown>)?.data)) return (raw as Record<string, unknown>).data as ExchangeRateDto[]
  return []
}

export class ApiExchangeRateRepository implements ExchangeRateRepository {
  constructor(private readonly http: HttpClient) {}

  private productUrl(path: string): string {
    return `${PRODUCT_API_BASE_URL}${path}`
  }

  /** Try paths in order, return first success; throw last error if all fail. */
  private async getFirst(paths: string[]): Promise<unknown> {
    let lastErr: unknown = null
    for (const p of paths) {
      try {
        return await this.http.get<unknown>(p, { showFeedback: false })
      } catch (e) {
        lastErr = e
        // Only fall through on "route/data missing" style failures; anything
        // else (e.g. rate-limited 429 already retried inside HttpClient) also falls
        // through — public fallback still gives the user working prices.
        if (e instanceof ApiError && ![0, 400, 401, 404, 500, 502, 503].includes(e.status)) throw e
      }
    }
    throw lastErr
  }

  async getLatest(base = 'USD'): Promise<ExchangeRateDto[]> {
    const upper = base.toUpperCase()
    const gatewayPath =
      upper === 'USD' ? EXCHANGE_RATE_ROUTES.latest : EXCHANGE_RATE_ROUTES.latestByBase(upper)
    const candidates = [gatewayPath, this.productUrl(gatewayPath)]
    try {
      const raw = await this.getFirst(candidates)
      return normalizeList(raw)
    } catch {
      return []
    }
  }

  async getPair(from: string, to: string): Promise<ExchangeRateDto | null> {
    const f = from.toUpperCase()
    const tt = to.toUpperCase()
    if (f === tt) {
      return {
        id: `pair-${f}-${tt}`,
        baseCurrency: f,
        targetCurrency: tt,
        rate: 1,
        rateDate: new Date().toISOString().slice(0, 10),
        source: 'identity',
        fetchedAt: new Date().toISOString(),
      }
    }
    try {
      const raw = await this.getFirst([
        EXCHANGE_RATE_ROUTES.pair(f, tt),
        this.productUrl(EXCHANGE_RATE_ROUTES.pair(f, tt)),
      ])
      return unwrap<ExchangeRateDto>(raw)
    } catch { /* derive from latest table below */ }
    // Derive cross-rate from the latest table (backend pair endpoint 400s when
    // its DB has no seeded rates — same root cause as /latest 500).
    try {
      const latest = await this.getLatest(f)
      const hit = latest.find((r) => r.targetCurrency.toUpperCase() === tt)
      if (hit) return hit
      // Cross via USD when direct base table lacks the pair
      if (f !== 'USD') {
        const usd = await this.getLatest('USD')
        const fromRate = usd.find((r) => r.targetCurrency.toUpperCase() === f)?.rate
        const toRate = usd.find((r) => r.targetCurrency.toUpperCase() === tt)?.rate
        if (fromRate && toRate && fromRate > 0) {
          return {
            id: `cross-${f}-${tt}`,
            baseCurrency: f,
            targetCurrency: tt,
            rate: toRate / fromRate,
            rateDate: new Date().toISOString().slice(0, 10),
            source: 'cross-usd',
            fetchedAt: new Date().toISOString(),
          }
        }
      }
    } catch { /* null below */ }
    return null
  }

  async convert(amount: number, from: string, to: string): Promise<ConversionResultDto> {
    const f = from.toUpperCase()
    const tt = to.toUpperCase()
    const qs = new URLSearchParams({ from: f, to: tt, amount: String(amount) }).toString()
    try {
      const raw = await this.getFirst([
        `${EXCHANGE_RATE_ROUTES.convert}?${qs}`,
        this.productUrl(`${EXCHANGE_RATE_ROUTES.convert}?${qs}`),
      ])
      return unwrap<ConversionResultDto>(raw)
    } catch {
      // Local fallback: compute from latest table so callers still get a price
      // instead of surfacing the backend 400/500 to the shopper.
      const pair = await this.getPair(f, tt)
      if (pair) {
        // Backend-compatible fallback rounding (AwayFromZero, 2dp).
        const rounded = (Math.sign(amount * pair.rate) * Math.round(Math.abs(amount * pair.rate) * 100 + 1e-9)) / 100
        return {
          amount,
          fromCurrency: f,
          toCurrency: tt,
          rate: pair.rate,
          convertedAmount: rounded,
          rateDate: pair.rateDate,
          source: pair.source,
        }
      }
      throw new ApiError(0, 'Unable to reach the server')
    }
  }

  async convertCartTotal(payload: ConvertCartTotalRequest): Promise<ConvertCartTotalResult> {
    const candidates = [
      this.productUrl(EXCHANGE_RATE_ROUTES.cartTotal),
      EXCHANGE_RATE_ROUTES.cartTotal,
    ];
    let lastErr: unknown = null
    for (const p of candidates) {
      try {
        const raw = await this.http.post<unknown>(p, payload, { showFeedback: false })
        return unwrap<ConvertCartTotalResult>(raw)
      } catch (e) {
        lastErr = e
      }
    }
    throw lastErr
  }

  async getHistory(base: string, date: string): Promise<ExchangeRateDto[]> {
    try {
      const raw = await this.getFirst([
        EXCHANGE_RATE_ROUTES.history(base, date),
        this.productUrl(EXCHANGE_RATE_ROUTES.history(base, date)),
      ])
      const data = unwrap<ExchangeRateDto[] | { data: ExchangeRateDto[] }>(raw)
      if (Array.isArray(data)) return data
      return []
    } catch {
      return []
    }
  }

  async sync(): Promise<{ success: boolean; ratesCount: number; baseCurrency: string }> {
    // Sync is an admin op that must go through the gateway (auth). No public
    // fallback — surface the backend error so ops sees it.
    const raw = await this.http.post<unknown>(EXCHANGE_RATE_ROUTES.sync, {})
    const unwrapped = unwrap<Record<string, unknown>>(raw)
    return {
      success: Boolean((unwrapped as Record<string, unknown>)?.success ?? (unwrapped as Record<string, unknown>)?.isSuccess ?? true),
      ratesCount: Number((unwrapped as Record<string, unknown>)?.ratesCount ?? 0),
      baseCurrency: String((unwrapped as Record<string, unknown>)?.baseCurrency ?? 'USD'),
    }
  }

  async getSyncLogs(take = 20): Promise<ExchangeRateSyncLogDto[]> {
    const qs = `?take=${take}`
    const candidates = [
      `${EXCHANGE_RATE_ROUTES.syncLogs}${qs}`,
      this.productUrl(`${EXCHANGE_RATE_ROUTES.syncLogs}${qs}`),
    ]
    try {
      const raw = await this.getFirst(candidates)
      const list = unwrap<ExchangeRateSyncLogDto[]>(raw)
      if (Array.isArray(list)) return list
      if (list && typeof list === 'object' && Array.isArray((list as Record<string, unknown>).data)) {
        return (list as Record<string, unknown>).data as ExchangeRateSyncLogDto[]
      }
      return []
    } catch {
      return []
    }
  }
}
