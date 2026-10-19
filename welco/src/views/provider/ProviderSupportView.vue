<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useAnimation } from '../../composables/useAnimation'
import ProviderLayout from '../../components/layout/ProviderLayout.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { companyService, contentService } from '../../di/container'
import { formatDate, formatDateTime, formatTicketReplyDate } from '../../utils/format'
import { t, locale } from '../../i18n'
import type { OemInquiryDto } from '../../domain/ports/company-repository'
import type { SupportTicketDto, FaqItemDto } from '../../domain/models/content'


useAnimation()

/* ── Active Tab ── */
const activeTab = ref<'support' | 'oem'>('support')

/* Roving-tabindex keyboard support for the support/oem tablist. */
const onSupportTabKeydown = (e: KeyboardEvent, current: 'support' | 'oem') => {
  const order: Array<'support' | 'oem'> = ['support', 'oem']
  let next = -1
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (order.indexOf(current) + 1) % order.length
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (order.indexOf(current) - 1 + order.length) % order.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = order.length - 1
  if (next < 0) return
  e.preventDefault()
  const target = order[next]
  if (!target) return
  activeTab.value = target
  void nextTick(() => {
    document.getElementById(target === 'support' ? 'support-tab-support' : 'support-tab-oem')?.focus()
  })
}

/* ── Live Data Loading ── */
const loading = ref(true)
const loadAllData = async () => {
  loading.value = true
  try {
    await Promise.allSettled([
      contentService.loadSupportContact(),
      contentService.loadMyTickets(),
      contentService.loadSupport(),
      companyService.loadOemInquiries(),
    ])
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadAllData()
})

/* ── Dynamic Support Contact Hub ── */
const supportContact = computed(() => contentService.supportContact.value)
const livePhone = computed(() => supportContact.value?.phoneNumber || '+971 4 800 93526')
const liveWhatsApp = computed(() => supportContact.value?.whatsAppNumber || '+971 50 800 9352')
const liveEmail = computed(() => supportContact.value?.supportEmail || 'support@welco.health')
const liveFacebook = computed(() => supportContact.value?.facebookUrl || '')
const liveInstagram = computed(() => supportContact.value?.instagramUrl || '')
const liveHours = computed(() => supportContact.value?.workingHours || '24/7 dedicated distributor & hospital escalation desk')

