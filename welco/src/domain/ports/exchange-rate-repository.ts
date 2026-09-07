import type { ConversionResultDto, ExchangeRateDto } from '../models/exchange-rate'

export interface ExchangeRateRepository {
  getLatest(base?: string): Promise<ExchangeRateDto[]>
  getPair(from: string, to: string): Promise<ExchangeRateDto | null>
  convert(amount: number, from: string, to: string): Promise<ConversionResultDto>
  getHistory(base: string, date: string): Promise<ExchangeRateDto[]>
  sync(): Promise<{ success: boolean; ratesCount: number; baseCurrency: string }>
}
