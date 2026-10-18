import { describe, it, expect } from 'vitest'
import { parseServerDate, formatDateTime, formatTicketReplyDate } from '../format'

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

describe('formatTicketReplyDate', () => {
  it('clamps to createdAt when repliedAt is earlier than createdAt', () => {
    // Ticket created on 9/8/2026, reply mistakenly dated 9/5/2026
    const createdAt = '2026-09-08T10:00:00Z'
    const repliedAt = '2026-09-05T10:00:00Z'

    const result = formatTicketReplyDate(repliedAt, createdAt, 'en')
    const expected = formatDateTime(createdAt, 'en')

    expect(result).toBe(expected)
    expect(result).not.toContain('Sep 05')
    expect(result).toContain('Sep 08')
  })

  it('formats repliedAt normally when repliedAt is after createdAt', () => {
    const createdAt = '2026-09-08T10:00:00Z'
    const repliedAt = '2026-09-09T14:30:00Z'

    const result = formatTicketReplyDate(repliedAt, createdAt, 'en')
    const expected = formatDateTime(repliedAt, 'en')

    expect(result).toBe(expected)
    expect(result).toContain('Sep 09')
  })


  it('handles missing repliedAt gracefully', () => {
    expect(formatTicketReplyDate(null, '2026-09-08T10:00:00Z', 'en')).toBe('')
    expect(formatTicketReplyDate(undefined, '2026-09-08T10:00:00Z', 'en')).toBe('')
  })

  it('formats repliedAt when createdAt is null or undefined', () => {
    const repliedAt = '2026-09-09T14:30:00Z'
    expect(formatTicketReplyDate(repliedAt, null, 'en')).toBe(formatDateTime(repliedAt, 'en'))
  })
})

