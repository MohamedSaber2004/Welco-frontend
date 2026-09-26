<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import { companyRepository, companyService, locationService, userRepository } from '../../di/container'
import BaseModal from '../../components/ui/BaseModal.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import FileUpload from '../../components/ui/FileUpload.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { ATTACHMENT_PLACE, MEDIA_TYPE } from '../../config/api.config'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t, locale } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { COMPANY_TYPE_LABEL, CompanyStatus, CompanyType } from '../../domain/models/company'
import type { CompanyDto, CreateCompanyPayload, UpdateCompanyPayload, DistributorApplicationDto } from '../../domain/models/company'
import type { UserDetailsDto, UserDto } from '../../domain/models/user'
import { USER_TYPE_ROLE_KEY } from '../../domain/models/user'
import { AppLanguage } from '../../domain/models/user'

const route = useRoute()
const router = useRouter()

const activeTab = ref<'companies' | 'applications'>(
  (route.query.tab as string) === 'applications' ? 'applications' : 'companies',
)

const companies = ref<CompanyDto[]>([])
const loadingCompanies = ref(true)
const fetchCompaniesError = ref('')
const companySearch = ref('')
const companyPage = ref(1)
const companyTotalCount = ref(0)

const filteredCompanies = computed(() => {
  const list = Array.isArray(companies.value) ? companies.value : []
  if (!companySearch.value.trim()) return list
  const q = companySearch.value.trim().toLowerCase()
  return list.filter((c) => {
    if (!c) return false
    const matchName = c.name ? String(c.name).toLowerCase().includes(q) : false
    const matchCountry = c.countryNameEn ? String(c.countryNameEn).toLowerCase().includes(q) : false
    const matchType = (COMPANY_TYPE_LABEL[c.type] || c.type) ? String(COMPANY_TYPE_LABEL[c.type] || c.type).toLowerCase().includes(q) : false
    return matchName || matchCountry || matchType
  })
})

const companyTotalPages = computed(() => Math.max(1, Math.ceil(filteredCompanies.value.length / 10)))

const paginatedCompanies = computed(() => {
  const start = (companyPage.value - 1) * 10
  return filteredCompanies.value.slice(start, start + 10)
})

const loadCompanies = async () => {
  loadingCompanies.value = true
  fetchCompaniesError.value = ''
  try {
    const res = await companyRepository.getCompanies({
      pageNumber: 1,
      pageSize: 50,
    })
    companies.value = Array.isArray(res?.data) ? res.data : []
    companyTotalCount.value = res?.totalCount ?? companies.value.length
  } catch (e) {
    fetchCompaniesError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loadingCompanies.value = false
  }
}

// --- Company Add / Edit / Delete / Details ---
const showCompanyModal = ref(false)
const editingCompany = ref<CompanyDto | null>(null)
const companyFormLoading = ref(false)
const companyFormError = ref('')
const companyActionPendingId = ref<string | null>(null)

const companyForm = ref({
  name: '',
  email: '',
  type: CompanyType.Distributor as CompanyType,
  countryId: '',
  status: CompanyStatus.Pending as CompanyStatus,
  isActive: true,
  imageName: '',
})

const openCreateCompany = () => {
  editingCompany.value = null
  companyForm.value = {
    name: '',
    email: '',
    type: CompanyType.Distributor,
    countryId: '',
    status: CompanyStatus.Pending,
    isActive: true,
    imageName: '',
  }
  companyFormError.value = ''
  showCompanyModal.value = true
}

const openEditCompany = (c: CompanyDto) => {
  editingCompany.value = c
  companyForm.value = {
    name: c.name ?? '',
    email: c.email ?? '',
    type: c.type,
    countryId: c.countryId ?? '',
    status: c.status,
    isActive: c.isActive ?? true,
    imageName: c.imageName ?? '',
  }
  companyFormError.value = ''
  showCompanyModal.value = true
}

const closeCompanyForm = () => {
  showCompanyModal.value = false
  companyFormError.value = ''
}

const submitCompanyForm = async () => {
  const f = companyForm.value
  if (!f.name.trim()) {
    companyFormError.value = t('admin.companyName')
    return
  }
  if (!f.countryId) {
    companyFormError.value = t('admin.errCountry')
    return
  }
  companyFormLoading.value = true
  companyFormError.value = ''
  try {
    if (editingCompany.value) {
      const payload: UpdateCompanyPayload = {
        name: f.name.trim(),
        email: f.email.trim() || null,
        type: f.type,
        countryId: f.countryId,
        status: f.status,
        accountManagerId: editingCompany.value.accountManagerId ?? null,
        isActive: f.isActive,
        imageName: f.imageName.trim() || null,
      }
      await companyRepository.updateCompany(editingCompany.value.id, payload)
      toastService.success(t('admin.companyUpdated'))
    } else {
      const payload: CreateCompanyPayload = {
        name: f.name.trim(),
        email: f.email.trim() || null,
        type: f.type,
        countryId: f.countryId,
        status: f.status,
      }
      await companyRepository.createCompany(payload)
      toastService.success(t('admin.companyCreated'))
    }
    closeCompanyForm()
    await loadCompanies()
  } catch (e) {
    companyFormError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    companyFormLoading.value = false
  }
}

const toggleCompanyActive = async (c: CompanyDto) => {
  const nextActive = !(c.isActive ?? true)
  const ok = await confirmService.confirmAction(
    nextActive ? t('admin.confirmActivate') : t('admin.confirmDeactivate'),
    {
      title: nextActive ? t('admin.activate') : t('admin.deactivate'),
      variant: nextActive ? 'primary' : 'warning',
      icon: nextActive ? 'check_circle' : 'block',
      confirmText: nextActive ? t('admin.activate') : t('admin.deactivate'),
      cancelText: t('common.cancel'),
    },
  )
  if (!ok) return
  companyActionPendingId.value = c.id
  try {
    const payload: UpdateCompanyPayload = {
      name: c.name,
      email: c.email ?? null,
      type: c.type,
      countryId: c.countryId ?? '',
      status: c.status,
      accountManagerId: c.accountManagerId ?? null,
      isActive: nextActive,
    }
    await companyRepository.updateCompany(c.id, payload)
    toastService.success(nextActive ? t('admin.activated') : t('admin.deactivated'))
    await loadCompanies()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    companyActionPendingId.value = null
  }
}

const confirmDeleteCompany = async (c: CompanyDto) => {
  const ok = await confirmService.confirmDelete(
    `${t('admin.deleteCompanyConfirm')}\n${c.name}`,
    t('common.delete'),
  )
  if (!ok) return
  companyActionPendingId.value = c.id
  try {
    await companyRepository.deleteCompany(c.id)
    toastService.success(t('admin.companyDeleted'))
    await loadCompanies()
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  } finally {
    companyActionPendingId.value = null
  }
}

const showCompanyDetails = ref(false)
const selectedCompany = ref<CompanyDto | null>(null)

const openCompanyDetails = (c: CompanyDto) => {
  selectedCompany.value = c
  showCompanyDetails.value = true
}

const closeCompanyDetails = () => {
  showCompanyDetails.value = false
  selectedCompany.value = null
}

const companyCountryName = (c: CompanyDto): string => {
  const localizedName = locale.value === 'ar' ? (c.countryNameAr || c.countryNameEn) : (c.countryNameEn || c.countryNameAr)
  if (localizedName) return localizedName
  const found = locationService.countries.value.find((x) => x.id === c.countryId)
  if (!found) return '—'
  return locale.value === 'ar' ? (found.nameAr || found.nameEn) : (found.nameEn || found.nameAr)
}

const companyStatusLabel = (c: CompanyDto): string =>
  c.status === CompanyStatus.Approved
    ? t('common.verified')
    : c.status === CompanyStatus.Rejected
      ? t('sales.statusDeclined')
      : t('common.pending')

