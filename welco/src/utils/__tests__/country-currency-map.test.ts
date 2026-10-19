import { describe, it, expect } from 'vitest'
import {
  currencyCodeForCountry,
  currencySymbolForCountry,
  currencyForAddressCountry,
  currencySymbolForAddressCountry,
  distinctCurrenciesFromAddresses,
  resolveCurrencyCountry,
  type CountryRef,
  type CurrencyRef,
} from '../country-currency-map'

describe('country-currency-map dynamic resolution', () => {
  const backendCurrencies: CurrencyRef[] = [
    {
      id: 'c-1',
      code: 'EGP',
      symbol: 'EGP',
      symbolNative: 'ج.م.',
      nameEn: 'Egyptian Pound',
      nameAr: 'جنيه مصري',
      countryCode: 'EG',
    },
    {
      id: 'c-2',
      code: 'SAR',
      symbol: 'SAR',
      symbolNative: 'ر.س.',
      nameEn: 'Saudi Riyal',
      nameAr: 'ريال سعودي',
      countryCode: 'SA',
    },
    {
      id: 'c-3',
      code: 'AED',
      symbol: 'AED',
      symbolNative: 'د.إ',
      nameEn: 'UAE Dirham',
      nameAr: 'درهم إماراتي',
      countryCode: 'AE',
    },
    {
      id: 'c-4',
      code: 'USD',
      symbol: '$',
      symbolNative: '$',
      nameEn: 'US Dollar',
      nameAr: 'دولار أمريكي',
      countryCode: 'US',
    },
    {
      id: 'c-5',
      code: 'EUR',
      symbol: '€',
      symbolNative: '€',
      nameEn: 'Euro',
      nameAr: 'يورو',
      countryCode: 'EU',
    },
  ]

  const countries: CountryRef[] = [
    {
      id: 'country-eg',
      code: 'EG',
      nameEn: 'Egypt',
      nameAr: 'مصر',
      currencyCode: 'EGP',
      currencySymbol: 'EGP',
      currencySymbolNative: 'ج.م.',
    },
    {
      id: 'country-sa',
      code: 'SA',
      nameEn: 'Saudi Arabia',
      nameAr: 'المملكة العربية السعودية',
      currencyCode: 'SAR',
      currencySymbol: 'SAR',
      currencySymbolNative: 'ر.س.',
    },
    {
      id: 'country-ae',
      code: 'AE',
      nameEn: 'United Arab Emirates',
      nameAr: 'الإمارات العربية المتحدة',
      // Simulating a country without direct currencyCode, resolved via backend currencies list
    },
    {
      id: 'country-de',
      code: 'DE',
      nameEn: 'Germany',
      nameAr: 'ألمانيا',
      // Eurozone member
    },
    {
      id: 'country-us',
      code: 'US',
      nameEn: 'United States',
      nameAr: 'الولايات المتحدة',
      currencyCode: 'USD',
      currencySymbol: '$',
      currencySymbolNative: '$',
    },
  ]

  it('resolves currency code directly from backend CountryDto fields', () => {
    expect(currencyCodeForCountry(countries[0], backendCurrencies)).toBe('EGP')
    expect(currencyCodeForCountry(countries[1], backendCurrencies)).toBe('SAR')
    expect(currencyCodeForCountry(countries[4], backendCurrencies)).toBe('USD')
  })

  it('resolves currency code dynamically from backend currencies when CountryDto has no direct currencyCode', () => {
    // UAE has code 'AE' and no direct currencyCode, should match backendCurrencies with countryCode 'AE'
    expect(currencyCodeForCountry(countries[2], backendCurrencies)).toBe('AED')
  })

  it('resolves Eurozone countries to EUR dynamically', () => {
    expect(currencyCodeForCountry(countries[3], backendCurrencies)).toBe('EUR')
  })

  it('resolves dynamic currency symbols in Arabic and English based on country', () => {
    // Egypt
    expect(currencySymbolForCountry(countries[0], backendCurrencies, 'ar')).toBe('ج.م.')
    expect(currencySymbolForCountry(countries[0], backendCurrencies, 'en')).toBe('EGP')

    // Saudi Arabia
    expect(currencySymbolForCountry(countries[1], backendCurrencies, 'ar')).toBe('ر.س.')
    expect(currencySymbolForCountry(countries[1], backendCurrencies, 'en')).toBe('SAR')

    // UAE (resolved via currencies list)
    expect(currencySymbolForCountry(countries[2], backendCurrencies, 'ar')).toBe('د.إ')
    expect(currencySymbolForCountry(countries[2], backendCurrencies, 'en')).toBe('AED')

    // Germany (Eurozone resolved to EUR)
    expect(currencySymbolForCountry(countries[3], backendCurrencies, 'ar')).toBe('€')
    expect(currencySymbolForCountry(countries[3], backendCurrencies, 'en')).toBe('€')
  })

  it('resolves currency code and symbol for address countryId', () => {
    expect(currencyForAddressCountry(countries, 'country-eg', backendCurrencies)).toBe('EGP')
    expect(currencySymbolForAddressCountry(countries, 'country-eg', backendCurrencies, 'ar')).toBe('ج.م.')
    expect(currencySymbolForAddressCountry(countries, 'country-ae', backendCurrencies, 'ar')).toBe('د.إ')
  })

  it('extracts distinct currencies from address list dynamically', () => {
    const addresses = [
      { countryId: 'country-eg' },
      { countryId: 'country-sa' },
      { countryId: 'country-ae' },
      { countryId: 'country-eg' }, // duplicate country
    ]

    const distinct = distinctCurrenciesFromAddresses(addresses, countries, backendCurrencies)
    expect(distinct).toEqual(['EGP', 'SAR', 'AED'])
  })

  it('resolves currency country with flag and symbol for CurrencySelect', () => {
    const resolved = resolveCurrencyCountry('SAR', backendCurrencies, countries, 'ar')
    expect(resolved.code).toBe('SAR')
    expect(resolved.countryCode).toBe('SA')
    expect(resolved.symbol).toBe('ر.س.')
    expect(resolved.countryNameAr).toBe('المملكة العربية السعودية')
  })
})
