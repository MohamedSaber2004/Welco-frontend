<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAnimation } from '../../composables/useAnimation'
import { t, locale } from '../../i18n'
import { salesService } from '../../di/container'
import AccountNav from '../../components/account/AccountNav.vue'
import BackButton from '../../components/ui/BackButton.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import type { ProductInquiryDto } from '../../domain/ports/sales-repository'

useAnimation()

const router = useRouter()
const inquiries = ref<ProductInquiryDto[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const searchQuery = ref('')
const statusFilter = ref<'all' | 'pending' | 'responded'>('all')
const localPage = ref(1)
const pageSize = 8

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const res = await salesService.loadProductInquiries({ pageSize: 50 })
    const list = Array.isArray(res?.data) ? res.data : []
    inquiries.value = list
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('common.error')
    inquiries.value = []
  } finally {
    loading.value = false
  }
}

const totalCount = computed(() => inquiries.value.length)
const respondedCount = computed(() => inquiries.value.filter((i) => Boolean(i.response)).length)
const pendingCount = computed(() => inquiries.value.filter((i) => !i.response).length)

const filteredInquiries = computed(() => {
  let list = inquiries.value
  if (statusFilter.value === 'responded') {
    list = list.filter((i) => Boolean(i.response))
  } else if (statusFilter.value === 'pending') {
    list = list.filter((i) => !i.response)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter((i) => {
      const pEn = (i.productNameEn || '').toLowerCase()
      const pAr = (i.productNameAr || '').toLowerCase()
      const sku = (i.productSku || '').toLowerCase()
      const msg = (i.message || '').toLowerCase()
      const resp = (i.response || '').toLowerCase()
      const name = (i.name || '').toLowerCase()
      const org = (i.organization || '').toLowerCase()
      return pEn.includes(q) || pAr.includes(q) || sku.includes(q) || msg.includes(q) || resp.includes(q) || name.includes(q) || org.includes(q)
    })
  }

  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredInquiries.value.length / pageSize)))

const paginatedInquiries = computed(() => {
  const start = (localPage.value - 1) * pageSize
  return filteredInquiries.value.slice(start, start + pageSize)
})

function onSearch() {
  localPage.value = 1
}

function setFilter(f: 'all' | 'pending' | 'responded') {
  statusFilter.value = f
  localPage.value = 1
}

function clearFilters() {
  searchQuery.value = ''
  statusFilter.value = 'all'
  localPage.value = 1
}

function goPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  localPage.value = p
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="page-shell inquiry-list-view">
    <BackButton fallback="/account" variant="minimal" class="mb-3" />

    <!-- Breadcrumb -->
    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/account">{{ t('account.dashboard') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('account.myInquiriesTitle') }}</span>
    </nav>

    <!-- Header Section -->
    <header class="page-header">
      <div>
        <div class="eyebrow-tag mono">
          <span class="pulse-dot"></span>
          <span>{{ t('account.inquiryQueue') }}</span>
        </div>
        <h1 class="page-title">{{ t('account.myInquiriesTitle') }}</h1>
        <p class="page-subtitle">{{ t('account.myInquiriesDesc') }}</p>
      </div>

      <div class="header-actions">
        <BaseButton variant="primary" size="sm" @click="router.push({ name: 'marketplace' })">
          <span class="material-symbols-outlined text-[16px]">storefront</span>
          <span>{{ t('marketplace.browseMarketplace') }}</span>
        </BaseButton>
      </div>
    </header>

    <!-- Account Navigation Tabs -->
    <AccountNav />

    <!-- Executive Metrics Strip -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon kpi-icon--slate">
          <span class="material-symbols-outlined">contact_support</span>
        </div>
        <div class="kpi-body">
          <span class="kpi-label mono">{{ locale === 'ar' ? 'إجمالي الاستفسارات' : 'Total Inquiries' }}</span>
          <strong class="kpi-val mono">{{ totalCount }}</strong>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon kpi-icon--emerald">
          <span class="material-symbols-outlined">verified</span>
        </div>
        <div class="kpi-body">
          <span class="kpi-label mono">{{ locale === 'ar' ? 'تم الرد عليها' : 'Responded Inquiries' }}</span>
          <strong class="kpi-val mono text-emerald-600">{{ respondedCount }}</strong>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon kpi-icon--amber">
          <span class="material-symbols-outlined">hourglass_top</span>
        </div>
        <div class="kpi-body">
          <span class="kpi-label mono">{{ locale === 'ar' ? 'قيد الانتظار' : 'Awaiting Reply' }}</span>
          <strong class="kpi-val mono text-amber-600">{{ pendingCount }}</strong>
        </div>
      </div>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="filter-toolbar">
      <div class="filter-tabs">
        <button
          type="button"
          class="filter-tab mono"
          :class="{ 'is-active': statusFilter === 'all' }"
          @click="setFilter('all')"
        >
          <span>{{ locale === 'ar' ? 'الكل' : 'All' }}</span>
          <span class="tab-count">{{ totalCount }}</span>
        </button>

        <button
          type="button"
          class="filter-tab mono"
          :class="{ 'is-active': statusFilter === 'responded' }"
          @click="setFilter('responded')"
        >
          <span>{{ locale === 'ar' ? 'تم الرد' : 'Responded' }}</span>
          <span class="tab-count tab-count--success">{{ respondedCount }}</span>
        </button>

        <button
          type="button"
          class="filter-tab mono"
          :class="{ 'is-active': statusFilter === 'pending' }"
          @click="setFilter('pending')"
        >
          <span>{{ locale === 'ar' ? 'قيد الانتظار' : 'Pending' }}</span>
          <span class="tab-count tab-count--warning">{{ pendingCount }}</span>
        </button>
      </div>

      <div class="search-box">
        <span class="material-symbols-outlined search-icon text-[18px]">search</span>
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="locale === 'ar' ? 'البحث عن منتج أو كود SKU أو محتوى استفسار...' : 'Search by product name, SKU, or message...'"
          class="search-input"
          @input="onSearch"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="clear-btn"
          :title="locale === 'ar' ? 'مسح البحث' : 'Clear search'"
          @click="clearFilters"
        >
          <span class="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="inquiries-loading">
      <div v-for="i in 3" :key="i" class="skeleton-card">
        <div class="skeleton-line skeleton-header"></div>
        <div class="skeleton-line skeleton-body"></div>
        <div class="skeleton-line skeleton-footer"></div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-banner">
      <span class="material-symbols-outlined text-[24px]">error</span>
      <div>
        <strong>{{ t('common.error') }}</strong>
        <p>{{ error }}</p>
      </div>
      <BaseButton size="sm" variant="outline" @click="loadData">
        {{ locale === 'ar' ? 'إعادة المحاولة' : 'Retry' }}
      </BaseButton>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredInquiries.length === 0" class="empty-state-card">
      <div class="empty-icon-circle">
        <span class="material-symbols-outlined text-[36px]">chat_bubble_outline</span>
      </div>
      <h3 class="empty-title">
        {{ searchQuery || statusFilter !== 'all' ? (locale === 'ar' ? 'لا توجد نتائج مطابقة' : 'No matching inquiries') : t('account.noInquiriesYet') }}
      </h3>
      <p class="empty-desc">
        {{ searchQuery || statusFilter !== 'all' ? (locale === 'ar' ? 'جرب تغيير معايير البحث أو تصفية الحالة.' : 'Try adjusting your search query or status filter.') : t('pdp.inquiryHint') }}
      </p>
      <div class="empty-actions">
        <BaseButton v-if="searchQuery || statusFilter !== 'all'" variant="outline" size="sm" @click="clearFilters">
          <span class="material-symbols-outlined text-[16px]">restart_alt</span>
          <span>{{ locale === 'ar' ? 'إعادة ضبط الفلتر' : 'Reset filters' }}</span>
        </BaseButton>
        <BaseButton v-else variant="primary" size="sm" @click="router.push({ name: 'marketplace' })">
          <span class="material-symbols-outlined text-[16px]">search</span>
          <span>{{ t('marketplace.browseMarketplace') }}</span>
        </BaseButton>
      </div>
    </div>

    <!-- Inquiries Cards Grid -->
    <div v-else class="inquiries-list">
      <article
        v-for="(inq, idx) in paginatedInquiries"
        :key="inq.id"
        class="inquiry-item-card anim-fade-in-up"
        :style="{ animationDelay: `${idx * 40}ms` }"
      >
        <!-- Card Top Bar: Product & Status -->
        <header class="item-header">
          <div class="product-info-wrap">
            <span class="product-icon-box">
              <span class="material-symbols-outlined text-[20px]">medical_services</span>
            </span>
            <div class="product-text">
              <router-link
                v-if="inq.productId"
                :to="`/marketplace/product/${inq.productId}`"
                class="product-title-link"
              >
                <span>{{ (locale === 'ar' ? (inq.productNameAr || inq.productNameEn) : (inq.productNameEn || inq.productNameAr)) || (locale === 'ar' ? 'منتج غير محدد' : 'Instrument Detail') }}</span>
                <span class="material-symbols-outlined icon--directional text-[16px] text-slate-400">arrow_forward</span>
              </router-link>
              <div class="product-meta-row mono">
                <span v-if="inq.productSku" class="sku-badge">SKU: {{ inq.productSku }}</span>
                <span class="date-badge">
                  <span class="material-symbols-outlined text-[13px]">calendar_today</span>
                  <span>{{ inq.createdAt ? new Date(inq.createdAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '' }}</span>
                </span>
              </div>
            </div>
          </div>

          <!-- Status Indicator Pill -->
          <div class="status-indicator">
            <span
              class="status-pill-badge mono"
              :class="inq.response ? 'status-pill--responded' : 'status-pill--pending'"
            >
              <span class="material-symbols-outlined text-[14px]">
                {{ inq.response ? 'check_circle' : 'hourglass_empty' }}
              </span>
              <span>{{ inq.response ? (locale === 'ar' ? 'تم الرد' : 'Responded') : (locale === 'ar' ? 'قيد الانتظار' : 'Pending') }}</span>
            </span>
          </div>
        </header>

        <!-- Body: Client's Original Inquiry -->
        <div class="inquiry-client-bubble">
          <div class="bubble-tag mono">
            <span class="material-symbols-outlined text-[14px]">send</span>
            <span>{{ locale === 'ar' ? 'استفسارك المرسل' : 'Your Inquiry' }}</span>
            <span v-if="inq.organization" class="org-sub">({{ inq.organization }})</span>
          </div>
          <p class="bubble-content">{{ inq.message }}</p>
        </div>

        <!-- Provider's Response Box OR Awaiting Banner -->
        <div v-if="inq.response" class="inquiry-provider-reply">
          <div class="provider-reply-head mono">
            <span class="verified-icon-box">
              <span class="material-symbols-outlined text-[16px]">verified_user</span>
            </span>
            <strong>{{ t('account.providerResponse') }}</strong>
            <span v-if="inq.respondedAt" class="reply-timestamp">
              &bull; {{ t('account.respondedAt') }} {{ new Date(inq.respondedAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) }}
            </span>
          </div>
          <p class="provider-reply-text">{{ inq.response }}</p>
        </div>

        <div v-else class="inquiry-pending-tray mono">
          <span class="material-symbols-outlined text-[18px] text-amber-600">schedule</span>
          <div>
            <strong>{{ t('account.awaitingProviderResponse') }}</strong>
            <span class="pending-sub"> &mdash; {{ locale === 'ar' ? 'سيقوم المورّد بمراجعة المواصفات والرد عليك في أقرب وقت.' : 'The provider is reviewing technical specifications and will respond shortly.' }}</span>
          </div>
        </div>
      </article>

      <!-- Pagination -->
      <AppPagination
        v-if="totalPages > 1"
        :page="localPage"
        :total-pages="totalPages"
        :total-items="filteredInquiries.length"
        :page-size="pageSize"
        variant="table"
        @change="goPage"
      />
    </div>
  </div>
</template>

<style scoped>
.inquiry-list-view {
  max-width: var(--wl-max-width, 1280px);
  margin: 0 auto;
  padding: var(--wl-page-padding-top, 2rem) var(--wl-gutter, 1.5rem) var(--wl-page-padding-bottom, 3rem);
  width: 100%;
  box-sizing: border-box;
}

.crumb-bar {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 11px;
  color: var(--wl-muted);
  margin-bottom: 1.25rem;
}

.crumb-bar a {
  color: var(--wl-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.crumb-bar a:hover {
  color: var(--wl-primary);
}

.crumb-sep {
  opacity: 0.45;
  font-size: 11px;
}

.crumb-active {
  color: var(--wl-ink-strong);
  font-weight: 600;
}

/* Header */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 1.75rem;
  flex-wrap: wrap;
}

.eyebrow-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--wl-primary);
  background: var(--wl-primary-subtle, rgba(20, 184, 166, 0.08));
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-pill, 999px);
  border: 1px solid var(--wl-border);
  margin-bottom: 0.5rem;
  font-weight: 700;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-primary);
  animation: pulse-ring 2s infinite;
}

