<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { t, locale, setLocale } from '../../i18n'
import { authService } from '../../di/container'
import { AppLanguage } from '../../domain/models/user'

export interface DashboardNavLink {
  to: string
  icon: string
  label: string
  exact?: boolean
  visible?: boolean
}

export interface DashboardNavSection {
  key: string
  label: string
  collapsible: boolean
  links: DashboardNavLink[]
  visible?: boolean
}

const props = withDefaults(
  defineProps<{
    storageKey: string
    brandText: string
    sections: DashboardNavSection[]
    statusText?: string
    mobileLinks?: DashboardNavLink[]
  }>(),
  {
    statusText: '',
    mobileLinks: undefined,
  },
)

const mobileMenuOpen = ref(false)

try {
  const route = useRoute()
  if (route) {
    watch(
      () => route.path,
      () => {
        mobileMenuOpen.value = false
      },
    )
  }
} catch {}

const closeMobileMenu = () => {
  mobileMenuOpen.value = false
}

const collapsed = ref(false)
try {
  const v = typeof window !== 'undefined' ? localStorage.getItem(props.storageKey) : null
  collapsed.value = v ? v === '1' : false
} catch {}
watch(collapsed, (v) => {
  try { if (typeof window !== 'undefined') localStorage.setItem(props.storageKey, v ? '1' : '0') } catch {}
})
const toggle = () => { collapsed.value = !collapsed.value }

const openSections = ref<Record<string, boolean>>({})
watch(
  () => props.sections,
  (secs) => {
    for (const s of secs) {
      if (!(s.key in openSections.value)) openSections.value[s.key] = true
    }
  },
  { immediate: true },
)
const toggleSection = (key: string) => {
  openSections.value[key] = !openSections.value[key]
}

const visibleSections = computed(() =>
  props.sections.filter((s) => s.visible !== false && s.links.some((l) => l.visible !== false)),
)

const flatMobileLinks = computed<DashboardNavLink[]>(
  () =>
    props.mobileLinks ??
    props.sections
      .filter((s) => s.visible !== false)
      .flatMap((s) => s.links.filter((l) => l.visible !== false)),
)

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
</script>

