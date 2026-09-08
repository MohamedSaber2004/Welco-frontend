<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { t, locale } from '../i18n'
import { useAddresses } from '../composables/useAddresses'
import { useCompanyAddresses } from '../composables/useCompanyAddresses'
import { locationService, authService, companyService } from '../di/container'
import { currencyForAddressCountry } from '../utils/country-currency-map'
import BaseModal from '../components/ui/BaseModal.vue'
import BackButton from '../components/ui/BackButton.vue'
import SkeletonLoader from '../components/ui/SkeletonLoader.vue'
import ErrorState from '../components/ui/ErrorState.vue'
import EmptyState from '../components/ui/EmptyState.vue'

const personal = useAddresses()
const company = useCompanyAddresses()

const activeTab = ref<'personal' | 'company'>('personal')
const isCompanyUser = computed(() => authService.isOrganizationUser.value)

onMounted(async () => {
  await locationService.loadCountries().catch(() => {})
  if (isCompanyUser.value) {
    await companyService.loadMyCompany().catch(() => {})
    if (companyService.myCompany.value?.id) void company.load()
  }
})

const groupedPersonal = computed(() => {
  const m = new Map<string, typeof personal.addresses.value>()
  for (const a of personal.addresses.value) {
    const arr = m.get(a.countryId) ?? []
    arr.push(a)
    m.set(a.countryId, arr)
  }
  return [...m.entries()]
})

const groupedCompany = computed(() => {
  const m = new Map<string, typeof company.addresses.value>()
  for (const a of company.addresses.value) {
    const arr = m.get(a.countryId) ?? []
    arr.push(a)
    m.set(a.countryId, arr)
  }
  return [...m.entries()]
})

const localized = (en?: string | null, ar?: string | null): string => {
  if (locale.value === 'ar') return ar || en || ''
  return en || ar || ''
}

const countryLabel = (countryId: string) => {
  const c = locationService.getCountryById(countryId)
  if (!c) return '—'
  return localized(c.nameEn, c.nameAr)
}
const countryPhone = (countryId: string) => locationService.getCountryPhoneCode(countryId)
const countryIso = (countryId: string) => locationService.getCountryIso(countryId)
// Billing currency from the group's country when the API links one (null = unknown, pill hidden)
const groupCurrency = (countryId: string): string | null =>
  currencyForAddressCountry(locationService.countries.value, countryId)

const totalPersonal = computed(() => personal.addresses.value.length)
const distinctPersonalCountries = computed(() => new Set(personal.addresses.value.map((a) => a.countryId)).size)
const totalCompany = computed(() => company.addresses.value.length)
</script>

