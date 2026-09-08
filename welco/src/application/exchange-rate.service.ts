import { ref } from 'vue'
import type { ConversionResultDto, ExchangeRateDto, ExchangeRateSyncLogDto } from '../domain/models/exchange-rate'
import type { ExchangeRateRepository } from '../domain/ports/exchange-rate-repository'


const STATIC_USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.86,
  GBP: 0.74,
  AED: 3.6725,
  SAR: 3.75,
  PKR: 278,
  INR: 94.5,
  CNY: 6.71,
  CAD: 1.38,
  AUD: 1.39,
  CHF: 0.81,
  JPY: 156,
  EGP: 49,
  QAR: 3.64,
  KWD: 0.31,
  BHD: 0.376,
  OMR: 0.385,
  JOD: 0.71,
  TRY: 48.4,
}

function staticRates(base: string): Map<string, number> {
  const upper = base.toUpperCase().trim()
  const map = new Map<string, number>()
  if (upper === 'USD') {
    for (const [code, rate] of Object.entries(STATIC_USD_RATES)) map.set(code, rate)
    return map
  }
  const baseRate = STATIC_USD_RATES[upper]
  if (!baseRate) return map
  for (const [code, usdRate] of Object.entries(STATIC_USD_RATES)) {
    if (code === upper) continue
    map.set(code, usdRate / baseRate)
  }
  return map
}

export class ExchangeRateService {
  readonly latestRates = ref<Map<string, number>>(new Map())
  readonly lastUpdated = ref<string | null>(null)
  /** 'live' | 'public' | 'static' | null — lets UI badge offline rates honestly. */
  readonly lastUpdatedSource = ref<'live' | 'public' | 'static' | null>(null)
  readonly loading = ref(false)
  readonly syncLogs = ref<ExchangeRateSyncLogDto[]>([])
  readonly syncing = ref(false)
  readonly loadingLogs = ref(false)
  private cache = new Map<string, { rates: Map<string, number>; fetchedAt: number; source: 'live' | 'public' | 'static' }>()
  private readonly TTL_MS = 60 * 60 * 1000 // 60 min for live rates
  private readonly FALLBACK_TTL_MS = 10 * 60 * 1000 // 10 min negative-cache so we don't spam a broken backend

  constructor(private readonly repo: ExchangeRateRepository) {}

  private cacheKey(base: string): string { return `latest:${base.toUpperCase()}` }

  private classify(rates: ExchangeRateDto[]): 'live' | 'public' {
    if (!rates.length) return 'live'
    const src = (rates[0]?.source ?? '').toLowerCase()
    if (src.includes('er-api') || src.includes('frankfurter') || src.startsWith('public-')) return 'public'
    return 'live'
  }

  async loadLatest(base = 'USD'): Promise<Map<string, number>> {
    const key = this.cacheKey(base)
    const cached = this.cache.get(key)
    if (cached) {
      const ttl = cached.source === 'live' ? this.TTL_MS : this.FALLBACK_TTL_MS
      if (Date.now() - cached.fetchedAt < ttl) {
        this.latestRates.value = new Map(cached.rates)
        this.lastUpdatedSource.value = cached.source
        return this.latestRates.value
      }
    }
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
        this.cache.set(key, { rates: new Map(map), fetchedAt: Date.now(), source })
        return map
      }
      // Backend + public providers both empty -> static table (still cached briefly)
      const fallback = staticRates(base)
      this.latestRates.value = fallback
      this.lastUpdated.value = new Date().toISOString()
      this.lastUpdatedSource.value = 'static'
      this.cache.set(key, { rates: new Map(fallback), fetchedAt: Date.now(), source: 'static' })
      return fallback
    } catch {
      // fallback to cached or static
      if (cached) {
        this.latestRates.value = new Map(cached.rates)
        this.lastUpdatedSource.value = cached.source
        return this.latestRates.value
      }
      const fallback = staticRates(base)
      this.latestRates.value = fallback
      this.lastUpdatedSource.value = 'static'
      this.cache.set(key, { rates: new Map(fallback), fetchedAt: Date.now(), source: 'static' })
      return fallback
    } finally {
      this.loading.value = false
    }
  }

  // Local conversion using cached latest rates + base=USD logic (no extra API call)
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

  async convert(amount: number, from: string, to: string): Promise<ConversionResultDto> {
    // Try server-side convert for precision / correct rounding per currency
    try {
      return await this.repo.convert(amount, from, to)
    } catch {
      // fallback to local calc
      const converted = await this.convertLocal(amount, from, to)
      return {
        amount,
        fromCurrency: from.toUpperCase(),
        toCurrency: to.toUpperCase(),
        rate: amount === 0 ? 1 : converted / amount,
        convertedAmount: converted,
        rateDate: new Date().toISOString().slice(0, 10),
        source: this.lastUpdatedSource.value === 'live' ? 'local-cache' : (this.lastUpdatedSource.value ?? 'local-cache'),
      }
    }
  }

  async getRate(from: string, to: string): Promise<number> {
    const res = await this.convert(1, from, to)
    return res.rate
  }

  clearCache(): void {
    this.cache.clear()
    this.latestRates.value = new Map()
    this.lastUpdated.value = null
    this.lastUpdatedSource.value = null
  }

  async fetchSyncLogs(take = 20): Promise<ExchangeRateSyncLogDto[]> {
    this.loadingLogs.value = true
    try {
      const logs = await this.repo.getSyncLogs(take)
      this.syncLogs.value = logs
      return logs
    } finally {
      this.loadingLogs.value = false
    }
  }

  async enqueueHangfireSync(): Promise<{ isSuccess: boolean; data?: string; message?: string }> {
    this.syncing.value = true
    try {
      const res = await this.repo.syncEnqueue()
      this.cache.clear()
      setTimeout(() => { void this.fetchSyncLogs() }, 1000)
      setTimeout(() => { void this.fetchSyncLogs(); void this.loadLatest('USD') }, 3500)
      return res
    } finally {
      this.syncing.value = false
    }
  }

  async triggerDirectSync(): Promise<{ success: boolean; ratesCount: number; baseCurrency: string }> {
    this.syncing.value = true
    try {
      const res = await this.repo.sync()
      this.cache.clear()
      await Promise.all([this.fetchSyncLogs(), this.loadLatest('USD')])
      return res
    } finally {
      this.syncing.value = false
    }
  }
}
