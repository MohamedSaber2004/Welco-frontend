export type LandingPageType = 'Brand' | 'Specialty' | 'Procedure'

export interface DocumentDto {
  id: string
  title: string
  docType: string
  fileUrl: string
  fileSizeKB: number
  productId?: string | null
  publishedDate: string
}

export interface CreateDocumentPayload {
  title: string
  docType: string
  fileUrl: string
  fileSizeKB?: number
  productId?: string | null
  publishedDate?: string
}

export interface LandingPageDto {
  id: string
  type: LandingPageType
  slug: string
  heroTitle: string
  heroBody?: string
  categoryId?: string
  categoryName?: string
  procedure?: string
  relatedCategoryIds?: string[]
  relatedProductIds?: string[]
  featuredProductIds?: string[]
  createdAt: string
}

export interface HelpCategoryDto {
  id: string
  name: string
  icon: string
  articleCount?: number
}

export interface HelpArticleDto {
  id: string
  categoryId: string
  title: string
  body: string
  slug: string
}

export interface FaqItemDto {
  id: string
  question: string
  answer: string
}

export interface TradeShowEventDto {
  id: string
  name: string
  location: string
  country?: string
  startDate: string
  endDate: string
  isUpcoming: boolean
  booth?: string
}

export interface SupportTicketDto {
  id: string
  userId: string
  subject: string
  message: string
  status: string
  reply?: string | null
  createdAt: string
  repliedAt?: string | null
}

export interface DocumentQuery {
  pageNumber?: number
  pageSize?: number
  searchTerm?: string
  docType?: string
}

export interface LandingPageQuery {
  pageNumber?: number
  pageSize?: number
  type?: string
}

export interface SupportContactDto {
  id?: string
  supportEmail: string
  phoneNumber: string
  whatsAppNumber: string
  workingHours?: string
  updatedAt?: string
}

export interface UpdateSupportContactPayload {
  supportEmail: string
  phoneNumber: string
  whatsAppNumber: string
  workingHours?: string
}

