<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import { services } from '../../di/container'
import { t } from '../../i18n'
import { resolveFileUrl } from '../../utils/file-url'
import type { CertificationDto } from '../../domain/models/certification'

const router = useRouter()

/* Certifications State */
const certifications = ref<CertificationDto[]>([])
const loadingCerts = ref(false)
const certsError = ref('')
const certSearch = ref('')
const certPage = ref(1)
const certPageSize = 10
const certTotalCount = ref(0)

const filteredCerts = computed(() => {
  const list = Array.isArray(certifications.value) ? certifications.value : []
  if (!certSearch.value.trim()) return list
  const q = certSearch.value.trim().toLowerCase()
  return list.filter((c) => {
    if (!c) return false
    const matchTitle = c.title ? String(c.title).toLowerCase().includes(q) : false
    const matchNum = c.certificateNumber ? String(c.certificateNumber).toLowerCase().includes(q) : false
    const matchIssuer = c.issuer ? String(c.issuer).toLowerCase().includes(q) : false
    const matchTo = c.issuedTo ? String(c.issuedTo).toLowerCase().includes(q) : false
    const matchId = c.id ? String(c.id).toLowerCase().includes(q) : false
    return matchTitle || matchNum || matchIssuer || matchTo || matchId
  })
})

const loadCertifications = async () => {
  loadingCerts.value = true
  certsError.value = ''
  try {
    const res = await services.certificationRepository.getCertifications({
      pageNumber: 1,
      pageSize: 50,
    })
    certifications.value = res.data
    certTotalCount.value = res.totalCount
  } catch (e) {
    certsError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loadingCerts.value = false
  }
}

const totalCertPages = computed(() => Math.max(1, Math.ceil(filteredCerts.value.length / certPageSize)))

const paginatedCerts = computed(() => {
  const start = (certPage.value - 1) * certPageSize
  return filteredCerts.value.slice(start, start + certPageSize)
})

const goToCertPage = (p: number) => {
  if (p < 1 || p > totalCertPages.value) return
  certPage.value = p
}

watch(certSearch, () => {
  certPage.value = 1
})

const formatValidity = (issueDate: string, expiryDate?: string | null): string => {
  const start = issueDate ? issueDate.substring(0, 10) : '—'
  const end = expiryDate ? expiryDate.substring(0, 10) : t('admin.certPermanent')
  return `${start} → ${end}`
}

const isCertActive = (c: CertificationDto): boolean => {
  if (!c.isActive) return false
  if (!c.expiryDate) return true
  return new Date(c.expiryDate) > new Date()
}

onMounted(async () => {
  if (!services.authService.isAdmin.value) {
    void router.replace('/admin')
    return
  }
  await loadCertifications()
})
</script>

