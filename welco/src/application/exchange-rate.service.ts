import { ref } from 'vue'
import type { ConversionResultDto, ConvertCartTotalRequest, ConvertCartTotalResult, ExchangeRateDto } from '../domain/models/exchange-rate'
import type { ExchangeRateRepository } from '../domain/ports/exchange-rate-repository'


export class ExchangeRateService {
  readonly latestRates = ref<Map<string, number>>(new Map())
  readonly lastUpdated = ref<string | null>(null)
  /** 'live' | null — lets UI badge whether backend rates are loaded. */
  readonly lastUpdatedSource = ref<'live' | null>(null)
  readonly loading = ref(false)

  constructor(private readonly repo: ExchangeRateRepository) {}

  private classify(_rates: ExchangeRateDto[]): 'live' {
    // Live only — every rate comes from the Welco backend (FastForex fetch-one).
    return 'live'
  }

  /** Live daily rates. No cache — every call hits the backend (FastForex fetch-one). */
  async loadLatest(base = 'USD'): Promise<Map<string, number>> {
    this.loading.value = true
    try {
      const rates = await this.repo.getLatest(base)
      if (rates.length) {
        const map = new Map<string, number>()
        for (const r of rates) map.set(r.targetCurrency.toUpperCase(), r.rate)
        const source = this.classify(rates)
        this.latestRates.value = map
        this.lastUpdated.value = new Date().toISOString()
        this.lastUpdatedSource.value = source
        return map
      }
      this.latestRates.value = new Map()
      this.lastUpdated.value = ''
      this.lastUpdatedSource.value = null
      return this.latestRates.value
    } catch {
      this.latestRates.value = new Map()
      this.lastUpdated.value = ''
      this.lastUpdatedSource.value = null
      return this.latestRates.value
    } finally {
      this.loading.value = false
    }
  }

  // Live conversion using fresh latest rates (no cache — extra API call each time)
  async convertLocal(amount: number, from: string, to: string, base = 'USD'): Promise<number> {
    from = from.toUpperCase().trim()
    to = to.toUpperCase().trim()
    base = base.toUpperCase().trim()
    if (from === to) return amount
    if (from === base) {
      const map = await this.loadLatest(base)
      const toRate = map.get(to)
      if (toRate == null) throw new Error(`Missing rate ${base}->${to}`)
      return amount * toRate
    }
    if (to === base) {
      const map = await this.loadLatest(base)
      const fromRate = map.get(from)
      if (fromRate == null) throw new Error(`Missing rate ${base}->${from}`)
      return amount * (1 / fromRate)
    }
    const map = await this.loadLatest(base)
    const fromRate = map.get(from)
    const toRate = map.get(to)
    if (fromRate == null || toRate == null) throw new Error(`Missing rate ${from} or ${to}`)
    return amount * (toRate / fromRate)
  }

  /** Live convert via backend (FastForex fetch-one). No cache — every call hits the API. */
  async convert(amount: number, from: string, to: string): Promise<ConversionResultDto> {
    try {
      return await this.repo.convert(amount, from, to)
    } catch {
      // fallback to live calc (still hits the API, no cache)
      const converted = await this.convertLocal(amount, from, to)
      return {
        amount,
        fromCurrency: from.toUpperCase(),
        toCurrency: to.toUpperCase(),
        rate: amount === 0 ? 1 : converted / amount,
        convertedAmount: converted,
        rateDate: new Date().toISOString().slice(0, 10),
        source: 'live',
      }
    }
  }

  /** Backend cart total: live rates for every line + ceiling total. No fallback here — caller decides. */
  async convertCartTotal(payload: ConvertCartTotalRequest): Promise<ConvertCartTotalResult> {
    return await this.repo.convertCartTotal(payload)
  }

  async getRate(from: string, to: string): Promise<number> {
    const res = await this.convert(1, from, to)
    return res.rate
  }

  /** Kept for callers (e.g. CartView refresh) — just resets live state, no cache to clear. */
  clearCache(): void {
    this.latestRates.value = new Map()
    this.lastUpdated.value = null
    this.lastUpdatedSource.value = null
  }
}