const telLink = computed(() => `tel:${livePhone.value.replace(/\s+/g, '')}`)
const waLink = computed(() => {
  const digits = liveWhatsApp.value.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=Provider%20Escalation%20Inquiry%20from%20Welco%20Network`
})
const mailLink = computed(() => `mailto:${liveEmail.value}?subject=Provider%20Support%20Inquiry`)

/* ── Dynamic Options (Categories & Priorities) ── */
const dynamicCategories = computed(() => {
  const apiCats = contentService.helpCategories.value
  if (apiCats && apiCats.length > 0) {
    return apiCats
      .filter((c) => c.isActive ?? true)
      .map((c) => ({
        value: c.name,
        label: c.name,
        icon: c.icon || 'support_agent',
      }))
  }
  return [
    { value: 'Quotes & Price Negotiations', label: t('provider.quotes') || 'Quotes & Negotiations', icon: 'request_quote' },
    { value: 'Orders & Dispatch Fulfillment', label: t('provider.orders') || 'Orders & Fulfillment', icon: 'local_shipping' },
    { value: 'Catalog Products & Specifications', label: t('provider.myCatalog') || 'Catalog & Specifications', icon: 'inventory_2' },
    { value: 'Technical or Portal Issue', label: t('admin.system') || 'Technical / System Issue', icon: 'build' },
  ]
})

const priorityOptions = computed(() => [
  { value: 'normal', label: t('help.priorityNormal') },
  { value: 'high', label: t('help.priorityHigh') },
  { value: 'urgent', label: t('help.priorityUrgent') },
])

/* ── Escalation Ticket Form ── */
const subject = ref('')
const category = ref('')
const priority = ref('high')
const message = ref('')
const submitting = ref(false)

// Initialize category with first option once loaded
const currentCategory = computed({
  get: () => category.value || dynamicCategories.value[0]?.value || '',
  set: (val: string) => { category.value = val },
})

const submitEscalation = async () => {
  if (!subject.value.trim() || !message.value.trim()) {
    toastService.info(t('help.errSubjectMessageRequired'))
    return
  }

  submitting.value = true
  try {
    const selectedCat = currentCategory.value || 'General Support'
    const prefix = `[${selectedCat} | ${priority.value.toUpperCase()}] `
    const fullSubject = `${prefix}${subject.value.trim()}`
    await contentService.createTicket(fullSubject, message.value.trim())
    toastService.success(t('provider.issueSentSuccess'))
    subject.value = ''
    message.value = ''
    priority.value = 'high'
    // Refresh tickets from API
    await contentService.loadMyTickets()
  } catch (err) {
    toastService.error(err instanceof Error ? err.message : t('common.error'))
  } finally {
    submitting.value = false
  }
}

/* ── My Tickets Tracker & Details ── */
const myTickets = computed(() => contentService.myTickets.value)
const showTicketModal = ref(false)
const selectedTicket = ref<SupportTicketDto | null>(null)
const closingTicketId = ref<string | null>(null)

const openTicketDetails = (t: SupportTicketDto) => {
  selectedTicket.value = t
  showTicketModal.value = true
}

const closeTicketDetails = () => {
  showTicketModal.value = false
  selectedTicket.value = null
}

const handleCloseTicket = async (ticket: SupportTicketDto) => {
  const ok = await confirmService.confirm({
    title: t('help.closeTicket'),
    message: t('help.confirmCloseTicket'),
    variant: 'warning',
    confirmText: t('help.closeTicket'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return

  closingTicketId.value = ticket.id
  try {
    await contentService.closeTicket(ticket.id)
    toastService.success(t('help.ticketClosedSuccess'))
    await contentService.loadMyTickets()
    if (selectedTicket.value?.id === ticket.id) {
      selectedTicket.value = myTickets.value.find((x) => x.id === ticket.id) ?? null
    }
  } catch (err) {
    toastService.error(err instanceof Error ? err.message : t('common.error'))
  } finally {
    closingTicketId.value = null
  }
}

const ticketStatusBadgeClass = (status: string): string => {
  const s = (status || '').toLowerCase()
  if (s.includes('replied') || s.includes('answered')) return 'badge--success'
  if (s.includes('open')) return 'badge--info'
  if (s.includes('closed')) return 'badge--neutral'
  return 'badge--warning'
}

/* ── Dynamic FAQs ── */
const faqs = computed<FaqItemDto[]>(() => contentService.faqs.value.filter((f) => f.isActive ?? true))
const expandedFaqId = ref<string | null>(null)
const toggleFaq = (id: string) => {
  expandedFaqId.value = expandedFaqId.value === id ? null : id
}

/* ── OEM Inquiries Management ── */
const oemSearch = ref('')
const oemPage = ref(1)
const oemPageSize = 10
const showOemDetails = ref(false)
const selectedOem = ref<OemInquiryDto | null>(null)
const oemDeletePendingId = ref<string | null>(null)

const oemInquiries = computed(() => companyService.oemInquiries.value)
const oemLoading = computed(() => companyService.oemInquiriesLoading.value)

const filteredOem = computed(() => {
  const list = oemInquiries.value
  const searchTerm = oemSearch.value.trim().toLowerCase()
  if (!searchTerm) return list
  return list.filter((inq) => {
    return [
      inq.fullName,
      inq.companyName,
      inq.serviceType,
      inq.email,
    ].some((v) => v?.toLowerCase().includes(searchTerm))
  })
})

const oemTotalPages = computed(() => Math.max(1, Math.ceil(filteredOem.value.length / oemPageSize)))

const paginatedOem = computed(() => {
  const start = (oemPage.value - 1) * oemPageSize
  return filteredOem.value.slice(start, start + oemPageSize)
})

const openOemDetails = (inquiry: OemInquiryDto) => {
  selectedOem.value = inquiry
  showOemDetails.value = true
}

const closeOemDetails = () => {
  showOemDetails.value = false
  selectedOem.value = null
}

const confirmDeleteOem = async (inquiry: OemInquiryDto) => {
  const ok = await confirmService.confirmDelete(
    `${t('admin.oemInquiryDeletedConfirm')}\n${inquiry.fullName}`,
    t('common.delete'),
  )
  if (!ok) return
  oemDeletePendingId.value = inquiry.id
  try {
    const result = await companyService.deleteOemInquiry(inquiry.id)
    if (result.ok) {
      toastService.success(t('admin.oemInquiryDeleted'))
      if (selectedOem.value?.id === inquiry.id) {
        closeOemDetails()
      }
    }
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    oemDeletePendingId.value = null
  }
}

const oemAcceptPendingId = ref<string | null>(null)

const acceptOemInquiry = async (inquiry: OemInquiryDto) => {
  oemAcceptPendingId.value = inquiry.id
  try {
    const result = await companyService.acceptOemInquiry(inquiry.id)
    if (result.ok) {
      toastService.success(t('admin.oemInquiryAccepted'))
      if (selectedOem.value?.id === inquiry.id) {
        closeOemDetails()
      }
    }
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    oemAcceptPendingId.value = null
  }
}
</script>

<template>
  <ProviderLayout>
    <div class="provider-support-view">
      <!-- Header -->
      <header class="view-header">
        <div class="header-left">
          <span class="mono eyebrow">{{ t('provider.dashboard') }} · {{ t('provider.support') }}</span>
          <h1 class="view-title">{{ t('provider.contactAdmin') }}</h1>
          <p class="view-desc">{{ t('provider.supportDesc') }}</p>
        </div>

        <!-- Live Operations Desk Badge -->
        <div class="live-desk-pill">
          <span class="live-pulse-dot"></span>
          <div class="live-desk-info">
            <span class="live-desk-title mono">WELCO CENTRAL ESCALATION</span>
            <span class="live-desk-sub text-xs text-muted">{{ liveHours }}</span>
          </div>
        </div>
      </header>

      <!-- View Navigation Tabs -->
      <div class="support-tabs-bar" role="tablist" :aria-label="t('provider.support')">
        <button
          type="button"
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === 'support' }"
          role="tab"
          id="support-tab-support"
          aria-controls="support-panel-support"
          :aria-selected="activeTab === 'support'"
          :tabindex="activeTab === 'support' ? 0 : -1"
          @click="activeTab = 'support'"
          @keydown="onSupportTabKeydown($event, 'support')"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">support_agent</span>
          <span>{{ t('provider.support') }} &amp; {{ t('help.tickets') }}</span>
          <span v-if="myTickets.length" class="tab-badge mono">{{ myTickets.length }}</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === 'oem' }"
          role="tab"
          id="support-tab-oem"
          aria-controls="support-panel-oem"
          :aria-selected="activeTab === 'oem'"
          :tabindex="activeTab === 'oem' ? 0 : -1"
          @click="activeTab = 'oem'"
          @keydown="onSupportTabKeydown($event, 'oem')"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">precision_manufacturing</span>
          <span>{{ t('admin.oemInquiries') }}</span>
          <span v-if="filteredOem.length" class="tab-badge mono">{{ filteredOem.length }}</span>
        </button>
      </div>

      <!-- TAB 1: Support & Escalation -->
      <div
        v-show="activeTab === 'support'"
        id="support-panel-support"
        class="tab-pane"
        role="tabpanel"
        aria-labelledby="support-tab-support"
        tabindex="0"
      >
        <!-- Direct Dynamic Contact Channels Hub -->
        <div class="channels-grid">
          <!-- Hotline Card -->
          <div class="channel-card">
            <div class="channel-icon bg-blue-soft">
              <span class="material-symbols-outlined text-blue-600">support_agent</span>
            </div>
            <div class="channel-info">
              <span class="channel-label mono">{{ t('provider.callAdminSupport') }}</span>
              <strong class="channel-main mono">{{ livePhone }}</strong>
              <p class="channel-sub">{{ liveHours }}</p>
            </div>
            <a :href="telLink" class="btn-channel btn-call mono">
              <span class="material-symbols-outlined text-[16px]">call</span>
              <span>Call Hotline</span>
            </a>
          </div>

          <!-- WhatsApp Card -->
          <div class="channel-card">
            <div class="channel-icon bg-emerald-soft">
              <span class="material-symbols-outlined text-emerald-600">chat</span>
            </div>
            <div class="channel-info">
              <span class="channel-label mono">Instant WhatsApp Desk</span>
              <strong class="channel-main mono">{{ liveWhatsApp }}</strong>
              <p class="channel-sub">Direct real-time channel with central operations managers.</p>
            </div>
            <a :href="waLink" target="_blank" rel="noopener noreferrer" class="btn-channel btn-wa mono">
              <span class="material-symbols-outlined text-[16px]">forum</span>
              <span>Open WhatsApp</span>
            </a>
          </div>

          <!-- Email Desk Card -->
          <div class="channel-card">
            <div class="channel-icon bg-indigo-soft">
              <span class="material-symbols-outlined text-indigo-600">mail</span>
            </div>
            <div class="channel-info">
              <span class="channel-label mono">Official Operations Email</span>
              <strong class="channel-main mono text-sm">{{ liveEmail }}</strong>
              <p class="channel-sub">For formal documentation, audit trails, and contract records.</p>
            </div>
            <a :href="mailLink" class="btn-channel btn-mail mono">
              <span class="material-symbols-outlined text-[16px]">mail</span>
              <span>Send Email</span>
            </a>
          </div>

          <!-- Facebook Desk Card -->
          <div v-if="liveFacebook" class="channel-card">
            <div class="channel-icon bg-blue-soft">
              <svg class="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <div class="channel-info">
              <span class="channel-label mono">{{ t('help.facebookChannel') }}</span>
              <strong class="channel-main mono text-sm truncate max-w-[220px]">{{ liveFacebook }}</strong>
              <p class="channel-sub">{{ t('help.facebookChannelNote') }}</p>
            </div>
            <a :href="liveFacebook" target="_blank" rel="noopener noreferrer" class="btn-channel btn-fb mono">
              <span class="material-symbols-outlined text-[16px]">open_in_new</span>
              <span>{{ t('common.open') || 'Visit' }}</span>
            </a>
          </div>

          <!-- Instagram Desk Card -->
          <div v-if="liveInstagram" class="channel-card">
            <div class="channel-icon bg-pink-soft">
              <svg class="w-5 h-5 text-pink-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </div>
            <div class="channel-info">
              <span class="channel-label mono">{{ t('help.instagramChannel') }}</span>
              <strong class="channel-main mono text-sm truncate max-w-[220px]">{{ liveInstagram }}</strong>
              <p class="channel-sub">{{ t('help.instagramChannelNote') }}</p>
            </div>
            <a :href="liveInstagram" target="_blank" rel="noopener noreferrer" class="btn-channel btn-ig mono">
              <span class="material-symbols-outlined text-[16px]">open_in_new</span>
              <span>{{ t('common.open') || 'Visit' }}</span>
            </a>
          </div>
        </div>

        <!-- Central Admin Management Notice -->
        <div class="admin-notice-card">
          <div class="notice-icon-box">
            <span class="material-symbols-outlined text-amber-600 text-[26px]">admin_panel_settings</span>
          </div>
          <div class="notice-content">
            <strong class="notice-title mono">Full Central Admin Oversight &amp; Escalation Guarantee</strong>
            <p class="notice-desc">
              Welco Central Administration maintains 360° operational access across the network. If your team encounters logistics bottlenecks, client disputes, or quote calculation constraints, Welco Admins manage quotes on your behalf, track client interactions, and directly resolve procurement discrepancies.
            </p>
          </div>
        </div>

        <div class="support-dual-grid">
          <!-- Escalation Ticket Form Card -->
          <div class="ticket-card">
            <div class="ticket-card-head">
              <div class="ticket-head-titles">
                <h2 class="ticket-heading">{{ t('provider.escalateIssue') }}</h2>
                <p class="ticket-sub">Submit an expedited ticket directly to the Welco Admin executive queue.</p>
              </div>
              <span class="material-symbols-outlined text-primary text-[24px]">send_and_archive</span>
            </div>

            <form class="ticket-form" @submit.prevent="submitEscalation">
              <div class="form-row">
                <div class="form-group flex-1">
                  <label class="form-lbl mono" for="esc-category">{{ t('admin.category') }} *</label>
                  <select id="esc-category" v-model="currentCategory" class="form-select mono" required>
                    <option v-for="c in dynamicCategories" :key="c.value" :value="c.value">
                      {{ c.label }}
                    </option>
                  </select>
                </div>

                <div class="form-group w-48">
                  <label class="form-lbl mono" for="esc-priority">{{ t('help.priority') }} *</label>
                  <select id="esc-priority" v-model="priority" class="form-select mono" required>
                    <option v-for="p in priorityOptions" :key="p.value" :value="p.value">
                      {{ p.label }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-lbl mono" for="esc-subject">{{ t('provider.issueSubject') }} *</label>
                <input
                  id="esc-subject"
                  v-model="subject"
                  type="text"
                  class="form-input"
                  placeholder="e.g. Need assistance with counter-offer for RFQ #RFQ-2026-081"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-lbl mono" for="esc-message">{{ t('provider.issueMessage') }} *</label>
                <textarea
                  id="esc-message"
                  v-model="message"
                  rows="5"
                  class="form-textarea"
                  :placeholder="t('provider.issueMessage')"
                  required
                ></textarea>
              </div>

              <div class="form-actions">
                <BaseButton variant="primary" type="submit" :loading="submitting">
                  <span class="material-symbols-outlined text-[16px]">send</span>
                  <span>{{ t('provider.sendIssue') }}</span>
                </BaseButton>
              </div>
            </form>
          </div>

          <!-- My Active & Past Escalation Tickets -->
          <div class="ticket-history-card">
            <div class="history-head">
              <div class="history-titles">
                <h3 class="history-title">{{ t('help.tickets') }}</h3>
                <p class="history-sub">Track real-time status and responses from Welco staff.</p>
              </div>
              <button
                type="button"
                class="refresh-icon-btn"
                :title="t('common.refresh') || 'Refresh'"
                :aria-label="t('common.refresh') || 'Refresh'"
                @click="contentService.loadMyTickets()"
              >
                <span class="material-symbols-outlined text-[18px]">refresh</span>
              </button>
            </div>

            <div v-if="!myTickets.length" class="empty-tickets-box">
              <span class="material-symbols-outlined text-slate-300 text-[40px]">confirmation_number</span>
              <p class="empty-tickets-text mono text-xs text-muted">{{ t('help.noTickets') || 'No tickets submitted yet.' }}</p>
            </div>

            <div v-else class="tickets-list">
              <div
                v-for="(tk, i) in myTickets"
                :key="tk.id"
                class="ticket-list-item anim-fade-in-up"
                :style="{ animationDelay: `${i * 30}ms` }"
                @click="openTicketDetails(tk)"
              >
                <div class="ticket-item-top">
                  <span class="status-badge mono" :class="ticketStatusBadgeClass(tk.status)">
                    <span class="badge-dot"></span>
                    <span>{{ tk.status || 'Pending' }}</span>
                  </span>
                  <span class="ticket-date mono text-xs text-muted">
                    {{ formatDateTime(tk.createdAt, locale) }}
                  </span>
                </div>


                <strong class="ticket-item-subject">{{ tk.subject }}</strong>
                <p class="ticket-item-snippet">{{ tk.message }}</p>

                <div class="ticket-item-foot">
                  <span v-if="tk.reply" class="has-reply-tag mono text-xs">
                    <span class="material-symbols-outlined text-[14px]">reply</span>
                    <span>Admin Replied</span>
                  </span>
                  <span v-else class="waiting-reply-tag mono text-xs">
                    <span class="material-symbols-outlined text-[14px]">schedule</span>
                    <span>Pending Review</span>
                  </span>
                  <span class="view-thread-link mono text-xs">
                    <span>View</span>
                    <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Dynamic FAQs / Knowledge Base -->
        <div v-if="faqs.length" class="faqs-section">
          <div class="faqs-head">
            <span class="material-symbols-outlined text-primary text-[22px]">quiz</span>
            <h3 class="faqs-title">{{ t('help.faq') || 'Frequently Asked Questions' }}</h3>
          </div>
          <div class="faqs-grid">
            <button
              v-for="(faq, i) in faqs"
              :id="`faq-btn-${faq.id}`"
              :key="faq.id"
              type="button"
              class="faq-card anim-fade-in-up"
              :class="{ 'faq-card--open': expandedFaqId === faq.id }"
              :style="{ animationDelay: `${i * 30}ms` }"
              :aria-expanded="expandedFaqId === faq.id"
              :aria-controls="`faq-panel-${faq.id}`"
              @click="toggleFaq(faq.id)"
            >
              <span class="faq-question-row">
                <strong class="faq-q">{{ faq.question }}</strong>
                <span class="material-symbols-outlined faq-toggle-icon" aria-hidden="true">
                  {{ expandedFaqId === faq.id ? 'expand_less' : 'expand_more' }}
                </span>
              </span>
              <span
                v-show="expandedFaqId === faq.id"
                :id="`faq-panel-${faq.id}`"
                class="faq-a"
              >
                {{ faq.answer }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- TAB 2: OEM Inquiries Management -->
      <div
        v-show="activeTab === 'oem'"
        id="support-panel-oem"
        class="tab-pane"
        role="tabpanel"
        aria-labelledby="support-tab-oem"
        tabindex="0"
      >
        <div class="oem-card">
          <div class="oem-card-head">
            <div>
              <h2 class="oem-card-heading">{{ t('admin.oemInquiries') }}</h2>
              <p class="oem-card-sub">Review and manage OEM inquiries submitted by prospective partners across the network.</p>
            </div>
          </div>

          <div class="oem-toolbar">
            <div class="search-wrap">
              <span class="material-symbols-outlined search-icon">search</span>
              <input
                v-model="oemSearch"
                :placeholder="t('common.searchPlaceholder')"
                :aria-label="t('common.searchPlaceholder')"
                class="toolbar-input"
                @input="oemPage = 1"
              />
              <button v-if="oemSearch" type="button" class="clear-btn" @click="oemSearch = ''; oemPage = 1">
                <span class="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
            <span class="mono counter-text">{{ filteredOem.length }} {{ t('admin.oemInquiries') }}</span>
          </div>

          <DataState
            :loading="oemLoading && !oemInquiries.length"
            :empty="!filteredOem.length && !oemLoading"
            :empty-title="t('admin.oemInquiries')"
            skeleton-type="table"
            :skeleton-count="6"
            min-height="320px"
            @retry="companyService.loadOemInquiries"
          >
            <div class="table-card">
              <div class="table-wrap">
                <table class="exec-table">
                  <thead>
                    <tr>
                      <th>{{ t('oem.fullName') }}</th>
                      <th>{{ t('oem.companyName') }}</th>
                      <th>{{ t('oem.serviceType') }}</th>
                      <th>{{ t('oem.email') }}</th>
                      <th>{{ t('commerce.status') || 'Date' }}</th>
                      <th class="text-end">{{ t('admin.actions') }}</th>
                    </tr>
                  </thead>
<tbody>
                     <tr v-for="(o, i) in paginatedOem" :key="o.id" class="exec-row anim-fade-in-up"
                         :style="{ animationDelay: `${i * 30}ms` }">
                       <td>
                         <strong class="company-name">{{ o.fullName }}</strong>
                       </td>
                       <td>{{ o.companyName }}</td>
                       <td>
                         <span class="vol-pill mono">{{ o.serviceType }}</span>
                       </td>
                       <td class="mono text-xs">{{ o.email }}</td>
                       <td class="mono text-xs">{{ formatDate(o.createdAt, locale) }}</td>
                       <td class="text-end">
                         <div class="row-actions">
                           <button
                             type="button"
                             class="row-action-btn"
                             :title="t('admin.viewDetails')"
                             :aria-label="t('admin.viewDetails')"
                             @click="openOemDetails(o)"
                           >
                             <span class="material-symbols-outlined text-[18px]">visibility</span>
                           </button>
                           <button
                             type="button"
                             class="row-action-btn row-action-btn--success"
                             :title="t('admin.accept')"
                             :aria-label="t('admin.accept')"
                             :disabled="oemAcceptPendingId === o.id"
                             @click="acceptOemInquiry(o)"
                           >
                             <span class="material-symbols-outlined text-[18px]">check_circle</span>
                           </button>
                           <button
                             type="button"
                             class="row-action-btn row-action-btn--danger"
                             :title="t('common.delete')"
                             :aria-label="t('common.delete')"
                             :disabled="oemDeletePendingId === o.id"
                             @click="confirmDeleteOem(o)"
                           >
                             <span class="material-symbols-outlined text-[18px]">delete</span>
                           </button>
                         </div>
                       </td>
                     </tr>
                   </tbody>
                </table>
              </div>

              <AppPagination
                v-model:page="oemPage"
                :total-pages="oemTotalPages"
                :total-items="filteredOem.length"
                :page-size="10"
                variant="table"
                @change="(p: number) => { oemPage = p }"
              />
            </div>
          </DataState>
        </div>
      </div>

      <!-- Ticket Details & Conversation Modal -->
      <BaseModal
        v-model="showTicketModal"
        :title="t('help.tickets')"
        max-width="620px"
        @close="closeTicketDetails"
      >
        <div v-if="selectedTicket" class="ticket-modal-body">
          <div class="ticket-modal-header">
            <span class="status-badge mono" :class="ticketStatusBadgeClass(selectedTicket.status)">
              <span class="badge-dot"></span>
              <span>{{ selectedTicket.status || 'Pending' }}</span>
            </span>
            <span class="mono text-xs text-muted">
              {{ formatDateTime(selectedTicket.createdAt, locale) }}
            </span>
          </div>

          <h3 class="ticket-modal-subject">{{ selectedTicket.subject }}</h3>

          <!-- Provider Original Message -->
          <div class="message-card message-card--provider">
            <div class="message-card-head">
              <span class="material-symbols-outlined text-[16px] text-muted">person</span>
              <strong class="mono text-xs text-muted">Your Message</strong>
            </div>
            <p class="message-content">{{ selectedTicket.message }}</p>
          </div>

          <!-- Admin Executive Response -->
          <div v-if="selectedTicket.reply" class="message-card message-card--admin">
            <div class="message-card-head">
              <span class="material-symbols-outlined text-[16px] text-emerald-600">verified_user</span>
              <strong class="mono text-xs text-emerald-700">Welco Admin Official Reply</strong>
              <span v-if="selectedTicket.repliedAt" class="mono text-xs text-muted ms-auto">
                {{ formatTicketReplyDate(selectedTicket.repliedAt, selectedTicket.createdAt, locale) }}
              </span>
            </div>
            <p class="message-content reply-content">{{ selectedTicket.reply }}</p>
          </div>


          <div v-else class="pending-reply-banner">
            <span class="material-symbols-outlined spin text-[20px] text-amber-600">hourglass_top</span>
            <div class="pending-reply-text">
              <strong class="mono text-xs text-amber-800">Pending Review by Welco Admin</strong>
              <p class="text-xs text-amber-700 m-0">An executive staff member is reviewing your inquiry and will post a reply here.</p>
            </div>
          </div>

          <div class="modal-foot">
            <BaseButton
              v-if="selectedTicket.status !== 'Closed'"
              variant="secondary"
              :loading="closingTicketId === selectedTicket.id"
              @click="handleCloseTicket(selectedTicket)"
            >
              <span class="material-symbols-outlined text-[16px]">check_circle</span>
              <span>Mark as Closed</span>
            </BaseButton>
            <BaseButton variant="primary" @click="closeTicketDetails">
              {{ t('common.close') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>

      <!-- OEM Inquiry Details Modal -->
      <BaseModal
        v-model="showOemDetails"
        :title="t('admin.oemInquiries')"
        max-width="560px"
        @close="closeOemDetails"
      >
        <div v-if="selectedOem" class="admin-details">
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-k mono">{{ t('oem.fullName') }}</span>
              <strong class="detail-v">{{ selectedOem.fullName }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('oem.email') }}</span>
              <strong class="detail-v mono">{{ selectedOem.email }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('oem.companyName') }}</span>
              <strong class="detail-v">{{ selectedOem.companyName }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('oem.serviceType') }}</span>
              <strong class="detail-v">{{ selectedOem.serviceType }}</strong>
            </div>
          </div>
          <div class="detail-item">
            <span class="detail-k mono">{{ t('oem.message') }}</span>
            <p class="detail-v--pre">{{ selectedOem.message }}</p>
          </div>
          <div class="modal-foot">
            <BaseButton
              variant="primary"
              :loading="oemAcceptPendingId === selectedOem.id"
              @click="selectedOem && acceptOemInquiry(selectedOem)"
            >
              {{ t('admin.accept') }}
            </BaseButton>
            <BaseButton
              variant="secondary"
              :loading="oemDeletePendingId === selectedOem.id"
              @click="selectedOem && confirmDeleteOem(selectedOem)"
            >
              {{ t('common.delete') }}
            </BaseButton>
            <BaseButton variant="secondary" @click="closeOemDetails">
              {{ t('common.close') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>
    </div>
  </ProviderLayout>
</template>

<style scoped>
.provider-support-view {
  width: 100%;
}

.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
}

.header-left {
  flex: 1 1 360px;
}

.eyebrow {
  font-size: var(--step--1);
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.05em;
  display: block;
}

.view-title {
  font-family: var(--wl-font-display);
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: var(--space-1) 0;
}

.view-desc {
  font-size: var(--step-0);
  color: var(--wl-muted);
  max-width: 600px;
  margin: 0;
}

/* Live Operational Desk Badge */
.live-desk-pill {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
}

.live-pulse-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  background: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
  flex-shrink: 0;
}

.live-desk-info {
  display: flex;
  flex-direction: column;
}

.live-desk-title {
  font-size: var(--step--2);
  font-weight: 700;
  color: var(--wl-ink-strong);
  letter-spacing: 0.05em;
}

/* Tabs Bar */
.support-tabs-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  border-bottom: 1px solid var(--wl-border);
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-1);
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  border: none;
  background: transparent;
  color: var(--wl-muted);
  font-size: var(--step--1);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.tab-btn:hover {
  color: var(--wl-ink-strong);
  background: var(--wl-surface-soft);
}

.tab-btn--active {
  color: var(--wl-primary);
  border-bottom: 2px solid var(--wl-primary);
}

.tab-badge {
  font-size: var(--step--2);
  padding: 2px 7px;
  border-radius: var(--radius-full);
  background: var(--wl-surface-soft);
  color: var(--wl-ink-strong);
  border: 1px solid var(--wl-border);
}

.tab-btn--active .tab-badge {
  background: var(--wl-primary-soft, #e0f2fe);
  color: var(--wl-primary);
}

/* Direct Channels Hub Grid */
.channels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.channel-card {
  display: flex;
  flex-direction: column;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  gap: var(--space-3);
  position: relative;
  transition: all 0.18s ease;
}

.channel-card:hover {
  border-color: var(--wl-border-strong);
  transform: translateY(-2px);
}

.channel-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
}

.bg-blue-soft { background: #eff6ff; }
.bg-emerald-soft { background: #ecfdf5; }
.bg-indigo-soft { background: #eef2ff; }

.channel-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.channel-label {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.channel-main {
  font-size: 1.15rem;
  color: var(--wl-ink-strong);
  word-break: break-all;
}

.channel-sub {
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin: 4px 0 0;
  line-height: 1.4;
}

.btn-channel {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.15s ease;
  margin-top: auto;
}

.btn-call {
  background: var(--wl-surface-soft);
  color: var(--wl-ink-strong);
  border: 1px solid var(--wl-border);
}
.btn-call:hover { background: var(--wl-border); }

.btn-wa {
  background: #059669;
  color: #fff;
  border: 1px solid #047857;
}
.btn-wa:hover { background: #047857; }

.btn-mail {
  background: #4f46e5;
  color: #fff;
  border: 1px solid #4338ca;
}
.btn-mail:hover { background: #4338ca; }

.btn-fb {
  background: #1877f2;
  color: #fff;
  border: 1px solid #166fe5;
}
.btn-fb:hover { background: #166fe5; }

.btn-ig {
  background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
  color: #fff;
  border: 1px solid rgba(220, 39, 67, 0.4);
}
.btn-ig:hover { opacity: 0.92; }

/* Admin Oversight Notice */
.admin-notice-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-5);
}

.notice-icon-box {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: #fef3c7;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.notice-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notice-title {
  color: #92400e;
  font-size: var(--step-0);
}

.notice-desc {
  font-size: var(--step--1);
  color: #b45309;
  line-height: 1.5;
  margin: 0;
}

/* Dual Grid: Ticket Form + My Tickets */
.support-dual-grid {
  display: grid;
  grid-template-columns: minmax(320px, 1.2fr) minmax(300px, 1fr);
  gap: var(--space-5);
  margin-bottom: var(--space-6);
}

/* Ticket Form Card */
.ticket-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.ticket-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--wl-border);
  padding-bottom: var(--space-3);
}

.ticket-heading {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.ticket-sub {
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin: 4px 0 0;
}

.ticket-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-row {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.flex-1 { flex: 1; min-width: 180px; }
.w-48 { width: 190px; }

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-lbl {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
}

.form-select,
.form-input,
.form-textarea {
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  outline: none;
}

.form-select:focus,
.form-input:focus,
.form-textarea:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-2);
}

/* Ticket History Card */
.ticket-history-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--wl-border);
  padding-bottom: var(--space-3);
}

.history-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
}

.history-sub {
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin: 2px 0 0;
}

.refresh-icon-btn {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--wl-muted);
  transition: all 0.15s ease;
}

.refresh-icon-btn:hover {
  color: var(--wl-ink-strong);
  border-color: var(--wl-border-strong);
}

.empty-tickets-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) var(--space-4);
  gap: var(--space-2);
  margin: auto;
}

.tickets-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: 480px;
  overflow-y: auto;
}

.ticket-list-item {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ticket-list-item:hover {
  border-color: var(--wl-primary);
  background: var(--wl-surface);
}

.ticket-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ticket-item-subject {
  font-size: var(--step--1);
  color: var(--wl-ink-strong);
  line-height: 1.3;
}

.ticket-item-snippet {
  font-size: var(--step--2);
  color: var(--wl-muted);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ticket-item-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed var(--wl-border);
}

.has-reply-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #047857;
  font-weight: 700;
}

.waiting-reply-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #b45309;
}

.view-thread-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--wl-primary);
  font-weight: 700;
}

/* Status Badges */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--step--2);
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
}

.badge--success {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}
.badge--success .badge-dot { background: #10b981; }

.badge--warning {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}
.badge--warning .badge-dot { background: #f59e0b; }

.badge--info {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}
.badge--info .badge-dot { background: #3b82f6; }

.badge--neutral {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
}
.badge--neutral .badge-dot { background: #94a3b8; }

/* Dynamic FAQs Section */
.faqs-section {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  margin-top: var(--space-5);
}

.faqs-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.faqs-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
}

.faqs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-3);
}

.faq-card {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  cursor: pointer;
  transition: all 0.15s ease;
  display: block;
  width: 100%;
  text-align: start;
  font: inherit;
  color: inherit;
}
.faq-card:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.faq-card:hover {
  border-color: var(--wl-border-strong);
}

.faq-card--open {
  border-color: var(--wl-primary);
  background: var(--wl-surface);
}

.faq-question-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.faq-q {
  font-size: var(--step--1);
  color: var(--wl-ink-strong);
}

.faq-toggle-icon {
  font-size: 18px;
  color: var(--wl-muted);
}

.faq-a {
  font-size: var(--step--1);
  color: var(--wl-ink-strong);
  line-height: 1.5;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--wl-border);
}

/* OEM Inquiries Card */
.oem-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.oem-card-head {
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--wl-border);
  padding-bottom: var(--space-3);
}

.oem-card-heading {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.oem-card-sub {
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin: 4px 0 0;
}

.oem-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.toolbar-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  padding-inline-start: var(--space-10);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: var(--step--1);
  outline: none;
}

.toolbar-input:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.counter-text {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

/* Modals */
.ticket-modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.ticket-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ticket-modal-subject {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
}

.message-card {
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.message-card--provider {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
}

.message-card--admin {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
}

.message-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.message-content {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
}

.reply-content {
  color: #064e3b;
}

.pending-reply-banner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.admin-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-k {
  font-size: var(--step--2);
  color: var(--wl-muted);
}

.detail-v {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
}

.detail-v--pre {
  font-size: var(--step--1);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  white-space: pre-wrap;
  margin: 0;
  color: var(--wl-ink-strong);
}

@media (max-width: 900px) {
  .support-dual-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .form-row {
    flex-direction: column;
  }
  .w-48 {
    width: 100%;
  }
}
</style>
