import { ref } from 'vue'
import type {
  DocumentDto,
  FaqItemDto,
  HelpArticleDto,
  HelpCategoryDto,
  LandingPageDto,
  TradeShowEventDto,
  CreateDocumentPayload,
  SupportContactDto,
  UpdateSupportContactPayload,
} from '../domain/models/content'
import type { ContentRepository } from '../domain/ports/content-repository'

export class ContentService {
  readonly documents = ref<DocumentDto[]>([])
  readonly helpCategories = ref<HelpCategoryDto[]>([])
  readonly helpArticles = ref<HelpArticleDto[]>([])
  readonly faqs = ref<FaqItemDto[]>([])
  readonly tradeShows = ref<TradeShowEventDto[]>([])
  readonly tickets = ref<import('../domain/models/content').SupportTicketDto[]>([])
  readonly myTickets = ref<import('../domain/models/content').SupportTicketDto[]>([])
  readonly supportContact = ref<SupportContactDto>({
    supportEmail: '',
    phoneNumber: '',
    whatsAppNumber: '',
    workingHours: '',
  })
  readonly loading = ref(false)

  private readonly repo: ContentRepository

  constructor(repo: ContentRepository) {
    this.repo = repo
  }

  async loadDocuments(): Promise<void> {
    this.loading.value = true
    try {
      const res = await this.repo.getDocuments({ pageNumber: 1, pageSize: 10 })
      this.documents.value = res.data ?? []
    } catch {
      // gateway may be cold on first hit; page shows empty state gracefully
    } finally {
      this.loading.value = false
    }
  }

  async createDocument(payload: CreateDocumentPayload): Promise<DocumentDto> {
    const created = await this.repo.createDocument(payload)
    this.documents.value.unshift(created)
    return created
  }

  async deleteDocument(id: string): Promise<void> {
    await this.repo.deleteDocument(id)
    this.documents.value = this.documents.value.filter((d) => d.id !== id)
  }

  async loadSupport(): Promise<void> {
    this.loading.value = true
    try {
      // Use allSettled so trade-shows or single help failure doesn't block other help data
      const results = await Promise.allSettled([
        this.repo.getHelpCategories(),
        this.repo.getHelpArticles(),
        this.repo.getFaqs(),
        this.repo.getTradeShows(),
        this.loadSupportContact(),
      ])
      const categories = results[0].status === 'fulfilled' ? results[0].value : []
      const articles = results[1].status === 'fulfilled' ? results[1].value : []
      const faqs = results[2].status === 'fulfilled' ? results[2].value : []
      const shows = results[3].status === 'fulfilled' ? results[3].value : []
      if (import.meta.env.DEV && results.some((r) => r.status === 'rejected')) {
        console.warn('[content] loadSupport partial failure', results)
      }
      this.helpCategories.value = categories
      this.helpArticles.value = articles
      this.faqs.value = faqs
      this.tradeShows.value = shows
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[content] loadSupport failed', e)
    } finally {
      this.loading.value = false
    }
  }

  async createHelpCategory(name: string, icon?: string) {
    const created = await this.repo.createHelpCategory({ name, icon })
    this.helpCategories.value.push(created)
    return created
  }
  async updateHelpCategory(id: string, name: string, icon?: string) {
    const updated = await this.repo.updateHelpCategory(id, { name, icon })
    this.helpCategories.value = this.helpCategories.value.map((c) => (c.id === id ? updated : c))
    return updated
  }
  async deleteHelpCategory(id: string) {
    await this.repo.deleteHelpCategory(id)
    this.helpCategories.value = this.helpCategories.value.filter((c) => c.id !== id)
  }

  async createHelpArticle(payload: { categoryId: string; title: string; body: string; slug: string }) {
    const created = await this.repo.createHelpArticle(payload)
    this.helpArticles.value.unshift(created)
    return created
  }
  async updateHelpArticle(id: string, payload: { categoryId: string; title: string; body: string; slug: string }) {
    const updated = await this.repo.updateHelpArticle(id, payload)
    this.helpArticles.value = this.helpArticles.value.map((a) => (a.id === id ? updated : a))
    return updated
  }
  async deleteHelpArticle(id: string) {
    await this.repo.deleteHelpArticle(id)
    this.helpArticles.value = this.helpArticles.value.filter((a) => a.id !== id)
  }

  async createFaq(question: string, answer: string, sortOrder = 0) {
    const created = await this.repo.createFaq({ question, answer, sortOrder })
    this.faqs.value.push(created)
    return created
  }
  async updateFaq(id: string, question: string, answer: string, sortOrder = 0) {
    const updated = await this.repo.updateFaq(id, { question, answer, sortOrder })
    this.faqs.value = this.faqs.value.map((f) => (f.id === id ? updated : f))
    return updated
  }
  async deleteFaq(id: string) {
    await this.repo.deleteFaq(id)
    this.faqs.value = this.faqs.value.filter((f) => f.id !== id)
  }

  async loadMyTickets(): Promise<void> {
    try {
      this.myTickets.value = await this.repo.getMyTickets()
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[content] loadMyTickets failed', e)
    }
  }
  async loadTickets(params?: { pageNumber?: number; pageSize?: number; status?: string; searchTerm?: string }): Promise<void> {
    try {
      this.tickets.value = await this.repo.getTickets(params)
    } catch {
      // gateway may be cold on first hit; page shows empty state gracefully
    }
  }
  async createTicket(subject: string, message: string) {
    const created = await this.repo.createTicket({ subject, message })
    this.myTickets.value.unshift(created)
    return created
  }
  async replyTicket(id: string, reply: string) {
    const updated = await this.repo.replyTicket(id, reply)
    this.tickets.value = this.tickets.value.map((t) => (t.id === id ? updated : t))
    this.myTickets.value = this.myTickets.value.map((t) => (t.id === id ? updated : t))
    return updated
  }
  async closeTicket(id: string) {
    const updated = await this.repo.closeTicket(id)
    this.tickets.value = this.tickets.value.map((t) => (t.id === id ? updated : t))
    this.myTickets.value = this.myTickets.value.map((t) => (t.id === id ? updated : t))
    return updated
  }

  async getLandingPage(slug: string): Promise<LandingPageDto | null> {
    try {
      return await this.repo.getLandingPageBySlug(slug)
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[content] getLandingPage failed', e)
      return null
    }
  }

  async loadSupportContact(): Promise<SupportContactDto> {
    try {
      const data = await this.repo.getSupportContact()
      // Keep last-known-good: an empty/failed fetch must not blank the footer.
      if (data && (data.supportEmail || data.phoneNumber || data.whatsAppNumber)) {
        this.supportContact.value = data
      }
      return this.supportContact.value
    } catch {
      return this.supportContact.value
    }
  }

  async updateSupportContact(payload: UpdateSupportContactPayload): Promise<SupportContactDto> {
    const updated = await this.repo.updateSupportContact(payload)
    if (updated) {
      this.supportContact.value = updated
    }
    return this.supportContact.value
  }
}
