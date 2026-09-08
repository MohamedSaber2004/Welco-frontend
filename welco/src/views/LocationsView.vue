<script setup lang="ts">
import { computed } from 'vue'
import { authService } from '../di/container'
import { t } from '../i18n'
import { useLocations } from '../composables/useLocations'
import SkeletonLoader from '../components/ui/SkeletonLoader.vue'
import ErrorState from '../components/ui/ErrorState.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BackButton from '../components/ui/BackButton.vue'

const {
  selectedCountry,
  selectedCity,
  searchQuery,
  error,
  loading,
  cities,
  zones,
  filteredCountries,
  localized,
  loadCountries,
} = useLocations()

const isOrganizationUser = computed(() => authService.isOrganizationUser.value)
</script>

<template>
  <div class="page-shell locations-view">
    <BackButton fallback="/" variant="minimal" class="mb-3" />

    <!-- Breadcrumb -->
    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/">{{ t('nav.home') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('locations.title') }}</span>
    </nav>

    <!-- Executive Header -->
    <header class="locations-head">
      <div class="head-info">
        <div class="head-chip mono">
          <span class="pulse-dot"></span>
          <span>{{ t('locations.eyebrow') }}</span>
        </div>
        <h1 class="head-title">{{ t('locations.title') }}</h1>
        <p class="head-subtitle">
          {{ isOrganizationUser ? t('locations.doctorHint') : t('locations.adminHint') }}
        </p>

        <!-- Dynamic Cascade Lineage -->
        <div class="cascade-pills mono">
          <span class="pill-node" :class="{ 'is-active': !!selectedCountry }">
            <span class="dot"></span>
            <span>1. {{ t('locations.countries') }}</span>
          </span>
          <span class="crumb-sep icon--directional">→</span>
          <span class="pill-node" :class="{ 'is-active': !!selectedCity }">
            <span class="dot"></span>
            <span>2. {{ t('locations.cities') }}</span>
          </span>
          <span class="crumb-sep icon--directional">→</span>
          <span class="pill-node" :class="{ 'is-active': zones.length > 0 }">
            <span class="dot"></span>
            <span>3. {{ t('locations.zones') }}</span>
          </span>
        </div>
      </div>

      <div class="search-input-wrap">
        <span class="material-symbols-outlined search-icon">search</span>
        <input
          v-model="searchQuery"
          :placeholder="t('admin.searchPlaceholder')"
          :aria-label="t('common.searchPlaceholder')"
          class="toolbar-search-input"
        />
      </div>
    </header>

    <!-- 1. Loading State -->
    <div v-if="loading && !filteredCountries.length" class="skeleton-grid">
      <SkeletonLoader type="location-grid" :count="3" />
    </div>

    <!-- 2. Error State -->
    <ErrorState
      v-else-if="error && !filteredCountries.length"
      :message="error"
      @retry="loadCountries"
    />

    <!-- 3. Cascading 3-Column Territory Explorer -->
    <div v-else class="territory-grid">
      <!-- Column 1: Countries -->
      <section class="territory-col">
        <div class="col-head">
          <div class="col-title-row">
            <div class="col-title-group">
              <span class="material-symbols-outlined text-[18px] text-indigo-600">public</span>
              <h2 class="col-title">{{ t('locations.countries') }}</h2>
            </div>
            <span class="mono count-pill">{{ filteredCountries.length }}</span>
          </div>
          <span class="mono col-eyebrow">{{ t('locations.rootTerritory') }}</span>
        </div>

        <EmptyState
          v-if="!filteredCountries.length"
          :title="t('locations.noCountries')"
          :description="t('locations.emptyDescription')"
          compact
        />

        <div v-else class="item-list-box" role="listbox">
          <button
            v-for="c in filteredCountries"
            :key="c.id"
            type="button"
            class="territory-item"
            :class="{ 'is-selected': selectedCountry === c.id }"
            :aria-selected="selectedCountry === c.id"
            @click="selectedCountry = c.id"
          >
            <span class="mono code-tag">{{ c.code || '—' }}</span>
            <span class="item-name">{{ localized(c.nameEn, c.nameAr) }}</span>
            <span class="material-symbols-outlined nav-arrow icon--directional">chevron_right</span>
          </button>
        </div>
      </section>

      <!-- Column 2: Cities -->
      <section class="territory-col">
        <div class="col-head">
          <div class="col-title-row">
            <div class="col-title-group">
              <span class="material-symbols-outlined text-[18px] text-indigo-600">apartment</span>
              <h2 class="col-title">{{ t('locations.cities') }}</h2>
            </div>
            <span class="mono count-pill">{{ cities.length }}</span>
          </div>
          <span class="mono col-eyebrow">{{ t('locations.insideCountry') }}</span>
        </div>

        <EmptyState
          v-if="!selectedCountry"
          :title="t('locations.selectCountryHint')"
          :description="t('locations.selectCountryHint')"
          icon="arrow_forward"
          compact
        />

        <EmptyState
          v-else-if="!cities.length"
          :title="t('locations.noCities')"
          :description="t('locations.emptyDescription')"
          compact
        />

        <div v-else class="item-list-box" role="listbox">
          <button
            v-for="c in cities"
            :key="c.id"
            type="button"
            class="territory-item"
            :class="{ 'is-selected': selectedCity === c.id }"
            :aria-selected="selectedCity === c.id"
            @click="selectedCity = c.id"
          >
            <span class="item-name">{{ localized(c.nameEn, c.nameAr) }}</span>
            <span class="material-symbols-outlined nav-arrow icon--directional">chevron_right</span>
          </button>
        </div>
      </section>

      <!-- Column 3: Zones -->
      <section class="territory-col">
        <div class="col-head">
          <div class="col-title-row">
            <div class="col-title-group">
              <span class="material-symbols-outlined text-[18px] text-indigo-600">near_me</span>
              <h2 class="col-title">{{ t('locations.zones') }}</h2>
            </div>
            <span class="mono count-pill">{{ zones.length }}</span>
          </div>
          <span class="mono col-eyebrow">{{ t('locations.deliveryAnchor') }}</span>
        </div>

        <EmptyState
          v-if="!selectedCity"
          :title="t('locations.selectCityHint')"
          :description="t('locations.selectCityHint')"
          icon="arrow_forward"
          compact
        />

        <EmptyState
          v-else-if="!zones.length"
          :title="t('locations.noZones')"
          :description="t('locations.emptyDescription')"
          compact
        />

        <div v-else class="item-list-box">
          <div v-for="z in zones" :key="z.id" class="zone-item-static">
            <span class="zone-dot"></span>
            <span class="item-name">{{ localized(z.nameEn, z.nameAr) }}</span>
            <span class="mono zone-badge">{{ t('locations.zoneBadge') }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.locations-view {
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

.locations-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.head-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
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
  width: fit-content;
  margin-bottom: 0.4rem;
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
  max-width: 540px;
}

.cascade-pills {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.pill-node {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-muted-soft);
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
}

.pill-node .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #CBD5E1;
}

