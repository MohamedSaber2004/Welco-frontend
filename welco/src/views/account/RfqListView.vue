<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { salesService } from '../../di/container'
import AccountNav from '../../components/account/AccountNav.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import DataState from '../../components/ui/DataState.vue'
import BackButton from '../../components/ui/BackButton.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import { RFQ_STATUSES } from '../../domain/models/sales'

const router = useRouter()
const rfqs = salesService.rfqs

const searchQuery = ref('')
const statusFilter = ref('')
const localPage = ref(1)
const pageSize = 10

const loadData = () => {
  void salesService.loadRfqs({ pageNumber: 1, pageSize: 50 })
}

const filteredRfqs = computed(() => {
  const rawList = Array.isArray(rfqs.value) ? rfqs.value : []
  let list = rawList
  if (statusFilter.value) {
    list = list.filter((r) => r && String(r.status || '').toLowerCase() === String(statusFilter.value).toLowerCase())
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter((r) => {
      if (!r) return false
      const matchNum = r.rfqNumber ? String(r.rfqNumber).toLowerCase().includes(q) : false
      const matchId = r.id ? String(r.id).toLowerCase().includes(q) : false
      const matchNote = r.note ? String(r.note).toLowerCase().includes(q) : false
      const matchItems = Array.isArray(r.items) && r.items.some((it) => {
        if (!it) return false
        const en = it.productNameEn ? String(it.productNameEn).toLowerCase().includes(q) : false
        const ar = it.productNameAr ? String(it.productNameAr).toLowerCase().includes(q) : false
        const pid = it.productId ? String(it.productId).toLowerCase().includes(q) : false
        return en || ar || pid
      })
      return matchNum || matchId || matchNote || matchItems
    })
  }
  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRfqs.value.length / pageSize)))

const paginatedRfqs = computed(() => {
  const start = (localPage.value - 1) * pageSize
  return filteredRfqs.value.slice(start, start + pageSize)
})

const onSearch = () => {
  localPage.value = 1
}

const clearFilters = () => {
  searchQuery.value = ''
  statusFilter.value = ''
  localPage.value = 1
}