const applications = ref<DistributorApplicationDto[]>([])
const loadingApplications = ref(true)
const fetchApplicationsError = ref('')
const applicationSearch = ref('')
const statusFilter = ref<'all' | 'Pending' | 'Approved' | 'Rejected'>('all')
const typeFilter = ref<'all' | CompanyType>('all')
const applicationPage = ref(1)
const applicationTotalCount = ref(0)

const pendingCount = computed(() => {
  return applications.value.filter((a) => String(a.status).toLowerCase() === 'pending' || a.status === 1).length
})

const approvedCount = computed(() => {
  return applications.value.filter((a) => String(a.status).toLowerCase() === 'approved' || a.status === 2).length
})

const rejectedCount = computed(() => {
  return applications.value.filter((a) => String(a.status).toLowerCase() === 'rejected' || a.status === 3).length
})

const companyTypeIcon = (type: CompanyType | number | string): string => {
  const num = Number(type)
  if (num === CompanyType.Hospital) return 'local_hospital'
  if (num === CompanyType.Distributor) return 'local_shipping'
  if (num === CompanyType.Clinic) return 'medical_services'
  return 'domain'
}

const companyTypeClass = (type: CompanyType | number | string): string => {
  const num = Number(type)
  if (num === CompanyType.Hospital) return 'type--hospital'
  if (num === CompanyType.Distributor) return 'type--distributor'
  if (num === CompanyType.Clinic) return 'type--clinic'
  return 'type--default'
}