.pill-node.is-active {
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border-color: rgba(var(--wl-primary-rgb), 0.3);
}

.pill-node.is-active .dot {
  background: #4F46E5;
}

/* Search Bar */
.search-input-wrap {
  position: relative;
  width: 300px;
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
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  font-size: 13.5px;
  color: var(--wl-ink-strong);
  outline: none;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.toolbar-search-input:focus {
  border-color: #4F46E5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
}

/* 3-Column Territory Grid */
.skeleton-grid,
.territory-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

.territory-col {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  min-height: 480px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
}

.col-head {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid #F1F5F9;
  margin-bottom: 0.75rem;
}

.col-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.col-title-group {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.col-title {
  font-size: 14.5px;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0;
}

.count-pill {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
}

.col-eyebrow {
  font-size: 10px;
  font-weight: 700;
  color: #94A3B8;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.item-list-box {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  overflow-y: auto;
  max-height: 460px;
  padding-inline-end: 2px;
}

.territory-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  border-radius: 10px;
  color: var(--wl-ink-strong);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  text-align: start;
  width: 100%;
  transition: all 0.15s ease;
}

.territory-item:hover {
  border-color: var(--wl-border-strong);
  background: var(--wl-surface-soft);
}

.territory-item.is-selected {
  background: #4F46E5;
  border-color: #4F46E5;
  color: #FFFFFF;
  box-shadow: 0 4px 12px -2px rgba(79, 70, 229, 0.35);
}

.code-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  background: var(--wl-surface-soft);
  color: var(--wl-ink-soft);
  border-radius: 4px;
  letter-spacing: 0.04em;
}

.territory-item.is-selected .code-tag {
  background: rgba(255, 255, 255, 0.2);
  color: #FFFFFF;
}

.item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-arrow {
  font-size: 18px;
  color: #94A3B8;
  transition: transform 0.15s;
}

.territory-item:hover .nav-arrow {
  transform: translateX(calc(2px * var(--wl-dir-sign, 1)));
  color: #4F46E5;
}

.territory-item.is-selected .nav-arrow {
  color: #FFFFFF;
}

.zone-item-static {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--wl-border);
  background: var(--wl-surface-soft);
  border-radius: 10px;
  color: var(--wl-ink-strong);
  font-size: 13.5px;
  font-weight: 600;
}

.zone-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10B981;
}

.zone-badge {
  font-size: 10px;
  font-weight: 700;
  color: #0D9488;
  background: #CCFBF1;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
}

@media (max-width: 1024px) {
  .skeleton-grid,
  .territory-grid {
    grid-template-columns: 1fr;
  }
}
</style>
