<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { t, locale, setLocale } from '../../i18n'
import { authService } from '../../di/container'
import { AppLanguage } from '../../domain/models/user'

const isAdmin = computed(() => authService.isAdmin.value)
const isStaff = computed(() => authService.isWelcoStaff.value)
const canManageTerritory = computed(() => isAdmin.value)
const canManageUsers = computed(() => isAdmin.value)
const canManageCompanies = computed(() => isAdmin.value)
const canManageCertifications = computed(() => isAdmin.value)

const STORAGE_KEY = 'welco-admin-rail-collapsed'
const collapsed = ref(false)
try {
  const v = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  collapsed.value = v ? v === '1' : false
} catch {}
watch(collapsed, (v) => {
  try { if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, v ? '1' : '0') } catch {}
})
const toggle = () => { collapsed.value = !collapsed.value }

const toggleLang = async () => {
  const next = locale.value === 'ar' ? 'en' : 'ar'
  setLocale(next)
  if (authService.user.value && authService.user.value.fullName) {
    try {
      await authService.updateProfile({
        fullName: authService.user.value.fullName,
        phoneNumber: authService.user.value.phoneNumber || undefined,
        language: next === 'ar' ? AppLanguage.Ar : AppLanguage.En,
      })
    } catch {}
  }
}

// Collapsible sub-menus state
const openSections = ref<Record<string, boolean>>({
  territory: true,
  sales: true,
  catalog: true,
  support: true,
})

