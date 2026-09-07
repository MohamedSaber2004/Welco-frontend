import { ref } from 'vue'
import { userRepository } from '../di/container'
import { UserType } from '../domain/models/user'
import type { UserDetailsDto, UserDto } from '../domain/models/user'

export interface ResolvedUser {
  name: string
  role: string
  roleKey: string
  email?: string
}

const userCache = ref<Record<string, ResolvedUser>>({})
const fetchingIds = new Set<string>()

const isGuid = (val?: string | null): boolean => {
  if (!val) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim())
}

const formatRole = (user: UserDto | UserDetailsDto): { role: string; roleKey: string } => {
  if (user.roles && user.roles.length > 0) {
    const rawRole = user.roles[0] ?? ''
    if (rawRole.toLowerCase().includes('admin')) return { role: 'Admin', roleKey: 'roleAdmin' }
    if (rawRole.toLowerCase().includes('staff')) return { role: 'Welco Staff', roleKey: 'roleWelcoStaff' }
    if (rawRole.toLowerCase().includes('org') || rawRole.toLowerCase().includes('user')) return { role: 'Organization', roleKey: 'roleOrganizationUser' }
    return { role: rawRole, roleKey: rawRole }
  }

  if (user.userType === UserType.Admin) return { role: 'Admin', roleKey: 'roleAdmin' }
  if (user.userType === UserType.WelcoStaff) return { role: 'Welco Staff', roleKey: 'roleWelcoStaff' }
  if (user.userType === UserType.OrganizationUser) return { role: 'Organization', roleKey: 'roleOrganizationUser' }

  return { role: 'User', roleKey: 'roleUser' }
}

export function useUserLookup() {
  const getUserInfo = (identifier?: string | null): ResolvedUser => {
    if (!identifier) return { name: 'System', role: 'System', roleKey: 'system' }
    const cached = userCache.value[identifier]
    if (cached) return cached

    if (!isGuid(identifier)) {
      const isEmail = identifier.includes('@')
      return {
        name: isEmail ? identifier.split('@')[0]! : identifier,
        role: 'User',
        roleKey: 'user',
        email: isEmail ? identifier : undefined,
      }
    }

    return {
      name: `${identifier.slice(0, 8)}…`,
      role: 'User',
      roleKey: 'user',
    }
  }

  const resolveUser = async (identifier?: string | null): Promise<ResolvedUser> => {
    if (!identifier) return { name: 'System', role: 'System', roleKey: 'system' }
    if (userCache.value[identifier]) return userCache.value[identifier]!
    if (fetchingIds.has(identifier)) return getUserInfo(identifier)

    fetchingIds.add(identifier)
    try {
      if (isGuid(identifier)) {
        const user = await userRepository.getUserById(identifier).catch(() => null)
        if (user && user.id) {
          const { role, roleKey } = formatRole(user)
          const resolved: ResolvedUser = {
            name: user.fullName?.trim() || user.email || identifier,
            role,
            roleKey,
            email: user.email,
          }
          userCache.value[identifier] = resolved
          return resolved
        }
      } else if (identifier.includes('@')) {
        const res = await userRepository.getUsers({ searchTerm: identifier, pageSize: 1 }).catch(() => null)
        const match = res?.data?.[0]
        if (match) {
          const { role, roleKey } = formatRole(match)
          const resolved: ResolvedUser = {
            name: match.fullName?.trim() || match.email || identifier,
            role,
            roleKey,
            email: match.email,
          }
          userCache.value[identifier] = resolved
          return resolved
        }
      }

      const fallback: ResolvedUser = {
        name: isGuid(identifier) ? `${identifier.slice(0, 8)}…` : identifier,
        role: 'User',
        roleKey: 'user',
      }
      userCache.value[identifier] = fallback
      return fallback
    } finally {
      fetchingIds.delete(identifier)
    }
  }

  const resolveLogsUsers = async (logs: Array<{ performedBy?: string; performedById?: string }>): Promise<void> => {
    const ids = new Set<string>()
    for (const log of logs) {
      if (log.performedById) ids.add(log.performedById)
      if (log.performedBy) ids.add(log.performedBy)
    }

    const promises: Promise<unknown>[] = []
    for (const id of ids) {
      if (!userCache.value[id] && !fetchingIds.has(id)) {
        promises.push(resolveUser(id))
      }
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises)
    }
  }

  const getRoleBadgeClass = (roleKey?: string): string => {
    switch (roleKey?.toLowerCase()) {
      case 'admin':
      case 'roleadmin':
        return 'role-badge--admin'
      case 'welco staff':
      case 'rolewelcostaff':
      case 'staff':
        return 'role-badge--staff'
      case 'organization':
      case 'organization user':
      case 'roleorganizationuser':
        return 'role-badge--org'
      case 'system':
        return 'role-badge--system'
      default:
        return 'role-badge--default'
    }
  }

  return {
    userCache,
    getUserInfo,
    resolveUser,
    resolveLogsUsers,
    getRoleBadgeClass,
  }
}
