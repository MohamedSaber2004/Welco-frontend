import { describe, it, expect, vi } from 'vitest'
import { ExchangeRateService } from '../exchange-rate.service'
import type { ExchangeRateRepository } from '../../domain/ports/exchange-rate-repository'

describe('ExchangeRateService (pure backend data)', () => {
  it('uses live rates from repository when available', async () => {
    const mockRepo: ExchangeRateRepository = {
      getLatest: vi.fn().mockResolvedValue([
        {
          id: 'rate-1',
          baseCurrency: 'USD',
          targetCurrency: 'EGP',
          rate: 51.5,
          rateDate: '2026-09-26',
          source: 'FastForex',
          fetchedAt: '2026-09-26T12:00:00Z',
        },
      ]),
      getPair: vi.fn(),
      convert: vi.fn().mockResolvedValue({
        amount: 100,
        fromCurrency: 'USD',
        toCurrency: 'EGP',
        rate: 51.5,
        convertedAmount: 5150,
        rateDate: '2026-09-26',
        source: 'FastForex',
      }),
      convertCartTotal: vi.fn(),
    }

    const svc = new ExchangeRateService(mockRepo)
    const map = await svc.loadLatest('USD')
    expect(map.get('EGP')).toBe(51.5)
    expect(svc.lastUpdatedSource.value).toBe('live')

    const res = await svc.convert(100, 'USD', 'EGP')
    expect(res.convertedAmount).toBe(5150)
    expect(res.source).toBe('FastForex')
  })

  it('propagates error when repository fails without injecting fallback data', async () => {
    const failingRepo: ExchangeRateRepository = {
      getLatest: vi.fn().mockRejectedValue(new Error('Network error or 400 Bad Request')),
      getPair: vi.fn().mockRejectedValue(new Error('Network error')),
      convert: vi.fn().mockRejectedValue(new Error('Network error')),
      convertCartTotal: vi.fn(),
    }

    const svc = new ExchangeRateService(failingRepo)
    await expect(svc.loadLatest('USD')).rejects.toThrow('Network error or 400 Bad Request')
    expect(svc.latestRates.value.size).toBe(0)
    expect(svc.lastUpdatedSource.value).toBeNull()

    await expect(svc.convert(310.8, 'USD', 'EGP')).rejects.toThrow('Network error')
  })
})