const toggleSection = (key: string) => {
  openSections.value[key] = !openSections.value[key]
}
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-rail" :class="{ 'admin-rail--collapsed': collapsed }">
      <div class="rail__top">
        <div class="rail__brand">
          <span class="rail__dot" aria-hidden="true"></span>
          <span v-if="!collapsed" class="rail__brand-text mono">{{ t('admin.console') }}</span>
        </div>
        <button class="rail__toggle" type="button" :aria-label="collapsed ? t('common.expand') : t('common.collapse')" @click="toggle">
          <span class="material-symbols-outlined icon--directional" style="font-size:16px">{{ collapsed ? 'chevron_right' : 'chevron_left' }}</span>
        </button>
      </div>

      <nav class="rail__nav" :aria-label="t('nav.navigation')">
        <router-link to="/admin" class="admin-link" exact-active-class="admin-link--active">
          <span class="material-symbols-outlined nav-icon">dashboard</span>
          <span v-if="!collapsed" class="admin-link__label">{{ t('admin.dashboard') }}</span>
        </router-link>

        <!-- Territory Group -->
        <template v-if="canManageTerritory">
          <button v-if="!collapsed" type="button" class="admin-section-toggle mono" @click="toggleSection('territory')">
            <span>{{ t('admin.territory') }}</span>
            <span class="material-symbols-outlined section-arrow" :class="{ 'is-open': openSections.territory }">expand_more</span>
          </button>
          <div v-show="collapsed || openSections.territory" class="admin-sub-menu">
            <router-link to="/admin/countries" class="admin-link" active-class="admin-link--active">
              <span class="material-symbols-outlined nav-icon">public</span>
              <span v-if="!collapsed" class="admin-link__label">{{ t('admin.countries') }}</span>
            </router-link>
            <router-link to="/admin/cities" class="admin-link" active-class="admin-link--active">
              <span class="material-symbols-outlined nav-icon">location_city</span>
              <span v-if="!collapsed" class="admin-link__label">{{ t('admin.cities') }}</span>
            </router-link>
            <router-link to="/admin/zones" class="admin-link" active-class="admin-link--active">
              <span class="material-symbols-outlined nav-icon">my_location</span>
              <span v-if="!collapsed" class="admin-link__label">{{ t('admin.zones') }}</span>
            </router-link>
          </div>
        </template>

        <!-- Commerce & Operations Group -->
        <button v-if="!collapsed" type="button" class="admin-section-toggle mono" @click="toggleSection('sales')">
          <span>{{ t('admin.commerce') }}</span>
          <span class="material-symbols-outlined section-arrow" :class="{ 'is-open': openSections.sales }">expand_more</span>
        </button>
        <div v-show="collapsed || openSections.sales" class="admin-sub-menu">
          <router-link to="/admin/sales" class="admin-link" active-class="admin-link--active">
            <span class="material-symbols-outlined nav-icon">request_quote</span>
            <span v-if="!collapsed" class="admin-link__label">{{ t('admin.sales') }}</span>
          </router-link>
          <router-link to="/admin/orders" class="admin-link" active-class="admin-link--active">
            <span class="material-symbols-outlined nav-icon">local_shipping</span>
            <span v-if="!collapsed" class="admin-link__label">{{ t('admin.orders') }}</span>
          </router-link>
          <router-link v-if="canManageCompanies" to="/admin/companies" class="admin-link" active-class="admin-link--active">
            <span class="material-symbols-outlined nav-icon">apartment</span>
            <span v-if="!collapsed" class="admin-link__label">{{ t('admin.companies') }}</span>
          </router-link>
        </div>

        <!-- Catalog & Quality Group -->
        <button v-if="!collapsed" type="button" class="admin-section-toggle mono" @click="toggleSection('catalog')">
          <span>{{ t('admin.catalog') }}</span>
          <span class="material-symbols-outlined section-arrow" :class="{ 'is-open': openSections.catalog }">expand_more</span>
        </button>
        <div v-show="collapsed || openSections.catalog" class="admin-sub-menu">
          <router-link to="/admin/catalog" class="admin-link" active-class="admin-link--active">
            <span class="material-symbols-outlined nav-icon">inventory_2</span>
            <span v-if="!collapsed" class="admin-link__label">{{ t('nav.catalog') }}</span>
          </router-link>
          <router-link v-if="canManageCertifications" to="/admin/certifications" class="admin-link" active-class="admin-link--active">
            <span class="material-symbols-outlined nav-icon">verified</span>
            <span v-if="!collapsed" class="admin-link__label">{{ t('certifications.title') }}</span>
          </router-link>
        </div>

        <!-- Support, People & Audit Group -->
        <button v-if="!collapsed" type="button" class="admin-section-toggle mono" @click="toggleSection('support')">
          <span>{{ t('admin.system') }}</span>
          <span class="material-symbols-outlined section-arrow" :class="{ 'is-open': openSections.support }">expand_more</span>
        </button>
        <div v-show="collapsed || openSections.support" class="admin-sub-menu">
          <router-link v-if="canManageUsers" to="/admin/users" class="admin-link" active-class="admin-link--active">
            <span class="material-symbols-outlined nav-icon">group</span>
            <span v-if="!collapsed" class="admin-link__label">{{ t('admin.users') }}</span>
          </router-link>
          <router-link to="/admin/help" class="admin-link" active-class="admin-link--active">
            <span class="material-symbols-outlined nav-icon">help</span>
            <span v-if="!collapsed" class="admin-link__label">{{ t('nav.help') }}</span>
          </router-link>
          <router-link to="/admin/tickets" class="admin-link" active-class="admin-link--active">
            <span class="material-symbols-outlined nav-icon">support_agent</span>
            <span v-if="!collapsed" class="admin-link__label">{{ t('admin.supportTickets') }}</span>
          </router-link>
          <router-link v-if="isAdmin" to="/admin/audit-logs" class="admin-link" active-class="admin-link--active">
            <span class="material-symbols-outlined nav-icon">history</span>
            <span v-if="!collapsed" class="admin-link__label">{{ t('admin.auditLogs') }}</span>
          </router-link>
        </div>
      </nav>

      <div class="rail__foot">
        <div v-if="!collapsed" class="rail__status mono">
          <span class="rail__dot--live" aria-hidden="true"></span>
          <span>{{ t('admin.systemLive') }}</span>
        </div>
        <button
          type="button"
          class="rail__lang-btn mono"
          :title="locale === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'"
          @click="toggleLang"
        >
          <span class="material-symbols-outlined text-[16px]">language</span>
          <span v-if="!collapsed">{{ locale === 'ar' ? 'English' : 'العربية' }}</span>
        </button>
      </div>
    </aside>

    <div class="admin-mobile" :aria-label="t('nav.navigation')">
      <router-link to="/admin" class="admin-mobile-pill" exact-active-class="is-active">{{ t('admin.dashboard') }}</router-link>
      <router-link to="/admin/sales" class="admin-mobile-pill" active-class="is-active">{{ t('admin.sales') }}</router-link>
      <router-link to="/admin/orders" class="admin-mobile-pill" active-class="is-active">{{ t('admin.orders') }}</router-link>
      <router-link to="/admin/catalog" class="admin-mobile-pill" active-class="is-active">{{ t('nav.catalog') }}</router-link>
      <router-link v-if="canManageCompanies" to="/admin/companies" class="admin-mobile-pill" active-class="is-active">{{ t('admin.companies') }}</router-link>
      <router-link v-if="canManageTerritory" to="/admin/countries" class="admin-mobile-pill" active-class="is-active">{{ t('admin.countries') }}</router-link>
      <router-link v-if="canManageUsers" to="/admin/users" class="admin-mobile-pill" active-class="is-active">{{ t('admin.users') }}</router-link>
      <router-link to="/admin/tickets" class="admin-mobile-pill" active-class="is-active">{{ t('admin.supportTickets') }}</router-link>
      <router-link v-if="isAdmin" to="/admin/audit-logs" class="admin-mobile-pill" active-class="is-active">{{ t('admin.auditLogs') }}</router-link>
    </div>

    <div class="admin-main">
      <div class="admin-main__inner"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  min-height: calc(100vh - var(--wl-header-height, 56px));
  background: var(--wl-paper);
  display: flex;
  gap: var(--wl-gutter);
  padding: var(--wl-page-padding-top) var(--wl-gutter) var(--wl-page-padding-bottom);
  padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left));
  padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right));
  max-width: 1560px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.admin-rail {
  width: var(--wl-rail-width, 240px);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md, 12px);
  flex-shrink: 0;
  position: sticky;
  top: calc(var(--wl-header-height, 56px) + var(--wl-page-padding-top, 1.5rem));
  height: calc(100vh - var(--wl-header-height, 56px) - calc(var(--wl-page-padding-top) + var(--wl-page-padding-bottom)));
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  box-shadow: var(--wl-shadow-card);
  transition: width 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.admin-rail--collapsed {
  width: 64px;
}

