<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ProviderLayout from '../../components/layout/ProviderLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import { salesService, companyService } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { t, locale } from '../../i18n'
import type { RfqDto, QuoteDto, RfqItemDto } from '../../domain/models/sales'
import type { ProductInquiryDto } from '../../domain/ports/sales-repository'
import { parseNegotiationNote } from '../../utils/negotiation'
import { formatPrice } from '../../utils/format'

const localized = (en?: string | null, ar?: string | null) =>
  locale.value === 'ar' ? ar || en || '' : en || ar || ''

const getItemRequestedCurrency = (it: Partial<RfqItemDto>, rfq?: RfqDto | null): string => {
  return it.requestedCurrency || rfq?.requestedCurrency || rfq?.currency || 'USD'
}

const getItemBaseCurrency = (it: Partial<RfqItemDto>, rfq?: RfqDto | null): string => {
  return it.baseCurrency || rfq?.baseCurrency || 'USD'
}

const getItemRequestedUnitPrice = (it: RfqItemDto): number => {
  if (it.requestedPrice != null && it.requestedPrice > 0) return it.requestedPrice
  return it.unitPrice || 0
}

const getItemBaseUnitPrice = (it: RfqItemDto): number => {
  if (it.basePrice != null && it.basePrice > 0) return it.basePrice
  return it.unitPrice || 0
}

const getItemRequestedTotal = (it: RfqItemDto): number => {
  return getItemRequestedUnitPrice(it) * (it.quantity || 1)
}

const getItemBaseTotal = (it: RfqItemDto): number => {
  return getItemBaseUnitPrice(it) * (it.quantity || 1)
}

const hasConversion = (rfq?: RfqDto | null): boolean => {
  if (!rfq) return false
  const rCur = rfq.requestedCurrency || rfq.currency
  return Boolean(rfq.baseCurrency && rCur && rfq.baseCurrency !== rCur)
}

const hasItemConversion = (it: RfqItemDto, rfq?: RfqDto | null): boolean => {
  const bCur = getItemBaseCurrency(it, rfq)
  const rCur = getItemRequestedCurrency(it, rfq)
  return Boolean(bCur && rCur && bCur !== rCur)
}

const selectedRfqTotal = computed(() => {
  if (!selectedRfq.value?.items || !selectedRfq.value.items.length) return selectedRfq.value?.total || 0
  return selectedRfq.value.items.reduce((sum, it) => sum + getItemRequestedTotal(it), 0)
})

const selectedRfqBaseTotal = computed(() => {
  if (!selectedRfq.value?.items || !selectedRfq.value.items.length) return 0
  return selectedRfq.value.items.reduce((sum, it) => sum + getItemBaseTotal(it), 0)
})

const rfqs = salesService.rfqs
const quotes = salesService.quotes
const inquiries = ref<ProductInquiryDto[]>([])
const loading = ref(true)
const fetchError = ref('')
const search = ref('')
const statusFilter = ref('all')
const tab = ref<'all' | 'negotiations' | 'quotes' | 'inquiries'>('all')
const page = ref(1)
const pageSize = 10

// Action states
const acting = ref('')
const selectedRfq = ref<RfqDto | null>(null)
const showDetailModal = ref(false)

// Quote detail modal
const selectedQuote = ref<QuoteDto | null>(null)
const showQuoteDetailModal = ref(false)

const openQuoteDetails = (q: QuoteDto) => {
  selectedQuote.value = q
  showQuoteDetailModal.value = true
}

// Counter-offer modal
const showCounterModal = ref(false)
const counterRfq = ref<RfqDto | null>(null)
const counterAmount = ref<number | null>(null)
const counterNote = ref('')
const counterValidityDays = ref(14)
const submittingCounter = ref(false)

// Inquiry Response modal
const selectedInquiry = ref<ProductInquiryDto | null>(null)
const showInquiryModal = ref(false)
const inquiryResponseText = ref('')
const submittingInquiryResponse = ref(false)

const openInquiryResponse = (inq: ProductInquiryDto) => {
  selectedInquiry.value = inq
  inquiryResponseText.value = inq.response || ''
  showInquiryModal.value = true
}

const submitInquiryResponse = async () => {
  if (!selectedInquiry.value || !inquiryResponseText.value.trim()) {
    toastService.error(t('common.error'))
    return
  }
  submittingInquiryResponse.value = true
  try {
    const res = await salesService.respondProductInquiry(selectedInquiry.value.id, inquiryResponseText.value.trim())
    if (res.ok) {
      if (res.inquiry) {
        const idx = inquiries.value.findIndex((x) => x.id === selectedInquiry.value?.id)
        if (idx !== -1) inquiries.value[idx] = res.inquiry
      }
      showInquiryModal.value = false
      await loadData()
    } else {
      toastService.error(res.error || t('common.error'))
    }
  } finally {
    submittingInquiryResponse.value = false
  }
}

const loadData = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    const [, , , inqPage] = await Promise.all([
      companyService.loadMyCompany().catch(() => null),
      salesService.loadRfqs({ pageSize: 50 }),
      salesService.loadQuotes({ pageSize: 50 }),
      salesService.loadProductInquiries({ pageSize: 50 }).catch(() => null),
    ])
    inquiries.value = inqPage?.data || []
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadData()
})

interface EnhancedRfq extends RfqDto {
  negotiation: ReturnType<typeof parseNegotiationNote>
}

const enhancedRfqs = computed<EnhancedRfq[]>(() => {
  return rfqs.value.map((r) => ({
    ...r,
    negotiation: parseNegotiationNote(r.note),
  }))
})

// Metrics
const totalRfqsCount = computed(() => rfqs.value.length)
const negotiationsCount = computed(() => enhancedRfqs.value.filter((r) => r.negotiation.isNegotiation).length)
const quotesCount = computed(() => quotes.value.length)

const filteredRfqs = computed(() => {
  let list = enhancedRfqs.value

  if (tab.value === 'negotiations') {
    list = list.filter((r) => r.negotiation.isNegotiation)
  }

  if (statusFilter.value !== 'all') {
    list = list.filter((r) => String(r.status || '').toLowerCase() === statusFilter.value.toLowerCase())
  }

  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter((r) => {
      const num = r.rfqNumber?.toLowerCase() || ''
      const comp = r.companyName?.toLowerCase() || ''
      const note = r.note?.toLowerCase() || ''
      const hasItem = Array.isArray(r.items) && r.items.some((it) =>
        (it.productNameEn?.toLowerCase() || '').includes(q) ||
        (it.productNameAr?.toLowerCase() || '').includes(q) ||
        (it.productId?.toLowerCase() || '').includes(q)
      )
      return num.includes(q) || comp.includes(q) || note.includes(q) || hasItem
    })
  }

  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRfqs.value.length / pageSize)))
