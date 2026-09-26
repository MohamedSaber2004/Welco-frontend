export const formatDate = (iso: string, locale = 'en'): string => {
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export const truncate = (text: string, max = 60): string =>
  text.length > max ? `${text.slice(0, max)}…` : text

export const formatCurrency = (value: number, locale = 'en', currency = 'USD'): string => {
  try {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return value.toFixed(2)
  }
}

export const formatPrice = (value: number, locale = 'en'): string => {
  const safeLocale = locale === 'ar' || locale?.startsWith('ar') ? 'ar-EG' : 'en-US'
  try {
    return new Intl.NumberFormat(safeLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return Number(value).toFixed(2)
  }
}

export const formatCurrencySymbol = (value: number, locale = 'en', symbol = '$'): string => {
  return `${symbol}${value.toFixed(2)}`
}