const parseCategoryTags = (interest?: string | null): string[] => {
  if (!interest) return []
  return interest
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const resetAppFilters = () => {
  applicationSearch.value = ''
  statusFilter.value = 'all'
  typeFilter.value = 'all'
  applicationPage.value = 1
}

const hasActiveAppFilters = computed(() => {
  return statusFilter.value !== 'all' || typeFilter.value !== 'all' || !!applicationSearch.value.trim()
})

const filteredApplications = computed(() => {
  const rawList = Array.isArray(applications.value) ? applications.value : []
  let list = rawList
  if (statusFilter.value !== 'all') {
    list = list.filter((a) => {
      if (!a) return false
      const s = String(a.status).toLowerCase()
      if (statusFilter.value === 'Pending') return s === 'pending' || a.status === 1
      if (statusFilter.value === 'Approved') return s === 'approved' || a.status === 2
      if (statusFilter.value === 'Rejected') return s === 'rejected' || a.status === 3
      return true
    })
  }
  if (typeFilter.value !== 'all') {
    list = list.filter((a) => Number(a.type) === Number(typeFilter.value))
  }
  if (applicationSearch.value.trim()) {
    const q = applicationSearch.value.trim().toLowerCase()
    list = list.filter((a) => {
      if (!a) return false
      const comp = a.companyName ? String(a.companyName).toLowerCase().includes(q) : false
      const contact = a.contactPerson ? String(a.contactPerson).toLowerCase().includes(q) : false
      const email = a.email ? String(a.email).toLowerCase().includes(q) : false
      const cEmail = a.contactEmail ? String(a.contactEmail).toLowerCase().includes(q) : false
      const phone = a.phone ? String(a.phone).toLowerCase().includes(q) : false
      const country = (a.countryName || a.countryNameEn) ? String(a.countryName || a.countryNameEn).toLowerCase().includes(q) : false
      const category = a.categoryInterest ? String(a.categoryInterest).toLowerCase().includes(q) : false
      return comp || contact || email || cEmail || phone || country || category
    })
  }
  return list
})

const applicationTotalPages = computed(() => Math.max(1, Math.ceil(filteredApplications.value.length / 10)))

const paginatedApplications = computed(() => {
  const start = (applicationPage.value - 1) * 10
  return filteredApplications.value.slice(start, start + 10)
})

const loadApplications = async () => {
  loadingApplications.value = true
  fetchApplicationsError.value = ''
  try {
    const res = await companyRepository.getDistributorApplications({
      pageNumber: 1,
      pageSize: 50,
    })
    applications.value = res.data ?? []
    applicationTotalCount.value = res.totalCount ?? applications.value.length
  } catch (e) {
    fetchApplicationsError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loadingApplications.value = false
  }
}

const confirmApprove = async (app: DistributorApplicationDto) => {
  const ok = await confirmService.confirm({
    title: t('admin.approveApplication'),
    message: `${t('admin.approveApplication')}: ${app.companyName}?`,
    variant: 'primary',
    confirmText: t('common.save'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return

  try {
    const res = await companyService.approveDistributorApplication(app.id)
    if (res.ok) {
      await Promise.all([loadApplications(), loadCompanies()])
    }
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  }
}

const confirmReject = async (app: DistributorApplicationDto) => {
  const ok = await confirmService.confirm({
    title: t('admin.rejectApplication'),
    message: `${t('admin.rejectApplication')}: ${app.companyName}?`,
    variant: 'danger',
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return

  try {
    const res = await companyService.rejectDistributorApplication(app.id)
    if (res.ok) {
      await loadApplications()
    }
  } catch (e) {
    toastService.error(e instanceof Error ? e.message : t('common.error'))
  }
}

// --- Distributor Application & Related User Details ---
const showApplicationModal = ref(false)
const selectedApplication = ref<DistributorApplicationDto | null>(null)
const loadingAppDetails = ref(false)
const relatedUser = ref<UserDetailsDto | UserDto | null>(null)
const loadingRelatedUser = ref(false)
const fetchAppDetailsError = ref('')

const openApplicationDetails = async (app: DistributorApplicationDto) => {
  selectedApplication.value = app
  showApplicationModal.value = true
  loadingAppDetails.value = true
  loadingRelatedUser.value = true
  relatedUser.value = null
  fetchAppDetailsError.value = ''

  try {
    const freshApp = await companyRepository.getDistributorApplicationById(app.id).catch(() => null)
    if (freshApp) {
      selectedApplication.value = freshApp
      // Backend embeds the applicant account — use it directly, no extra lookups.
      const embedded = freshApp.applicantUser
      if (embedded) {
        relatedUser.value = {
          id: embedded.id,
          fullName: embedded.fullName,
          email: embedded.email,
          phoneNumber: embedded.phoneNumber ?? null,
          userType: embedded.userType,
          language: AppLanguage.En,
          isActive: embedded.isActive,
          isEmailConfirmed: embedded.emailConfirmed,
          createdAt: embedded.createdAt,
          roles: [],
        } as UserDto
        loadingRelatedUser.value = false
      }
    }
  } catch (err) {
    fetchAppDetailsError.value = err instanceof Error ? err.message : t('common.error')
  } finally {
    loadingAppDetails.value = false
  }

  if (relatedUser.value) return

  const targetEmail = (
    selectedApplication.value?.contactEmail ||
    selectedApplication.value?.email ||
    app.contactEmail ||
    app.email ||
    ''
  ).trim().toLowerCase()

  if (targetEmail) {
    try {
      const usersRes = await userRepository.getUsers({
        searchTerm: targetEmail,
        pageSize: 5,
      })
      const found = (usersRes.data ?? []).find(
        (u) => (u.email ?? '').trim().toLowerCase() === targetEmail,
      )
      if (found) {
        const full = await userRepository.getUserById(found.id).catch(() => found)
        relatedUser.value = full
      }
    } catch {
      relatedUser.value = null
    } finally {
      loadingRelatedUser.value = false
    }
  } else {
    loadingRelatedUser.value = false
  }
}

const closeApplicationDetails = () => {
  showApplicationModal.value = false
  selectedApplication.value = null
  relatedUser.value = null
}

const setTab = (tab: 'companies' | 'applications') => {
  activeTab.value = tab
  void router.replace({ query: { ...route.query, tab } })
}

onMounted(() => {
  void loadCompanies()
  void loadApplications()
  if (!locationService.countries.value.length) {
    void locationService.loadCountries().catch(() => {})
  }
})

const isPending = (status: string | number) => {
  const s = String(status).toLowerCase()
  return s === 'pending' || status === 1
}
const isApproved = (status: string | number) => {
  const s = String(status).toLowerCase()
  return s === 'approved' || status === 2
}
const isRejected = (status: string | number) => {
  const s = String(status).toLowerCase()
  return s === 'rejected' || status === 3
}

watch(companySearch, () => {
  companyPage.value = 1
})
watch([applicationSearch, statusFilter, typeFilter], () => {
  applicationPage.value = 1
})
</script>

<template>
  <AdminLayout>
    <div class="companies-view">
      <!-- Executive Header -->
      <header class="companies-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.companiesEyebrow') }}</span>
          </div>
          <h1 class="head-title">{{ t('admin.companies') }}</h1>
          <p class="head-subtitle">{{ t('admin.companiesDesc') }}</p>
        </div>
      </header>

      <!-- Segmented Navigation Tabs -->
      <div class="tab-ribbon">
        <button
          type="button"
          class="tab-btn mono"
          :class="{ 'is-active': activeTab === 'companies' }"
          @click="setTab('companies')"
        >
          <span>{{ t('admin.companies') }}</span>
          <span class="tab-chip">({{ companies.length }})</span>
        </button>
        <button
          type="button"
          class="tab-btn mono"
          :class="{ 'is-active': activeTab === 'applications' }"
          @click="setTab('applications')"
        >
          <span>{{ t('admin.distributorApps') }}</span>
          <span v-if="pendingCount > 0" class="tab-chip tab-chip--amber">{{ pendingCount }} {{ t('common.pending').toUpperCase() }}</span>
          <span v-else class="tab-chip">({{ applications.length }})</span>
        </button>
      </div>

      <!-- TAB 1: Companies -->
      <div v-if="activeTab === 'companies'" class="tab-content">
        <div class="toolbar-card">
          <div class="search-wrap">
            <span class="material-symbols-outlined search-icon">search</span>
            <input
              v-model="companySearch"
              :placeholder="t('admin.searchPlaceholder')"
              :aria-label="t('common.searchPlaceholder')"
              class="toolbar-input"
            />
          </div>
          <BaseButton variant="primary" @click="openCreateCompany">
            <span class="material-symbols-outlined text-[18px]">add</span>
            <span>{{ t('admin.newCompany') }}</span>
          </BaseButton>
          <span class="mono counter-text">{{ filteredCompanies.length }} {{ t('common.of') }} {{ companyTotalCount }} {{ t('admin.companies') }}</span>
        </div>

        <DataState
          :loading="loadingCompanies && !companies.length"
          :error="fetchCompaniesError && !companies.length ? fetchCompaniesError : null"
          :empty="!filteredCompanies.length && !loadingCompanies && !fetchCompaniesError"
          :empty-title="t('admin.noResults')"
          :empty-description="t('admin.emptyCountriesDesc')"
          skeleton-type="table"
          :skeleton-count="6"
          min-height="320px"
          @retry="loadCompanies"
        >
          <div class="table-card">
            <div class="table-wrap">
              <table class="exec-table">
                <thead>
                  <tr>
                    <th>{{ t('admin.companies') }}</th>
                    <th>{{ t('admin.companyType') }}</th>
                    <th>{{ t('distributor.country') }}</th>
                    <th class="text-end">{{ t('commerce.status') }}</th>
                    <th class="text-end">{{ t('common.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in paginatedCompanies" :key="c.id" class="exec-row">
                    <td>
                      <strong class="company-name">{{ c.name }}</strong>
                    </td>
                    <td>
                      <span class="type-pill mono">{{ COMPANY_TYPE_LABEL[c.type] ?? c.type }}</span>
                    </td>
                    <td class="mono text-xs text-slate-600">{{ (locale === 'ar' ? (c.countryNameAr || c.countryNameEn) : (c.countryNameEn || c.countryNameAr)) ?? '—' }}</td>
                    <td class="text-end">
                      <span
                        class="status-pill mono"
                        :class="{
                          'status-pill--verified': c.status === 2,
                          'status-pill--declined': c.status === 3,
                          'status-pill--pending': c.status !== 2 && c.status !== 3,
                        }"
                      >
                        <span class="pill-dot"></span>
                        <span>{{ c.status === 2 ? t('common.verified') : c.status === 3 ? t('sales.statusDeclined') : t('common.pending') }}</span>
                      </span>
                    </td>
                    <td>
                      <div class="row-actions">
                        <button
                          type="button"
                          class="row-action-btn"
                          :title="t('admin.viewDetails')"
                          :aria-label="t('admin.viewDetails')"
                          @click="openCompanyDetails(c)"
                        >
                          <span class="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button
                          type="button"
                          class="row-action-btn"
                          :title="t('common.edit')"
                          :aria-label="t('common.edit')"
                          @click="openEditCompany(c)"
                        >
                          <span class="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          type="button"
                          class="row-action-btn"
                          :class="(c.isActive ?? true) ? 'row-action-btn--deactivate' : 'row-action-btn--activate'"
                          :title="(c.isActive ?? true) ? t('admin.deactivate') : t('admin.activate')"
                          :aria-label="(c.isActive ?? true) ? t('admin.deactivate') : t('admin.activate')"
                          :disabled="companyActionPendingId === c.id"
                          @click="toggleCompanyActive(c)"
                        >
                          <span class="material-symbols-outlined text-[18px]">{{
                            (c.isActive ?? true) ? 'block' : 'check_circle'
                          }}</span>
                        </button>
                        <button
                          type="button"
                          class="row-action-btn row-action-btn--danger"
                          :title="t('common.delete')"
                          :aria-label="t('common.delete')"
                          :disabled="companyActionPendingId === c.id"
                          @click="confirmDeleteCompany(c)"
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
              v-model:page="companyPage"
              :total-pages="companyTotalPages"
              :total-items="filteredCompanies.length"
              :page-size="10"
              variant="table"
              @change="(p: number) => { companyPage = p }"
            />
          </div>
        </DataState>
      </div>


      <!-- TAB 2: Applications -->
      <div v-else-if="activeTab === 'applications'" class="tab-content">
        <!-- Executive KPI Metrics Ribbon -->
        <div class="kpi-ribbon" role="region" :aria-label="t('admin.distributorApps')">
          <button
            type="button"
            class="kpi-card kpi-card--all mono"
            :class="{ 'is-active': statusFilter === 'all' }"
            @click="statusFilter = 'all'; applicationPage = 1"
          >
            <div class="kpi-card-main">
              <div class="kpi-icon-box">
                <span class="material-symbols-outlined">hub</span>
              </div>
              <div class="kpi-content">
                <span class="kpi-label">{{ t('admin.allApplications') }}</span>
                <span class="kpi-value">{{ applications.length }}</span>
              </div>
            </div>
            <div class="kpi-card-foot">
              <span class="kpi-foot-text">{{ t('admin.inquiriesCount') }}</span>
            </div>
          </button>

          <button
            type="button"
            class="kpi-card kpi-card--pending mono"
            :class="{ 'is-active': statusFilter === 'Pending' }"
            @click="statusFilter = 'Pending'; applicationPage = 1"
          >
            <div class="kpi-card-main">
              <div class="kpi-icon-box">
                <span class="material-symbols-outlined">pending_actions</span>
              </div>
              <div class="kpi-content">
                <span class="kpi-label">{{ t('admin.pendingReview') }}</span>
                <div class="kpi-val-row">
                  <span class="kpi-value">{{ pendingCount }}</span>
                  <span v-if="pendingCount > 0" class="kpi-pulse-dot" :title="t('common.pending')"></span>
                </div>
              </div>
            </div>
            <div class="kpi-card-foot">
              <span class="kpi-foot-text">{{ t('common.pending') }}</span>
            </div>
          </button>

          <button
            type="button"
            class="kpi-card kpi-card--approved mono"
            :class="{ 'is-active': statusFilter === 'Approved' }"
            @click="statusFilter = 'Approved'; applicationPage = 1"
          >
            <div class="kpi-card-main">
              <div class="kpi-icon-box">
                <span class="material-symbols-outlined">verified</span>
              </div>
              <div class="kpi-content">
                <span class="kpi-label">{{ t('admin.approvedPartners') }}</span>
                <span class="kpi-value">{{ approvedCount }}</span>
              </div>
            </div>
            <div class="kpi-card-foot">
              <span class="kpi-foot-text">{{ t('common.verified') }}</span>
            </div>
          </button>

          <button
            type="button"
            class="kpi-card kpi-card--rejected mono"
            :class="{ 'is-active': statusFilter === 'Rejected' }"
            @click="statusFilter = 'Rejected'; applicationPage = 1"
          >
            <div class="kpi-card-main">
              <div class="kpi-icon-box">
                <span class="material-symbols-outlined">cancel</span>
              </div>
              <div class="kpi-content">
                <span class="kpi-label">{{ t('admin.declinedInquiries') }}</span>
                <span class="kpi-value">{{ rejectedCount }}</span>
              </div>
            </div>
            <div class="kpi-card-foot">
              <span class="kpi-foot-text">{{ t('sales.statusDeclined') }}</span>
            </div>
          </button>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="toolbar-card">
          <div class="search-wrap">
            <span class="material-symbols-outlined search-icon">search</span>
            <input
              v-model="applicationSearch"
              :placeholder="t('admin.searchPlaceholder')"
              :aria-label="t('common.searchPlaceholder')"
              class="toolbar-input"
              @input="applicationPage = 1"
            />
            <button
              v-if="applicationSearch"
              type="button"
              class="search-clear-btn"
              @click="applicationSearch = ''; applicationPage = 1"
            >
              <span class="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>

          <!-- Type Filter Dropdown -->
          <div class="filter-select-wrap">
            <span class="material-symbols-outlined filter-icon">corporate_fare</span>
            <select
              v-model="typeFilter"
              class="filter-select mono"
              @change="applicationPage = 1"
            >
              <option value="all">{{ t('providers.filterByType') }}</option>
              <option :value="CompanyType.Hospital">{{ COMPANY_TYPE_LABEL[CompanyType.Hospital] }}</option>
              <option :value="CompanyType.Distributor">{{ COMPANY_TYPE_LABEL[CompanyType.Distributor] }}</option>
              <option :value="CompanyType.Clinic">{{ COMPANY_TYPE_LABEL[CompanyType.Clinic] }}</option>
            </select>
          </div>

          <!-- Status Segment Chips -->
          <div class="status-segment-group">
            <button
              type="button"
              class="seg-btn mono"
              :class="{ 'is-active': statusFilter === 'all' }"
              @click="statusFilter = 'all'; applicationPage = 1"
            >
              {{ t('common.all') }}
            </button>
            <button
              type="button"
              class="seg-btn mono"
              :class="{ 'is-active': statusFilter === 'Pending' }"
              @click="statusFilter = 'Pending'; applicationPage = 1"
            >
              {{ t('common.pending') }}
              <span v-if="pendingCount > 0" class="seg-badge">{{ pendingCount }}</span>
            </button>
            <button
              type="button"
              class="seg-btn mono"
              :class="{ 'is-active': statusFilter === 'Approved' }"
              @click="statusFilter = 'Approved'; applicationPage = 1"
            >
              {{ t('common.verified') }}
            </button>
            <button
              type="button"
              class="seg-btn mono"
              :class="{ 'is-active': statusFilter === 'Rejected' }"
              @click="statusFilter = 'Rejected'; applicationPage = 1"
            >
              {{ t('sales.statusDeclined') }}
            </button>
          </div>

          <!-- Reset Filter Button if active -->
          <button
            v-if="hasActiveAppFilters"
            type="button"
            class="reset-filters-btn mono"
            @click="resetAppFilters"
          >
            <span class="material-symbols-outlined text-[14px]">filter_alt_off</span>
            <span>{{ t('common.reset') }}</span>
          </button>

          <span class="mono counter-text ms-auto">
            {{ filteredApplications.length }} {{ t('common.of') }} {{ applications.length }} {{ t('admin.inquiriesCount') }}
          </span>
        </div>

        <DataState
          :loading="loadingApplications && !applications.length"
          :error="fetchApplicationsError && !applications.length ? fetchApplicationsError : null"
          :empty="!filteredApplications.length && !loadingApplications && !fetchApplicationsError"
          :empty-title="t('admin.noApplications')"
          :empty-description="t('admin.emptyApplicationsDesc')"
          skeleton-type="table"
          :skeleton-count="6"
          min-height="320px"
          @retry="loadApplications"
        >
          <div class="table-card">
            <div class="table-wrap">
              <table class="exec-table">
                <thead>
                  <tr>
                    <th>{{ t('distributor.companyName') }}</th>
                    <th>{{ t('admin.applicant') }}</th>
                    <th>{{ t('distributor.country') }}</th>
                    <th>{{ t('distributor.salesVolume') }} &amp; {{ t('admin.category') }}</th>
                    <th>{{ t('commerce.status') }}</th>
                    <th>{{ t('admin.submittedDate') }}</th>
                    <th class="text-end">{{ t('admin.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="app in paginatedApplications" :key="app.id" class="exec-row">
                    <td>
                      <div class="company-cell">
                        <div class="company-badge-icon" :class="companyTypeClass(app.type)">
                          <span class="material-symbols-outlined">{{ companyTypeIcon(app.type) }}</span>
                        </div>
                        <div class="company-info-col">
                          <div class="company-title-row">
                            <strong class="company-name">{{ app.companyName }}</strong>
                            <span class="inst-type-badge mono" :class="companyTypeClass(app.type)">
                              {{ COMPANY_TYPE_LABEL[app.type] ?? app.type }}
                            </span>
                          </div>
                          <div v-if="app.website" class="website-row mono">
                            <a
                              :href="app.website.startsWith('http') ? app.website : `https://${app.website}`"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="company-web-link"
                            >
                              <span class="material-symbols-outlined text-[12px]">link</span>
                              <span>{{ app.website }}</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="applicant-cell">
                        <span class="applicant-name">{{ app.contactPerson }}</span>
                        <a
                          v-if="app.contactEmail || app.email"
                          :href="`mailto:${app.contactEmail || app.email}`"
                          class="mono applicant-email"
                        >
                          <span class="material-symbols-outlined text-[12px]">mail</span>
                          <span>{{ app.contactEmail || app.email }}</span>
                        </a>
                        <a
                          v-if="app.phone"
                          :href="`tel:${app.phone}`"
                          class="mono applicant-phone"
                        >
                          <span class="material-symbols-outlined text-[12px]">call</span>
                          <span>{{ app.phone }}</span>
                        </a>
                      </div>
                    </td>
                    <td>
                      <div class="country-cell mono">
                        <span class="material-symbols-outlined text-[14px] text-slate-400">public</span>
                        <span>{{ app.countryName || app.countryNameEn || '—' }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="volume-category-cell">
                        <span v-if="app.salesVolumeBand" class="vol-pill mono">{{ app.salesVolumeBand }}</span>
                        <div v-if="parseCategoryTags(app.categoryInterest).length" class="category-tags-wrap">
                          <span
                            v-for="(tag, idx) in parseCategoryTags(app.categoryInterest).slice(0, 2)"
                            :key="idx"
                            class="category-tag mono"
                          >
                            {{ tag }}
                          </span>
                          <span
                            v-if="parseCategoryTags(app.categoryInterest).length > 2"
                            class="category-tag-more mono"
                            :title="app.categoryInterest"
                          >
                            +{{ parseCategoryTags(app.categoryInterest).length - 2 }}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        class="status-pill mono"
                        :class="{
                          'status-pill--verified': isApproved(app.status),
                          'status-pill--declined': isRejected(app.status),
                          'status-pill--pending': isPending(app.status),
                        }"
                      >
                        <span class="pill-dot"></span>
                        <span>{{ isApproved(app.status) ? t('common.verified') : isRejected(app.status) ? t('sales.statusDeclined') : t('common.pending') }}</span>
                      </span>
                    </td>
                    <td class="mono text-xs text-slate-500 whitespace-nowrap">
                      {{ new Date(app.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}
                    </td>
                    <td class="text-end">
                      <div class="app-actions">
                        <button
                          type="button"
                          class="btn-view-app mono"
                          :title="t('admin.distributorAppDetails')"
                          @click="openApplicationDetails(app)"
                        >
                          <span class="material-symbols-outlined text-[15px]">visibility</span>
                          <span>{{ t('common.details') }}</span>
                        </button>
                        <template v-if="isPending(app.status)">
                          <button
                            type="button"
                            class="btn-approve mono"
                            :title="t('sales.approve')"
                            @click="confirmApprove(app)"
                          >
                            <span class="material-symbols-outlined text-[15px]">check</span>
                            <span>{{ t('sales.approve') }}</span>
                          </button>
                          <button
                            type="button"
                            class="btn-reject mono"
                            :title="t('sales.decline')"
                            @click="confirmReject(app)"
                          >
                            <span class="material-symbols-outlined text-[15px]">close</span>
                            <span>{{ t('sales.decline') }}</span>
                          </button>
                        </template>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <AppPagination
              v-model:page="applicationPage"
              :total-pages="applicationTotalPages"
              :total-items="filteredApplications.length"
              :page-size="10"
              variant="table"
              @change="(p: number) => { applicationPage = p }"
            />
          </div>
        </DataState>
      </div>

      <!-- Add / Edit Company Modal -->
      <BaseModal
        v-model="showCompanyModal"
        :title="editingCompany ? t('admin.editCompany') : t('admin.newCompany')"
        max-width="640px"
        @close="closeCompanyForm"
      >
        <form class="admin-modal-form" @submit.prevent="submitCompanyForm">
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="company-name">{{ t('admin.companyName') }} *</label>
              <input id="company-name" v-model="companyForm.name" type="text" class="field-input" required />
            </div>
            <div class="form-field">
              <label class="field-label" for="company-email">{{ t('admin.companyEmail') }}</label>
              <input id="company-email" v-model="companyForm.email" type="email" class="field-input mono" />
            </div>
          </div>
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="company-type">{{ t('admin.companyType') }} *</label>
              <select id="company-type" v-model="companyForm.type" class="field-select">
                <option :value="CompanyType.Hospital">{{ COMPANY_TYPE_LABEL[CompanyType.Hospital] }}</option>
                <option :value="CompanyType.Distributor">{{ COMPANY_TYPE_LABEL[CompanyType.Distributor] }}</option>
                <option :value="CompanyType.Clinic">{{ COMPANY_TYPE_LABEL[CompanyType.Clinic] }}</option>
                </select>
            </div>
            <div class="form-field">
              <label class="field-label" for="company-country">{{ t('distributor.country') }} *</label>
              <select id="company-country" v-model="companyForm.countryId" class="field-select" required>
                <option value="" disabled>{{ t('distributor.country') }}</option>
                <option v-for="co in locationService.countries.value" :key="co.id" :value="co.id">
                  {{ locale === 'ar' ? (co.nameAr || co.nameEn) : (co.nameEn || co.nameAr) }}
                </option>
              </select>
            </div>
          </div>
          <div class="form-row two-cols">
            <div class="form-field">
              <label class="field-label" for="company-status">{{ t('commerce.status') }} *</label>
              <select id="company-status" v-model="companyForm.status" class="field-select">
                <option :value="CompanyStatus.Pending">{{ t('common.pending') }}</option>
                <option :value="CompanyStatus.Approved">{{ t('common.verified') }}</option>
                <option :value="CompanyStatus.Rejected">{{ t('sales.statusDeclined') }}</option>
              </select>
            </div>
          </div>
          <div class="form-field full-width">
            <FileUpload
              :model-value="companyForm.imageName || null"
              :place="ATTACHMENT_PLACE.PROVIDERS"
              :file-type="MEDIA_TYPE.IMAGE"
              accept="image/*"
              :label="t('admin.companyImage')"
              :hint="t('attachment.dropHint')"
              @update:modelValue="companyForm.imageName = $event ?? ''"
            />
          </div>
          <div v-if="editingCompany" class="form-field">
            <label class="toggle-label">
              <input v-model="companyForm.isActive" type="checkbox" />
              <span>{{ t('admin.active') }}</span>
            </label>
          </div>

          <p v-if="companyFormError" class="form-error" role="alert">{{ companyFormError }}</p>

          <div class="modal-foot">
            <BaseButton variant="secondary" type="button" @click="closeCompanyForm">
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton variant="primary" type="submit" :loading="companyFormLoading">
              {{ t('common.save') }}
            </BaseButton>
          </div>
        </form>
      </BaseModal>

      <!-- Company Details Modal -->
      <BaseModal
        v-model="showCompanyDetails"
        :title="t('admin.companyDetails')"
        max-width="560px"
        @close="closeCompanyDetails"
      >
        <div v-if="selectedCompany" class="admin-details">
          <div v-if="selectedCompany.imageName" class="details-logo">
            <AppImage
              :src="selectedCompany.imageName"
              placeholder-type="company"
              :placeholder-text="selectedCompany.name"
              :alt="selectedCompany.name"
              fit="contain"
              height="96px"
            />
          </div>
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.companyName') }}</span>
              <strong class="detail-v">{{ selectedCompany.name }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.companyEmail') }}</span>
              <strong class="detail-v mono">{{ selectedCompany.email || '—' }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('admin.companyType') }}</span>
              <strong class="detail-v">{{ COMPANY_TYPE_LABEL[selectedCompany.type] ?? selectedCompany.type }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('distributor.country') }}</span>
              <strong class="detail-v">{{ companyCountryName(selectedCompany) }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k mono">{{ t('commerce.status') }}</span>
              <strong class="detail-v">{{ companyStatusLabel(selectedCompany) }}</strong>
            </div>
          </div>
          <div class="modal-foot">
            <BaseButton variant="secondary" @click="selectedCompany && openEditCompany(selectedCompany)">
              {{ t('common.edit') }}
            </BaseButton>
            <BaseButton variant="secondary" @click="closeCompanyDetails">
              {{ t('common.close') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>

      <!-- Distributor Application & Related User Details Modal -->
      <BaseModal
        v-model="showApplicationModal"
        :title="t('admin.partnerDossier')"
        max-width="860px"
        @close="closeApplicationDetails"
      >
        <div v-if="selectedApplication" class="app-details-flow">
          <!-- Top Hero Card -->
          <div class="app-hero-card">
            <div class="app-hero-main">
              <div class="app-hero-badge-icon" :class="companyTypeClass(selectedApplication.type)">
                <span class="material-symbols-outlined">{{ companyTypeIcon(selectedApplication.type) }}</span>
              </div>
              <div class="app-hero-text">
                <div class="app-hero-title-row">
                  <div class="app-hero-title-wrap">
                    <h3 class="app-hero-title">{{ selectedApplication.companyName }}</h3>
                    <span class="inst-type-badge mono" :class="companyTypeClass(selectedApplication.type)">
                      {{ COMPANY_TYPE_LABEL[selectedApplication.type] || selectedApplication.type }}
                    </span>
                  </div>
                  <span
                    class="status-pill mono"
                    :class="{
                      'status-pill--verified': isApproved(selectedApplication.status),
                      'status-pill--declined': isRejected(selectedApplication.status),
                      'status-pill--pending': isPending(selectedApplication.status),
                    }"
                  >
                    <span class="pill-dot"></span>
                    <span>{{ isApproved(selectedApplication.status) ? t('common.verified') : isRejected(selectedApplication.status) ? t('sales.statusDeclined') : t('common.pending') }}</span>
                  </span>
                </div>
                <div class="app-hero-meta mono">
                  <span class="hero-meta-item">
                    <span class="material-symbols-outlined text-[13px]">public</span>
                    {{ selectedApplication.countryNameEn || selectedApplication.countryName || '—' }}
                  </span>
                  <span>•</span>
                  <span class="hero-meta-item">
                    <span class="material-symbols-outlined text-[13px]">calendar_today</span>
                    {{ t('admin.submittedDate') }}: {{ new Date(selectedApplication.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }}
                  </span>
                  <span v-if="selectedApplication.id">•</span>
                  <span v-if="selectedApplication.id" class="hero-meta-id mono text-muted">#{{ String(selectedApplication.id).slice(0, 8) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Dossier Columns Grid (2 columns on desktop) -->
          <div class="app-dossier-grid">
            <!-- Left Column: Facility & Commercial Details -->
            <div class="details-section">
              <div class="details-section-head">
                <span class="material-symbols-outlined text-[18px] text-primary">domain</span>
                <h4 class="details-section-title">{{ t('admin.facilitySpecs') }}</h4>
              </div>
              <div class="details-specs-list">
                <div class="spec-row">
                  <span class="detail-k mono">{{ t('distributor.companyName') }}</span>
                  <strong class="detail-v">{{ selectedApplication.companyName }}</strong>
                </div>
                <div class="spec-row">
                  <span class="detail-k mono">{{ t('admin.companyType') }}</span>
                  <span class="inst-type-badge mono" :class="companyTypeClass(selectedApplication.type)">
                    {{ COMPANY_TYPE_LABEL[selectedApplication.type] || selectedApplication.type }}
                  </span>
                </div>
                <div class="spec-row">
                  <span class="detail-k mono">{{ t('distributor.country') }}</span>
                  <strong class="detail-v">{{ selectedApplication.countryNameEn || selectedApplication.countryName || '—' }}</strong>
                </div>
                <div class="spec-row">
                  <span class="detail-k mono">{{ t('distributor.salesVolume') }}</span>
                  <span class="vol-pill mono">{{ selectedApplication.salesVolumeBand || '—' }}</span>
                </div>
                <div class="spec-row spec-row--stacked">
                  <span class="detail-k mono">{{ t('distributor.categoryInterest') }}</span>
                  <div v-if="parseCategoryTags(selectedApplication.categoryInterest).length" class="category-tags-wrap mt-1">
                    <span
                      v-for="(tag, idx) in parseCategoryTags(selectedApplication.categoryInterest)"
                      :key="idx"
                      class="category-tag mono"
                    >
                      {{ tag }}
                    </span>
                  </div>
                  <strong v-else class="detail-v">{{ selectedApplication.categoryInterest || '—' }}</strong>
                </div>
                <div v-if="selectedApplication.website" class="spec-row spec-row--stacked">
                  <span class="detail-k mono">{{ t('distributor.website') }}</span>
                  <a
                    :href="selectedApplication.website.startsWith('http') ? selectedApplication.website : `https://${selectedApplication.website}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="website-link mono"
                  >
                    <span>{{ selectedApplication.website }}</span>
                    <span class="material-symbols-outlined text-[14px]">open_in_new</span>
                  </a>
                </div>
              </div>
            </div>

            <!-- Right Column: Applicant & Account Verification -->
            <div class="dossier-column-right">
              <!-- Contact specs -->
              <div class="details-section">
                <div class="details-section-head">
                  <span class="material-symbols-outlined text-[18px] text-primary">badge</span>
                  <h4 class="details-section-title">{{ t('admin.applicantContact') }}</h4>
                </div>
                <div class="details-specs-list">
                  <div class="spec-row">
                    <span class="detail-k mono">{{ t('admin.applicant') }}</span>
                    <strong class="detail-v">{{ selectedApplication.contactPerson || '—' }}</strong>
                  </div>
                  <div class="spec-row">
                    <span class="detail-k mono">{{ t('auth.email') }}</span>
                    <a
                      v-if="selectedApplication.contactEmail || selectedApplication.email"
                      :href="`mailto:${selectedApplication.contactEmail || selectedApplication.email}`"
                      class="website-link mono"
                    >
                      {{ selectedApplication.contactEmail || selectedApplication.email }}
                    </a>
                    <span v-else class="detail-v mono">—</span>
                  </div>
                  <div class="spec-row">
                    <span class="detail-k mono">{{ t('auth.phoneNumber') }}</span>
                    <a
                      v-if="selectedApplication.phone"
                      :href="`tel:${selectedApplication.phone}`"
                      class="website-link mono"
                    >
                      {{ selectedApplication.phone }}
                    </a>
                    <span v-else class="detail-v mono">—</span>
                  </div>
                </div>
              </div>

              <!-- Platform User Account Verification -->
              <div class="details-section">
                <div class="details-section-head">
                  <span class="material-symbols-outlined text-[18px] text-primary">account_circle</span>
                  <h4 class="details-section-title">{{ t('admin.accountVerification') }}</h4>
                </div>

                <div v-if="loadingRelatedUser" class="user-loading-box">
                  <span class="material-symbols-outlined spin text-[20px] text-primary">progress_activity</span>
                  <span class="mono text-xs text-muted">{{ t('common.loading') }}...</span>
                </div>

                <div v-else-if="relatedUser" class="related-user-card">
                  <div class="user-card-head">
                    <div class="user-avatar-badge">
                      <span>{{ (relatedUser.fullName || relatedUser.email || 'U').charAt(0).toUpperCase() }}</span>
                    </div>
                    <div class="user-info-text">
                      <div class="user-name-row">
                        <strong class="user-name">{{ relatedUser.fullName }}</strong>
                        <span class="user-role-badge mono">
                          {{ t(`admin.${USER_TYPE_ROLE_KEY(relatedUser.userType)}` as MessageKey) || relatedUser.roles?.join(', ') || 'User' }}
                        </span>
                      </div>
                      <span class="user-email mono">{{ relatedUser.email }}</span>
                    </div>
                  </div>

                  <div class="user-specs-grid">
                    <div class="user-spec-item">
                      <span class="spec-k mono">{{ t('commerce.status') }}</span>
                      <span class="mono status-badge" :class="relatedUser.isActive ? 'badge--success' : 'badge--danger'">
                        <span class="badge-dot"></span>
                        {{ relatedUser.isActive ? t('admin.userActive') : t('admin.userInactive') }}
                      </span>
                    </div>

                    <div class="user-spec-item">
                      <span class="spec-k mono">{{ t('auth.phoneNumber') }}</span>
                      <span class="mono spec-v">{{ relatedUser.phoneNumber || '—' }}</span>
                    </div>

                    <div class="user-spec-item">
                      <span class="spec-k mono">{{ t('admin.submittedDate') }}</span>
                      <span class="mono spec-v">{{ new Date(relatedUser.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</span>
                    </div>
                  </div>

                  <div class="user-card-foot">
                    <router-link
                      :to="{ path: '/admin/users', query: { search: relatedUser.email } }"
                      class="btn-user-admin-link mono"
                      target="_blank"
                    >
                      <span class="material-symbols-outlined text-[15px]">open_in_new</span>
                      <span>{{ t('admin.viewUserInAdmin') }}</span>
                    </router-link>
                  </div>
                </div>

                <div v-else class="no-user-box">
                  <span class="material-symbols-outlined text-slate-400 text-[24px]">person_off</span>
                  <p class="mono text-xs text-muted">{{ t('admin.noRelatedUser') }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Footer with Actions -->
          <div class="modal-foot">
            <template v-if="isPending(selectedApplication.status)">
              <BaseButton variant="primary" @click="confirmApprove(selectedApplication); showApplicationModal = false">
                <span class="material-symbols-outlined text-[16px]">check</span>
                <span>{{ t('sales.approve') }}</span>
              </BaseButton>
              <BaseButton variant="danger" @click="confirmReject(selectedApplication); showApplicationModal = false">
                <span class="material-symbols-outlined text-[16px]">close</span>
                <span>{{ t('sales.decline') }}</span>
              </BaseButton>
            </template>
            <BaseButton variant="secondary" @click="closeApplicationDetails">
              {{ t('common.close') }}
            </BaseButton>
          </div>
        </div>
      </BaseModal>
    </div>
  </AdminLayout>
</template>

<style scoped>
.companies-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.details-logo {
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  margin-bottom: 1rem;
  min-height: 96px;
}

.companies-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.25rem;
}

.head-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  letter-spacing: 0.06em;
  margin-bottom: 0.5rem;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-primary);
  animation: wlPulse 2s infinite ease-in-out;
}

.head-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: 1.68rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.1;
}

.head-subtitle {
  font-size: 13.5px;
  color: var(--wl-muted);
  margin: 0.25rem 0 0;
}

/* Tab Ribbon */
.tab-ribbon {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--wl-border, #D9E2EC);
  padding-bottom: 0;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  white-space: nowrap;
  margin-bottom: 0.25rem;
}

.tab-ribbon::-webkit-scrollbar {
  display: none;
}

.tab-btn {
  padding: 0.75rem 1.25rem;
  border: none;
  background: transparent;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--fg-muted, #627D98);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  transition: all var(--duration-fast, 0.16s) var(--ease-out);
}

.tab-btn:hover {
  color: var(--fg-heading, #102A43);
}

.tab-btn.is-active {
  color: var(--primary, #0F3D56);
  border-bottom-color: var(--primary, #0F3D56);
}

.tab-chip {
  font-size: 10px;
  font-weight: 700;
  background: var(--surface-subtle, #F7F9FB);
  color: var(--fg-muted, #627D98);
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-xs, 3px);
}

.tab-chip--amber {
  background: var(--color-warning-50, #FFF8E1);
  color: var(--fg-warning, #E67E22);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
  min-width: 0;
}

/* Executive KPI Metrics Ribbon */
.kpi-ribbon {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
  margin-bottom: 0.35rem;
  width: 100%;
  min-width: 0;
}

.kpi-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  border-radius: var(--radius-lg, 10px);
  padding: 0.95rem 1.15rem;
  text-align: start;
  cursor: pointer;
  position: relative;
  transition: all var(--duration-fast, 0.18s) cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: var(--shadow-xs);
  min-width: 0;
  overflow: hidden;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: color-mix(in srgb, var(--wl-primary) 40%, var(--wl-border));
}

.kpi-card:active {
  transform: translateY(0);
}

.kpi-card.is-active {
  border-color: var(--wl-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--wl-primary) 20%, transparent);
  background: color-mix(in srgb, var(--wl-primary) 3%, var(--wl-surface));
}

.kpi-card-main {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.kpi-icon-box {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 20px;
  background: var(--wl-surface-soft);
  color: var(--wl-muted);
  border: 1px solid var(--wl-border);
}

.kpi-card--all .kpi-icon-box {
  background: color-mix(in srgb, var(--wl-primary) 10%, var(--wl-surface));
  color: var(--wl-primary);
  border-color: color-mix(in srgb, var(--wl-primary) 25%, transparent);
}

.kpi-card--pending .kpi-icon-box {
  background: #FEF3C7;
  color: #D97706;
  border-color: #FDE68A;
}

.kpi-card--approved .kpi-icon-box {
  background: #ECFDF5;
  color: #059669;
  border-color: #A7F3D0;
}

.kpi-card--rejected .kpi-icon-box {
  background: #FFF1F2;
  color: #E11D48;
  border-color: #FECDD3;
}

.kpi-content {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.kpi-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--wl-muted);
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kpi-val-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.kpi-value {
  font-family: var(--wl-font-display, system-ui);
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  line-height: 1.1;
}

.kpi-pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #D97706;
  box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.7);
  animation: kpi-pulse 1.8s infinite;
}

@keyframes kpi-pulse {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 6px rgba(217, 119, 6, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(217, 119, 6, 0);
  }
}

.kpi-card-foot {
  margin-top: 0.5rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--wl-border);
}

.kpi-foot-text {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--wl-muted);
  text-transform: capitalize;
}

/* Toolbar */
.toolbar-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 14px;
  padding: 0.85rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.85rem;
  box-shadow: var(--shadow-xs);
  flex-wrap: wrap;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 280px;
  max-width: 100%;
}

.search-icon {
  position: absolute;
  inset-inline-start: 12px;
  font-size: 18px;
  color: var(--wl-muted-soft);
  pointer-events: none;
}

.toolbar-input {
  width: 100%;
  height: 40px;
  padding: 0 14px;
  padding-inline-start: 38px;
  padding-inline-end: 32px;
  background: var(--wl-surface-soft);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  font-size: 13px;
  color: var(--wl-ink-strong);
  outline: none;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.toolbar-input:focus {
  background: var(--wl-surface);
  border-color: var(--wl-primary);
  box-shadow: 0 0 0 3px rgba(105, 169, 255, 0.12);
}

.search-clear-btn {
  position: absolute;
  inset-inline-end: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--wl-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 2px;
  border-radius: 50%;
}

.search-clear-btn:hover {
  background: var(--wl-surface-hover);
  color: var(--wl-ink-strong);
}

.filter-select-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.filter-icon {
  position: absolute;
  inset-inline-start: 10px;
  font-size: 16px;
  color: var(--wl-muted);
  pointer-events: none;
}

.filter-select {
  height: 40px;
  padding: 0 12px;
  padding-inline-start: 32px;
  background: var(--wl-surface-soft);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--wl-ink-strong);
  outline: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-select:focus {
  background: var(--wl-surface);
  border-color: var(--wl-primary);
}

.status-segment-group {
  display: inline-flex;
  background: var(--wl-surface-soft);
  padding: 3px;
  border-radius: 8px;
  gap: 2px;
}

.seg-btn {
  border: none;
  background: transparent;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--wl-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
}

.seg-btn.is-active {
  background: var(--wl-surface);
  color: var(--wl-primary);
  font-weight: 700;
  box-shadow: var(--shadow-xs);
}

.seg-badge {
  background: #D97706;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 10px;
  margin-inline-start: 4px;
}

.reset-filters-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: transparent;
  border: 1px dashed var(--wl-border);
  color: var(--wl-muted);
  border-radius: 6px;
  padding: 0.35rem 0.65rem;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.reset-filters-btn:hover {
  background: var(--wl-surface-soft);
  color: var(--wl-danger);
  border-color: var(--wl-danger);
}

.counter-text {
  font-size: 11.5px;
  color: var(--wl-muted);
  font-weight: 700;
}

/* Executive Table */
.table-card {
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-lg, 8px);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  width: 100%;
  min-width: 0;
}

.exec-table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
  text-align: start;
}

.exec-table thead th {
  background: var(--surface-subtle, #F7F9FB);
  border-bottom: 1px solid var(--border, #D9E2EC);
  padding: 0.75rem 1rem;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--fg-muted, #627D98);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.exec-row {
  height: 52px;
  border-bottom: 1px solid var(--border, #D9E2EC);
  transition: background var(--duration-fast, 0.15s) ease;
}

.exec-row:hover {
  background: var(--surface-subtle, #F7F9FB);
}

.exec-row td {
  padding: 0.65rem 1rem;
  vertical-align: middle;
}

.company-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  max-width: 260px;
}

.company-badge-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 1px solid transparent;
}

.company-badge-icon span {
  font-size: 18px;
}

.type--hospital {
  background: #ECFDF5;
  color: #059669;
  border-color: #A7F3D0;
}

.type--distributor {
  background: #EFF6FF;
  color: #2563EB;
  border-color: #BFDBFE;
}

.type--clinic {
  background: #F5F3FF;
  color: #7C3AED;
  border-color: #DDD6FE;
}

.type--default {
  background: var(--wl-surface-soft);
  color: var(--wl-muted);
  border-color: var(--wl-border);
}

.company-info-col {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.company-title-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.company-name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--fg-heading, #102A43);
}

.inst-type-badge {
  font-size: 9.5px;
  font-weight: 700;
  padding: 0.12rem 0.45rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border: 1px solid transparent;
}

.website-row {
  font-size: 11px;
  color: var(--secondary, #147D92);
}

.company-web-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: inherit;
  text-decoration: none;
}

.company-web-link:hover {
  text-decoration: underline;
}

.type-pill {
  font-size: 10.5px;
  color: var(--fg-muted, #627D98);
  background: var(--surface-subtle, #F7F9FB);
  border: 1px solid var(--border, #D9E2EC);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-xs, 3px);
}

.applicant-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.applicant-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-heading, #102A43);
}

.applicant-email,
.applicant-phone {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 11px;
  color: var(--fg-muted, #627D98);
  text-decoration: none;
}

.applicant-email:hover,
.applicant-phone:hover {
  color: var(--wl-primary);
  text-decoration: underline;
}

.country-cell {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 12px;
  color: var(--wl-ink-strong);
  font-weight: 600;
}

.volume-category-cell {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.category-tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.category-tag {
  font-size: 10px;
  font-weight: 600;
  background: var(--wl-surface-soft);
  color: var(--wl-ink-strong);
  border: 1px solid var(--wl-border);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-tag-more {
  font-size: 9.5px;
  font-weight: 700;
  background: color-mix(in srgb, var(--wl-primary) 12%, var(--wl-surface));
  color: var(--wl-primary);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}

.vol-pill {
  font-size: 10px;
  font-weight: 700;
  color: var(--secondary, #147D92);
  background: var(--brand-soft, #EDF4FF);
  border: 1px solid var(--border, #D9E2EC);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-xs, 3px);
  width: fit-content;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 10.5px;
  font-weight: 700;
  padding: 0.18rem 0.55rem;
  border-radius: var(--radius-xs, 3px);
}

.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-pill--verified {
  background: var(--color-success-50, #E8F5E9);
  color: var(--fg-success, #198754);
}
.status-pill--verified .pill-dot { background: var(--color-success-500, #198754); }

.status-pill--pending {
  background: var(--color-warning-50, #FFF8E1);
  color: var(--fg-warning, #E67E22);
}
.status-pill--pending .pill-dot { background: var(--color-warning-500, #E67E22); }

.status-pill--declined {
  background: var(--color-danger-50, #FFF8F7);
  color: var(--fg-danger, #DC3545);
}
.status-pill--declined .pill-dot { background: var(--color-danger-500, #DC3545); }

.app-actions {
  display: flex;
  gap: 0.4rem;
  justify-content: flex-end;
}

.btn-approve {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  border-radius: 6px;
  padding: 0.35rem 0.75rem;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-approve:hover {
  background: var(--wl-primary-hover);
}

.btn-reject {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--wl-surface);
  border: 1px solid rgba(237, 66, 69, 0.35);
  color: var(--wl-danger);
  border-radius: 6px;
  padding: 0.35rem 0.75rem;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-reject:hover {
  background: var(--wl-danger-soft);
}

.text-end {
  text-align: end;
}

.btn-view-app {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  color: var(--wl-ink-strong);
  border-radius: 6px;
  padding: 0.35rem 0.65rem;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-view-app:hover {
  background: var(--wl-surface-hover);
  border-color: var(--wl-primary);
  color: var(--wl-primary);
}

.app-details-flow {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
  max-height: calc(85vh - 120px);
  overflow-y: auto;
  overflow-x: hidden;
  padding-inline-end: 4px;
}

.app-hero-card {
  background: color-mix(in srgb, var(--wl-primary) 8%, var(--wl-surface));
  border: 1px solid color-mix(in srgb, var(--wl-primary) 25%, var(--wl-border));
  border-radius: var(--radius-md);
  padding: 1.15rem 1.35rem;
}

.app-hero-main {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.app-hero-badge-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 1px solid transparent;
}

.app-hero-badge-icon span {
  font-size: 26px;
}

.app-hero-text {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
}

.app-hero-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.app-hero-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.app-hero-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0;
}

.app-hero-meta {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 11.5px;
  color: var(--wl-muted);
  flex-wrap: wrap;
}

.hero-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.hero-meta-id {
  font-size: 11px;
  letter-spacing: 0.04em;
}

.app-dossier-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.15rem;
  align-items: start;
  min-width: 0;
}

.dossier-column-right {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
  min-width: 0;
}

.details-section {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: 1.1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
  box-sizing: border-box;
}

.details-section-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--wl-border);
}

.details-section-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: 12px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.details-specs-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-width: 0;
}

.spec-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid color-mix(in srgb, var(--wl-border) 60%, transparent);
  min-width: 0;
}

.spec-row .detail-k {
  flex-shrink: 0;
  font-size: 10.5px;
}

.spec-row .detail-v {
  min-width: 0;
  word-break: break-word;
  text-align: end;
}

.spec-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.spec-row--stacked {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
}

.spec-row--stacked .detail-v {
  text-align: start;
}

.details-grid-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem 1.25rem;
}

.col-span-2 {
  grid-column: span 2;
}

.website-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 12px;
  font-weight: 600;
  color: var(--wl-primary);
  text-decoration: none;
  word-break: break-all;
}

.website-link:hover {
  text-decoration: underline;
}

.user-loading-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--wl-surface);
  border: 1px dashed var(--wl-border);
  border-radius: var(--radius-md);
}

.spin {
  animation: app-spin 1s linear infinite;
}

@keyframes app-spin {
  to { transform: rotate(360deg); }
}

.related-user-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.user-card-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar-badge {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 16px;
  flex-shrink: 0;
}

.user-info-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.user-name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
}

.user-role-badge {
  font-size: 10px;
  font-weight: 700;
  background: color-mix(in srgb, var(--wl-primary) 12%, var(--wl-surface));
  color: var(--wl-primary);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-pill);
}

.user-email {
  font-size: 11.5px;
  color: var(--wl-muted);
  word-break: break-all;
}

.user-specs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.65rem;
  background: var(--wl-surface-soft);
  border-radius: var(--radius-sm);
  padding: 0.65rem 0.85rem;
  min-width: 0;
}

.user-spec-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.spec-k {
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-muted);
  text-transform: uppercase;
}

.spec-v {
  font-size: 12px;
  font-weight: 600;
  color: var(--wl-ink-strong);
  word-break: break-word;
  min-width: 0;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 11px;
  font-weight: 700;
}

.badge--success {
  color: var(--wl-success);
}

.badge--danger {
  color: var(--wl-danger);
}

.badge--amber {
  color: var(--wl-warning);
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.user-card-foot {
  display: flex;
  justify-content: flex-end;
}

.btn-user-admin-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--wl-primary);
  text-decoration: none;
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--wl-primary) 30%, var(--wl-border));
  background: var(--wl-surface);
  transition: all 0.15s ease;
}

.btn-user-admin-link:hover {
  background: color-mix(in srgb, var(--wl-primary) 10%, var(--wl-surface));
}

.no-user-box {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 1rem;
  background: var(--wl-surface);
  border: 1px dashed var(--wl-border);
  border-radius: var(--radius-md);
}

@media (max-width: 960px) {
  .kpi-ribbon {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .app-dossier-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .kpi-ribbon {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }
  .kpi-card {
    padding: 0.75rem 0.85rem;
  }
  .kpi-icon-box {
    width: 32px;
    height: 32px;
    font-size: 17px;
  }
  .kpi-value {
    font-size: 1.25rem;
  }
  .toolbar-card {
    flex-direction: column;
    align-items: stretch;
    padding: 0.75rem 0.85rem;
  }
  .search-wrap {
    width: 100%;
  }
  .status-segment-group {
    overflow-x: auto;
    width: 100%;
    -webkit-overflow-scrolling: touch;
  }
  .details-grid-2col {
    grid-template-columns: 1fr;
  }
  .col-span-2 {
    grid-column: span 1;
  }
}

@media (max-width: 380px) {
  .kpi-ribbon {
    grid-template-columns: 1fr;
  }
}
</style>

