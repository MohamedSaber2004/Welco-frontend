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
