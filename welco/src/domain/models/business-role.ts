import { UserType } from './user'
import { CompanyStatus, type CompanyDto } from './company'

/**
 * 4 business roles derived from the backend `UserType` values:
 *  1. Admin                — UserType.Admin (full privileges)
 *  2. Provider/Distributor — OrganizationUser WITH a linked company.
 *                            The provider IS the company of the distributor /
 *                            organization user. B2B portal (RFQ / quotes /
 *                            orders) unlocked once the company is approved.
 *  3. Customer             — the buyer (UserType.Customer = 4: registers
 *                            WITHOUT company, needs NO admin approval).
 *                            Legacy fallback: an OrganizationUser WITHOUT a
 *                            linked company is also treated as Customer.
 *  4. WelcoStaff           — UserType.WelcoStaff (internal ops)
 */
export enum BusinessRole {
  Admin = 'Admin',
  Provider = 'Provider',
  Customer = 'Customer',
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

export function isCustomerTypeContext(ctx: BusinessRoleContext): boolean {
  return roleList(ctx).includes('customer') || ctx.userType === UserType.Customer || ctx.userType === 4
}

export function isProviderContext(ctx: BusinessRoleContext): boolean {
  if (isAdminContext(ctx) || isStaffContext(ctx)) return false
  if (!isOrganizationUserContext(ctx)) return false
  return !!(ctx.companyId ?? ctx.company?.id)
}

export const isDistributorContext = isProviderContext

export function isCustomerContext(ctx: BusinessRoleContext): boolean {
  if (isAdminContext(ctx) || isStaffContext(ctx)) return false
  // First-class Customer type needs no company at all.
  if (isCustomerTypeContext(ctx)) return true
  // Legacy fallback: OrganizationUser WITHOUT a linked company.
  if (!isOrganizationUserContext(ctx)) return false
  return !(ctx.companyId ?? ctx.company?.id)
}

export function resolveBusinessRole(ctx: BusinessRoleContext): BusinessRole {
  if (isAdminContext(ctx)) return BusinessRole.Admin
  if (isStaffContext(ctx)) return BusinessRole.WelcoStaff
  if (isCustomerTypeContext(ctx)) return BusinessRole.Customer
  if (isProviderContext(ctx)) return BusinessRole.Provider
  if (isOrganizationUserContext(ctx)) return BusinessRole.Customer
  return BusinessRole.Customer
}

export type BusinessRoleKey = 'roleAdmin' | 'roleWelcoStaff' | 'roleProvider' | 'roleCustomer'

export function businessRoleKey(role: BusinessRole): BusinessRoleKey {
  switch (role) {
    case BusinessRole.Admin:
      return 'roleAdmin'
    case BusinessRole.WelcoStaff:
      return 'roleWelcoStaff'
    case BusinessRole.Provider:
      return 'roleProvider'
    case BusinessRole.Customer:
    default:
      return 'roleCustomer'
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
