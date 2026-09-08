<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import StatCard from '../../components/ui/StatCard.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import { exchangeRateService } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { PRODUCT_API_BASE_URL, EXCHANGE_RATE_ROUTES } from '../../config/api.config'
import type { ExchangeRateSyncLogDto } from '../../domain/models/exchange-rate'
import { t, locale } from '../../i18n'

const loading = ref(true)
const triggering = ref(false)
const filterStatus = ref<'all' | 'success' | 'failed' | 'pending'>('all')
const selectedLog = ref<ExchangeRateSyncLogDto | null>(null)
const showDetailsModal = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

const logs = computed(() => exchangeRateService.syncLogs.value)

const filteredLogs = computed(() => {
  if (filterStatus.value === 'all') return logs.value
  return logs.value.filter((l) => {
    const s = normalizeStatus(l.status)
    return s.toLowerCase() === filterStatus.value
  })
})

const stats = computed(() => {
  const all = logs.value
  const successCount = all.filter((l) => normalizeStatus(l.status) === 'Success').length
  const failedCount = all.filter((l) => normalizeStatus(l.status) === 'Failed').length
  const latestRun = all[0]
  return {
    total: all.length,
    success: successCount,
    failed: failedCount,
    latestRates: latestRun?.ratesCount ?? 154,
    latestDate: latestRun?.startedAt ?? null,
  }
})

