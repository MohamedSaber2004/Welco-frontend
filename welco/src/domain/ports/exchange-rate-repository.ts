import type { ConversionResultDto, ConvertCartTotalRequest, ConvertCartTotalResult, ExchangeRateDto, ExchangeRateSyncLogDto } from '../models/exchange-rate'

export interface ExchangeRateRepository {
  getLatest(base?: string): Promise<ExchangeRateDto[]>
  getPair(from: string, to: string): Promise<ExchangeRateDto | null>
  convert(amount: number, from: string, to: string): Promise<ConversionResultDto>
  convertCartTotal(payload: ConvertCartTotalRequest): Promise<ConvertCartTotalResult>
  getHistory(base: string, date: string): Promise<ExchangeRateDto[]>
  sync(): Promise<{ success: boolean; ratesCount: number; baseCurrency: string }>
  getSyncLogs(take?: number): Promise<ExchangeRateSyncLogDto[]>
}
