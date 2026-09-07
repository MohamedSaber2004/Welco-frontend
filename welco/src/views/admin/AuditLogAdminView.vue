<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import { auditLogService } from '../../di/container'
import { useUserLookup } from '../../composables/useUserLookup'
import { t, locale } from '../../i18n'
import type { AuditLogDto, AuditAction } from '../../domain/models/audit-log'

const { getUserInfo, resolveLogsUsers, getRoleBadgeClass } = useUserLookup()

const filters = ref<{ entity: string; action: string; search: string }>({ entity: '', action: '', search: '' })
const selectedLog = ref<AuditLogDto | null>(null)

const ACTIONS: { value: AuditAction; labelKey: string }[] = [
  { value: 'CREATE', labelKey: 'admin.auditActionCreate' },
  { value: 'UPDATE', labelKey: 'admin.auditActionUpdate' },
  { value: 'DELETE', labelKey: 'admin.auditActionDelete' },
  { value: 'APPROVE', labelKey: 'admin.auditActionApprove' },
  { value: 'REJECT', labelKey: 'admin.auditActionReject' },
  { value: 'LOGIN', labelKey: 'admin.auditActionLogin' },
  { value: 'LOGOUT', labelKey: 'admin.auditActionLogout' },
  { value: 'STATUS_CHANGE', labelKey: 'admin.auditActionStatusChange' },
  { value: 'UPLOAD', labelKey: 'admin.auditActionUpload' },
  { value: 'DOWNLOAD', labelKey: 'admin.auditActionDownload' },
  { value: 'ASSIGN', labelKey: 'admin.auditActionAssign' },
]

const ENTITY_TYPES = ['Product', 'Category', 'Order', 'RFQ', 'Quote', 'User', 'Company', 'Certification', 'Document', 'Ticket', 'Cart', 'Address', 'DistributorApplication']

const localPage = ref(1)
const localPageSize = 15

const filteredLogs = computed(() => {
  const rawList = Array.isArray(auditLogService.logs.value) ? auditLogService.logs.value : []
  let list = rawList
  if (filters.value.entity) {
    list = list.filter((l) => l && l.entityName === filters.value.entity)
  }
  if (filters.value.action) {
    list = list.filter((l) => l && l.action === filters.value.action)
  }
  if (filters.value.search.trim()) {
    const q = filters.value.search.trim().toLowerCase()
    list = list.filter((l) => {
      if (!l) return false
      const user = getUserInfo(l.performedById || l.performedBy)
      const entity = l.entityName ? String(l.entityName).toLowerCase().includes(q) : false
      const action = l.action ? String(l.action).toLowerCase().includes(q) : false
      const ip = l.ipAddress ? String(l.ipAddress).toLowerCase().includes(q) : false
      const uName = user?.name ? String(user.name).toLowerCase().includes(q) : false
      const uRole = user?.role ? String(user.role).toLowerCase().includes(q) : false
      let detailsMatch = false
      try {
        if (l.details) detailsMatch = JSON.stringify(l.details).toLowerCase().includes(q)
      } catch {
        detailsMatch = false
      }
      return entity || action || ip || uName || uRole || detailsMatch
    })
  }
  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredLogs.value.length / localPageSize)))
const paginatedLogs = computed(() => {
  const start = (localPage.value - 1) * localPageSize
  return filteredLogs.value.slice(start, start + localPageSize)
})
const isEmpty = computed(() => !auditLogService.loading.value && filteredLogs.value.length === 0 && !auditLogService.error.value)
const isLoading = computed(() => auditLogService.loading.value)
const isError = computed(() => auditLogService.error.value ?? undefined)

