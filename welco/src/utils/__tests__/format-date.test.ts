import { describe, it, expect } from 'vitest'
import { parseServerDate, formatDateTime } from '../format'

describe('parseServerDate and formatDateTime', () => {
  it('parses timestamps with trailing Z as UTC', () => {
    const d = parseServerDate('2026-10-15T14:40:38Z')
    expect(d.toISOString()).toBe('2026-10-15T14:40:38.000Z')
  })

  it('treats naive server timestamps without timezone as UTC', () => {
    const d = parseServerDate('2026-10-15T14:40:38')
    expect(d.toISOString()).toBe('2026-10-15T14:40:38.000Z')
  })

  it('preserves timestamps that already include timezone offset', () => {
    const d = parseServerDate('2026-10-15T14:40:38+02:00')
    expect(d.toISOString()).toBe('2026-10-15T12:40:38.000Z')
  })

  it('produces identical formatted time for ISO strings with or without Z', () => {
    const formattedWithZ = formatDateTime('2026-10-15T14:40:38Z', 'en')
    const formattedWithoutZ = formatDateTime('2026-10-15T14:40:38', 'en')
    expect(formattedWithoutZ).toBe(formattedWithZ)
  })

  it('handles null and undefined gracefully', () => {
    expect(formatDateTime(null, 'en')).toBe('')
    expect(formatDateTime(undefined, 'en')).toBe('')
  })
})