const paginatedRfqs = computed(() =>
  filteredRfqs.value.slice((page.value - 1) * pageSize, page.value * pageSize)
)

const openDetails = (rfq: RfqDto) => {
  selectedRfq.value = rfq
  showDetailModal.value = true
}

const isValidGuid = (v?: string | null): boolean =>
  !!v && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)

const buildQuoteLines = (rfq: RfqDto | EnhancedRfq) => {
  const items = Array.isArray(rfq.items) && rfq.items.length ? rfq.items : []
  return items
    .filter((it) => isValidGuid(it.productId))
    .map((it) => ({
      productId: it.productId,
      quantity: it.quantity || 1,
      unitPrice: getItemRequestedUnitPrice(it as RfqItemDto) || it.unitPrice || 0,
    }))
}

const handleAcceptNegotiation = async (rfq: EnhancedRfq) => {
  const targetPriceStr = rfq.negotiation.targetTotal || 'Proposed Price'
  const ok = await confirmService.confirm({
    title: t('provider.acceptNegotiation'),
    message: `${t('provider.proposedTargetPrice')}: ${targetPriceStr}. ${t('provider.acceptSuccess')}`,
    variant: 'primary',
    confirmText: t('provider.acceptNegotiation'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return

  acting.value = rfq.id
  try {
    // Generate validUntil date 14 days from now
    const d = new Date()
    d.setDate(d.getDate() + 14)
    const validUntil = d.toISOString().split('T')[0]

    // Create quote reflecting client's negotiated total if items exist
    const lines = buildQuoteLines(rfq)

    const targetNum = parseFloat((rfq.negotiation.targetTotal || '').replace(/[^0-9.]/g, '')) || (rfq.total || 0)
    if (!lines.length) {
      toastService.error(t('common.error'))
      return
    }
    const res = await salesService.createQuote({
      rfqId: rfq.id,
      amount: targetNum,
      validUntil: validUntil || '',
      items: lines,
    })

    if (res.ok) {
      toastService.success(t('provider.acceptSuccess'))
      await loadData()
    } else {
      toastService.error(res.error)
    }
  } finally {
    acting.value = ''
  }
}

const handleAcceptInquiry = async (rfq: RfqDto | EnhancedRfq) => {
  const ok = await confirmService.confirm({
    title: t('provider.acceptNegotiation'),
    message: t('provider.acceptSuccess'),
    variant: 'primary',
    confirmText: t('provider.acceptNegotiation'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return

  acting.value = rfq.id
  try {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    const validUntil = d.toISOString().split('T')[0]

    const lines = buildQuoteLines(rfq)
    if (!lines.length) {
      toastService.error(t('common.error'))
      return
    }
    const amount = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0) || (rfq.total || 0)
    const res = await salesService.createQuote({
      rfqId: rfq.id,
      amount,
      validUntil: validUntil || '',
      items: lines,
    })

    if (res.ok) {
      toastService.success(t('provider.acceptSuccess'))
      await loadData()
    } else {
      toastService.error(res.error)
    }
  } finally {
    acting.value = ''
  }
}

const openCounterModal = (rfq: EnhancedRfq) => {
  counterRfq.value = rfq
  // Pre-fill counter amount with target total or current total
  const parsedNum = parseFloat((rfq.negotiation.targetTotal || '').replace(/[^0-9.]/g, ''))
  counterAmount.value = !isNaN(parsedNum) ? parsedNum : (rfq.total || 0)
  counterNote.value = ''
  counterValidityDays.value = 14
  showCounterModal.value = true
}

const submitCounterOffer = async () => {
  if (!counterRfq.value || !counterAmount.value || counterAmount.value <= 0) {
    toastService.info(t('sales.targetPriceValidation'))
    return
  }

  submittingCounter.value = true
  try {
    const d = new Date()
    d.setDate(d.getDate() + (counterValidityDays.value || 14))
    const validUntil = d.toISOString().split('T')[0]

    const rfq = counterRfq.value
    const validItems = (Array.isArray(rfq.items) ? rfq.items : []).filter((it) =>
      isValidGuid(it.productId),
    )
    if (!validItems.length) {
      toastService.error(t('common.error'))
      return
    }
    const lineTotals = validItems.map(
      (it) => (getItemRequestedUnitPrice(it as RfqItemDto) || it.unitPrice || 0) * (it.quantity || 1),
    )
    const sumOriginal = lineTotals.reduce((s, v) => s + v, 0)
    const lines = validItems.map((it, idx) => {
      const qty = it.quantity || 1
      let unitPrice: number
      if (sumOriginal > 0) {
        unitPrice = Math.round((((lineTotals[idx] ?? 0) / sumOriginal) * (counterAmount.value || 0)) / qty * 100) / 100
      } else {
        unitPrice = Math.round(((counterAmount.value || 0) / validItems.length / qty) * 100) / 100
      }
      return { productId: it.productId, quantity: qty, unitPrice }
    })
    // Fix rounding drift on last line so sum(lines) === counter amount
    const sumLines = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
    const drift = Math.round(((counterAmount.value || 0) - sumLines) * 100) / 100
    const last = lines.length ? lines[lines.length - 1] : undefined
    if (drift !== 0 && last) {
      last.unitPrice = Math.round((last.unitPrice + drift / last.quantity) * 100) / 100
    }

    const res = await salesService.createQuote({
      rfqId: rfq.id,
      amount: counterAmount.value,
      validUntil: validUntil || '',
      note: counterNote.value.trim() || undefined,
      items: lines,
    })

    if (counterNote.value.trim()) {
      await salesService.respondRfq(rfq.id, {
        responseNote: counterNote.value.trim(),
        proposedAmount: counterAmount.value ?? undefined,
        validityDays: counterValidityDays.value,
      }).catch(() => null)
    }

    if (res.ok) {
      toastService.success(t('provider.counterSuccess'))
      showCounterModal.value = false
      await loadData()
    } else {
      toastService.error(res.error)
    }
  } finally {
    submittingCounter.value = false
  }
}

const handleDecline = async (rfq: RfqDto) => {
  const ok = await confirmService.confirm({
    title: t('sales.decline'),
    message: t('provider.declineSuccess'),
    variant: 'danger',
    confirmText: t('sales.statusDeclined'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return

  acting.value = rfq.id
  try {
    const res = await salesService.updateRfqStatus(rfq.id, 'Cancelled')
    if (res.ok) {
      toastService.success(t('provider.declineSuccess'))
      await loadData()
    } else {
      toastService.error(res.error)
    }
  } finally {
    acting.value = ''
  }
}
</script>

<template>
  <ProviderLayout>
    <div class="provider-quotes-view">
      <!-- Header -->
      <header class="view-header">
        <div>
          <span class="mono eyebrow">{{ t('provider.dashboard') }} · {{ t('admin.commerce') }}</span>
          <h1 class="view-title">{{ t('provider.quotes') }}</h1>
          <p class="view-desc">{{ t('provider.quotesDesc') }}</p>
        </div>
        <div class="header-actions">
          <BaseButton variant="ghost" icon="refresh" :loading="loading" @click="loadData">
            {{ t('common.refresh') }}
          </BaseButton>
        </div>
      </header>

      <!-- KPI Summary Cards — double as tabs -->
      <div class="kpi-grid" role="radiogroup" :aria-label="t('sales.rfqTitle')">
        <button
          type="button"
          class="kpi-card"
          role="radio"
          :aria-checked="tab === 'all'"
          :class="{ 'is-active': tab === 'all' }"
          @click="tab = 'all'"
        >
          <div class="kpi-icon-box bg-primary-soft">
            <span class="material-symbols-outlined text-primary" aria-hidden="true">request_quote</span>
          </div>
          <div class="kpi-info">
            <span class="kpi-label mono">{{ t('sales.rfqTitle') }}</span>
            <strong class="kpi-value mono">{{ totalRfqsCount }}</strong>
          </div>
        </button>

        <button
          type="button"
          class="kpi-card kpi-card--highlight"
          role="radio"
          :aria-checked="tab === 'negotiations'"
          :class="{ 'is-active': tab === 'negotiations' }"
          @click="tab = 'negotiations'"
        >
          <div class="kpi-icon-box bg-emerald-soft">
            <span class="material-symbols-outlined text-emerald-600" aria-hidden="true">handshake</span>
          </div>
          <div class="kpi-info">
            <span class="kpi-label mono">{{ t('provider.negotiationRequests') }}</span>
            <strong class="kpi-value mono text-emerald-600">{{ negotiationsCount }}</strong>
          </div>
          <span v-if="negotiationsCount > 0" class="negotiation-ping-badge mono">{{ negotiationsCount }}</span>
        </button>

        <button
          type="button"
          class="kpi-card"
          role="radio"
          :aria-checked="tab === 'quotes'"
          :class="{ 'is-active': tab === 'quotes' }"
          @click="tab = 'quotes'"
        >
          <div class="kpi-icon-box bg-teal-soft">
            <span class="material-symbols-outlined text-teal" aria-hidden="true">verified</span>
          </div>
          <div class="kpi-info">
            <span class="kpi-label mono">{{ t('sales.quoteTitle') }}</span>
            <strong class="kpi-value mono">{{ quotesCount }}</strong>
          </div>
        </button>

        <button
          type="button"
          class="kpi-card"
          role="radio"
          :aria-checked="tab === 'inquiries'"
          :class="{ 'is-active': tab === 'inquiries' }"
          @click="tab = 'inquiries'"
        >
          <div class="kpi-icon-box bg-purple-soft">
            <span class="material-symbols-outlined text-purple-600" aria-hidden="true">question_answer</span>
          </div>
          <div class="kpi-info">
            <span class="kpi-label mono">{{ locale === 'ar' ? 'استفسارات المنتجات' : 'Product Inquiries' }}</span>
            <strong class="kpi-value mono">{{ inquiries.length }}</strong>
          </div>
          <span v-if="inquiries.filter((i) => !i.response).length > 0" class="negotiation-ping-badge mono">
            {{ inquiries.filter((i) => !i.response).length }}
          </span>
        </button>
      </div>

      <!-- Quotes List Tab vs RFQ List Tab -->
      <template v-if="tab === 'quotes'">
        <div class="table-card">
          <div class="table-card-head">
            <h2 class="section-title">{{ t('sales.quoteTitle') }} ({{ quotes.length }})</h2>
          </div>

          <DataState :loading="loading" :error="fetchError" :empty="!quotes.length" :empty-title="t('sales.noQuotes')" @retry="loadData">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr class="mono">
                    <th>{{ t('sales.quoteTitle') }}</th>
                    <th>{{ t('sales.requestDate') }}</th>
                    <th>{{ t('commerce.total') }}</th>
                    <th>{{ t('sales.validThrough') }}</th>
                    <th>{{ t('commerce.status') }}</th>
                    <th class="text-end">{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="q in quotes" :key="q.id" class="table-row-clickable" @click="openQuoteDetails(q)">
                    <td>
                      <strong class="mono">{{ q.quoteNumber }}</strong>
                    </td>
                    <td class="mono text-muted text-sm">
                      {{ q.createdAt ? new Date(q.createdAt).toLocaleDateString() : '—' }}
                    </td>
                    <td>
                      <strong class="mono text-primary">{{ formatPrice(q.amount, locale) }} {{ q.currency || 'USD' }}</strong>
                    </td>
                    <td class="mono text-sm">
                      {{ q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—' }}
                    </td>
                    <td>
                      <StatusPill :status="q.status" />
                    </td>
                    <td class="text-end" @click.stop>
                      <button
                        type="button"
                        class="action-btn btn-view"
                        :title="t('common.details')"
                        @click="openQuoteDetails(q)"
                      >
                        <span class="material-symbols-outlined text-[16px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </DataState>
        </div>
      </template>

      <!-- Product Inquiries Tab -->
      <template v-else-if="tab === 'inquiries'">
        <div class="table-card">
          <div class="table-card-head">
            <h2 class="section-title">{{ locale === 'ar' ? 'استفسارات المنتجات' : 'Product Inquiries' }} ({{ inquiries.length }})</h2>
          </div>

          <DataState :loading="loading" :error="fetchError" :empty="!inquiries.length" :empty-title="locale === 'ar' ? 'لا توجد استفسارات حالياً' : 'No Product Inquiries Yet'" @retry="loadData">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr class="mono">
                    <th>{{ locale === 'ar' ? 'العميل' : 'Client' }}</th>
                    <th>{{ t('marketplace.products') }}</th>
                    <th>{{ t('pdp.inquiryMsg') }}</th>
                    <th>{{ t('commerce.status') }}</th>
                    <th class="text-end">{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="inq in inquiries"
                    :key="inq.id"
                    class="table-row-clickable"
                    @click="openInquiryResponse(inq)"
                  >
                    <td>
                      <div class="rfq-id-cell">
                        <strong class="mono rfq-num">{{ inq.name }}</strong>
                        <span v-if="inq.organization" class="text-xs text-muted block">{{ inq.organization }}</span>
                        <span v-if="inq.email" class="text-xs text-muted font-mono block">{{ inq.email }}</span>
                        <span class="text-xs text-muted font-mono block">{{ inq.createdAt ? new Date(inq.createdAt).toLocaleDateString() : '' }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="flex flex-col gap-1">
                        <strong class="text-sm font-semibold">{{ localized(inq.productNameEn, inq.productNameAr) || inq.productId }}</strong>
                        <span v-if="inq.productSku" class="mono text-xs text-muted">SKU: {{ inq.productSku }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="inquiry-msg-box">
                        <p class="text-sm italic">"{{ inq.message }}"</p>
                        <div v-if="inq.response" class="inquiry-response-preview mono">
                          <span class="material-symbols-outlined text-[14px] text-emerald-600">reply</span>
                          <span><strong>{{ locale === 'ar' ? 'ردك:' : 'Response:' }}</strong> {{ inq.response }}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        class="status-pill mono"
                        :class="inq.response || inq.status === 'Responded' ? 'status--quoted' : 'status--pending'"
                      >
                        {{ inq.response || inq.status === 'Responded' ? (locale === 'ar' ? 'تم الرد' : 'Responded') : (locale === 'ar' ? 'قيد الانتظار' : 'Pending') }}
                      </span>
                    </td>
                    <td class="text-end" @click.stop>
                      <button
                        type="button"
                        class="action-btn"
                        :class="inq.response ? 'btn-view' : 'btn-accept'"
                        :title="inq.response ? (locale === 'ar' ? 'عرض الرد' : 'View') : (locale === 'ar' ? 'رد' : 'Respond')"
                        @click="openInquiryResponse(inq)"
                      >
                        <span class="material-symbols-outlined text-[16px]">reply</span>
                        <span>{{ inq.response ? (locale === 'ar' ? 'عرض' : 'View') : (locale === 'ar' ? 'رد' : 'Respond') }}</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </DataState>
        </div>
      </template>

      <!-- RFQs & Price Negotiations Tab -->
      <template v-else>
        <!-- Filter Controls -->
        <div class="filter-bar">
          <div class="search-input-wrap">
            <span class="material-symbols-outlined search-ic">search</span>
            <input
              v-model="search"
              type="search"
              :placeholder="t('common.searchPlaceholder')"
              class="search-input"
            />
            <button v-if="search" type="button" class="clear-search-btn" @click="search = ''; page = 1" :aria-label="t('common.clearInput')">
              <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          <div class="filter-actions">
            <select v-model="statusFilter" class="filter-select mono">
              <option value="all">{{ t('common.all') }} {{ t('commerce.status') }}</option>
              <option value="Pending">{{ t('account.pipeStatusPending') }}</option>
              <option value="Quoted">{{ t('admin.pipeQuoted') }}</option>
              <option value="Declined">{{ t('sales.statusDeclined') }}</option>
            </select>
          </div>
        </div>

        <!-- RFQs / Inquiries Table -->
        <div class="table-card">
          <DataState :loading="loading" :error="fetchError" :empty="!paginatedRfqs.length" :empty-title="t('sales.noRfqs')" @retry="loadData">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr class="mono">
                    <th>{{ t('admin.rfqColumn') }}</th>
                    <th>{{ t('account.company') }}</th>
                    <th>{{ t('cart.trayHeading') }}</th>
                    <th>{{ t('commerce.total') }} / {{ t('provider.proposedTargetPrice') }}</th>
                    <th>{{ t('commerce.status') }}</th>
                    <th class="text-end">{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="rfq in paginatedRfqs"
                    :key="rfq.id"
                    class="table-row-clickable"
                    :class="{ 'row-negotiation': rfq.negotiation.isNegotiation }"
                    @click="openDetails(rfq)"
                  >
                    <!-- RFQ Number & Negotiation Tag -->
                    <td>
                      <div class="rfq-id-cell">
                        <strong class="mono rfq-num">{{ rfq.rfqNumber }}</strong>
                        <span v-if="rfq.negotiation.isNegotiation" class="negotiation-pill mono">
                          <span class="material-symbols-outlined text-[13px]">handshake</span>
                          <span>{{ t('provider.negotiationRequests') }}</span>
                          <strong v-if="rfq.negotiation.discountPercent">(-{{ rfq.negotiation.discountPercent }}%)</strong>
                        </span>
                        <span class="mono text-xs text-muted">
                          {{ rfq.createdAt ? new Date(rfq.createdAt).toLocaleDateString() : '—' }}
                        </span>
                      </div>
                    </td>

                    <!-- Client Company -->
                    <td>
                      <div class="client-cell">
                        <strong class="client-name">{{ rfq.companyName || 'Verified Client' }}</strong>
                        <span v-if="rfq.negotiation.reason" class="client-reason" :title="rfq.negotiation.reason">
                          <span class="material-symbols-outlined text-[14px] text-muted">chat</span>
                          <span>{{ rfq.negotiation.reason }}</span>
                        </span>
                      </div>
                    </td>

                    <!-- Items Summary -->
                    <td>
                      <div class="items-cell">
                        <span class="items-count-badge mono">
                          {{ Array.isArray(rfq.items) ? rfq.items.length : 0 }} {{ t('marketplace.products') }}
                        </span>
                        <div class="items-snippet mono">
                          <span v-for="(it, i) in (rfq.items || []).slice(0, 2)" :key="i" class="item-chip">
                            {{ localized(it.productNameEn, it.productNameAr) }} (x{{ it.quantity }})
                          </span>
                          <span v-if="(rfq.items?.length || 0) > 2" class="more-items">
                            +{{ (rfq.items?.length || 0) - 2 }}
                          </span>
                        </div>
                      </div>
                    </td>

                    <!-- Price / Negotiated Price -->
                    <td>
                      <div class="price-cell mono">
                        <template v-if="rfq.negotiation.isNegotiation && rfq.negotiation.targetTotal">
                          <div class="target-price-badge">
                            <span class="target-lbl">{{ t('provider.proposedTargetPrice') }}:</span>
                            <strong class="target-val">{{ rfq.negotiation.targetTotal }}</strong>
                          </div>
                          <span v-if="rfq.total" class="original-price-striked">
                            {{ t('commerce.subtotal') }}: {{ formatPrice(rfq.total, locale) }} {{ rfq.requestedCurrency || rfq.currency || 'USD' }}
                          </span>
                        </template>
                        <template v-else>
                          <strong class="regular-total">
                            {{ formatPrice(rfq.total || 0, locale) }} {{ rfq.requestedCurrency || rfq.currency || 'USD' }}
                          </strong>
                        </template>
                        <span
                          v-if="hasConversion(rfq)"
                          class="conversion-tag mono"
                          :title="`${t('sales.baseCurrency')}: ${rfq.baseCurrency} → ${t('sales.requestedCurrency')}: ${rfq.requestedCurrency || rfq.currency}`"
                        >
                          <span class="material-symbols-outlined text-[12px]">currency_exchange</span>
                          <span>{{ rfq.baseCurrency }} → {{ rfq.requestedCurrency || rfq.currency }}</span>
                        </span>
                      </div>
                    </td>

                    <!-- Status -->
                    <td>
                      <StatusPill :status="rfq.status" />
                    </td>

                    <!-- Actions -->
                    <td class="text-end" @click.stop>
                      <div class="action-btn-group">
                        <!-- If price negotiation pending -->
                        <template v-if="rfq.negotiation.isNegotiation && rfq.status === 'Pending'">
                          <button
                            type="button"
                            class="action-btn btn-accept"
                            :title="t('provider.acceptNegotiation')"
                            :disabled="acting === rfq.id"
                            @click="handleAcceptNegotiation(rfq)"
                          >
                            <span class="material-symbols-outlined text-[16px]">check_circle</span>
                            <span>{{ t('provider.acceptNegotiation') }}</span>
                          </button>

                          <button
                            type="button"
                            class="action-btn btn-counter"
                            :title="t('provider.counterOffer')"
                            :disabled="acting === rfq.id"
                            @click="openCounterModal(rfq)"
                          >
                            <span class="material-symbols-outlined text-[16px]">rate_review</span>
                            <span>{{ t('provider.counterOffer') }}</span>
                          </button>
                        </template>

                        <!-- Standard RFQ actions -->
                        <template v-else-if="rfq.status === 'Pending'">
                          <button
                            type="button"
                            class="action-btn btn-accept"
                            :title="t('provider.acceptNegotiation')"
                            :disabled="acting === rfq.id"
                            @click="handleAcceptInquiry(rfq)"
                          >
                            <span class="material-symbols-outlined text-[16px]">check_circle</span>
                            <span>{{ t('provider.acceptNegotiation') }}</span>
                          </button>

                          <button
                            type="button"
                            class="action-btn btn-counter"
                            :title="t('sales.createQuote')"
                            @click="openCounterModal(rfq)"
                          >
                            <span class="material-symbols-outlined text-[16px]">edit_note</span>
                            <span>{{ t('sales.createQuote') }}</span>
                          </button>
                        </template>

                        <button
                          type="button"
                          class="action-btn btn-view"
                          :title="t('common.details')"
                          @click="openDetails(rfq)"
                        >
                          <span class="material-symbols-outlined text-[16px]">visibility</span>
                        </button>

                        <button
                          v-if="rfq.status === 'Pending'"
                          type="button"
                          class="action-btn btn-decline"
                          :title="t('sales.statusDeclined')"
                          :disabled="acting === rfq.id"
                          @click="handleDecline(rfq)"
                        >
                          <span class="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="pagination-footer">
              <AppPagination v-model:page="page" :total-pages="totalPages" />
            </div>
          </DataState>
        </div>
      </template>

      <!-- RFQ Detail Modal -->
      <BaseModal
        v-model="showDetailModal"
        :title="`${t('sales.rfqDetail')} · ${selectedRfq?.rfqNumber || ''}`"
        size="lg"
      >
        <div v-if="selectedRfq" class="detail-modal-body">
          <!-- Negotiation Banner if present -->
          <div v-if="parseNegotiationNote(selectedRfq.note).isNegotiation" class="negotiation-banner">
            <span class="material-symbols-outlined text-[22px] text-emerald-600">handshake</span>
            <div class="banner-content">
              <strong class="banner-title">{{ t('provider.negotiationRequests') }}</strong>
              <p class="banner-desc">
                {{ t('provider.proposedTargetPrice') }}:
                <strong class="text-emerald-700">{{ parseNegotiationNote(selectedRfq.note).targetTotal }}</strong>
                <span v-if="parseNegotiationNote(selectedRfq.note).discountPercent">
                  ({{ t('provider.requestedDiscount') }}: {{ parseNegotiationNote(selectedRfq.note).discountPercent }}%)
                </span>
              </p>
              <p v-if="parseNegotiationNote(selectedRfq.note).reason" class="banner-reason">
                <em>"{{ parseNegotiationNote(selectedRfq.note).reason }}"</em>
              </p>
            </div>
          </div>

          <!-- Metadata Grid -->
          <div class="detail-grid mono">
            <div class="detail-item">
              <span class="lbl">{{ t('account.company') }}</span>
              <strong class="val">{{ selectedRfq.companyName || '—' }}</strong>
            </div>
            <div class="detail-item">
              <span class="lbl">{{ t('sales.requestDate') }}</span>
              <strong class="val">{{ selectedRfq.createdAt ? new Date(selectedRfq.createdAt).toLocaleString() : '—' }}</strong>
            </div>
            <div class="detail-item">
              <span class="lbl">{{ t('commerce.status') }}</span>
              <StatusPill :status="selectedRfq.status" />
            </div>
            <div class="detail-item">
              <span class="lbl">{{ t('sales.requestedCurrency') }}</span>
              <strong class="val text-indigo-700">
                {{ selectedRfq.requestedCurrency || selectedRfq.currency || 'USD' }}
                <span v-if="hasConversion(selectedRfq)" class="conversion-sub-badge">
                  ({{ t('sales.convertedFromBase') }}: {{ selectedRfq.baseCurrency }})
                </span>
              </strong>
            </div>
          </div>

          <!-- Line Items Table -->
          <div class="line-items-section">
            <div class="line-items-header-row">
              <h3 class="section-sub mono">{{ t('sales.lineItems') }} ({{ selectedRfq.items?.length || 0 }})</h3>
              <span v-if="hasConversion(selectedRfq)" class="conversion-summary-pill mono">
                <span class="material-symbols-outlined text-[13px]">currency_exchange</span>
                <span>{{ selectedRfq.baseCurrency }} → {{ selectedRfq.requestedCurrency || selectedRfq.currency }}</span>
              </span>
            </div>

            <div class="line-items-table-wrap">
              <table class="line-items-table mono">
                <thead>
                  <tr>
                    <th>{{ t('marketplace.products') }}</th>
                    <th class="text-center">{{ t('marketplace.quantity') }}</th>
                    <th class="text-end">{{ t('sales.baseUnitPrice') }}</th>
                    <th class="text-end">{{ t('sales.requestedUnitPrice') }}</th>
                    <th class="text-end">{{ t('sales.amount') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(it, idx) in selectedRfq.items || []" :key="idx">
                    <td>
                      <strong class="item-name">{{ localized(it.productNameEn, it.productNameAr) }}</strong>
                      <div class="text-xs text-muted item-sku">{{ it.productId }}</div>
                      <div v-if="it.exchangeRate" class="exchange-rate-badge mono">
                        <span class="material-symbols-outlined text-[12px]">info</span>
                        <span>1 {{ getItemBaseCurrency(it, selectedRfq) }} = {{ it.exchangeRate }} {{ getItemRequestedCurrency(it, selectedRfq) }}</span>
                      </div>
                    </td>
                    <td class="text-center item-qty">{{ it.quantity }}</td>
                    <td class="text-end item-base-price text-muted">
                      {{ formatPrice(getItemBaseUnitPrice(it), locale) }} {{ getItemBaseCurrency(it, selectedRfq) }}
                    </td>
                    <td class="text-end item-req-price font-semibold text-indigo-700">
                      {{ formatPrice(getItemRequestedUnitPrice(it), locale) }} {{ getItemRequestedCurrency(it, selectedRfq) }}
                    </td>
                    <td class="text-end item-amount">
                      <strong class="font-bold text-indigo-700 block">
                        {{ formatPrice(getItemRequestedTotal(it), locale) }} {{ getItemRequestedCurrency(it, selectedRfq) }}
                      </strong>
                      <span v-if="hasItemConversion(it, selectedRfq)" class="text-xs text-muted block sub-amount">
                        ({{ formatPrice(getItemBaseTotal(it), locale) }} {{ getItemBaseCurrency(it, selectedRfq) }})
                      </span>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="line-items-total-row">
                    <td colspan="4" class="text-end font-bold">{{ t('commerce.total') }}:</td>
                    <td class="text-end">
                      <strong class="total-requested-val text-indigo-700 font-extrabold text-base block">
                        {{ formatPrice(selectedRfqTotal, locale) }} {{ getItemRequestedCurrency(selectedRfq.items?.[0] || {}, selectedRfq) }}
                      </strong>
                      <span v-if="hasConversion(selectedRfq)" class="text-xs text-muted block">
                        ({{ formatPrice(selectedRfqBaseTotal, locale) }} {{ selectedRfq.baseCurrency }})
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- Note -->
          <div v-if="parseNegotiationNote(selectedRfq.note).cleanNote" class="detail-note">
            <span class="mono text-xs text-muted font-bold block mb-1">{{ t('sales.notes') }}:</span>
            <p class="detail-note-text">{{ parseNegotiationNote(selectedRfq.note).cleanNote }}</p>
          </div>
        </div>

        <template #footer>
          <div v-if="selectedRfq" class="modal-footer-actions">
            <BaseButton variant="ghost" @click="showDetailModal = false">{{ t('common.close') }}</BaseButton>
            <template v-if="selectedRfq.status === 'Pending'">
              <BaseButton
                v-if="parseNegotiationNote(selectedRfq.note).isNegotiation"
                variant="primary"
                class="btn-accept-negotiation"
                :loading="acting === selectedRfq.id"
                @click="showDetailModal = false; handleAcceptNegotiation(selectedRfq as any)"
              >
                <span class="material-symbols-outlined text-[16px]">check_circle</span>
                <span>{{ t('provider.acceptNegotiation') }}</span>
              </BaseButton>

              <BaseButton
                v-if="!parseNegotiationNote(selectedRfq.note).isNegotiation"
                variant="primary"
                class="btn-accept-negotiation"
                :loading="acting === selectedRfq.id"
                @click="showDetailModal = false; handleAcceptInquiry(selectedRfq as any)"
              >
                <span class="material-symbols-outlined text-[16px]">check_circle</span>
                <span>{{ t('provider.acceptNegotiation') }}</span>
              </BaseButton>

              <BaseButton
                variant="primary"
                @click="showDetailModal = false; openCounterModal(selectedRfq as any)"
              >
                <span class="material-symbols-outlined text-[16px]">rate_review</span>
                <span>{{ t('provider.counterOffer') }}</span>
              </BaseButton>
            </template>
          </div>
        </template>
      </BaseModal>

      <!-- Counter-Offer Modal -->
      <BaseModal v-model="showCounterModal" :title="t('provider.counterOffer')" size="md">
        <div v-if="counterRfq" class="counter-modal-body">
          <div v-if="hasConversion(counterRfq)" class="currency-reminder-box mono">
            <span class="material-symbols-outlined text-[16px] text-indigo-600">currency_exchange</span>
            <div>
              <span class="text-xs text-muted">{{ t('provider.clientRequestedCurrency') }}:</span>
              <strong class="text-xs text-indigo-700"> {{ counterRfq.requestedCurrency || counterRfq.currency }}</strong>
              <span class="text-xs text-muted"> ({{ t('sales.convertedFromBase') }}: {{ counterRfq.baseCurrency }})</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-lbl mono">{{ t('provider.counterAmount') }} ({{ counterRfq.requestedCurrency || counterRfq.currency || 'USD' }}) *</label>
            <input
              v-model.number="counterAmount"
              type="number"
              min="1"
              step="any"
              class="form-input mono"
              :placeholder="String(counterRfq.total || 0)"
            />
          </div>

          <div class="form-group">
            <label class="form-lbl mono">{{ t('sales.validThrough') }}</label>
            <input
              v-model.number="counterValidityDays"
              type="number"
              min="1"
              max="90"
              class="form-input mono"
            />
          </div>

          <div class="form-group">
            <label class="form-lbl mono">{{ t('provider.counterNote') }}</label>
            <textarea
              v-model="counterNote"
              rows="3"
              class="form-textarea"
              :placeholder="t('provider.counterNote')"
            ></textarea>
          </div>
        </div>

        <template #footer>
          <div class="modal-footer-actions">
            <BaseButton variant="ghost" @click="showCounterModal = false">{{ t('common.cancel') }}</BaseButton>
            <BaseButton variant="primary" :loading="submittingCounter" @click="submitCounterOffer">
              {{ t('provider.counterOffer') }}
            </BaseButton>
          </div>
        </template>
      </BaseModal>

      <!-- Quote Detail Modal -->
      <BaseModal
        v-model="showQuoteDetailModal"
        :title="`${t('sales.quoteTitle')} · ${selectedQuote?.quoteNumber || ''}`"
        size="lg"
      >
        <div v-if="selectedQuote" class="detail-modal-body">
          <div class="detail-grid mono">
            <div class="detail-item">
              <span class="lbl">{{ t('sales.quoteTitle') }}</span>
              <strong class="val">{{ selectedQuote.quoteNumber }}</strong>
            </div>
            <div class="detail-item">
              <span class="lbl">{{ t('sales.requestDate') }}</span>
              <strong class="val">{{ selectedQuote.createdAt ? new Date(selectedQuote.createdAt).toLocaleDateString() : '—' }}</strong>
            </div>
            <div class="detail-item">
              <span class="lbl">{{ t('sales.validThrough') }}</span>
              <strong class="val">{{ selectedQuote.validUntil ? new Date(selectedQuote.validUntil).toLocaleDateString() : '—' }}</strong>
            </div>
            <div class="detail-item">
              <span class="lbl">{{ t('commerce.status') }}</span>
              <StatusPill :status="selectedQuote.status" />
            </div>
          </div>

          <!-- Line items -->
          <div v-if="selectedQuote.items && selectedQuote.items.length" class="line-items-section">
            <h3 class="section-sub mono">{{ t('sales.lineItems') }}</h3>
            <div class="line-items-table-wrap">
              <table class="line-items-table mono">
                <thead>
                  <tr>
                    <th>{{ t('marketplace.products') }}</th>
                    <th class="text-center">{{ t('marketplace.quantity') }}</th>
                    <th class="text-end">{{ t('admin.quoteUnitPrice') }}</th>
                    <th class="text-end">{{ t('admin.quoteSubtotal') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(it, idx) in selectedQuote.items" :key="idx">
                    <td>
                      <strong>{{ localized(it.productNameEn, it.productNameAr) }}</strong>
                      <div class="text-xs text-muted">{{ it.productId }}</div>
                    </td>
                    <td class="text-center">{{ it.quantity }}</td>
                    <td class="text-end">{{ formatPrice(it.unitPrice || 0, locale) }} {{ selectedQuote.currency || 'USD' }}</td>
                    <td class="text-end"><strong>{{ formatPrice((it.unitPrice || 0) * (it.quantity || 1), locale) }} {{ selectedQuote.currency || 'USD' }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Total Summary -->
          <div class="order-summary-box mono">
            <span class="summary-lbl">{{ t('commerce.total') }}:</span>
            <strong class="summary-val text-primary">{{ formatPrice(selectedQuote.amount, locale) }} {{ selectedQuote.currency || 'USD' }}</strong>
          </div>
        </div>

        <template #footer>
          <div class="modal-footer-actions">
            <BaseButton variant="secondary" type="button" @click="showQuoteDetailModal = false">
              {{ t('common.close') }}
            </BaseButton>
          </div>
        </template>
      </BaseModal>

      <!-- Product Inquiry Response Modal -->
      <BaseModal
        v-model="showInquiryModal"
        :title="`${locale === 'ar' ? 'الرد على استفسار المنتج' : 'Respond to Product Inquiry'} · ${selectedInquiry?.name || ''}`"
        size="md"
      >
        <div v-if="selectedInquiry" class="detail-modal-body">
          <div class="inquiry-modal-meta mono">
            <div class="detail-item">
              <span class="lbl">{{ t('pdp.inquiryName') }}</span>
              <strong class="val">{{ selectedInquiry.name }}</strong>
            </div>
            <div class="detail-item" v-if="selectedInquiry.organization">
              <span class="lbl">{{ t('pdp.inquiryOrg') }}</span>
              <strong class="val">{{ selectedInquiry.organization }}</strong>
            </div>
            <div class="detail-item" v-if="selectedInquiry.email">
              <span class="lbl">Email</span>
              <strong class="val">{{ selectedInquiry.email }}</strong>
            </div>
            <div class="detail-item">
              <span class="lbl">{{ t('marketplace.products') }}</span>
              <strong class="val">{{ localized(selectedInquiry.productNameEn, selectedInquiry.productNameAr) || selectedInquiry.productId }}</strong>
            </div>
          </div>

          <div class="inquiry-quote-bubble">
            <span class="material-symbols-outlined text-[18px] text-muted">format_quote</span>
            <p class="text-sm">"{{ selectedInquiry.message }}"</p>
          </div>

          <div class="form-group mt-3">
            <label class="form-lbl mono">{{ locale === 'ar' ? 'رد المزوّد للعميل' : 'Provider Response to Customer' }} *</label>
            <textarea
              v-model="inquiryResponseText"
              rows="4"
              class="form-textarea"
              :placeholder="locale === 'ar' ? 'اكتب ردك المفصل مع شروط الأسعار والتوريد هنا...' : 'Type your detailed response regarding pricing, MOQ, or specifications...'"
            ></textarea>
          </div>
        </div>

        <template #footer>
          <div class="modal-footer-actions">
            <BaseButton variant="ghost" @click="showInquiryModal = false">{{ t('common.cancel') }}</BaseButton>
            <BaseButton variant="primary" :loading="submittingInquiryResponse" @click="submitInquiryResponse">
              <span class="material-symbols-outlined text-[16px]">send</span>
              <span>{{ locale === 'ar' ? 'إرسال الرد' : 'Send Response' }}</span>
            </BaseButton>
          </div>
        </template>
      </BaseModal>
    </div>
  </ProviderLayout>
</template>

<style scoped>
.provider-quotes-view {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
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
}

/* KPI Cards */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  position: relative;
  transition: all 0.18s ease;
  /* Reset native button chrome so the card keeps its div appearance */
  width: 100%;
  font: inherit;
  color: inherit;
  text-align: start;
}
.kpi-card:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.kpi-card:hover {
  border-color: var(--wl-border-strong);
  transform: translateY(-1px);
}

.kpi-card.is-active {
  border-color: var(--secondary, #00A389);
  box-shadow: 0 4px 14px rgba(0, 163, 137, 0.18);
  background: var(--brand-soft, #E8F8F5);
}

.kpi-card--highlight.is-active {
  border-color: #059669;
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.12);
}

.kpi-icon-box {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
}

.bg-primary-soft { background: var(--wl-primary-soft); }
.bg-emerald-soft { background: #ecfdf5; }
.bg-teal-soft { background: rgba(0, 163, 137, 0.12); }
.bg-purple-soft { background: #f5f3ff; }
.text-teal { color: var(--secondary, #00A389); }

.inquiry-msg-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 480px;
}

.inquiry-response-preview {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 6px 10px;
  background: var(--wl-surface-soft, #f8fafc);
  border: 1px solid var(--wl-border, #e2e8f0);
  border-radius: var(--radius-sm, 6px);
  font-size: 12px;
  color: var(--wl-ink-soft, #334155);
}

.inquiry-quote-bubble {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  background: var(--wl-surface-soft, #f1f5f9);
  border-radius: var(--radius-sm, 6px);
  margin-top: 12px;
  border-inline-start: 3px solid var(--wl-primary);
}

.inquiry-modal-meta {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 12px;
  background: var(--wl-surface-soft, #f8fafc);
  border-radius: var(--radius-sm, 6px);
  border: 1px solid var(--wl-border, #e2e8f0);
}

.kpi-info {
  display: flex;
  flex-direction: column;
}

.kpi-label {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.kpi-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.negotiation-ping-badge {
  position: absolute;
  top: 10px;
  inset-inline-end: 10px;
  background: #059669;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: var(--radius-full);
}

/* Filter Bar */
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.search-input-wrap {
  position: relative;
  flex: 1;
  min-width: 260px;
}

.search-ic {
  position: absolute;
  inset-inline-start: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--wl-muted);
  font-size: 18px;
}

.search-input {
  width: 100%;
  height: 40px;
  padding-inline-start: 36px;
  padding-inline-end: 36px;
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  outline: none;
}

.clear-search-btn {
  position: absolute;
  inset-inline-end: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--wl-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 4px;
}

.filter-select {
  height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: var(--step--1);
  outline: none;
}

/* Table Card */
.table-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.table-card-head {
  padding: var(--space-4);
  border-bottom: 1px solid var(--wl-border);
}

.section-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
}

.table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  width: 100%;
  min-width: 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--wl-border);
  text-align: start;
  vertical-align: middle;
}

.table-row-clickable {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.table-row-clickable:hover {
  background-color: var(--wl-surface-soft);
}

.order-summary-box {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--wl-surface-soft);
  border-radius: var(--radius-md);
  border: 1px solid var(--wl-border);
}

.summary-lbl {
  font-size: var(--step-0);
  color: var(--wl-muted);
}

.summary-val {
  font-size: 1.25rem;
  font-weight: 800;
}

.data-table th {
  background: var(--wl-surface-soft);
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
}

.row-negotiation {
  background: #f0fdf4;
}

.rfq-id-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.rfq-num {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
}

.negotiation-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
  font-size: 11px;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  width: fit-content;
}

.client-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.client-name {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
}

.client-reason {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--wl-muted);
  max-width: 250px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.items-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.items-count-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-muted);
}

.items-snippet {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.item-chip {
  font-size: 11px;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more-items {
  font-size: 11px;
  color: var(--wl-muted);
}

.price-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.target-price-badge {
  display: flex;
  flex-direction: column;
}

.target-lbl {
  font-size: 10px;
  color: #059669;
  text-transform: uppercase;
}

.target-val {
  font-size: var(--step-0);
  color: #059669;
  font-weight: 800;
}

.original-price-striked {
  font-size: 11px;
  color: var(--wl-muted);
  text-decoration: line-through;
}

.regular-total {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
}

.conversion-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--wl-primary, #4338ca);
  background: var(--wl-primary-soft, #eef2ff);
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  margin-top: 3px;
  width: fit-content;
}

.currency-reminder-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-md, 8px);
  background: var(--wl-primary-soft, #eef2ff);
  border: 1px solid var(--wl-primary-border, #c7d2fe);
  margin-bottom: 12px;
}

/* Actions */
.action-btn-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}

.btn-accept {
  background: #059669;
  color: #fff;
}
.btn-accept:hover {
  background: #047857;
}

.btn-counter {
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
  border: 1px solid var(--wl-border);
}
.btn-counter:hover {
  background: var(--wl-primary);
  color: #fff;
}

.btn-view {
  background: var(--wl-surface-soft);
  color: var(--wl-muted);
  border: 1px solid var(--wl-border);
  padding: 6px;
}
.btn-view:hover {
  color: var(--wl-ink-strong);
  border-color: var(--wl-border-strong);
}

.btn-decline {
  background: transparent;
  color: var(--wl-danger);
  border: 1px solid transparent;
  padding: 6px;
}
.btn-decline:hover {
  background: var(--wl-danger-soft);
  border-color: var(--wl-border);
}

.pagination-footer {
  padding: var(--space-4);
  display: flex;
  justify-content: center;
  border-top: 1px solid var(--wl-border);
}

/* Detail Modal */
/* Detail Modal */
.detail-modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
  padding: 0;
}

.negotiation-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3, 12px);
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: var(--radius-md, 8px);
  padding: var(--space-3, 12px) var(--space-4, 16px);
}

.banner-content {
  flex: 1;
}

.banner-title {
  color: #065f46;
  font-size: var(--step-0);
  display: block;
  font-weight: 700;
}

.banner-desc {
  font-size: var(--step--1);
  color: #047857;
  margin: 3px 0 0;
}

.banner-reason {
  font-size: var(--step--1);
  color: var(--wl-ink-strong);
  margin-top: 4px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px) var(--space-4, 16px);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md, 8px);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-item .lbl {
  font-size: 11px;
  color: var(--wl-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}

.detail-item .val {
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
}

.conversion-sub-badge {
  display: block;
  font-size: 11px;
  color: var(--wl-muted);
  font-weight: 500;
  margin-top: 1px;
}

.line-items-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.line-items-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.conversion-summary-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #4338ca;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.line-items-table-wrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md, 8px);
  background: var(--wl-surface);
}

.line-items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--step--1);
  min-width: 580px;
}

.line-items-table th,
.line-items-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--wl-border);
  vertical-align: middle;
}

.line-items-table th {
  background: var(--wl-surface-soft);
  color: var(--wl-muted);
  font-weight: 700;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.item-name {
  color: var(--wl-ink-strong);
  font-size: var(--step--1);
}

.item-sku {
  margin-top: 2px;
}

.exchange-rate-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10.5px;
  color: #4338ca;
  background: #eef2ff;
  padding: 1px 6px;
  border-radius: 4px;
  margin-top: 4px;
}

.item-base-price {
  font-size: 12px;
}

.item-req-price {
  font-size: 13px;
}

.item-amount {
  font-size: 13px;
}

.sub-amount {
  margin-top: 2px;
  font-size: 11px;
}

.line-items-total-row td {
  background: var(--wl-surface-soft);
  font-weight: 700;
  border-bottom: none;
  padding: 12px 14px;
}

.total-requested-val {
  font-size: var(--step-0);
}

.detail-note {
  background: var(--wl-surface-soft);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--wl-border);
  font-size: var(--step--1);
  color: var(--wl-ink-strong);
}

.detail-note-text {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.45;
}

.modal-footer-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  width: 100%;
}

.btn-accept-negotiation {
  background: #059669 !important;
  color: #fff !important;
}
.btn-accept-negotiation:hover {
  background: #047857 !important;
}

/* Counter Modal */
.counter-modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

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

.form-input:focus,
.form-textarea:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

@media (max-width: 768px) {
  .view-header {
    flex-direction: column;
  }
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }
  .kpi-card {
    padding: var(--space-3);
  }
}

@media (max-width: 440px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}
</style>
