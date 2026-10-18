
export interface CountryRef {
  id: string
  code?: string | null
  nameEn?: string | null
  nameAr?: string | null
  currencyCode?: string | null
  currencySymbol?: string | null
  currencySymbolNative?: string | null
  currencyId?: string | null
  currency?: CurrencyRef | null
}

export interface CurrencyRef {
  id?: string | null
  code?: string | null
  symbol?: string | null
  symbolNative?: string | null
  nameEn?: string | null
  nameAr?: string | null
  countryCode?: string | null
  countryId?: string | null
}

export interface AddressRef {
  countryId: string
  countryCode?: string | null
  currencyCode?: string | null
}

export interface ResolvedCurrency {
  code: string
  currencyNameEn: string
  currencyNameAr: string
  countryCode: string
  countryNameEn: string
  countryNameAr: string
  flag: string
  symbol: string
}

const EUROZONE_CODES = new Set([
  'AT', 'BE', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES', 'EU',
])

export function normalizeCurrencyCode(code?: string | null): string {
  return (code ?? '').trim().toUpperCase()
}

export function getFlagEmoji(countryCode?: string | null): string {
  if (!countryCode) return '🌐'
  const upper = countryCode.trim().toUpperCase()
  if (upper === 'EU') return '🇪🇺'
  if (upper.length !== 2) return '🌐'
  const offset = 127397
  return String.fromCodePoint(...[...upper].map((c) => c.charCodeAt(0) + offset))
}

function readLinkCurrencyCode(ref?: CountryRef | CurrencyRef | AddressRef | null): string {
  if (!ref) return ''
  const withLink = ref as CountryRef & CurrencyRef & AddressRef & {
    currency?: CurrencyRef | null
  }
  return normalizeCurrencyCode(withLink.currencyCode ?? withLink.currency?.code ?? null)
}

export function currencyCodeForCountry(
  country?: CountryRef | null,
  currencies?: CurrencyRef[] | null,
): string | null {
  if (!country) return null
  const direct = readLinkCurrencyCode(country)
  if (direct) return direct
  const cCode = (country.code ?? '').trim().toUpperCase()
  if (!cCode) return null

  if (currencies && currencies.length > 0) {
    const match = currencies.find(
      (c) => (c.countryCode ?? '').trim().toUpperCase() === cCode,
    )
    if (match?.code) return normalizeCurrencyCode(match.code)
  }

  if (EUROZONE_CODES.has(cCode)) return 'EUR'

  if (currencies && currencies.length > 0) {
    const isoMatch = currencies.find(
      (c) => (c.code ?? '').trim().toUpperCase().startsWith(cCode),
    )
    if (isoMatch?.code) return normalizeCurrencyCode(isoMatch.code)
  }

  return null
}

export function currencySymbolForCountry(
  country?: CountryRef | null,
  currencies?: CurrencyRef[] | null,
  locale = 'en',
): string {
  if (!country) return '$'
  const isAr = locale === 'ar' || locale?.startsWith('ar')

  if (isAr && country.currencySymbolNative) {
    return country.currencySymbolNative.trim()
  }
  if (country.currencySymbol) {
    return country.currencySymbol.trim()
  }
  if (country.currencySymbolNative) {
    return country.currencySymbolNative.trim()
  }

  const code = currencyCodeForCountry(country, currencies)
  if (code && currencies && currencies.length > 0) {
    const curr = findCurrencyByCode(currencies, code)
    if (curr) return currencyDisplaySymbol(curr, locale)
  }

  return code || '$'
}

export function currencyForAddressCountry(
  countries: CountryRef[],
  countryId: string,
  currencies?: CurrencyRef[] | null,
): string | null {
  const c = countries.find((x) => x.id === countryId)
  return currencyCodeForCountry(c ?? null, currencies)
}

export function currencySymbolForAddressCountry(
  countries: CountryRef[],
  countryId: string,
  currencies?: CurrencyRef[] | null,
  locale = 'en',
): string {
  const c = countries.find((x) => x.id === countryId)
  return currencySymbolForCountry(c ?? null, currencies, locale)
}

export function distinctCurrenciesFromAddresses(
  addresses: AddressRef[],
  countries: CountryRef[],
  currencies?: CurrencyRef[] | null,
): string[] {
  const set = new Set<string>()
  for (const a of addresses) {
    const direct = readLinkCurrencyCode(a)
    if (direct) {
      set.add(direct)
      continue
    }
    const viaCountry = currencyForAddressCountry(countries, a.countryId, currencies)
    if (viaCountry) set.add(viaCountry.toUpperCase())
  }
  return [...set]
}

export function findCurrencyByCode<T extends CurrencyRef>(
  currencies: T[],
  code?: string | null,
): T | undefined {
  const upper = normalizeCurrencyCode(code)
  if (!upper) return undefined
  return currencies.find((c) => normalizeCurrencyCode(c.code) === upper)
}

export function currencyDisplaySymbol(currency?: CurrencyRef | null, locale = 'en'): string {
  if (!currency) return '$'
  const code = normalizeCurrencyCode(currency.code)
  const sym = (currency.symbol ?? '').trim()
  const nat = (currency.symbolNative ?? '').trim()
  const isAr = locale === 'ar' || locale?.startsWith('ar')
  if (isAr) return nat || sym || code || '$'
  return sym || nat || code || '$'
}

export function resolveCurrencyCountry(
  currencyCode?: string | null,
  currencies: CurrencyRef[] = [],
  countries: CountryRef[] = [],
  locale = 'en',
): ResolvedCurrency {
  const code = normalizeCurrencyCode(currencyCode)
  const currency = findCurrencyByCode(currencies, code)
  const linkedCountry = code
    ? countries.find((c) => readLinkCurrencyCode(c) === code)
    : undefined
  const linkedByCurrency =
    !linkedCountry && currency?.countryCode
      ? countries.find(
          (c) => (c.code ?? '').trim().toUpperCase() === normalizeCurrencyCode(currency.countryCode),
        )
      : undefined
  const linkedByEuro =
    !linkedCountry && !linkedByCurrency && code === 'EUR'
      ? countries.find((c) => EUROZONE_CODES.has((c.code ?? '').trim().toUpperCase()))
      : undefined
  const country = linkedCountry ?? linkedByCurrency ?? linkedByEuro

  const currencyNameEn = (currency?.nameEn ?? '').trim() || code
  const currencyNameAr = (currency?.nameAr ?? '').trim() || currencyNameEn
  const countryCode = (country?.code ?? currency?.countryCode ?? '').trim().toUpperCase()
  const countryNameEn = (country?.nameEn ?? '').trim()
  const countryNameAr = (country?.nameAr ?? '').trim() || countryNameEn

  return {
    code,
    currencyNameEn,
    currencyNameAr,
    countryCode,
    countryNameEn,
    countryNameAr,
    flag: countryCode ? getFlagEmoji(countryCode) : '🌐',
    symbol: currencyDisplaySymbol(currency ?? { code }, locale),
  }
}