<template>
  <div class="page-shell addresses-view">
    <BackButton fallback="/profile" variant="minimal" class="mb-3" />

    <!-- Breadcrumb -->
    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/">{{ t('nav.home') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <router-link to="/profile">{{ t('profile.title') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('profile.addresses') }}</span>
    </nav>

    <!-- Executive Header -->
    <header class="addresses-head">
      <div>
        <div class="head-chip mono">
          <span class="pulse-dot"></span>
          <span>{{ t('addresses.eyebrow') }}</span>
        </div>
        <h1 class="head-title">{{ t('profile.addresses') }}</h1>
        <p class="head-subtitle">{{ t('profile.addressesDesc') }}</p>
      </div>

      <div class="head-actions">
        <button
          v-if="activeTab === 'personal'"
          type="button"
          class="btn-create-addr"
          @click="personal.openCreate()"
        >
          <span class="material-symbols-outlined text-[18px]">add_location</span>
          <span>{{ t('profile.addAddress') }}</span>
        </button>
        <button
          v-else
          type="button"
          class="btn-create-addr"
          @click="company.openCreate()"
        >
          <span class="material-symbols-outlined text-[18px]">add_business</span>
          <span>{{ t('addresses.addCompany') }}</span>
        </button>
      </div>
    </header>

    <!-- Tabs if Company User -->
    <div v-if="isCompanyUser" class="tab-ribbon">
      <button
        type="button"
        class="tab-btn mono"
        :class="{ 'is-active': activeTab === 'personal' }"
        @click="activeTab = 'personal'"
      >
        <span>{{ t('addresses.personalTab') }}</span>
        <span class="tab-chip">({{ totalPersonal }})</span>
      </button>
      <button
        type="button"
        class="tab-btn mono"
        :class="{ 'is-active': activeTab === 'company' }"
        @click="activeTab = 'company'"
      >
        <span>{{ t('addresses.companyTab') }}</span>
        <span class="tab-chip">({{ totalCompany }})</span>
      </button>
    </div>

    <!-- Info Callout Banner -->
    <div class="territory-info-banner">
      <span class="material-symbols-outlined banner-icon">share_location</span>
      <p class="banner-text">
        {{ t('addresses.hierarchyNote') }}
      </p>
    </div>

    <!-- TAB 1: Personal Addresses -->
    <template v-if="activeTab === 'personal'">
      <div v-if="personal.loading.value && !personal.addresses.value.length" class="grid-skeletons">
        <SkeletonLoader v-for="i in 2" :key="i" type="card" height="160px" />
      </div>

      <ErrorState
        v-else-if="personal.error.value && !personal.addresses.value.length"
        :message="personal.error.value"
        @retry="personal.load"
      />

      <EmptyState
        v-else-if="!personal.addresses.value.length"
        :title="t('profile.addressesEmpty')"
        :description="t('profile.addFirstDesc')"
        :action-text="t('profile.addAddress')"
        @action="personal.openCreate()"
      />

      <div v-else class="address-groups-stack">
        <div v-for="[countryId, group] in groupedPersonal" :key="countryId" class="country-cluster">
          <div class="cluster-head">
            <span class="material-symbols-outlined text-[18px] text-indigo-600">public</span>
            <h2 class="cluster-title">{{ countryLabel(countryId) }}</h2>
            <span class="mono country-pill">{{ countryIso(countryId) || '—' }} {{ countryPhone(countryId) || '' }}</span>
            <span class="mono cluster-count">{{ t('addresses.countInCountry', { count: group.length }) }}</span>
          </div>

          <div class="address-cards-grid">
            <article v-for="addr in group" :key="addr.id" class="address-card">
              <div class="card-main">
                <div class="addr-icon-box">
                  <span class="material-symbols-outlined">home</span>
                </div>
                <div class="addr-details">
                  <h3 class="street-name">{{ addr.street }}</h3>
                  <p class="building-meta">
                    <span v-if="addr.building">{{ t('profile.buildingShort', { building: addr.building }) }}</span>
                    <span v-if="addr.floor">, {{ t('profile.floorShort', { floor: addr.floor }) }}</span>
                    <span v-if="addr.apartment">, {{ t('profile.apartmentShort', { apartment: addr.apartment }) }}</span>
                  </p>
                  <div class="hierarchy-tags">
                    <span class="geo-pill mono">{{ localized(addr.countryNameEn, addr.countryNameAr) || countryLabel(addr.countryId) }}</span>
                    <span class="crumb-sep icon--directional">→</span>
                    <span class="geo-pill geo-pill--subtle mono">{{ localized(addr.cityNameEn, addr.cityNameAr) }}</span>
                    <span class="crumb-sep icon--directional">→</span>
                    <span class="geo-pill geo-pill--teal mono">{{ localized(addr.zoneNameEn, addr.zoneNameAr) }}</span>
                  </div>
                </div>
              </div>

              <div class="card-actions">
                <button type="button" class="btn-action-ghost" @click="personal.openEdit(addr)">
                  <span class="material-symbols-outlined text-[15px]">edit</span>
                  <span>{{ t('common.edit') }}</span>
                </button>
                <button type="button" class="btn-action-danger" @click="personal.handleDelete(addr.id)">
                  <span class="material-symbols-outlined text-[15px]">delete</span>
                  <span>{{ t('common.delete') }}</span>
                </button>
              </div>
            </article>
          </div>
        </div>
      </div>

      <!-- Personal Modal -->
      <BaseModal
        v-model="personal.showModal.value"
        :title="personal.editingId.value ? t('profile.editAddress') : t('profile.addAddress')"
        max-width="520px"
      >
        <form class="modal-form-stack" @submit.prevent="personal.handleSubmit">
          <div class="field-item">
            <label class="vip-field-label mono">{{ t('profile.country') }} *</label>
            <select v-model="personal.form.value.countryId" required class="vip-select">
              <option value="">{{ t('profile.selectCountry') }}</option>
              <option v-for="c in personal.countries.value" :key="c.id" :value="c.id">
                {{ localized(c.nameEn, c.nameAr) }} — {{ c.code }} {{ c.phoneCode }}
              </option>
            </select>
          </div>

          <div class="fields-2col">
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.city') }} *</label>
              <select
                v-model="personal.form.value.cityId"
                :disabled="!personal.form.value.countryId"
                required
                class="vip-select"
              >
                <option value="">{{ t('profile.selectCity') }}</option>
                <option v-for="c in personal.cities.value" :key="c.id" :value="c.id">
                  {{ localized(c.nameEn, c.nameAr) }}
                </option>
              </select>
            </div>

            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.zone') }} *</label>
              <select
                v-model="personal.form.value.zoneId"
                :disabled="!personal.form.value.cityId"
                required
                class="vip-select"
              >
                <option value="">{{ t('profile.selectZone') }}</option>
                <option v-for="z in personal.zones.value" :key="z.id" :value="z.id">
                  {{ localized(z.nameEn, z.nameAr) }}
                </option>
              </select>
            </div>
          </div>

          <div class="field-item">
            <label class="vip-field-label mono">{{ t('profile.street') }} *</label>
            <input
              v-model="personal.form.value.street"
              required
              :placeholder="t('profile.streetPlaceholder')"
              class="vip-input"
            />
          </div>

          <div class="fields-3col">
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.building') }}</label>
              <input v-model="personal.form.value.building" :placeholder="t('profile.buildingPlaceholder')" class="vip-input" />
            </div>
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.floor') }}</label>
              <input v-model="personal.form.value.floor" :placeholder="t('profile.floorPlaceholder')" class="vip-input" />
            </div>
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.apartment') }}</label>
              <input v-model="personal.form.value.apartment" :placeholder="t('profile.apartmentPlaceholder')" class="vip-input" />
            </div>
          </div>

          <p v-if="personal.formError.value" class="modal-error-banner">{{ personal.formError.value }}</p>

          <div class="modal-btn-grid">
            <button type="submit" :disabled="personal.submitting.value" class="btn-modal-save">
              {{ personal.submitting.value ? t('common.loading') : t('common.save') }}
            </button>
            <button type="button" class="btn-modal-cancel" @click="personal.showModal.value = false">
              {{ t('common.cancel') }}
            </button>
          </div>
        </form>
      </BaseModal>
    </template>

    <!-- TAB 2: Company Addresses -->
    <template v-else>
      <div v-if="company.loading.value && !company.addresses.value.length" class="grid-skeletons">
        <SkeletonLoader v-for="i in 2" :key="i" type="card" height="160px" />
      </div>

      <ErrorState
        v-else-if="company.error.value && !company.addresses.value.length"
        :message="company.error.value"
        @retry="company.load"
      />

      <EmptyState
        v-else-if="!company.addresses.value.length"
        :title="t('addresses.noCompanyTitle')"
        :description="t('addresses.noCompanyDesc')"
        :action-text="t('addresses.addCompany')"
        @action="company.openCreate()"
      />

      <div v-else class="address-groups-stack">
        <div v-for="[countryId, group] in groupedCompany" :key="countryId" class="country-cluster">
          <div class="cluster-head">
            <span class="material-symbols-outlined text-[18px] text-indigo-600">domain</span>
            <h2 class="cluster-title">{{ countryLabel(countryId) }}</h2>
            <span class="mono country-pill">{{ countryIso(countryId) || '—' }} {{ countryPhone(countryId) || '' }}</span>
            <span v-if="groupCurrency(countryId)" class="mono currency-pill" :title="t('checkout.currency')">{{ groupCurrency(countryId) }}</span>
            <span class="mono cluster-count">{{ t('addresses.countInCountry', { count: group.length }) }}</span>
          </div>

          <div class="address-cards-grid">
            <article v-for="addr in group" :key="addr.id" class="address-card">
              <div class="card-main">
                <div class="addr-icon-box addr-icon-box--company">
                  <span class="material-symbols-outlined">business</span>
                </div>
                <div class="addr-details">
                  <div class="street-line">
                    <h3 class="street-name">{{ addr.street }}</h3>
                    <span v-if="addr.isDefault" class="default-badge mono">{{ t('addresses.defaultBadge') }}</span>
                  </div>
                  <p class="building-meta">
                    <span v-if="addr.building">{{ t('profile.buildingShort', { building: addr.building }) }}</span>
                    <span v-if="addr.floor">, {{ t('profile.floorShort', { floor: addr.floor }) }}</span>
                    <span v-if="addr.apartment">, {{ t('profile.apartmentShort', { apartment: addr.apartment }) }}</span>
                  </p>
                  <div class="hierarchy-tags">
                    <span class="geo-pill mono">{{ localized(addr.countryNameEn, addr.countryNameAr) || countryLabel(addr.countryId) }}</span>
                    <span class="crumb-sep icon--directional">→</span>
                    <span class="geo-pill geo-pill--subtle mono">{{ localized(addr.cityNameEn, addr.cityNameAr) }}</span>
                    <span class="crumb-sep icon--directional">→</span>
                    <span class="geo-pill geo-pill--teal mono">{{ localized(addr.zoneNameEn, addr.zoneNameAr) }}</span>
                  </div>
                </div>
              </div>

              <div class="card-actions">
                <button type="button" class="btn-action-ghost" @click="company.openEdit(addr)">
                  <span class="material-symbols-outlined text-[15px]">edit</span>
                  <span>{{ t('common.edit') }}</span>
                </button>
                <button type="button" class="btn-action-danger" @click="company.handleDelete(addr.id)">
                  <span class="material-symbols-outlined text-[15px]">delete</span>
                  <span>{{ t('common.delete') }}</span>
                </button>
              </div>
            </article>
          </div>
        </div>
      </div>

      <!-- Company Modal -->
      <BaseModal
        v-model="company.showModal.value"
        :title="company.editingId.value ? t('addresses.editCompany') : t('addresses.addCompanyTitle')"
        max-width="520px"
      >
        <form class="modal-form-stack" @submit.prevent="company.handleSubmit">
          <div class="field-item">
            <label class="vip-field-label mono">{{ t('profile.country') }} *</label>
            <select v-model="company.form.value.countryId" required class="vip-select">
              <option value="">{{ t('profile.selectCountry') }}</option>
              <option v-for="c in company.countries.value" :key="c.id" :value="c.id">
                {{ localized(c.nameEn, c.nameAr) }} — {{ c.code }} {{ c.phoneCode }}
              </option>
            </select>
          </div>

          <div class="fields-2col">
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.city') }} *</label>
              <select
                v-model="company.form.value.cityId"
                :disabled="!company.form.value.countryId"
                required
                class="vip-select"
              >
                <option value="">{{ t('profile.selectCity') }}</option>
                <option v-for="c in company.cities.value" :key="c.id" :value="c.id">
                  {{ localized(c.nameEn, c.nameAr) }}
                </option>
              </select>
            </div>

            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.zone') }} *</label>
              <select
                v-model="company.form.value.zoneId"
                :disabled="!company.form.value.cityId"
                required
                class="vip-select"
              >
                <option value="">{{ t('profile.selectZone') }}</option>
                <option v-for="z in company.zones.value" :key="z.id" :value="z.id">
                  {{ localized(z.nameEn, z.nameAr) }}
                </option>
              </select>
            </div>
          </div>

          <div class="field-item">
            <label class="vip-field-label mono">{{ t('profile.street') }} *</label>
            <input
              v-model="company.form.value.street"
              required
              :placeholder="t('profile.streetPlaceholder')"
              class="vip-input"
            />
          </div>

          <div class="fields-3col">
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.building') }}</label>
              <input v-model="company.form.value.building" :placeholder="t('profile.buildingPlaceholder')" class="vip-input" />
            </div>
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.floor') }}</label>
              <input v-model="company.form.value.floor" :placeholder="t('profile.floorPlaceholder')" class="vip-input" />
            </div>
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.apartment') }}</label>
              <input v-model="company.form.value.apartment" :placeholder="t('profile.apartmentPlaceholder')" class="vip-input" />
            </div>
          </div>

          <label class="default-checkbox-wrap mono">
            <input type="checkbox" v-model="company.form.value.isDefault" class="vip-checkbox" />
            <span>{{ t('addresses.setDefault') }}</span>
          </label>

          <p v-if="company.formError.value" class="modal-error-banner">{{ company.formError.value }}</p>

          <div class="modal-btn-grid">
            <button type="submit" :disabled="company.submitting.value" class="btn-modal-save">
              {{ company.submitting.value ? t('common.loading') : t('common.save') }}
            </button>
            <button type="button" class="btn-modal-cancel" @click="company.showModal.value = false">
              {{ t('common.cancel') }}
            </button>
          </div>
        </form>
      </BaseModal>
    </template>
  </div>