const goPage = (p: number) => {
  if (p < 1 || p > totalPages.value) return
  localPage.value = p
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="page-shell rfq-list-view">
    <BackButton fallback="/account" variant="minimal" class="mb-3" />

    <!-- Breadcrumb -->
    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/account">{{ t('account.dashboard') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('sales.rfqTitle') }}</span>
    </nav>

    <!-- Executive Header -->
    <header class="page-header">
      <div>
        <div class="header-chip mono">
          <span class="pulse-dot"></span>
          <span>{{ t('account.rfqLedger', { count: filteredRfqs.length }) }}</span>
        </div>
        <h1 class="header-title">{{ t('sales.rfqTitle') }}</h1>
        <p class="header-subtitle">{{ t('sales.rfqSubtitle') }}</p>
      </div>

      <button type="button" class="btn-create-rfq" @click="router.push({ name: 'marketplace' })">
        <span class="material-symbols-outlined text-[18px]">add</span>
        <span>{{ t('account.createRfqInquiry') }}</span>
      </button>
    </header>

    <AccountNav />

    <!-- Search & Filter Bar -->
    <div class="search-filter-bar">
      <div class="search-wrap">
        <span class="material-symbols-outlined search-icon">search</span>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input mono"
          :placeholder="t('common.searchPlaceholder') + ' — ' + t('account.rfqNumberCol')"
          @input="onSearch"
        />
        <button v-if="searchQuery" type="button" class="clear-btn" @click="searchQuery = ''; onSearch()">
          <span class="material-symbols-outlined text-[14px]">close</span>
        </button>
      </div>
      <select v-model="statusFilter" class="filter-select mono" @change="onSearch">
        <option value="">{{ t('common.all') }} {{ t('commerce.status') }}</option>
        <option v-for="s in RFQ_STATUSES" :key="s" :value="s">{{ s }}</option>
      </select>
      <button v-if="searchQuery || statusFilter" type="button" class="clear-filters-btn mono" @click="clearFilters">
        <span class="material-symbols-outlined text-[14px]">filter_alt_off</span>
        {{ t('common.clearFilters') }}
      </button>
    </div>

    <!-- Table or DataState -->
    <DataState
      :loading="salesService.loading.value"
      :empty="!filteredRfqs.length && !salesService.loading.value"
      :empty-title="searchQuery || statusFilter ? t('common.noResults') : t('sales.noRfqs')"
      :empty-description="searchQuery || statusFilter ? t('common.searchResults') : t('sales.noRfqsDesc')"
      :empty-variant="searchQuery || statusFilter ? 'search' : 'default'"
      :action-text="searchQuery || statusFilter ? t('common.clearFilters') : t('nav.marketplace')"
      skeleton-type="table"
      :skeleton-count="6"
      min-height="320px"
      @action="searchQuery || statusFilter ? clearFilters() : router.push({ name: 'marketplace' })"
    >
      <div class="table-card">
        <div class="table-wrap">
          <table class="exec-table">
            <thead>
              <tr>
                <th>{{ t('sales.requestDate') }}</th>
                <th>{{ t('account.rfqNumberCol') }}</th>
                <th>{{ t('marketplace.products') }}</th>
                <th>{{ t('commerce.total') }}</th>
                <th>{{ t('commerce.status') }}</th>
                <th class="text-end">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in paginatedRfqs"
                :key="r.id"
                class="exec-row"
                @click="router.push({ name: 'account-rfq-detail', params: { id: r.id } })"
              >
                <td class="mono text-xs text-slate-500">{{ new Date(r.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</td>
                <td>
                  <strong class="mono rfq-num">{{ r.rfqNumber || '—' }}</strong>
                </td>
                <td>
                  <div class="product-names-cell">
                    <span
                      v-for="(item, idx) in (r.items ?? []).slice(0, 2)"
                      :key="item?.id || idx"
                      class="product-name-pill"
                    >
                      {{ locale === 'ar' ? (item?.productNameAr || item?.productNameEn || '—') : (item?.productNameEn || item?.productNameAr || '—') }}
                      <span v-if="item && item.quantity > 1" class="qty-tag">×{{ item.quantity }}</span>
                    </span>
                    <span v-if="(r.items ?? []).length > 2" class="more-badge mono">+{{ (r.items ?? []).length - 2 }} {{ t('common.more') }}</span>
                  </div>
                </td>
                <td>
                  <strong class="mono amount-text">${{ Math.round(r.total ?? 0).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</strong>
                </td>
                <td>
                  <StatusPill :status="r.status" />
                </td>
                <td class="text-end">
                  <span class="row-link mono">
                    <span>{{ t('marketplace.viewDetails') }}</span>
                    <span class="icon--directional text-[14px]">→</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <AppPagination
          :page="localPage"
          :total-pages="totalPages"
          :total-items="filteredRfqs.length"
          :page-size="pageSize"
          variant="table"
          @change="goPage"
        />
      </div>
    </DataState>
  </div>
</template>

<style scoped>
.rfq-list-view {
  width: 100%;
}

.crumb-bar {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 11px;
  color: #64748B;
}

.crumb-bar a {
  color: #64748B;
  text-decoration: none;
  transition: color 0.15s ease;
}

.crumb-bar a:hover {
  color: #4F46E5;
}

.crumb-sep {
  color: #CBD5E1;
}

.crumb-active {
  color: #0F172A;
  font-weight: 700;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.header-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  font-weight: 700;
  color: #4F46E5;
  background: #EEF2FF;
  border: 1px solid #C7D2FE;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  letter-spacing: 0.06em;
  margin-bottom: 0.5rem;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4F46E5;
}

.header-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: 1.68rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: #0F172A;
  margin: 0;
  line-height: 1.1;
}

.header-subtitle {
  font-size: 13.5px;
  color: #64748B;
  margin: 0.25rem 0 0;
}

.btn-create-rfq {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  height: 44px;
  padding: 0 1.25rem;
  background: #4F46E5;
  color: #FFFFFF;
  border: none;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px -2px rgba(79, 70, 229, 0.35);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-create-rfq:hover {
  background: #4338CA;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px -2px rgba(79, 70, 229, 0.45);
}

/* Table Card */
.table-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
}

.table-wrap {
  overflow-x: auto;
}

.exec-table {
  width: 100%;
  border-collapse: collapse;
  text-align: start;
}

.exec-table thead th {
  background: #F8FAFC;
  border-bottom: 1px solid #E2E8F0;
  padding: 0.85rem 1.25rem;
  font-family: var(--wl-font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
  color: #64748B;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.exec-row {
  height: 52px;
  border-bottom: 1px solid #F1F5F9;
  cursor: pointer;
  transition: background 0.15s ease;
}

.exec-row:hover {
  background: #F8FAFC;
}

.exec-row:hover .row-link {
  color: #4F46E5;
  transform: translateX(2px);
}

.exec-row td {
  padding: 0.65rem 1.25rem;
  vertical-align: middle;
}

.rfq-num {
  font-size: 13px;
  color: #0F172A;
  font-weight: 700;
}

.items-badge {
  font-size: 11px;
  color: #475569;
  background: #F1F5F9;
  border: 1px solid #E2E8F0;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
}

.amount-text {
  font-size: 13.5px;
  color: #0F172A;
}

.row-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 11.5px;
  font-weight: 700;
  color: #94A3B8;
  transition: all 0.15s ease;
}

.text-end {
  text-align: end;
}

/* ── Search & Filter Bar ── */
.search-filter-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 200px;
  max-width: 420px;
}

.search-icon {
  position: absolute;
  inset-inline-start: 0.75rem;
  font-size: 18px;
  color: #94A3B8;
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 38px;
  padding: 0 2.2rem 0 2.5rem;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  font-size: 12.5px;
  color: #0F172A;
  background: #F8FAFC;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.search-input:focus {
  border-color: #6366F1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
  background: #fff;
}

.clear-btn {
  position: absolute;
  inset-inline-end: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #94A3B8;
  display: flex;
  align-items: center;
  padding: 0.2rem;
  border-radius: 4px;
}

.clear-btn:hover { color: #4F46E5; }

.filter-select {
  height: 38px;
  padding: 0 0.85rem;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  font-size: 12.5px;
  color: #475569;
  background: #F8FAFC;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}

.filter-select:focus { border-color: #6366F1; }

.clear-filters-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  height: 38px;
  padding: 0 0.85rem;
  border: 1px solid #FCA5A5;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  color: #DC2626;
  background: #FEF2F2;
  cursor: pointer;
  transition: all 0.15s;
}

.clear-filters-btn:hover { background: #FEE2E2; }

/* ── Product Names Cell ── */
.product-names-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-width: 240px;
}

.product-name-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 12px;
  font-weight: 600;
  color: #1E293B;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qty-tag {
  font-size: 10px;
  font-weight: 700;
  color: #4F46E5;
  background: #EEF2FF;
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
}

.more-badge {
  font-size: 10px;
  font-weight: 700;
  color: #64748B;
  background: #F1F5F9;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  align-self: flex-start;
}
</style>
