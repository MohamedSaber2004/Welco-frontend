export interface ExchangeRateDto {
  id: string
  baseCurrency: string
  targetCurrency: string
  rate: number
  rateDate: string
  source: string
  fetchedAt: string
}

export interface ConversionResultDto {
  amount: number
  fromCurrency: string
  toCurrency: string
  rate: number
  convertedAmount: number
  rateDate: string
  source: string
}

export interface CurrencyRateMap {
  [code: string]: number
}

export interface LatestRatesResponse {
  isSuccess: boolean
  data: ExchangeRateDto[]
  count: number
  baseCurrency?: string
}

export type SyncStatusType = 'Pending' | 'Success' | 'Failed' | 'Partial'

export interface ExchangeRateSyncLogDto {
  id: string
  baseCurrency: string
  status: number | SyncStatusType
  ratesCount: number
  source: string
  startedAt: string
  completedAt?: string | null
  errorMessage?: string | null
  createdAt?: string
}

