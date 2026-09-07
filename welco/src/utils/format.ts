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
