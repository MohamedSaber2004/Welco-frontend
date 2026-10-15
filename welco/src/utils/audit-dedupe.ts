import type { AuditLogDto } from '../domain/models/audit-log'

/**
 * Deduplicates audit logs by removing identical consecutive entries
 * (same entity, same action, same user within 3 seconds) or entries with duplicate IDs.
 */
export function deduplicateLogs(list: AuditLogDto[]): AuditLogDto[] {
  if (!Array.isArray(list) || list.length === 0) return []
  const result: AuditLogDto[] = []
  const seenIds = new Set<string>()

  for (let i = 0; i < list.length; i++) {
    const curr = list[i]
    if (!curr) continue

    // Filter duplicate IDs if present
    if (curr.id && seenIds.has(curr.id)) {
      continue
    }

    const prev = result[result.length - 1]
    if (prev) {
      const sameAction =
        String(prev.action || '').toUpperCase() === String(curr.action || '').toUpperCase()
      const sameEntity =
        String(prev.entityName || '').toLowerCase() === String(curr.entityName || '').toLowerCase() &&
        String(prev.entityId || '') === String(curr.entityId || '')
      const sameUser =
        (prev.performedById || prev.performedBy) === (curr.performedById || curr.performedBy)
      const timeDiff = Math.abs(
        new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime(),
      )
      if (sameAction && sameEntity && sameUser && timeDiff < 3000) {
        continue
      }
    }

    if (curr.id) seenIds.add(curr.id)
    result.push(curr)
  }
  return result
}
