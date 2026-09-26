export enum CompanyType {
  Hospital = 1,
  Distributor = 2,
  Clinic = 3,
  Supplier = 4,
}

import type { UserType } from './user'

export enum CompanyStatus {
  Pending = 1,
  Approved = 2,
  Rejected = 3,
}

export interface CompanyDto {
  id: string
  name: string
  email?: string | null
  type: CompanyType
  countryId?: string
  countryNameEn?: string | null
  countryNameAr?: string | null
  status: CompanyStatus
  accountManagerId?: string | null
  isActive: boolean
  isProvider?: boolean
  imageName?: string | null
  createdAt: string
}

export interface CreateCompanyPayload {
  name: string
  email?: string | null
  type: CompanyType
  countryId: string
  status?: CompanyStatus
  accountManagerId?: string | null
  isProvider?: boolean
  imageName?: string | null
}

export interface UpdateCompanyPayload extends CreateCompanyPayload {
  isActive?: boolean
}

/**
 * Provider-owned subset of a company record, used by the profile
 * "organization details" self-service form.
 *
 * The admin-controlled fields (status, type, account manager, active /
 * provider flags) are intentionally absent: the backend copies those
 * straight through from the stored record so a provider cannot
 * self-approve or re-classify its own organization.
 */
export interface UpdateMyCompanyPayload {
  name: string
  email?: string | null
  countryId: string
  /** Stored attachment name. An empty string clears the logo. */
  imageName?: string | null
}

export interface DistributorApplicationPayload {
  companyName: string
  countryId: string
  /** kept for backward compat — will be derived from selected country */
  countryName?: string
  salesVolumeBand: string
  categoryInterest: string
  website?: string
  contactPerson: string
  email: string
  phone?: string
}

export interface DistributorApplicationDto extends DistributorApplicationPayload {
  id: string
  type: CompanyType
  status: CompanyStatus | string
  countryNameEn?: string | null
  contactEmail?: string
  createdAt: string
  updatedAt?: string | null
  applicantUser?: ApplicantUserDto | null
}

export interface ApplicantUserDto {
  id: string
  fullName: string
  email: string
  phoneNumber?: string | null
  userType: UserType
  isActive: boolean
  emailConfirmed: boolean
  createdAt: string
}

export interface OemService {
  id: string
  title: string
  description: string
  icon: string
  titleAr?: string
  descriptionAr?: string
}

export interface OemInquiryPayload {
  fullName: string
  email: string
  companyName: string
  serviceType: string
  message: string
}

export const COMPANY_TYPE_LABEL: Record<CompanyType, string> = {
  [CompanyType.Hospital]: 'Hospital',
  [CompanyType.Distributor]: 'Distributor',
  [CompanyType.Clinic]: 'Clinic',
  [CompanyType.Supplier]: 'Supplier',
}

export const COMPANY_STATUS_LABEL: Record<CompanyStatus, string> = {
  [CompanyStatus.Pending]: 'Pending',
  [CompanyStatus.Approved]: 'Approved',
  [CompanyStatus.Rejected]: 'Rejected',
}