<template>
  <AdminLayout>
    <div class="compliance-admin-view">
      <!-- Executive Header -->
      <header class="admin-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.complianceEyebrow') }}</span>
          </div>
          <h1 class="head-title">{{ t('certifications.title') }} {{ t('admin.regulatoryLedger') }}</h1>
          <p class="head-subtitle">{{ t('admin.complianceSubtitle') }}</p>
        </div>
      </header>

      <!-- TAB: CERTIFICATIONS -->
      <div class="tab-pane">
        <div class="toolbar-wrap">
          <div class="search-input-wrap">
            <span class="material-symbols-outlined search-icon">search</span>
            <input
              v-model="certSearch"
              type="text"
              class="toolbar-search-input"
              :placeholder="t('common.searchPlaceholder')"
            />
          </div>
        </div>

        <DataState
          :loading="loadingCerts"
          :error="certsError"
          :empty="!filteredCerts.length && !loadingCerts"
          :empty-title="t('admin.noCertificationsFound')"
          :empty-description="t('admin.noCertificationsFoundDesc')"
          @retry="loadCertifications"
        >
          <div class="table-card">
            <div class="table-wrap">
              <table class="exec-table">
                <thead>
                  <tr>
                    <th>{{ t('admin.certStandardTitle') }}</th>
                    <th>{{ t('admin.certCertificateNumber') }}</th>
                    <th>{{ t('admin.certIssuingAuthority') }}</th>
                    <th>{{ t('admin.certValidity') }}</th>
                    <th>{{ t('commerce.status') }}</th>
                    <th>{{ t('admin.certAttachment') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in paginatedCerts" :key="c.id" class="exec-row">
                    <td>
                      <div class="cert-cell">
                        <div class="cert-icon-circle">
                          <span class="material-symbols-outlined text-[18px]">verified</span>
                        </div>
                        <div>
                          <strong class="cert-title">{{ c.title }}</strong>
                          <div v-if="c.issuedTo" class="cert-issued-to">{{ c.issuedTo }}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="mono cert-badge">{{ c.certificateNumber }}</span>
                    </td>
                    <td class="issuer-text">{{ c.issuer }}</td>
                    <td class="mono validity-text">{{ formatValidity(c.issueDate, c.expiryDate) }}</td>
                    <td>
                      <span
                        class="status-pill mono"
                        :class="isCertActive(c) ? 'status-pill--active' : 'status-pill--expired'"
                      >
                        <span class="dot"></span>
                        <span>{{ isCertActive(c) ? t('admin.certActive') : t('admin.certExpired') }}</span>
                      </span>
                    </td>
                    <td>
                      <a
                        v-if="c.certificationImageName"
                        :href="resolveFileUrl(c.certificationImageName, '#')"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="btn-view-doc mono"
                      >
                        <span class="material-symbols-outlined text-[14px]">file_open</span>
                        <span>{{ t('admin.certView') }}</span>
                      </a>
                      <span v-else class="mono text-xs text-slate-400">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <AppPagination
              :page="certPage"
              :total-pages="totalCertPages"
              :total-items="filteredCerts.length"
              :page-size="certPageSize"
              variant="table"
              @change="goToCertPage"
            />
          </div>
        </DataState>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.compliance-admin-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.admin-head {
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

/* Toolbar */
.toolbar-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.search-input-wrap {
  position: relative;
  width: 320px;
  max-width: 100%;
}

.search-icon {
  position: absolute;
  inset-inline-start: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: #94A3B8;
  pointer-events: none;
}

.toolbar-search-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  padding-inline-start: 38px;
  background: #FFFFFF;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  font-size: 13.5px;
  color: #0F172A;
  outline: none;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.toolbar-search-input:focus {
  border-color: #4F46E5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
}

/* Executive Table */
.table-card {
  background: var(--wl-surface, #FFFFFF);
  border: 1px solid var(--wl-border, #E2E8F0);
  border-radius: var(--wl-radius-card, 16px);
  overflow: hidden;
  box-shadow: var(--wl-shadow-card, 0 1px 3px rgba(15, 23, 42, 0.05));
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

.cert-cell {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.cert-icon-circle {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #EEF2FF;
  color: #4F46E5;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.cert-title {
  font-size: 13.5px;
  color: #0F172A;
}

.cert-issued-to {
  font-size: 11.5px;
  color: #64748B;
}

.cert-badge {
  font-size: 11.5px;
  font-weight: 700;
  color: #0F172A;
  background: #F1F5F9;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  border: 1px solid #E2E8F0;
}

.issuer-text {
  font-size: 13px;
  color: #334155;
}

.validity-text {
  font-size: 11.5px;
  color: #64748B;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11px;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
}

.status-pill .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-pill--active {
  background: #ECFDF5;
  color: #059669;
}
.status-pill--active .dot { background: #10B981; }

.status-pill--expired {
  background: #FEF3C7;
  color: #92400E;
}
.status-pill--expired .dot { background: #F59E0B; }

.btn-view-doc {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11.5px;
  font-weight: 700;
  color: #4F46E5;
  background: #EEF2FF;
  border: 1px solid #C7D2FE;
  padding: 0.25rem 0.65rem;
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.15s ease;
}

.btn-view-doc:hover {
  background: #4F46E5;
  color: #FFFFFF;
}
</style>
