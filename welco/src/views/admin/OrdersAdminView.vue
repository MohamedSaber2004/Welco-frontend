<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import { commerceService } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t, locale } from '../../i18n'
import type { OrderDto } from '../../domain/models/commerce'
import { ORDER_STATUSES } from '../../domain/models/commerce'

const orders = commerceService.orders
const loading = ref(false)
const fetchError = ref('')
const acting = ref('')
const searchQuery = ref('')
const statusFilter = ref('')
const localPage = ref(1)
const pageSize = 10

const NEXT: Record<string, string> = {
  Pending: 'Confirmed',
  Confirmed: 'Shipped',
  Shipped: 'Delivered',
}

async function fetchOrders() {
  loading.value = true
  fetchError.value = ''
  try {
    await commerceService.loadOrders({ page: 1, pageSize: 50 })
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

const filteredOrders = computed(() => {
  const rawList = Array.isArray(orders.value) ? orders.value : []
  let list = rawList
  if (statusFilter.value) {
    list = list.filter((o) => o && String(o.status || '').toLowerCase() === String(statusFilter.value).toLowerCase())
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter((o) => {
      if (!o) return false
      const matchNum = o.orderNumber ? String(o.orderNumber).toLowerCase().includes(q) : false
      const matchId = o.id ? String(o.id).toLowerCase().includes(q) : false
      const matchItems = Array.isArray(o.items) && o.items.some((it) => {
        if (!it) return false
        const en = it.productNameEn ? String(it.productNameEn).toLowerCase().includes(q) : false
        const ar = it.productNameAr ? String(it.productNameAr).toLowerCase().includes(q) : false
        const pid = it.productId ? String(it.productId).toLowerCase().includes(q) : false
        return en || ar || pid
      })
      const matchIncoterm = o.incotermCode ? String(o.incotermCode).toLowerCase().includes(q) : false
      return matchNum || matchId || matchItems || matchIncoterm
    })
  }
  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredOrders.value.length / pageSize)))

const paginatedOrders = computed(() => {
  const start = (localPage.value - 1) * pageSize
  return filteredOrders.value.slice(start, start + pageSize)
})

function onSearch() {
  localPage.value = 1
}

function clearFilters() {
  searchQuery.value = ''
  statusFilter.value = ''
  localPage.value = 1
}

onMounted(() => fetchOrders())

async function advance(o: OrderDto) {
  const next = NEXT[o.status]
  if (!next) return
  acting.value = o.id
  try {
    const res = await commerceService.updateOrderStatus(o.id, next)
    if (res.ok) {
      // updateOrderStatus reloads a default page — restore the full admin list
      await fetchOrders()
      const fresh = commerceService.orders.value.find((x) => x.id === o.id) ?? null
      if (fresh && selectedOrder.value?.id === o.id) selectedOrder.value = fresh
    } else if (res.error) {
      toastService.error(res.error)
    }
  } finally {
    acting.value = ''
  }
}

// --- Order details modal ---
const showDetailsModal = ref(false)
const selectedOrder = ref<OrderDto | null>(null)
const detailsLoading = ref(false)

async function openDetails(o: OrderDto) {
  selectedOrder.value = o
  showDetailsModal.value = true
  detailsLoading.value = true
  try {
    const fresh = await commerceService.getOrder(o.id)
    if (fresh) selectedOrder.value = fresh
  } finally {
    detailsLoading.value = false
  }
}

function closeDetails() {
  showDetailsModal.value = false
  selectedOrder.value = null
}

const detailsSubtotal = (order: OrderDto): number =>
  (order.items ?? []).reduce((s, it) => s + (it?.quantity ?? 0) * (it?.unitPrice ?? 0), 0)

function goPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  localPage.value = p
}
</script>