</template>

<style scoped>
.addresses-view {
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
  color: var(--wl-ink-strong);
  font-weight: 700;
}

.addresses-head {
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
  background: #4F46E5;
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
  color: #64748B;
  margin: 0.25rem 0 0;
}

.btn-create-addr {
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

.btn-create-addr:hover {
  background: #4338CA;
  transform: translateY(-1px);
}

/* Tabs */
.tab-ribbon {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1.5px solid var(--wl-border, #E2E8F0);
}

.tab-btn {
  padding: 0.75rem 1.25rem;
  border: none;
  background: transparent;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wl-muted, #64748B);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1.5px;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  transition: all 0.18s ease;
}

.tab-btn:hover {
  color: var(--wl-ink-strong, #0F172A);
}

.tab-btn.is-active {
  color: var(--wl-primary, #4F46E5);
  border-bottom-color: var(--wl-primary, #4F46E5);
}

.tab-chip {
  font-size: 10px;
  font-weight: 700;
  background: var(--wl-surface-soft);
  color: var(--wl-ink-soft);
  padding: 0.1rem 0.45rem;
  border-radius: 9999px;
}

/* Territory Info Banner */
.territory-info-banner {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 12px;
  padding: 0.85rem 1.15rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.banner-icon {
  font-size: 20px;
  color: #4F46E5;
  flex-shrink: 0;
}

.banner-text {
  font-size: 13px;
  color: #475569;
  line-height: 1.5;
  margin: 0;
}

/* Clusters & Address Cards */
.address-groups-stack {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.country-cluster {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cluster-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cluster-title {
  font-size: 14.5px;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0;
}

.country-pill {
  font-size: 10px;
  font-weight: 700;
  color: #0369A1;
  background: #E0F2FE;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
}

.currency-pill {
  font-size: 10px;
  font-weight: 800;
  color: #047857;
  background: #ECFDF5;
  border: 1px solid #A7F3D0;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  letter-spacing: 0.04em;
}

.cluster-count {
  font-size: 11px;
  color: #94A3B8;
}

.address-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 1rem;
}

.address-card {
  background: var(--wl-surface, #FFFFFF);
  border: 1px solid var(--wl-border, #E2E8F0);
  border-radius: var(--wl-radius-card, 16px);
  padding: var(--wl-card-padding, 1.25rem);
  box-shadow: var(--wl-shadow-card, 0 1px 3px rgba(15, 23, 42, 0.05));
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
  transition: all 0.2s ease;
}

.address-card:hover {
  border-color: var(--wl-border-hover, #CBD5E1);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
}

.card-main {
  display: flex;
  gap: 0.85rem;
  align-items: flex-start;
}

.addr-icon-box {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.addr-icon-box--company {
  background: #E0F2FE;
  color: #0284C7;
}

.addr-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.street-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.street-name {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.default-badge {
  font-size: 9px;
  font-weight: 800;
  color: #059669;
  background: #ECFDF5;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.building-meta {
  font-size: 12.5px;
  color: #64748B;
  margin: 0;
}

.hierarchy-tags {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.35rem;
}

.geo-pill {
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
}

.geo-pill--subtle {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
}

.geo-pill--teal {
  color: #0D9488;
  background: #CCFBF1;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid #F1F5F9;
}

.btn-action-ghost {
  flex: 1;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--wl-ink-soft);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-action-ghost:hover {
  border-color: #4F46E5;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
}

.btn-action-danger {
  flex: 1;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  background: var(--wl-surface);
  border: 1px solid #FECDD3;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #E11D48;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-action-danger:hover {
  background: #FFF1F2;
}

/* Modals */
.modal-form-stack {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.vip-field-label {
  font-size: 10.5px;
  font-weight: 700;
  color: #475569;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.vip-select,
.vip-input {
  width: 100%;
  height: 48px;
  padding: 0 14px;
  background: var(--wl-surface-soft);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  font-size: 13.5px;
  color: var(--wl-ink-strong);
  outline: none;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.vip-select:focus,
.vip-input:focus {
  background: var(--wl-surface);
  border-color: #4F46E5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
}

.fields-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.fields-3col {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.75rem;
}

.default-checkbox-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12.5px;
  color: var(--wl-ink-soft);
  cursor: pointer;
}

.vip-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #4F46E5;
}

.modal-error-banner {
  background: #FFF1F2;
  border: 1px solid #FECDD3;
  color: #E11D48;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  font-size: 12.5px;
}

.modal-btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.btn-modal-save {
  height: 48px;
  background: #4F46E5;
  color: #FFFFFF;
  border: none;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-modal-save:hover:not(:disabled) {
  background: #4338CA;
}

.btn-modal-cancel {
  height: 48px;
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  color: var(--wl-ink-strong);
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-modal-cancel:hover {
  background: var(--wl-surface-soft);
}
</style>
