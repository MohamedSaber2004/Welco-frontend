import { describe, it, expect } from 'vitest'
import { deduplicateLogs } from '../audit-dedupe'
import type { AuditLogDto } from '../../domain/models/audit-log'

describe('deduplicateLogs', () => {
  it('returns empty array when list is empty or invalid', () => {
    expect(deduplicateLogs([])).toEqual([])
    expect(deduplicateLogs(null as unknown as AuditLogDto[])).toEqual([])
  })

  it('filters duplicate records by id', () => {
    const list: AuditLogDto[] = [
      { id: '1', entityName: 'Product', action: 'CREATE', createdAt: '2026-10-15T12:00:00Z' },
      { id: '1', entityName: 'Product', action: 'CREATE', createdAt: '2026-10-15T12:00:00Z' },
    ]
    const res = deduplicateLogs(list)
    expect(res).toHaveLength(1)
    expect(res[0]?.id).toBe('1')
  })

  it('filters near-duplicate records within 3 seconds for same entity and action', () => {
    const list: AuditLogDto[] = [
      {
        id: '1',
        entityName: 'UserRefreshToken',
        entityId: 'tok-1',
        action: 'Create',
        performedBy: 'System',
        createdAt: '2026-10-15T14:13:22.8647462Z',
      },
      {
        id: '2',
        entityName: 'UserRefreshToken',
        entityId: 'tok-1',
        action: 'Create',
        performedBy: 'System',
        createdAt: '2026-10-15T14:13:22.8645746Z',
      },
    ]
    const res = deduplicateLogs(list)
    expect(res).toHaveLength(1)
    expect(res[0]?.id).toBe('1')
  })

  it('preserves distinct records across different entities or times', () => {
    const list: AuditLogDto[] = [
      {
        id: '1',
        entityName: 'UserRefreshToken',
        entityId: 'tok-1',
        action: 'Create',
        performedBy: 'System',
        createdAt: '2026-10-15T14:13:22Z',
      },
      {
        id: '2',
        entityName: 'ApplicationUser',
        entityId: 'usr-1',
        action: 'Update',
        performedBy: 'usr-1',
        createdAt: '2026-10-15T14:13:46Z',
      },
    ]
    const res = deduplicateLogs(list)
    expect(res).toHaveLength(2)
  })
})
