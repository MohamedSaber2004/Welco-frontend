import { UserType } from './user'
import { CompanyStatus, type CompanyDto } from './company'

export enum BusinessRole {
  Admin = 'Admin',
  Provider = 'Provider',
  WelcoStaff = 'WelcoStaff',
}

export const DistributorBusinessRole = BusinessRole.Provider

export interface BusinessRoleContext {
  userType?: UserType | number | null
  roles?: string[] | null
  companyId?: string | null
  company?: CompanyDto | null
}

const roleList = (ctx: BusinessRoleContext): string[] =>
  (ctx.roles ?? []).map((r) => String(r).toLowerCase())

const isApprovedStatus = (status?: CompanyDto['status'] | string | number | null): boolean =>
  status === CompanyStatus.Approved || status === 'Approved' || status === 2 || status === '2'

export function isAdminContext(ctx: BusinessRoleContext): boolean {
  return roleList(ctx).includes('admin') || ctx.userType === UserType.Admin || ctx.userType === 1
}

export function isStaffContext(ctx: BusinessRoleContext): boolean {
  return roleList(ctx).includes('welcostaff') || ctx.userType === UserType.WelcoStaff || ctx.userType === 3
}

export function isOrganizationUserContext(ctx: BusinessRoleContext): boolean {
  return (
    roleList(ctx).includes('organizationuser') ||
    ctx.userType === UserType.OrganizationUser ||
    ctx.userType === 2
  )
}

export function isCustomerTypeContext(_ctx: BusinessRoleContext): boolean {
  return false
}

export function isProviderContext(ctx: BusinessRoleContext): boolean {
  if (isAdminContext(ctx) || isStaffContext(ctx)) return false
  return isOrganizationUserContext(ctx)
}

export const isDistributorContext = isProviderContext

export function isCustomerContext(_ctx: BusinessRoleContext): boolean {
  return false
}

export function resolveBusinessRole(ctx: BusinessRoleContext): BusinessRole {
  if (isAdminContext(ctx)) return BusinessRole.Admin
  if (isStaffContext(ctx)) return BusinessRole.WelcoStaff
  return BusinessRole.Provider
}

export type BusinessRoleKey = 'roleAdmin' | 'roleWelcoStaff' | 'roleProvider'

export function businessRoleKey(role: BusinessRole): BusinessRoleKey {
  switch (role) {
    case BusinessRole.Admin:
      return 'roleAdmin'
    case BusinessRole.WelcoStaff:
      return 'roleWelcoStaff'
    case BusinessRole.Provider:
    default:
      return 'roleProvider'
  }
}

export function resolveBusinessRoleKey(ctx: BusinessRoleContext): BusinessRoleKey {
  return businessRoleKey(resolveBusinessRole(ctx))
}

export function isProviderCompany(company?: CompanyDto | null): boolean {
  return !!company?.id
}


export function resolveProviderCompany(ctx: BusinessRoleContext): CompanyDto | null {
  if (isAdminContext(ctx) || isStaffContext(ctx)) return null
  if (!isOrganizationUserContext(ctx)) return null
  return ctx.company ?? null
}

export function canAccessB2B(ctx: BusinessRoleContext): boolean {
  if (isAdminContext(ctx) || isStaffContext(ctx)) return true
  if (!isProviderContext(ctx)) return false
  if (ctx.company) return isApprovedStatus(ctx.company.status)

  return true
}