.rail__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 0.85rem;
  border-bottom: 1px solid var(--wl-border);
}

.rail__brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.rail__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--wl-teal);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.16);
}

.rail__brand-text {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--wl-ink-strong);
}

.rail__toggle {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--wl-border);
  background: var(--wl-surface-soft);
  color: var(--wl-ink-soft);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.12s ease;
}

.rail__toggle:hover {
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  border-color: var(--wl-border-strong);
}

.rail__nav {
  flex: 1;
  padding: 0.65rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.admin-section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--wl-muted);
  padding: 0.75rem 0.65rem 0.3rem;
  transition: color 0.12s ease;
}

.admin-section-toggle:hover {
  color: var(--wl-ink-strong);
}

.section-arrow {
  font-size: 16px;
  transition: transform 0.15s ease;
}

.section-arrow.is-open {
  transform: rotate(180deg);
}

.admin-sub-menu {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}

/* Subtle active pills (Linear style) */
.admin-link {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.45rem 0.65rem;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--wl-ink-soft);
  text-decoration: none;
  border: 1px solid transparent;
  transition: all 0.12s ease;
}

.nav-icon {
  font-size: 18px;
  color: var(--wl-muted);
  transition: color 0.12s ease;
}

.admin-link:hover {
  background: var(--wl-surface-soft);
  color: var(--wl-ink-strong);
}

.admin-link:hover .nav-icon {
  color: var(--wl-ink-strong);
}

.admin-link--active {
  background: var(--wl-teal-soft) !important;
  color: var(--wl-teal) !important;
  border-color: rgba(99, 102, 241, 0.16) !important;
  font-weight: 600;
}

.admin-link--active .nav-icon {
  color: var(--wl-teal);
}

.rail__foot {
  padding: 0.75rem 0.85rem;
  border-top: 1px solid var(--wl-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.rail__status {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 11px;
  color: var(--wl-muted);
}

.rail__lang-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 6px;
  padding: 0.28rem 0.55rem;
  color: var(--wl-ink-soft);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.15s ease;
}

.rail__lang-btn:hover {
  background: var(--wl-surface);
  color: var(--wl-teal);
  border-color: var(--wl-teal);
}

.admin-rail--collapsed .rail__foot {
  justify-content: center;
  padding: 0.75rem 0.4rem;
}

.admin-rail--collapsed .rail__lang-btn {
  padding: 0.35rem;
}

.rail__dot--live {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-success);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.16);
}

.admin-rail--collapsed .admin-link__label,
.admin-rail--collapsed .admin-section-toggle,
.admin-rail--collapsed .rail__brand-text,
.admin-rail--collapsed .rail__status {
  display: none;
}

.admin-rail--collapsed .admin-link {
  justify-content: center;
  padding: 0.5rem;
}

.admin-rail--collapsed .rail__top {
  justify-content: center;
}

.admin-main {
  flex: 1;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.admin-main__inner {
  max-width: var(--wl-max-width, 1280px);
  margin: 0 auto;
  width: 100%;
  min-width: 0;
}

.admin-mobile {
  display: none;
}

@media (min-width: 901px) and (max-width: 1100px) {
  .admin-rail:not(.admin-rail--collapsed) {
    width: 210px;
  }
}

@media (max-width: 900px) {
  .admin-shell {
    flex-direction: column;
    padding: 0;
    gap: 0;
    max-width: 100%;
  }
  .admin-rail {
    display: none;
  }
  .admin-mobile {
    display: flex;
    gap: 0.4rem;
    padding: 0.6rem var(--wl-gutter);
    padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left));
    padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right));
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    background: var(--wl-surface);
    border-bottom: 1px solid var(--wl-border);
    position: sticky;
    top: var(--wl-header-height, 56px);
    z-index: 20;
    overscroll-behavior-x: contain;
  }
  .admin-mobile::-webkit-scrollbar {
    display: none;
  }
  .admin-mobile-pill {
    padding: 0.42rem 0.8rem;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 600;
    background: var(--wl-surface);
    color: var(--wl-ink-soft);
    border: 1px solid var(--wl-border);
    white-space: nowrap;
    text-decoration: none;
    transition: all 0.12s ease;
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .admin-mobile-pill.is-active {
    background: var(--wl-teal-soft);
    color: var(--wl-teal);
    border-color: rgba(99, 102, 241, 0.25);
  }
  .admin-main {
    padding: 0;
  }
  .admin-main__inner {
    padding: var(--wl-page-padding-top) var(--wl-gutter) var(--wl-page-padding-bottom);
    padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left));
    padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right));
  }
}
</style>