function normalizeStatus(status: number | string): 'Success' | 'Failed' | 'Pending' | 'Partial' {
  if (typeof status === 'string') {
    if (status.toLowerCase().includes('success')) return 'Success'
    if (status.toLowerCase().includes('fail')) return 'Failed'
    if (status.toLowerCase().includes('pending') || status.toLowerCase().includes('progress')) return 'Pending'
    return 'Partial'
  }
  if (status === 1) return 'Success'
  if (status === 2) return 'Failed'
  if (status === 3) return 'Partial'
  return 'Pending'
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString(locale.value === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatDuration(startedAt: string, completedAt?: string | null): string {
  if (!completedAt) return t('admin.inProgress')
  try {
    const start = new Date(startedAt).getTime()
    const end = new Date(completedAt).getTime()
    const diffMs = end - start
    if (diffMs < 0) return '—'
    if (diffMs < 1000) return `${diffMs}ms`
    return `${(diffMs / 1000).toFixed(1)}s`
  } catch {
    return '—'
  }
}

async function loadData() {
  loading.value = true
  try {
    await exchangeRateService.fetchSyncLogs(50)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    toastService.error(msg || t('common.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function triggerHangfireSync() {
  if (triggering.value) return
  triggering.value = true
  try {
    const res = await exchangeRateService.enqueueHangfireSync()
    toastService.success(res.message || t('admin.hangfireEnqueuedSuccess'))
    setTimeout(() => { void exchangeRateService.fetchSyncLogs(50) }, 1500)
    setTimeout(() => { void exchangeRateService.fetchSyncLogs(50) }, 4000)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    toastService.error(msg || t('admin.hangfireEnqueueFailed'))
  } finally {
    triggering.value = false
  }
}

async function triggerDirectSync() {
  if (triggering.value) return
  triggering.value = true
  try {
    const res = await exchangeRateService.triggerDirectSync()
    if (res.success) {
      toastService.success(t('admin.syncSuccessMsg', { count: res.ratesCount }))
    } else {
      toastService.error(t('admin.syncFailedMsg'))
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    toastService.error(msg || t('admin.syncFailedMsg'))
  } finally {
    triggering.value = false
  }
}

function openHangfireDashboard() {
  const url = EXCHANGE_RATE_ROUTES.hangfireDashboard(PRODUCT_API_BASE_URL)
  window.open(url, '_blank', 'noopener,noreferrer')
}

function openDetails(log: ExchangeRateSyncLogDto) {
  selectedLog.value = log
  showDetailsModal.value = true
}

onMounted(() => {
  void loadData()
  pollTimer = setInterval(() => {
    void exchangeRateService.fetchSyncLogs(50)
  }, 30000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <AdminLayout>
    <div class="jobs-view">
      <header class="jobs-header">
        <div class="header-content">
          <div class="header-breadcrumbs mono text-xs text-muted-soft mb-1">
            <span>{{ t('admin.system') }}</span>
            <span class="mx-1">/</span>
            <span class="text-ink font-semibold">{{ t('admin.backgroundJobs') }}</span>
          </div>
          <div class="flex items-center gap-3">
            <h1 class="header-title font-display text-2xl lg:text-3xl font-bold tracking-tight text-ink-strong">
              {{ t('admin.backgroundJobs') }}
            </h1>
            <span class="live-tag mono">
              <span class="pulse-dot" aria-hidden="true"></span>
              Hangfire 1.8
            </span>
          </div>
          <p class="header-desc text-sm text-ink-soft mt-1 max-w-2xl">
            {{ t('admin.backgroundJobsSubtitle') }}
          </p>
        </div>

        <div class="header-actions">
          <BaseButton
            variant="outline"
            size="sm"
            :loading="loading"
            class="refresh-btn"
            @click="loadData"
          >
            <span class="material-symbols-outlined text-[18px]">refresh</span>
            <span>{{ t('common.refresh') }}</span>
          </BaseButton>

          <BaseButton
            variant="secondary"
            size="sm"
            class="hangfire-dashboard-btn"
            @click="openHangfireDashboard"
          >
            <span class="material-symbols-outlined text-[18px]">dashboard_customize</span>
            <span>{{ t('admin.openHangfireDashboard') }}</span>
            <span class="material-symbols-outlined text-[16px] opacity-70">open_in_new</span>
          </BaseButton>

          <BaseButton
            variant="primary"
            size="sm"
            :loading="triggering"
            class="trigger-btn"
            @click="triggerHangfireSync"
          >
            <span class="material-symbols-outlined text-[18px]">bolt</span>
            <span>{{ t('admin.triggerHangfireSync') }}</span>
          </BaseButton>
        </div>
      </header>

      <div class="server-banner">
        <div class="banner-item">
          <span class="material-symbols-outlined banner-icon text-emerald-500">check_circle</span>
          <div>
            <span class="banner-label mono">{{ t('admin.hangfireServer') }}</span>
            <span class="banner-value font-medium text-ink-strong">ProductService-ExchangeRateServer</span>
          </div>
        </div>
        <div class="banner-divider" aria-hidden="true"></div>
        <div class="banner-item">
          <span class="material-symbols-outlined banner-icon text-indigo-500">database</span>
          <div>
            <span class="banner-label mono">{{ t('admin.jobStorage') }}</span>
            <span class="banner-value font-medium text-ink-strong">SQL Server ([Hangfire] Schema)</span>
          </div>
        </div>
        <div class="banner-divider" aria-hidden="true"></div>
        <div class="banner-item">
          <span class="material-symbols-outlined banner-icon text-cyan-500">queue</span>
          <div>
            <span class="banner-label mono">{{ t('admin.queues') }}</span>
            <span class="banner-value font-medium text-ink-strong">default (4 Workers)</span>
          </div>
        </div>
        <div class="banner-divider" aria-hidden="true"></div>
        <div class="banner-item">
          <span class="material-symbols-outlined banner-icon text-amber-500">schedule</span>
          <div>
            <span class="banner-label mono">{{ t('admin.recurringSchedule') }}</span>
            <span class="banner-value font-medium text-ink-strong">Daily (0 0 * * *)</span>
          </div>
        </div>
      </div>

      <div class="metrics-grid">
        <StatCard
          :label="t('admin.totalRuns')"
          :value="stats.total"
          icon="history"
          variant="default"
        />
        <StatCard
          :label="t('admin.successfulRuns')"
          :value="stats.success"
          icon="verified"
          variant="success"
        />
        <StatCard
          :label="t('admin.failedRuns')"
          :value="stats.failed"
          icon="error"
          :variant="stats.failed > 0 ? 'danger' : 'neutral'"
        />
        <StatCard
          :label="t('admin.ratesCount')"
          :value="stats.latestRates"
          icon="currency_exchange"
          variant="info"
          :subtext="stats.latestDate ? formatDate(stats.latestDate) : undefined"
        />
      </div>

      <section class="recurring-card">
        <div class="recurring-header">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-indigo-600 dark:text-indigo-400">update</span>
            <h2 class="font-display font-semibold text-lg text-ink-strong">{{ t('admin.recurringJobsList') }}</h2>
          </div>
          <span class="recurring-status-badge mono">1 {{ t('admin.activeJobs') }}</span>
        </div>

        <div class="recurring-body">
          <div class="job-row">
            <div class="job-main">
              <div class="job-name mono font-bold text-ink-strong text-base">
                sync-latest-exchange-rates
              </div>
              <div class="job-method mono text-xs text-muted">
                Product.Services.API.Jobs.ExchangeRateSyncJob.ExecuteAsync()
              </div>
            </div>

            <div class="job-schedule flex items-center gap-2">
              <span class="cron-badge mono">0 0 * * *</span>
              <span class="text-xs text-ink-soft">{{ t('admin.dailySchedule') }} (UTC)</span>
            </div>

            <div class="job-actions">
              <BaseButton
                variant="ghost"
                size="sm"
                :loading="triggering"
                class="direct-sync-btn mono text-xs"
                @click="triggerDirectSync"
              >
                <span class="material-symbols-outlined text-[16px]">sync</span>
                <span>{{ t('admin.manualDirectSync') }}</span>
              </BaseButton>
            </div>
          </div>
        </div>
      </section>

      <section class="history-section">
        <div class="history-header">
          <div class="history-title-group">
            <h3 class="font-display font-semibold text-lg text-ink-strong">{{ t('admin.syncHistoryLogs') }}</h3>
            <span class="logs-count mono text-xs text-muted">({{ filteredLogs.length }} {{ t('admin.records') }})</span>
          </div>

          <div class="filter-group">
            <button
              type="button"
              class="filter-pill mono"
              :class="{ 'is-active': filterStatus === 'all' }"
              @click="filterStatus = 'all'"
            >
              {{ t('common.all') }}
            </button>
            <button
              type="button"
              class="filter-pill mono"
              :class="{ 'is-active': filterStatus === 'success' }"
              @click="filterStatus = 'success'"
            >
              {{ t('common.success') }}
            </button>
            <button
              type="button"
              class="filter-pill mono"
              :class="{ 'is-active': filterStatus === 'failed' }"
              @click="filterStatus = 'failed'"
            >
              {{ t('common.failed') }}
            </button>
            <button
              type="button"
              class="filter-pill mono"
              :class="{ 'is-active': filterStatus === 'pending' }"
              @click="filterStatus = 'pending'"
            >
              {{ t('common.pending') }}
            </button>
          </div>
        </div>

        <div v-if="loading && !logs.length" class="p-6">
          <SkeletonLoader :lines="6" />
        </div>

        <EmptyState
          v-else-if="!filteredLogs.length"
          icon="event_note"
          :title="t('admin.noSyncLogsTitle')"
          :description="t('admin.noSyncLogsDesc')"
        >
          <template #action>
            <BaseButton variant="primary" size="sm" @click="triggerHangfireSync">
              <span class="material-symbols-outlined text-[18px]">bolt</span>
              <span>{{ t('admin.triggerHangfireSync') }}</span>
            </BaseButton>
          </template>
        </EmptyState>

        <div v-else class="table-responsive">
          <table class="logs-table">
            <thead>
              <tr class="mono text-xs text-muted-soft">
                <th>{{ t('admin.status') }}</th>
                <th>{{ t('admin.startedAt') }}</th>
                <th>{{ t('admin.duration') }}</th>
                <th>{{ t('admin.baseCurrency') }}</th>
                <th>{{ t('admin.ratesCount') }}</th>
                <th>{{ t('admin.source') }}</th>
                <th class="text-right">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in filteredLogs" :key="log.id" class="log-row">
                <td>
                  <StatusPill :status="normalizeStatus(log.status)" />
                </td>
                <td class="mono text-sm text-ink-strong whitespace-nowrap">
                  {{ formatDate(log.startedAt) }}
                </td>
                <td class="mono text-sm text-ink-soft whitespace-nowrap">
                  {{ formatDuration(log.startedAt, log.completedAt) }}
                </td>
                <td class="mono text-sm font-semibold text-ink-strong">
                  {{ log.baseCurrency || 'USD' }}
                </td>
                <td class="mono text-sm">
                  <span class="rates-badge" :class="{ 'rates-badge--zero': log.ratesCount === 0 }">
                    {{ log.ratesCount }}
                  </span>
                </td>
                <td class="mono text-xs text-muted">
                  {{ log.source || 'FawazahmedCDN' }}
                </td>
                <td class="text-right whitespace-nowrap">
                  <button
                    type="button"
                    class="details-btn mono"
                    @click="openDetails(log)"
                  >
                    <span class="material-symbols-outlined text-[16px]">info</span>
                    <span>{{ t('common.details') }}</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <BaseModal
        v-model="showDetailsModal"
        :title="t('admin.syncLogDetailsTitle')"
        size="md"
      >
        <div v-if="selectedLog" class="details-content space-y-4">
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="detail-item">
              <span class="mono text-xs text-muted block">{{ t('admin.logId') }}</span>
              <span class="mono text-xs text-ink-strong break-all">{{ selectedLog.id }}</span>
            </div>
            <div class="detail-item">
              <span class="mono text-xs text-muted block">{{ t('admin.status') }}</span>
              <StatusPill :status="normalizeStatus(selectedLog.status)" />
            </div>
            <div class="detail-item">
              <span class="mono text-xs text-muted block">{{ t('admin.startedAt') }}</span>
              <span class="mono text-xs text-ink-strong">{{ formatDate(selectedLog.startedAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="mono text-xs text-muted block">{{ t('admin.completedAt') }}</span>
              <span class="mono text-xs text-ink-strong">{{ formatDate(selectedLog.completedAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="mono text-xs text-muted block">{{ t('admin.ratesCount') }}</span>
              <span class="mono text-xs font-bold text-ink-strong">{{ selectedLog.ratesCount }}</span>
            </div>
            <div class="detail-item">
              <span class="mono text-xs text-muted block">{{ t('admin.source') }}</span>
              <span class="mono text-xs text-ink-strong">{{ selectedLog.source }}</span>
            </div>
          </div>

          <div v-if="selectedLog.errorMessage" class="error-box">
            <div class="error-header flex items-center gap-1.5 text-danger text-xs font-bold mono mb-1">
              <span class="material-symbols-outlined text-[16px]">error</span>
              <span>{{ t('admin.errorDetails') }}</span>
            </div>
            <pre class="error-text mono text-xs text-danger-soft bg-red-950/20 p-3 rounded border border-red-500/20 overflow-x-auto whitespace-pre-wrap">{{ selectedLog.errorMessage }}</pre>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <BaseButton variant="secondary" size="sm" @click="showDetailsModal = false">
              {{ t('common.close') }}
            </BaseButton>
          </div>
        </template>
      </BaseModal>
    </div>
  </AdminLayout>
</template>

<style scoped>
.jobs-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.jobs-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--wl-line);
}

@media (min-width: 768px) {
  .jobs-header {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.live-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  background: rgba(79, 70, 229, 0.08);
  color: var(--wl-primary);
  border: 1px solid rgba(79, 70, 229, 0.2);
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background-color: var(--wl-success);
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
  animation: pulse 2s infinite ease-in-out;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.4); opacity: 0.6; }
}

.server-banner {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.banner-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.banner-icon {
  font-size: 24px;
}

.banner-label {
  font-size: 0.68rem;
  color: var(--wl-muted);
  text-transform: uppercase;
  display: block;
}

.banner-value {
  font-size: 0.85rem;
}

.banner-divider {
  display: none;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.recurring-card {
  border-radius: 0.75rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.recurring-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--wl-line);
  background: var(--wl-paper);
}

.recurring-status-badge {
  font-size: 0.72rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.375rem;
  background: rgba(16, 185, 129, 0.1);
  color: var(--wl-success);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.recurring-body {
  padding: 1rem 1.25rem;
}

.job-row {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (min-width: 768px) {
  .job-row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.cron-badge {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.375rem;
  background: rgba(99, 102, 241, 0.1);
  color: var(--wl-primary);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.history-section {
  border-radius: 0.75rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.history-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--wl-line);
  background: var(--wl-paper);
}

@media (min-width: 640px) {
  .history-header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.history-title-group {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.filter-group {
  display: flex;
  gap: 0.35rem;
}

.filter-pill {
  font-size: 0.75rem;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  color: var(--wl-ink-soft);
  transition: all 0.15s ease;
  cursor: pointer;
}

.filter-pill:hover {
  border-color: var(--wl-primary);
  color: var(--wl-primary);
}

.filter-pill.is-active {
  background: var(--wl-primary);
  color: #fff;
  border-color: var(--wl-primary);
}

.table-responsive {
  overflow-x: auto;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

[dir="rtl"] .logs-table {
  text-align: right;
}

.logs-table th,
.logs-table td {
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--wl-line);
}

.logs-table th {
  background: var(--wl-paper);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.log-row {
  transition: background-color 0.15s ease;
}

.log-row:hover {
  background-color: var(--wl-surface-hover);
}

.rates-badge {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  border-radius: 0.25rem;
  background: rgba(79, 70, 229, 0.08);
  color: var(--wl-primary);
  font-weight: 600;
}

.rates-badge--zero {
  background: rgba(244, 63, 94, 0.08);
  color: var(--wl-danger);
}

.details-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--wl-primary);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  transition: background-color 0.15s;
}

.details-btn:hover {
  background: var(--wl-primary-soft);
}

.detail-item {
  padding: 0.5rem;
  border-radius: 0.375rem;
  background: var(--wl-paper);
  border: 1px solid var(--wl-line);
}

.error-box {
  margin-top: 0.5rem;
}
</style>