<template>
  <div class="admin-shell">
    <!-- Desktop Sidebar Rail -->
    <aside class="admin-rail" :class="{ 'admin-rail--collapsed': collapsed }">
      <div class="rail__top">
        <div class="rail__brand">
          <span class="rail__dot" aria-hidden="true"></span>
          <span v-if="!collapsed" class="rail__brand-text mono">{{ brandText }}</span>
        </div>
        <button class="rail__toggle" type="button" :aria-label="collapsed ? t('common.expand') : t('common.collapse')" @click="toggle">
          <span class="material-symbols-outlined icon--directional" style="font-size:16px">{{ collapsed ? 'chevron_right' : 'chevron_left' }}</span>
        </button>
      </div>

      <nav class="rail__nav" :aria-label="t('nav.navigation')">
        <template v-for="sec in visibleSections" :key="sec.key">
          <button
            v-if="sec.collapsible && !collapsed && sec.label"
            type="button"
            class="admin-section-toggle mono"
            @click="toggleSection(sec.key)"
          >
            <span>{{ sec.label }}</span>
            <span class="material-symbols-outlined section-arrow" :class="{ 'is-open': openSections[sec.key] }">expand_more</span>
          </button>
          <div v-show="collapsed || !sec.collapsible || openSections[sec.key]" class="admin-sub-menu">
            <router-link
              v-for="link in sec.links.filter((l) => l.visible !== false)"
              :key="link.to + link.label"
              :to="link.to"
              class="admin-link"
              :exact-active-class="link.exact ? 'admin-link--active' : undefined"
              :active-class="'admin-link--active'"
            >
              <span class="material-symbols-outlined nav-icon">{{ link.icon }}</span>
              <span v-if="!collapsed" class="admin-link__label">{{ link.label }}</span>
            </router-link>
          </div>
        </template>
      </nav>

      <div class="rail__foot">
        <div v-if="!collapsed && statusText" class="rail__status mono">
          <span class="rail__dot--live" aria-hidden="true"></span>
          <span>{{ statusText }}</span>
        </div>
        <button
          type="button"
          class="rail__lang-btn mono"
          :aria-label="locale === 'ar' ? 'English' : 'العربية'"
          :title="locale === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'"
          @click="toggleLang"
        >
          <span class="material-symbols-outlined text-[16px]">language</span>
        </button>
      </div>
    </aside>

    <!-- Mobile Top Navigation Header with Menu Drawer Trigger & Quick Pills -->
    <div class="admin-mobile-header" :aria-label="t('nav.navigation')">
      <div class="admin-mobile-bar">
        <button
          type="button"
          class="mobile-menu-trigger mono"
          :aria-expanded="mobileMenuOpen"
          :aria-label="t('nav.navigation')"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <span class="material-symbols-outlined text-[20px]">
            {{ mobileMenuOpen ? 'close' : 'menu' }}
          </span>
          <span class="menu-text">{{ locale === 'ar' ? 'القائمة' : 'Menu' }}</span>
        </button>

        <div class="mobile-brand-pill mono">
          <span class="rail__dot" aria-hidden="true"></span>
          <span class="font-bold">{{ brandText }}</span>
        </div>

        <button
          type="button"
          class="rail__lang-btn mono"
          :aria-label="locale === 'ar' ? 'English' : 'العربية'"
          :title="locale === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'"
          @click="toggleLang"
        >
          <span class="material-symbols-outlined text-[15px]">language</span>
          <span class="text-xs uppercase font-bold">{{ locale === 'ar' ? 'EN' : 'عربي' }}</span>
        </button>
      </div>

      <!-- Quick horizontal pill strip for instant 1-tap navigation -->
      <div class="admin-mobile-pills" :aria-label="t('nav.navigation')">
        <router-link
          v-for="link in flatMobileLinks"
          :key="link.to + link.label"
          :to="link.to"
          class="admin-mobile-pill"
          :exact-active-class="link.exact ? 'is-active' : undefined"
          :active-class="'is-active'"
        >
          <span class="material-symbols-outlined text-[15px] nav-icon-inline">{{ link.icon }}</span>
          <span>{{ link.label }}</span>
        </router-link>
      </div>
    </div>

    <!-- Mobile Drawer Overlay -->
    <Teleport to="body">
      <Transition name="drawer-fade">
        <div
          v-if="mobileMenuOpen"
          class="mobile-drawer-backdrop"
          @click="closeMobileMenu"
        ></div>
      </Transition>

      <Transition name="drawer-slide">
        <aside
          v-if="mobileMenuOpen"
          class="mobile-drawer-sheet"
          :aria-label="t('nav.navigation')"
        >
          <div class="drawer-head">
            <div class="drawer-brand">
              <span class="rail__dot" aria-hidden="true"></span>
              <strong class="drawer-title mono">{{ brandText }}</strong>
            </div>
            <button
              type="button"
              class="drawer-close-btn"
              :aria-label="t('common.close')"
              @click="closeMobileMenu"
            >
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <nav class="drawer-nav">
            <template v-for="sec in visibleSections" :key="'drawer-' + sec.key">
              <div v-if="sec.label" class="drawer-section-label mono">
                {{ sec.label }}
              </div>
              <div class="drawer-section-links">
                <router-link
                  v-for="link in sec.links.filter((l) => l.visible !== false)"
                  :key="'drawer-link-' + link.to + link.label"
                  :to="link.to"
                  class="drawer-link"
                  :exact-active-class="link.exact ? 'drawer-link--active' : undefined"
                  :active-class="'drawer-link--active'"
                  @click="closeMobileMenu"
                >
                  <span class="material-symbols-outlined drawer-nav-icon">{{ link.icon }}</span>
                  <span class="drawer-link__label">{{ link.label }}</span>
                </router-link>
              </div>
            </template>
          </nav>

          <div class="drawer-foot">
            <div v-if="statusText" class="rail__status mono">
              <span class="rail__dot--live" aria-hidden="true"></span>
              <span>{{ statusText }}</span>
            </div>
            <button
              type="button"
              class="rail__lang-btn mono"
              @click="toggleLang"
            >
              <span class="material-symbols-outlined text-[16px]">language</span>
              <span>{{ locale === 'ar' ? 'English' : 'العربية' }}</span>
            </button>
          </div>
        </aside>
      </Transition>
    </Teleport>

    <div class="admin-main">
      <div class="admin-main__inner"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--secondary) 8%, transparent), transparent 34rem),
    var(--wl-paper);
  display: flex;
  gap: clamp(1rem, 2vw, 1.75rem);
  padding: var(--wl-page-padding-top) var(--wl-gutter) var(--wl-page-padding-bottom);
  padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left));
  padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right));
  max-width: 1560px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.admin-rail {
  width: var(--sidebar-width);
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  flex-shrink: 0;
  position: sticky;
  top: calc(var(--wl-header-height, 56px) + var(--wl-page-padding-top, 1.5rem));
  height: calc(100vh - var(--wl-header-height, 56px) - var(--wl-page-padding-top, 1.5rem) - var(--wl-page-padding-bottom, 3.5rem));
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  box-shadow: 0 18px 46px rgba(8, 47, 73, 0.10);
  backdrop-filter: blur(14px);
  transition: width 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.admin-rail--collapsed {
  width: var(--sidebar-width-collapsed);
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
  background: var(--secondary, #00A389);
  box-shadow: 0 0 0 3px rgba(0, 163, 137, 0.22);
}

.rail__brand-text {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--wl-ink-strong);
}

.rail__toggle {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-xs, 3px);
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
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  font-weight: 600;
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

/* MarketPro nav items — solid brand active pill */
.admin-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm, 8px);
  font-size: var(--text-md);
  font-weight: var(--weight-medium);
  color: var(--fg-muted);
  text-decoration: none;
  border: 1px solid transparent;
  transition: background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
}