async function loadLogs() {
  await auditLogService.loadLogs({ pageNumber: 1, pageSize: 50 } as never)
  if (auditLogService.logs.value.length > 0) {
    void resolveLogsUsers(auditLogService.logs.value)
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(locale.value === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function openDetails(log: AuditLogDto) {
  selectedLog.value = log
}

function closeDetails() {
  selectedLog.value = null
}

function actionLabel(action: string): string {
  const found = ACTIONS.find((a) => a.value === action)
  return found ? t(found.labelKey as never) : action
}

function actionBadgeClass(action: string): string {
  const map: Record<string, string> = {
    CREATE: 'action-badge--teal',
    UPDATE: 'action-badge--indigo',
    DELETE: 'action-badge--rose',
    APPROVE: 'action-badge--emerald',
    REJECT: 'action-badge--rose',
    LOGIN: 'action-badge--amber',
    LOGOUT: 'action-badge--slate',
    STATUS_CHANGE: 'action-badge--indigo',
    UPLOAD: 'action-badge--teal',
    DOWNLOAD: 'action-badge--slate',
    ASSIGN: 'action-badge--amber',
  }
  return map[action] ?? 'action-badge--slate'
}

function goPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  localPage.value = p
}

onMounted(() => void loadLogs())
watch([() => filters.value.entity, () => filters.value.action, () => filters.value.search], () => {
  localPage.value = 1
})
</script>

<template>
  <AdminLayout>
    <div class="audit-view">
      <!-- Executive Header -->
      <header class="audit-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.auditLedgerEyebrow') }}</span>
          </div>
          <h1 class="head-title">{{ t('admin.auditLogs') }}</h1>
          <p class="head-subtitle">{{ t('admin.auditLogsDesc') }}</p>
        </div>
      </header>

      <!-- 44px Modern Filter Toolbar -->
      <div class="filter-card">
        <div class="filter-col">
          <label class="filter-label mono">{{ t('admin.auditEntity') }}</label>
          <select v-model="filters.entity" class="filter-input filter-select">
            <option value="">{{ t('common.all') }}</option>
            <option v-for="e in ENTITY_TYPES" :key="e" :value="e">{{ e }}</option>
          </select>
        </div>

        <div class="filter-col">
          <label class="filter-label mono">{{ t('admin.auditAction') }}</label>
          <select v-model="filters.action" class="filter-input filter-select">
            <option value="">{{ t('common.all') }}</option>
            <option v-for="a in ACTIONS" :key="a.value" :value="a.value">{{ t(a.labelKey as never) }}</option>
          </select>
        </div>

        <div class="filter-col filter-col--grow">
          <label class="filter-label mono">{{ t('admin.auditFilter') }}</label>
          <div class="search-input-wrap">
            <span class="material-symbols-outlined search-icon">search</span>
            <input
              v-model="filters.search"
              type="text"
              class="filter-input filter-search"
              :placeholder="t('admin.auditSearchPlaceholder')"
            />
          </div>
        </div>
      </div>

      <!-- Executive Data Table -->
      <DataState
        :loading="isLoading"
        :error="isError"
        :empty="isEmpty"
        :empty-title="t('admin.auditNoLogs')"
        :empty-description="t('admin.auditNoLogsDesc')"
        skeleton-type="table"
        :skeleton-count="6"
        min-height="320px"
        @retry="loadLogs"
      >
        <div class="table-card">
          <div class="table-wrap">
            <table class="exec-table">
              <thead>
                <tr>
                  <th>{{ t('admin.auditTimestamp') }}</th>
                  <th>{{ t('admin.auditEntity') }}</th>
                  <th>{{ t('admin.auditAction') }}</th>
                  <th>{{ t('admin.auditPerformedBy') }}</th>
                  <th class="text-end">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in paginatedLogs" :key="log.id" class="exec-row">
                  <td class="mono text-xs text-slate-500">{{ formatTime(log.createdAt) }}</td>
                  <td>
                    <span class="entity-pill mono">{{ log.entityName }}</span>
                  </td>
                  <td>
                    <span class="action-badge mono" :class="actionBadgeClass(log.action)">
                      {{ actionLabel(log.action) }}
                    </span>
                  </td>
                  <td>
                    <div class="actor-cell">
                      <div class="actor-top">
                        <strong class="actor-name">{{ getUserInfo(log.performedById || log.performedBy).name }}</strong>
                        <span
                          class="actor-role mono"
                          :class="getRoleBadgeClass(getUserInfo(log.performedById || log.performedBy).roleKey)"
                        >
                          {{ getUserInfo(log.performedById || log.performedBy).role }}
                        </span>
                      </div>
                      <span v-if="log.ipAddress" class="actor-ip mono">{{ log.ipAddress }}</span>
                    </div>
                  </td>
                  <td class="text-end">
                    <button
                      type="button"
                      class="row-action-btn mono"
                      @click="openDetails(log)"
                    >
                      <span class="material-symbols-outlined text-[16px]">visibility</span>
                      <span>{{ t('admin.viewDetails') }}</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Integrated Pagination -->
          <AppPagination
            :page="localPage"
            :total-pages="totalPages"
            :total-items="filteredLogs.length"
            :page-size="localPageSize"
            variant="table"
            @change="goPage"
          />
        </div>
      </DataState>

      <!-- Details Modal -->
      <BaseModal
        :model-value="!!selectedLog"
        :title="t('admin.auditLogs')"
        max-width="640px"
        @update:model-value="(v: boolean) => { if (!v) closeDetails() }"
      >
        <div v-if="selectedLog" class="modal-detail-stack">
          <div class="detail-grid mono">
            <div class="detail-item">
              <span class="detail-k">{{ t('admin.auditEntity') }}</span>
              <strong class="detail-v">{{ selectedLog.entityName }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k">{{ t('admin.auditAction') }}</span>
              <span class="action-badge mono" :class="actionBadgeClass(selectedLog.action)">
                {{ actionLabel(selectedLog.action) }}
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-k">{{ t('admin.auditTimestamp') }}</span>
              <span class="detail-v">{{ formatTime(selectedLog.createdAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-k">{{ t('admin.auditPerformedBy') }}</span>
              <span class="detail-v">{{ getUserInfo(selectedLog.performedById || selectedLog.performedBy).name }}</span>
            </div>
          </div>

          <div v-if="selectedLog.details" class="detail-code-block">
            <span class="detail-code-label mono">{{ t('admin.payloadSnapshot') }}</span>
            <pre class="detail-pre mono">{{ selectedLog.details }}</pre>
          </div>
        </div>
      </BaseModal>
    </div>
  </AdminLayout>
</template>

<style scoped>
.audit-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.audit-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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

/* Filter Toolbar */
.filter-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  padding: 1rem 1.25rem;
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  flex-wrap: wrap;
}

.filter-col {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 170px;
}

.filter-col--grow {
  flex: 1;
  min-width: 220px;
}

.filter-label {
  font-size: 10.5px;
  font-weight: 700;
  color: #64748B;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.filter-input {
  height: 44px;
  padding: 0 12px;
  background: #F8FAFC;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  font-size: 13.5px;
  color: #0F172A;
  outline: none;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.filter-input:focus {
  background: #FFFFFF;
  border-color: #4F46E5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
}

.filter-select {
  cursor: pointer;
}

.search-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  inset-inline-start: 12px;
  font-size: 18px;
  color: #94A3B8;
  pointer-events: none;
}

.filter-search {
  width: 100%;
  padding-inline-start: 38px;
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

.entity-pill {
  font-size: 11px;
  font-weight: 700;
  color: #0F172A;
  background: #F1F5F9;
  border: 1px solid #E2E8F0;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
}

.action-badge {
  display: inline-flex;
  font-size: 10px;
  font-weight: 800;
  padding: 0.18rem 0.5rem;
  border-radius: 9999px;
  letter-spacing: 0.04em;
}

.action-badge--indigo { background: #EEF2FF; color: #4F46E5; }
.action-badge--teal { background: #CCFBF1; color: #0F766E; }
.action-badge--emerald { background: #D1FAE5; color: #065F46; }
.action-badge--amber { background: #FEF3C7; color: #92400E; }
.action-badge--rose { background: #FFE4E6; color: #9F1239; }
.action-badge--slate { background: #F1F5F9; color: #475569; }

.actor-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.actor-top {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.actor-name {
  font-size: 13px;
  color: #0F172A;
}

.actor-role {
  font-size: 9.5px;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.actor-ip {
  font-size: 10.5px;
  color: #94A3B8;
}

.row-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 0.35rem 0.75rem;
  font-size: 11.5px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}

.row-action-btn:hover {
  border-color: #4F46E5;
  color: #4F46E5;
  background: #EEF2FF;
}

.text-end {
  text-align: end;
}

/* Modal Detail Stack */
.modal-detail-stack {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  background: #F8FAFC;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border: 1px solid #E2E8F0;
}

.detail-k {
  font-size: 10px;
  color: #64748B;
}

.detail-v {
  font-size: 12px;
  color: #0F172A;
}

.detail-code-block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.detail-code-label {
  font-size: 10.5px;
  font-weight: 700;
  color: #64748B;
}

.detail-pre {
  background: #0F172A;
  color: #F8FAFC;
  padding: 1rem;
  border-radius: 10px;
  font-size: 11.5px;
  overflow-x: auto;
  max-height: 280px;
}
</style>
