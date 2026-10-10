export const parseServerDate = (isoOrDate: string | Date | undefined | null): Date => {
  if (!isoOrDate) return new Date()
  if (isoOrDate instanceof Date) return isoOrDate
  let str = String(isoOrDate).trim()
  if (!str) return new Date()
  if (!str.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(str)) {
    str += '+03:00'
  }
  const d = new Date(str)
  return isNaN(d.getTime()) ? new Date(isoOrDate) : d
}

export const formatDate = (iso: string | Date | undefined | null, locale = 'en'): string => {
  try {
    const d = parseServerDate(iso)
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d)
  } catch {
    return String(iso || '')
  }
}

export const formatDateTime = (iso: string | Date | undefined | null, locale = 'en'): string => {
  try {
    const d = parseServerDate(iso)
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return String(iso || '')
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