.nav-icon {
  font-size: 18px;
  color: var(--fg-muted);
  transition: color var(--duration-fast) var(--ease-out);
}
.nav-icon svg { width: 20px; height: 20px; }

.admin-link:hover {
  background: var(--bg-hover);
  color: var(--brand);
  text-decoration: none;
}

.admin-link:hover .nav-icon {
  color: var(--brand);
}

.admin-link--active {
  background: var(--brand, #6366F1) !important;
  color: #FFFFFF !important;
  border-radius: var(--radius-sm, 8px) !important;
  font-weight: var(--weight-semibold, 600);
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
}

.admin-link--active .nav-icon {
  color: #FFFFFF !important;
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
  color: var(--wl-primary);
  border-color: var(--wl-primary);
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
  box-shadow: 0 0 0 3px var(--wl-success-soft);
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
  max-width: 100%;
  box-sizing: border-box;
}

.admin-main__inner {
  max-width: var(--wl-max-width-admin, 1560px);
  margin: 0 auto;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.admin-main__inner :deep(.grid),
.admin-main__inner :deep(.dashboard-grid) {
  min-width: 0;
}

.admin-main__inner :deep(.table-wrap),
.admin-main__inner :deep(.table-responsive) {
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.admin-mobile-header {
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
  .admin-mobile-header {
    display: flex;
    flex-direction: column;
    position: sticky;
    top: var(--wl-header-height, 56px);
    z-index: 40;
    background: var(--wl-surface, #ffffff);
    border-bottom: 1px solid var(--border, #E5E7EB);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  }
  .admin-mobile-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem var(--gutter, 1rem);
    padding-inline-start: max(var(--gutter, 1rem), env(safe-area-inset-left));
    padding-inline-end: max(var(--gutter, 1rem), env(safe-area-inset-right));
    border-bottom: 1px solid var(--border, #F3F4F6);
  }
  .mobile-menu-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.75rem;
    border-radius: var(--radius-sm, 8px);
    background: var(--brand-soft, #EEF2FF);
    color: var(--brand, #6366F1);
    border: 1px solid color-mix(in srgb, var(--brand, #6366F1) 20%, transparent);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    min-height: 38px;
    transition: all 0.15s ease;
  }
  .mobile-menu-trigger:hover {
    background: var(--brand, #6366F1);
    color: #ffffff;
  }
  .mobile-brand-pill {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 13px;
    color: var(--fg-heading, #111827);
  }
  .admin-mobile-pills {
    display: flex;
    gap: 0.4rem;
    padding: 0.45rem var(--gutter, 1rem);
    padding-inline-start: max(var(--gutter, 1rem), env(safe-area-inset-left));
    padding-inline-end: max(var(--gutter, 1rem), env(safe-area-inset-right));
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
  }
  .admin-mobile-pills::-webkit-scrollbar {
    display: none;
  }
  .admin-mobile-pill {
    padding: 0.35rem 0.75rem;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 600;
    background: var(--wl-surface);
    color: var(--wl-ink-soft);
    border: 1px solid var(--wl-border);
    white-space: nowrap;
    text-decoration: none;
    transition: all 0.12s ease;
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }
  .nav-icon-inline {
    font-size: 15px;
  }
  .admin-mobile-pill:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .admin-mobile-pill.is-active {
    background: var(--brand, #6366F1);
    color: #FFFFFF;
    border-color: var(--brand, #6366F1);
    font-weight: 600;
    box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
  }
  .admin-main {
    padding: 0;
  }
  .admin-main__inner {
    padding: var(--space-4) var(--gutter, 1rem) var(--space-8);
    padding-inline-start: max(var(--gutter, 1rem), env(safe-area-inset-left));
    padding-inline-end: max(var(--gutter, 1rem), env(safe-area-inset-right));
  }
}

/* Mobile Drawer Overlay Styles */
.mobile-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.5);
  backdrop-filter: blur(4px);
  z-index: 1000;
}

.mobile-drawer-sheet {
  position: fixed;
  top: 0;
  bottom: 0;
  inset-inline-start: 0;
  width: min(85vw, 320px);
  background: var(--bg-surface, #ffffff);
  border-inline-end: 1px solid var(--border, #E5E7EB);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.22);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border, #E5E7EB);
  background: var(--bg-subtle, #F9FAFB);
}

.drawer-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drawer-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--fg-heading, #111827);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.drawer-close-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-xs, 6px);
  border: 1px solid var(--border, #E5E7EB);
  background: var(--bg-surface, #ffffff);
  color: var(--fg-muted, #6B7280);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.drawer-close-btn:hover {
  color: var(--brand, #6366F1);
  border-color: var(--brand, #6366F1);
}

.drawer-nav {
  flex: 1;
  padding: 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.drawer-section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-muted, #9CA3AF);
  padding: 0.75rem 0.65rem 0.35rem;
}

.drawer-section-links {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.drawer-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-sm, 8px);
  font-size: 14px;
  font-weight: 500;
  color: var(--fg-body, #4B5563);
  text-decoration: none;
  transition: all 0.15s ease;
}

.drawer-link:hover {
  background: var(--bg-hover, #EEF2FF);
  color: var(--brand, #6366F1);
}

.drawer-link--active {
  background: var(--brand, #6366F1) !important;
  color: #FFFFFF !important;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
}

.drawer-link--active .drawer-nav-icon {
  color: #FFFFFF !important;
}

.drawer-nav-icon {
  font-size: 20px;
  color: var(--fg-muted, #6B7280);
}

.drawer-foot {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border, #E5E7EB);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--bg-subtle, #F9FAFB);
}

.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
[dir='ltr'] .drawer-slide-enter-from,
[dir='ltr'] .drawer-slide-leave-to {
  transform: translateX(-100%);
}
[dir='rtl'] .drawer-slide-enter-from,
[dir='rtl'] .drawer-slide-leave-to {
  transform: translateX(100%);
}
</style>