<template>
  <AdminLayout>
    <div class="orders-admin-view">
      <!-- Executive Header -->
      <header class="orders-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.ordersEyebrow') }}</span>
          </div>
          <h1 class="head-title">{{ t('admin.orders') }}</h1>
          <p class="head-subtitle">{{ t('admin.ordersDesc') }}</p>
        </div>

        <span class="mono count-badge">{{ t('admin.consignmentsTracked', { count: filteredOrders.length }) }}</span>
      </header>

      <!-- Search & Filter Bar -->
      <div class="search-filter-bar">
        <div class="search-wrap">
          <span class="material-symbols-outlined search-icon">search</span>
          <input
            v-model="searchQuery"
            type="text"
            class="search-input mono"
            :placeholder="t('common.searchPlaceholder') + ' — ' + t('commerce.orderNumber')"
            @input="onSearch"
          />
          <button v-if="searchQuery" type="button" class="clear-btn" @click="searchQuery = ''; onSearch()">
            <span class="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
        <select v-model="statusFilter" class="filter-select mono" @change="onSearch">
          <option value="">{{ t('common.all') }} {{ t('commerce.status') }}</option>
          <option v-for="s in ORDER_STATUSES" :key="s" :value="s">{{ s }}</option>
        </select>
        <button v-if="searchQuery || statusFilter" type="button" class="clear-filters-btn mono" @click="clearFilters">
          <span class="material-symbols-outlined text-[14px]">filter_alt_off</span>
          {{ t('common.clearFilters') }}
        </button>
      </div>

      <!-- Executive Table / DataState -->
      <DataState
        :loading="loading && !orders.length"
        :error="fetchError && !orders.length ? fetchError : null"
        :empty="!filteredOrders.length && !loading && !fetchError"
        :empty-title="searchQuery || statusFilter ? t('common.noResults') : t('admin.noOrdersYet')"
        :empty-description="searchQuery || statusFilter ? t('common.searchResults') : t('commerce.noOrdersDesc')"
        :empty-variant="searchQuery || statusFilter ? 'search' : 'default'"
        skeleton-type="table"
        :skeleton-count="6"
        min-height="320px"
        @retry="fetchOrders"
      >
        <div class="table-card">
          <div class="table-wrap">
            <table class="exec-table">
              <thead>
                <tr>
                  <th>{{ t('commerce.orderNumber') }}</th>
                  <th>{{ t('commerce.placed') }}</th>
                  <th>{{ t('marketplace.products') }}</th>
                  <th>{{ t('commerce.total') }}</th>
                  <th>{{ t('commerce.status') }}</th>
                  <th>{{ t('commerce.incoterm') }}</th>
                  <th class="text-end">{{ t('admin.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="o in paginatedOrders" :key="o.id" class="exec-row">
                  <td>
                    <strong class="mono order-num">{{ o.orderNumber || '—' }}</strong>
                  </td>
                  <td class="mono text-xs text-slate-500">{{ new Date(o.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</td>
                  <td>
                    <div class="product-names-cell">
                      <span
                        v-for="(item, idx) in (o.items ?? []).slice(0, 2)"
                        :key="item?.id || idx"
                        class="product-name-pill"
                      >
                        {{ locale === 'ar' ? (item?.productNameAr || item?.productNameEn || '—') : (item?.productNameEn || item?.productNameAr || '—') }}
                        <span v-if="item && item.quantity > 1" class="qty-tag">×{{ item.quantity }}</span>
                      </span>
                      <span v-if="(o.items ?? []).length > 2" class="more-badge mono">+{{ (o.items ?? []).length - 2 }} {{ t('common.more') }}</span>
                    </div>
                  </td>
                  <td>
                    <strong class="mono amount-num">
                      {{ Math.round(o.totalAmount).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} {{ o.currencyCode }}
                    </strong>
                  </td>
                  <td>
                    <StatusPill :status="o.status" />
                  </td>
                  <td>
                    <span class="mono incoterm-tag">{{ o.incotermCode || t('checkout.incotermExw') }}</span>
                  </td>
                  <td class="text-end">
                    <div class="row-actions">
                      <button
                        type="button"
                        class="row-action-btn"
                        :title="t('admin.viewDetails')"
                        :aria-label="t('admin.viewDetails')"
                        @click="openDetails(o)"
                      >
                        <span class="material-symbols-outlined text-[18px]">visibility</span>
                      </button>
                      <button
                        v-if="NEXT[o.status]"
                        type="button"
                        class="btn-advance mono"
                        :disabled="acting === o.id"
                        @click="advance(o)"
                      >
                        <span class="material-symbols-outlined text-[15px]">arrow_forward</span>
                        <span>{{ t('commerce.markAs', { status: NEXT[o.status] as string }) }}</span>
                      </button>
                      <span v-else class="mono text-xs text-slate-400">{{ t('admin.orderCompleted') }}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <AppPagination
            :page="localPage"
            :total-pages="totalPages"
            :total-items="filteredOrders.length"
            :page-size="pageSize"
            variant="table"
            @change="goPage"
          />
        </div>
      </DataState>

      <!-- Order Details Modal -->
      <BaseModal
        v-model="showDetailsModal"
        :title="selectedOrder ? `${t('commerce.orderNumber')} ${selectedOrder.orderNumber || '—'}` : t('admin.orderDetails')"
        max-width="720px"
        @close="closeDetails"
      >
        <div v-if="detailsLoading && !selectedOrder" class="details-loading">
          {{ t('common.loading') }}
        </div>
        <div v-else-if="selectedOrder" class="order-details">
          <div class="order-status-bar">
            <StatusPill :status="selectedOrder.status" />
            <span class="mono order-date">{{
              new Date(selectedOrder.createdAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')
            }}</span>
            <BaseButton
              v-if="NEXT[selectedOrder.status]"
              variant="primary"
              size="sm"
              :loading="acting === selectedOrder.id"
              @click="advance(selectedOrder)"
            >
              <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
              <span>{{ t('commerce.markAs', { status: NEXT[selectedOrder.status] as string }) }}</span>
            </BaseButton>
          </div>

          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-k mono">{{ t('commerce.orderNumber') }}</span>
              <strong class="detail-v mono">{{ selectedOrder.orderNumber || '—' }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('commerce.status') }}</span>
              <strong class="detail-v">{{ selectedOrder.status }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('commerce.incoterm') }}</span>
              <strong class="detail-v mono">{{ selectedOrder.incotermCode || t('checkout.incotermExw') }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('commerce.total') }}</span>
              <strong class="detail-v mono"
                >{{ Math.round(selectedOrder.totalAmount).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}
                {{ selectedOrder.currencyCode }}</strong
              >
            </div>
          </div>

          <div class="items-wrap">
            <table class="modal-items-table">
              <thead>
                <tr>
                  <th>{{ t('admin.quoteProduct') }}</th>
                  <th class="text-end">{{ t('marketplace.quantity') }}</th>
                  <th class="text-end">{{ t('admin.quoteUnitPrice') }}</th>
                  <th class="text-end">{{ t('admin.quoteSubtotal') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="it in selectedOrder.items ?? []" :key="it?.id || it?.productId">
                  <td>{{ locale === 'ar' ? (it?.productNameAr || it?.productNameEn) : (it?.productNameEn || it?.productNameAr) }}</td>
                  <td class="text-end mono">{{ it?.quantity ?? 0 }}</td>
                  <td class="text-end mono">{{ (it?.unitPrice ?? 0).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</td>
                  <td class="text-end mono">{{ ((it?.quantity ?? 0) * (it?.unitPrice ?? 0)).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="order-total-bar">
            <span class="mono total-label">{{ t('commerce.total') }}</span>
            <strong class="mono total-value"
              >{{ Math.round(detailsSubtotal(selectedOrder)).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}
              {{ selectedOrder.currencyCode }}</strong
            >
          </div>

          <div class="modal-foot">
            <BaseButton variant="secondary" @click="closeDetails">
              {{ t('common.close') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>
    </div>
  </AdminLayout>
</template>

<style scoped>
.orders-admin-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Search & Filter Bar ── */
.search-filter-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
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

.orders-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.head-chip {
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

.head-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: 1.68rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: #0F172A;
  margin: 0;
  line-height: 1.1;
}

.head-subtitle {
  font-size: 13.5px;
  color: #64748B;
  margin: 0.25rem 0 0;
}

.count-badge {
  font-size: 11.5px;
  font-weight: 700;
  color: #475569;
  background: #F1F5F9;
  border: 1px solid #E2E8F0;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
}

/* Executive Table */
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
  transition: background 0.15s ease;
}

.exec-row:hover {
  background: #F8FAFC;
}

.exec-row td {
  padding: 0.65rem 1.25rem;
  vertical-align: middle;
}

.order-num {
  font-size: 13px;
  color: #0F172A;
  font-weight: 700;
}

.items-pill {
  font-size: 11px;
  color: #475569;
  background: #F1F5F9;
  border: 1px solid #E2E8F0;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
}

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

.amount-num {
  font-size: 13.5px;
  color: #0F172A;
}

.incoterm-tag {
  font-size: 10.5px;
  font-weight: 800;
  color: #0369A1;
  background: #E0F2FE;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
}

.btn-advance {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #EEF2FF;
  border: 1px solid #C7D2FE;
  color: #4F46E5;
  border-radius: 8px;
  padding: 0.35rem 0.75rem;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-advance:hover:not(:disabled) {
  background: #4F46E5;
  color: #FFFFFF;
}

.btn-advance:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.text-end {
  text-align: end;
}

.row-actions {
  display: flex;
  gap: 0.4rem;
  justify-content: flex-end;
  align-items: center;
}

.row-action-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #64748b;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.row-action-btn:hover {
  color: #4f46e5;
  border-color: #4f46e5;
}

.details-loading {
  padding: 2rem;
  text-align: center;
  color: #64748b;
}

.order-details {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.order-status-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.order-date {
  font-size: 11.5px;
  color: #64748b;
  margin-inline-start: auto;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  background: #f8fafc;
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.detail-k {
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-v {
  font-size: 0.85rem;
  color: #0f172a;
}

.items-wrap {
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.modal-items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.modal-items-table thead th {
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  padding: 0.6rem 0.9rem;
  font-size: 10.5px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: start;
}

.modal-items-table tbody td {
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid #f1f5f9;
  color: #0f172a;
}

.modal-items-table tbody tr:last-child td {
  border-bottom: none;
}

.order-total-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 10px;
}

.total-label {
  font-size: 11px;
  font-weight: 700;
  color: #4f46e5;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.total-value {
  font-size: 1rem;
  color: #0f172a;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.25rem;
}
</style>
