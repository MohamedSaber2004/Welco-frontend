import { ref } from 'vue'
import type { ConversionResultDto, ConvertCartTotalRequest, ConvertCartTotalResult } from '../domain/models/exchange-rate'
import type { ExchangeRateRepository } from '../domain/ports/exchange-rate-repository'

export class ExchangeRateService {
  readonly latestRates = ref<Map<string, number>>(new Map())
  readonly lastUpdated = ref<string | null>(null)
  /** 'live' | null — reflects whether live backend rates are currently loaded. */
  readonly lastUpdatedSource = ref<'live' | null>(null)
  readonly loading = ref(false)

  constructor(private readonly repo: ExchangeRateRepository) {}

  /** Daily rates loaded directly from backend endpoints with no fallback. */
  async loadLatest(base = 'USD'): Promise<Map<string, number>> {
    this.loading.value = true
    try {
      const rates = await this.repo.getLatest(base)
      const map = new Map<string, number>()
      for (const r of rates) {
        if (r && r.targetCurrency && typeof r.rate === 'number') {
          map.set(r.targetCurrency.toUpperCase(), r.rate)
        }
      }
      this.latestRates.value = map
      this.lastUpdated.value = new Date().toISOString()
      this.lastUpdatedSource.value = map.size > 0 ? 'live' : null
      return map
    } finally {
      this.loading.value = false
    }
  }

  /** Conversion using latest loaded backend rates. */
  async convertLocal(amount: number, from: string, to: string, base = 'USD'): Promise<number> {
    from = from.toUpperCase().trim()
    to = to.toUpperCase().trim()
    base = base.toUpperCase().trim()
    if (from === to) return amount

    const map = this.latestRates.value.size > 0 ? this.latestRates.value : await this.loadLatest(base)
    const fromRate = from === base ? 1 : map.get(from)
    const toRate = to === base ? 1 : map.get(to)
    if (fromRate != null && toRate != null && fromRate > 0) {
      return amount * (toRate / fromRate)
    }
    throw new Error(`Unable to convert from ${from} to ${to}: live exchange rate not available`)
  }

  /** Convert via backend endpoint. */
  async convert(amount: number, from: string, to: string): Promise<ConversionResultDto> {
    return await this.repo.convert(amount, from, to)
  }

  /** Backend cart total: live rates for every line + ceiling total. */
  async convertCartTotal(payload: ConvertCartTotalRequest): Promise<ConvertCartTotalResult> {
    return await this.repo.convertCartTotal(payload)
  }

  async getRate(from: string, to: string): Promise<number> {
    const f = from.toUpperCase().trim()
    const tt = to.toUpperCase().trim()
    if (f === tt) return 1
    const pair = await this.repo.getPair(f, tt)
    if (pair) return pair.rate
    const res = await this.convert(1, f, tt)
    return res.rate
  }

  /** Resets live state. */
  clearCache(): void {
    this.latestRates.value = new Map()
    this.lastUpdated.value = null
    this.lastUpdatedSource.value = null
  }
}
