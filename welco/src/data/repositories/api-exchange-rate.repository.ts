import { EXCHANGE_RATE_ROUTES } from '../../config/api.config'
import type { ConversionResultDto, ConvertCartTotalRequest, ConvertCartTotalResult, ExchangeRateDto } from '../../domain/models/exchange-rate'
import type { ExchangeRateRepository } from '../../domain/ports/exchange-rate-repository'
import type { HttpClient } from '../../infrastructure/http/http-client'

function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if ('data' in obj && obj.data) return obj.data as T
    if ('Data' in obj && obj.Data) return obj.Data as T
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
  if (Array.isArray((raw as Record<string, unknown>)?.data)) return (raw as Record<string, unknown>).data as ExchangeRateDto[]
  return []
}

export class ApiExchangeRateRepository implements ExchangeRateRepository {
  constructor(private readonly http: HttpClient) {}

  /** Live daily rates from backend (FastForex fetch-one). Only loads real data from backend. */
  async getLatest(base = 'USD'): Promise<ExchangeRateDto[]> {
    const upper = base.toUpperCase()
    const gatewayPath =
      upper === 'USD' ? EXCHANGE_RATE_ROUTES.latest : EXCHANGE_RATE_ROUTES.latestByBase(upper)
    const raw = await this.http.get<unknown>(gatewayPath, { showFeedback: false })
    return normalizeList(raw)
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
    const raw = await this.http.get<unknown>(EXCHANGE_RATE_ROUTES.pair(f, tt), { showFeedback: false })
    const pair = unwrap<ExchangeRateDto>(raw)
    return pair && pair.rate > 0 ? pair : null
  }

  /** Live convert via backend. Only loads real data from backend. */
  async convert(amount: number, from: string, to: string): Promise<ConversionResultDto> {
    const f = from.toUpperCase()
    const tt = to.toUpperCase()
    if (f === tt) {
      return {
        amount,
        fromCurrency: f,
        toCurrency: tt,
        rate: 1,
        convertedAmount: amount,
        rateDate: new Date().toISOString().slice(0, 10),
        source: 'identity',
      }
    }
    const qs = new URLSearchParams({ from: f, to: tt, amount: String(amount) }).toString()
    const raw = await this.http.get<unknown>(`${EXCHANGE_RATE_ROUTES.convert}?${qs}`, { showFeedback: false })
    return unwrap<ConversionResultDto>(raw)
  }

  async convertCartTotal(payload: ConvertCartTotalRequest): Promise<ConvertCartTotalResult> {
    const raw = await this.http.post<unknown>(EXCHANGE_RATE_ROUTES.cartTotal, payload, { showFeedback: false })
    return unwrap<ConvertCartTotalResult>(raw)
  }
}
