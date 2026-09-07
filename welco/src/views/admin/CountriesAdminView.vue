<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import { locationRepository } from '../../di/container'
import { t } from '../../i18n'
import type { CountryDto } from '../../domain/models/location'

const countries = ref<CountryDto[]>([])
const loading = ref(false)
const search = ref('')
const fetchError = ref('')

const filtered = computed(() => {
  const rawList = Array.isArray(countries.value) ? countries.value : []
  if (!search.value.trim()) return rawList
  const q = search.value.trim().toLowerCase()
  return rawList.filter((c) => {
    if (!c) return false
    const matchEn = c.nameEn ? String(c.nameEn).toLowerCase().includes(q) : false
    const matchAr = c.nameAr ? String(c.nameAr).toLowerCase().includes(q) : false
    const matchCode = c.code ? String(c.code).toLowerCase().includes(q) : false
    const matchPhone = c.phoneCode ? String(c.phoneCode).toLowerCase().includes(q) : false
    const matchId = c.id ? String(c.id).toLowerCase().includes(q) : false
    return matchEn || matchAr || matchCode || matchPhone || matchId
  })
})

const page = ref(1)
const pageSize = 10
const paginated = computed(() => {
  const start = (page.value - 1) * pageSize
  return filtered.value.slice(start, start + pageSize)
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
watch(filtered, () => {
  page.value = 1
})

const load = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    countries.value = await locationRepository.getCountries()
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <AdminLayout>
    <div class="countries-view">
      <!-- Executive Header -->
      <header class="countries-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.countriesEyebrow') }}</span>
          </div>
          <h1 class="head-title">{{ t('admin.countries') }}</h1>
          <p class="head-subtitle">{{ t('admin.countriesDesc') }}</p>
        </div>
      </header>

      <!-- 44px Search & Counts Toolbar -->
      <div class="toolbar-card">
        <div class="search-input-wrap">
          <span class="material-symbols-outlined search-icon">search</span>
          <input
            v-model="search"
            :placeholder="t('admin.searchPlaceholder')"
            :aria-label="t('common.searchPlaceholder')"
            class="toolbar-search-input"
          />
        </div>
        <span class="mono counter-text">{{ filtered.length }} {{ t('common.of') }} {{ countries.length }} {{ t('admin.countries') }}</span>
      </div>

      <!-- Executive Data Table -->
      <DataState
        :loading="loading && !countries.length"
        :error="fetchError && !countries.length ? fetchError : null"
        :empty="!filtered.length && !loading && !fetchError"
        :empty-title="t('locations.noCountries')"
        :empty-description="t('admin.emptyCountriesDesc')"
        skeleton-type="table"
        :skeleton-count="5"
        min-height="280px"
        @retry="load"
      >
        <div class="table-card">
          <div class="table-wrap">
            <table class="exec-table">
              <thead>
                <tr>
                  <th><span class="mono">EN</span> {{ t('admin.nameEn') }}</th>
                  <th><span class="mono">AR</span> {{ t('admin.nameAr') }}</th>
                  <th class="mono">{{ t('admin.code') }}</th>
                  <th class="mono">{{ t('locations.phoneCode') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in paginated" :key="c.id" class="exec-row">
                  <td>
                    <div class="country-cell">
                      <span class="material-symbols-outlined country-icon">public</span>
                      <strong class="country-name">{{ c.nameEn }}</strong>
                    </div>
                  </td>
                  <td class="arabic-name">{{ c.nameAr }}</td>
                  <td>
                    <span v-if="c.code" class="mono code-pill">{{ c.code }}</span>
                    <span v-else class="mono text-slate-400">—</span>
                  </td>
                  <td>
                    <span v-if="c.phoneCode" class="mono phone-pill">{{ c.phoneCode }}</span>
                    <span v-else class="mono text-slate-400">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <AppPagination
            v-model:page="page"
            :total-pages="totalPages"
            :total-items="filtered.length"
            :page-size="pageSize"
            variant="table"
          />
        </div>
      </DataState>
    </div>
  </AdminLayout>
</template>

<style scoped>
.countries-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.countries-head {
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
.toolbar-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
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

.counter-text {
  font-size: 12px;
  font-weight: 700;
  color: #64748B;
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

.country-cell {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.country-icon {
  font-size: 20px;
  color: #4F46E5;
}

.country-name {
  font-size: 13.5px;
  color: #0F172A;
}

.arabic-name {
  font-size: 14px;
  color: #0F172A;
}

.code-pill {
  font-size: 11.5px;
  font-weight: 700;
  color: #4F46E5;
  background: #EEF2FF;
  border: 1px solid #C7D2FE;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}

.phone-pill {
  font-size: 11.5px;
  font-weight: 700;
  color: #0F172A;
  background: #F1F5F9;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  border: 1px solid #E2E8F0;
}
</style>
