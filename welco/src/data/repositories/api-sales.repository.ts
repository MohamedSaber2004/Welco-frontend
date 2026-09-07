import { SALES_ROUTES } from '../../config/api.config'
import type { PaginatedResult } from '../../domain/models/location'
import type { CreateQuotePayload, CreateRfqPayload, QuoteDto, RfqDto } from '../../domain/models/sales'
import type { ProductInquiryDto, ProductInquiryQuery, SalesRepository, SalesQuery } from '../../domain/ports/sales-repository'
import type { HttpClient } from '../../infrastructure/http/http-client'

export class ApiSalesRepository implements SalesRepository {
  constructor(private readonly http: HttpClient) {}

  private async getRfqsList(query: SalesQuery): Promise<PaginatedResult<RfqDto>> {
    const params = new URLSearchParams()
    if (query.pageNumber) params.set('pageNumber', String(query.pageNumber))
    if (query.pageSize) params.set('pageSize', String(Math.min(50, Math.max(1, query.pageSize))))
    if (query.searchTerm) params.set('searchTerm', query.searchTerm)
    if (query.status) params.set('status', query.status)
    const qs = params.toString()
    try {
      const raw = await this.http.get<unknown>(qs ? `${SALES_ROUTES.rfqs}?${qs}` : SALES_ROUTES.rfqs, { showFeedback: false })
      if (Array.isArray(raw)) return { isSuccess: true, data: raw as RfqDto[], totalCount: raw.length, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1, hasPreviousPage: false, hasNextPage: false, message: 'OK', statusCode: 200 }
      const res = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      const data = Array.isArray(res.data) ? (res.data as RfqDto[]) : []
      return {
        isSuccess: Boolean(res.isSuccess ?? true),
        data,
        totalCount: (res.totalCount as number) ?? data.length,
        pageNumber: (res.pageNumber as number) ?? query.pageNumber ?? 1,
        pageSize: (res.pageSize as number) ?? query.pageSize ?? 10,
        totalPages: (res.totalPages as number) ?? 1,
        hasPreviousPage: Boolean(res.hasPreviousPage),
        hasNextPage: Boolean(res.hasNextPage),
        message: String(res.message ?? 'OK'),
        statusCode: (res.statusCode as number) ?? 200,
      }
    } catch {
      return { isSuccess: false, data: [], totalCount: 0, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1, hasPreviousPage: false, hasNextPage: false, message: 'OK', statusCode: 200 }
    }
  }

  async getRfqs(query: SalesQuery = {}): Promise<PaginatedResult<RfqDto>> {
    return await this.getRfqsList(query)
  }

  async getRfqById(id: string): Promise<RfqDto> {
    return await this.http.get<RfqDto>(SALES_ROUTES.rfqById(id), { showFeedback: false })
  }

  async createRfq(payload: CreateRfqPayload): Promise<RfqDto> {
    return await this.http.post<RfqDto>(SALES_ROUTES.rfqs, payload)
  }

  async updateRfqStatus(id: string, status: string): Promise<string> {
    return await this.http.put<string>(SALES_ROUTES.rfqStatus(id), { status })
  }

  private async getQuotesList(query: SalesQuery): Promise<PaginatedResult<QuoteDto>> {
    const params = new URLSearchParams()
    if (query.pageNumber) params.set('pageNumber', String(query.pageNumber))
    if (query.pageSize) params.set('pageSize', String(Math.min(50, Math.max(1, query.pageSize))))
    if (query.searchTerm) params.set('searchTerm', query.searchTerm)
    if (query.status) params.set('status', query.status)
    const qs = params.toString()
    try {
      const raw = await this.http.get<unknown>(qs ? `${SALES_ROUTES.quotes}?${qs}` : SALES_ROUTES.quotes, { showFeedback: false })
      if (Array.isArray(raw)) return { isSuccess: true, data: raw as QuoteDto[], totalCount: raw.length, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1, hasPreviousPage: false, hasNextPage: false, message: 'OK', statusCode: 200 }
      const res = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      const data = Array.isArray(res.data) ? (res.data as QuoteDto[]) : []
      return {
        isSuccess: Boolean(res.isSuccess ?? true),
        data,
        totalCount: (res.totalCount as number) ?? data.length,
        pageNumber: (res.pageNumber as number) ?? query.pageNumber ?? 1,
        pageSize: (res.pageSize as number) ?? query.pageSize ?? 10,
        totalPages: (res.totalPages as number) ?? 1,
        hasPreviousPage: Boolean(res.hasPreviousPage),
        hasNextPage: Boolean(res.hasNextPage),
        message: String(res.message ?? 'OK'),
        statusCode: (res.statusCode as number) ?? 200,
      }
    } catch {
      return { isSuccess: false, data: [], totalCount: 0, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1, hasPreviousPage: false, hasNextPage: false, message: 'OK', statusCode: 200 }
    }
  }

  async getQuotes(query: SalesQuery = {}): Promise<PaginatedResult<QuoteDto>> {
    return await this.getQuotesList(query)
  }

  async getQuoteById(id: string): Promise<QuoteDto> {
    return await this.http.get<QuoteDto>(SALES_ROUTES.quoteById(id), { showFeedback: false })
  }

  async createQuote(payload: CreateQuotePayload): Promise<string> {
    return await this.http.post<string>(SALES_ROUTES.quotes, payload)
  }

  async approveQuote(id: string): Promise<string> {
    return await this.http.post<string>(SALES_ROUTES.quoteApprove(id), {}, { showFeedback: false })
  }

  async declineQuote(id: string): Promise<string> {
    return await this.http.post<string>(SALES_ROUTES.quoteDecline(id), {}, { showFeedback: false })
  }

  async createProductInquiry(payload: { productId: string; name: string; organization: string; message: string; email?: string }): Promise<unknown> {
    return await this.http.post<unknown>(SALES_ROUTES.productInquiries, payload, { showFeedback: true })
  }

  async getProductInquiries(query: ProductInquiryQuery = {}): Promise<PaginatedResult<ProductInquiryDto>> {
    const params = new URLSearchParams()
    if (query.pageNumber) params.set('pageNumber', String(query.pageNumber))
    if (query.pageSize) params.set('pageSize', String(Math.min(50, Math.max(1, query.pageSize))))
    if (query.searchTerm) params.set('searchTerm', query.searchTerm)
    if (query.productId) params.set('productId', query.productId)
    const qs = params.toString()
    const raw = await this.http.get<unknown>(qs ? `${SALES_ROUTES.productInquiries}?${qs}` : SALES_ROUTES.productInquiries, { showFeedback: false })
    if (Array.isArray(raw)) return { isSuccess: true, data: raw as ProductInquiryDto[], totalCount: raw.length, pageNumber: query.pageNumber ?? 1, pageSize: query.pageSize ?? 10, totalPages: 1, hasPreviousPage: false, hasNextPage: false, message: 'OK', statusCode: 200 }
    return raw as PaginatedResult<ProductInquiryDto>
  }

  async getProductInquiryById(id: string): Promise<ProductInquiryDto> {
    return await this.http.get<ProductInquiryDto>(SALES_ROUTES.productInquiryById(id), { showFeedback: false })
  }

  async deleteProductInquiry(id: string): Promise<void> {
    await this.http.del<void>(SALES_ROUTES.productInquiryById(id), { showFeedback: false })
  }
}