@keyframes pulse-ring {
  0% { transform: scale(0.9); opacity: 0.7; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.7; }
}

.page-title {
  font-size: clamp(1.4rem, 2.5vw, 1.85rem);
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0 0 0.35rem;
  letter-spacing: -0.02em;
}

.page-subtitle {
  font-size: 0.88rem;
  color: var(--wl-muted);
  margin: 0;
  max-width: 680px;
  line-height: 1.5;
}

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.kpi-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kpi-icon--slate {
  background: var(--wl-surface-soft, #f1f5f9);
  color: #475569;
}

.kpi-icon--emerald {
  background: #ecfdf5;
  color: #059669;
}

.kpi-icon--amber {
  background: #fffbeb;
  color: #d97706;
}

.kpi-body {
  display: flex;
  flex-direction: column;
}

.kpi-label {
  font-size: 10.5px;
  color: var(--wl-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.15rem;
}

.kpi-val {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  line-height: 1.1;
}

/* Filter Toolbar */
.filter-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md, 8px);
  padding: 0.65rem 0.85rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-tabs {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--wl-surface-soft, #f8fafc);
  border: 1px solid var(--wl-border);
  padding: 0.25rem;
  border-radius: 8px;
}

.filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.75rem;
  border: none;
  background: transparent;
  color: var(--wl-muted);
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-tab:hover {
  color: var(--wl-ink-strong);
}

.filter-tab.is-active {
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.tab-count {
  display: inline-block;
  padding: 0.08rem 0.45rem;
  font-size: 10px;
  border-radius: 999px;
  background: var(--wl-surface-soft, #e2e8f0);
  color: var(--wl-ink-soft);
}

.tab-count--success {
  background: #d1fae5;
  color: #065f46;
}

.tab-count--warning {
  background: #fef3c7;
  color: #92400e;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 280px;
  flex: 1;
  max-width: 480px;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  color: var(--wl-muted);
  pointer-events: none;
}

[dir="rtl"] .search-icon {
  left: auto;
  right: 0.75rem;
}

.search-input {
  width: 100%;
  padding: 0.45rem 2rem 0.45rem 2.25rem;
  font-size: 0.85rem;
  border: 1px solid var(--wl-border);
  border-radius: 6px;
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  outline: none;
  transition: border-color 0.15s;
}

[dir="rtl"] .search-input {
  padding: 0.45rem 2.25rem 0.45rem 2rem;
}

.search-input:focus {
  border-color: var(--wl-primary);
  box-shadow: 0 0 0 2px var(--wl-primary-subtle, rgba(20, 184, 166, 0.15));
}

.clear-btn {
  position: absolute;
  right: 0.5rem;
  background: transparent;
  border: none;
  color: var(--wl-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0.2rem;
}

[dir="rtl"] .clear-btn {
  right: auto;
  left: 0.5rem;
}

/* Inquiries List Cards */
.inquiries-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.inquiry-item-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md, 10px);
  padding: 1.35rem 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.inquiry-item-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border-color: var(--wl-border-strong, #cbd5e1);
}

.item-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px dashed var(--wl-border);
  padding-bottom: 0.9rem;
  flex-wrap: wrap;
}

.product-info-wrap {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}

.product-icon-box {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--wl-surface-soft, #f1f5f9);
  color: var(--wl-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--wl-border);
}

.product-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.product-title-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  text-decoration: none;
  transition: color 0.15s;
}

.product-title-link:hover {
  color: var(--wl-primary);
}

.product-meta-row {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 11.5px;
  color: var(--wl-muted);
  flex-wrap: wrap;
}

.sku-badge {
  background: var(--wl-surface-soft, #f1f5f9);
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
  color: var(--wl-ink-soft);
  font-weight: 600;
}

.date-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

/* Status Pill */
.status-pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.75rem;
  border-radius: var(--radius-pill, 999px);
  font-size: 11px;
  font-weight: 700;
}

.status-pill--responded {
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.status-pill--pending {
  background: #fffbeb;
  color: #92400e;
  border: 1px solid #fde68a;
}

/* Client Bubble */
.inquiry-client-bubble {
  background: var(--wl-surface-soft, #f8fafc);
  border: 1px solid var(--wl-border);
  border-radius: 8px;
  padding: 0.95rem 1.15rem;
}

.bubble-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 11px;
  color: var(--wl-muted);
  font-weight: 600;
  margin-bottom: 0.4rem;
}

.org-sub {
  color: var(--wl-ink-soft);
  font-weight: 700;
}

.bubble-content {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.6;
  color: var(--wl-ink-strong);
  white-space: pre-wrap;
}

/* Provider Reply Box */
.inquiry-provider-reply {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-inline-start: 4px solid #16a34a;
  border-radius: 8px;
  padding: 1rem 1.25rem;
}

.provider-reply-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 12px;
  color: #166534;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.verified-icon-box {
  display: inline-flex;
  align-items: center;
  color: #16a34a;
}

.reply-timestamp {
  font-size: 11px;
  color: #15803d;
  font-weight: 500;
}

.provider-reply-text {
  margin: 0;
  font-size: 0.93rem;
  line-height: 1.6;
  color: #14532d;
  white-space: pre-wrap;
  font-weight: 500;
}

/* Pending Tray */
.inquiry-pending-tray {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  background: #fffbeb;
  border: 1px dashed #fde68a;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 12px;
  color: #92400e;
}

.pending-sub {
  font-weight: normal;
  color: #b45309;
}

/* Empty State */
.empty-state-card {
  background: var(--wl-surface);
  border: 1px dashed var(--wl-border);
  border-radius: var(--radius-md, 12px);
  padding: 3.5rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.empty-icon-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--wl-surface-soft, #f1f5f9);
  color: var(--wl-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.empty-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
}

.empty-desc {
  font-size: 0.88rem;
  color: var(--wl-muted);
  max-width: 440px;
  margin: 0 0 0.5rem;
  line-height: 1.5;
}

.empty-actions {
  display: flex;
  gap: 0.75rem;
}

/* Skeleton Loading */
.inquiries-loading {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.skeleton-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-line {
  background: var(--wl-surface-soft, #e2e8f0);
  border-radius: 4px;
  animation: pulse-line 1.5s infinite;
}

.skeleton-header {
  height: 24px;
  width: 45%;
}

.skeleton-body {
  height: 60px;
  width: 100%;
}

.skeleton-footer {
  height: 20px;
  width: 30%;
}

@keyframes pulse-line {
  0% { opacity: 0.5; }
  50% { opacity: 0.9; }
  100% { opacity: 0.5; }
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 1rem 1.25rem;
  border-radius: 8px;
}
</style>
