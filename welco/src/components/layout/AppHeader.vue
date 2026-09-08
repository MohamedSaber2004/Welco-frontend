<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '../../di/container'
import { t, locale, setLocale } from '../../i18n'
import { theme, toggleTheme } from '../../application/theme.service'
import { resolveFileUrl, PLACEHOLDER } from '../../utils/file-url'
import { AppLanguage } from '../../domain/models/user'
import { useCart } from '../../composables/useCart'
import { wishlistService } from '../../di/container'

const router = useRouter()
const mobileOpen = ref(false)
const userMenuOpen = ref(false)
const searchQuery = ref('')

const toggleLang = async () => {
  const next = locale.value === 'ar' ? 'en' : 'ar'
  setLocale(next)
  userMenuOpen.value = false
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

const isAuthed  = computed(() => authService.isAuthenticated)
const isAdmin   = computed(() => authService.isAdmin.value)
const isStaff   = computed(() => authService.isWelcoStaff.value)
const isBuyer   = computed(() => authService.isOrganizationUser.value)
const isSeller  = computed(() => isAdmin.value || isStaff.value)
const user      = computed(() => authService.user.value)
const avatarSrc = computed(() => {
  const name = user.value?.profilePictureName
  if (!name) return ''
  const url = resolveFileUrl(name, '')
  return url === PLACEHOLDER || url === '/images/placeholder.svg' ? '' : url
})
const avatarInitials = computed(() => {
  const n = user.value?.fullName?.trim() ?? user.value?.email ?? '?'
  return n.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?'
})
const avatarFailed = ref(false)
const hasAvatar = computed(() => !!avatarSrc.value && !avatarFailed.value)
const userRoleLabel = computed(() =>
  // 4-role model: Provider/Distributor (has company) vs Customer (buyer) vs Admin/Staff.
  user.value ? t(`admin.${authService.resolveBusinessRoleKey()}`) : '',
)
const { count: cartCount } = useCart()
const wishlistCount = computed(() => wishlistService.count.value)

const handleLogout = async () => { userMenuOpen.value = false; mobileOpen.value = false; await authService.logout() }
const closeMobile  = () => { mobileOpen.value = false }
const navigate     = (name: string) => { void router.push({ name }); mobileOpen.value = false }
const onSearch = () => {
  if (!searchQuery.value.trim()) return
  void router.push({ name: 'marketplace', query: { search: searchQuery.value.trim() } })
  searchQuery.value = ''
}

const onClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.header__user-wrap')) userMenuOpen.value = false
}
watch(avatarSrc, () => { avatarFailed.value = false })
watch(isAuthed, (v) => { if (v) void authService.loadProfile().catch(() => {}) })

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  if (isAuthed.value) void authService.loadProfile().catch(() => {})
  void wishlistService.load().catch(() => {})
})
onUnmounted(() => document.removeEventListener('click', onClickOutside))
watch(isAuthed, (v) => {
  if (v) void wishlistService.refresh().catch(() => {})
  else wishlistService.clear()
})
</script>

<template>
  <header class="header">
    <div class="header__sweep" aria-hidden="true"></div>
    <div class="header__inner">
      <router-link :to="isSeller && isAuthed ? '/admin' : '/'" class="logo" @click="closeMobile" :aria-label="t('nav.home')">
        <img src="/logo.jpeg" alt="Welco" class="logo__img" width="120" height="28" loading="eager" />
        <span class="logo__word">Welco</span>
      </router-link>

      <nav v-if="!(isSeller && isAuthed)" class="menu" :aria-label="t('nav.navigation')">
        <template v-if="isBuyer && isAuthed">
          <router-link to="/" class="menu__link">{{ t('nav.home') }}</router-link>
          <router-link to="/marketplace" class="menu__link">{{ t('nav.marketplace') }}</router-link>
          <router-link to="/account" class="menu__link">{{ t('nav.account') }}</router-link>
          <router-link to="/wishlist" class="menu__link">{{ t('nav.wishlist') }}</router-link>
          <router-link to="/help/my-tickets" class="menu__link">{{ t('help.myTickets') }}</router-link>
          <router-link to="/help" class="menu__link">{{ t('nav.help') }}</router-link>
        </template>
        <template v-else>
          <router-link to="/" class="menu__link">{{ t('nav.home') }}</router-link>
          <router-link to="/marketplace" class="menu__link">{{ t('nav.marketplace') }}</router-link>
          <router-link to="/certifications" class="menu__link">{{ t('nav.certifications') }}</router-link>
          <router-link to="/help" class="menu__link">{{ t('nav.help') }}</router-link>
        </template>
      </nav>
      <div v-else class="menu" style="flex:1"></div>

      <form v-if="!(isSeller && isAuthed)" class="header__search" @submit.prevent="onSearch" role="search">
        <span class="material-symbols-outlined header__search-icon" aria-hidden="true">search</span>
        <input v-model="searchQuery" :placeholder="t('marketplace.searchPlaceholder')" :aria-label="t('marketplace.searchPlaceholder')" />
        <span class="header__search-kbd mono">⌘K</span>
      </form>

      <div class="header__actions">
        <router-link v-if="isAuthed && !isSeller" to="/wishlist" class="icon-btn" :aria-label="t('nav.wishlist')" :title="t('nav.wishlist')">
          <span class="material-symbols-outlined" style="font-size:18px">favorite</span>
          <span v-if="wishlistCount > 0" class="icon-btn__badge">{{ wishlistCount > 9 ? '9+' : wishlistCount }}</span>
        </router-link>
        <router-link v-if="!isSeller" to="/cart" class="icon-btn" :aria-label="t('nav.cart')" :title="t('nav.cart')">
          <span class="material-symbols-outlined" style="font-size:18px">shopping_bag</span>
          <span v-if="cartCount > 0" class="icon-btn__badge">{{ cartCount > 9 ? '9+' : cartCount }}</span>
        </router-link>

        <button v-if="isAuthed" class="icon-btn" :aria-label="t('nav.toggleTheme')" @click="toggleTheme">
          <span class="material-symbols-outlined" style="font-size:16px">{{ theme === 'light' ? 'dark_mode' : 'light_mode' }}</span>
        </button>

        <template v-if="isAuthed">
          <div class="header__user-wrap">
            <button class="header__user" type="button" @click.stop="userMenuOpen = !userMenuOpen" :aria-expanded="userMenuOpen">
              <span class="header__avatar" :style="{ background: user?.tint || '#4F46E5' }">
                <img v-if="hasAvatar" :src="avatarSrc" :alt="user?.fullName ?? ''" class="header__avatar-img" @error="avatarFailed = true" />
                <span v-else class="header__avatar-fallback">{{ avatarInitials }}</span>
              </span>
              <span class="header__user-text">
                <span class="header__user-name">{{ user?.fullName }}</span>
                <span class="header__user-role mono">{{ isSeller ? (isAdmin ? t('admin.roleAdmin') : t('admin.welcoStaff')) : userRoleLabel }}</span>
              </span>
            </button>
            <Transition name="drop">
              <div v-if="userMenuOpen" class="header__dropdown" role="menu">
                <div class="header__dropdown-head">
                  <strong>{{ user?.fullName }}</strong>
                  <span>{{ user?.email }}</span>
                </div>
                <router-link to="/profile" class="header__dropdown-item" role="menuitem" @click="userMenuOpen=false">
                  <span class="material-symbols-outlined text-[18px]">person</span>
                  <span>{{ t('nav.profile') }}</span>
                </router-link>
                <router-link v-if="isBuyer" to="/account/orders" class="header__dropdown-item" role="menuitem" @click="userMenuOpen=false">
                  <span class="material-symbols-outlined text-[18px]">local_shipping</span>
                  <span>{{ t('account.myOrders') }}</span>
                </router-link>
                <router-link v-if="isBuyer" to="/help/my-tickets" class="header__dropdown-item" role="menuitem" @click="userMenuOpen=false">
                  <span class="material-symbols-outlined text-[18px]">confirmation_number</span>
                  <span>{{ t('help.myTickets') }}</span>
                </router-link>
                <button
                  type="button"
                  class="header__dropdown-item"
                  role="menuitem"
                  @click="toggleLang"
                >
                  <span class="material-symbols-outlined text-[18px]">language</span>
                  <span>{{ locale === 'ar' ? 'English (الإنجليزية)' : 'العربية (Arabic)' }}</span>
                </button>
                <button class="header__dropdown-item header__dropdown-item--danger" role="menuitem" @click="handleLogout">
                  <span class="material-symbols-outlined text-[18px]">logout</span>
                  <span>{{ t('nav.logout') }}</span>
                </button>
              </div>
            </Transition>
          </div>
        </template>
        <template v-else>
          <div class="header__auth-desktop">
            <button class="btn btn-ghost btn-sm" type="button" @click="navigate('login')">{{ t('nav.login') }}</button>
            <button class="btn btn-primary btn-sm" type="button" @click="navigate('register')">{{ t('nav.register') }}</button>
          </div>
          <button class="icon-btn header__auth-mobile" :aria-label="t('nav.login')" type="button" @click="navigate('login')">
            <span class="material-symbols-outlined" style="font-size:18px">person</span>
          </button>
        </template>

        <button v-if="!(isSeller && isAuthed)" class="header__burger" :aria-label="t('nav.toggleMenu')" :aria-expanded="mobileOpen" type="button" @click="mobileOpen = !mobileOpen">
          <span :class="{ open: mobileOpen }"></span><span :class="{ open: mobileOpen }"></span><span :class="{ open: mobileOpen }"></span>
        </button>
      </div>
    </div>

    <Transition name="drawer">
      <nav v-if="mobileOpen" class="header__drawer" aria-label="Mobile">
        <template v-if="isBuyer && isAuthed">
          <router-link to="/" class="header__drawer-link" @click="closeMobile">{{ t('nav.home') }}</router-link>
          <router-link to="/marketplace" class="header__drawer-link" @click="closeMobile">{{ t('nav.marketplace') }}</router-link>
          <router-link to="/account" class="header__drawer-link" @click="closeMobile">{{ t('nav.account') }}</router-link>
          <router-link to="/account/orders" class="header__drawer-link" @click="closeMobile">{{ t('account.myOrders') }}</router-link>
          <router-link to="/wishlist" class="header__drawer-link" @click="closeMobile">{{ t('nav.wishlist') }}</router-link>
          <router-link to="/cart" class="header__drawer-link" @click="closeMobile">{{ t('nav.cart') }}</router-link>
          <router-link to="/help/my-tickets" class="header__drawer-link" @click="closeMobile">{{ t('help.myTickets') }}</router-link>
          <router-link to="/help" class="header__drawer-link" @click="closeMobile">{{ t('nav.help') }}</router-link>
        </template>
        <template v-else>
          <router-link to="/" class="header__drawer-link" @click="closeMobile">{{ t('nav.home') }}</router-link>
          <router-link to="/marketplace" class="header__drawer-link" @click="closeMobile">{{ t('nav.marketplace') }}</router-link>
          <router-link to="/certifications" class="header__drawer-link" @click="closeMobile">{{ t('nav.certifications') }}</router-link>
          <router-link to="/help" class="header__drawer-link" @click="closeMobile">{{ t('nav.help') }}</router-link>
          <router-link v-if="!isAuthed" to="/auth/login" class="header__drawer-link" @click="closeMobile">{{ t('nav.login') }}</router-link>
          <router-link v-if="!isAuthed" to="/auth/register" class="header__drawer-link" @click="closeMobile">{{ t('nav.register') }}</router-link>
        </template>
      </nav>
    </Transition>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--wl-header-bg);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border-bottom: 1px solid var(--wl-header-border);
  padding-inline-start: env(safe-area-inset-left, 0px);
  padding-inline-end: env(safe-area-inset-right, 0px);
}
.header__sweep {
  position: absolute;
  bottom: 0;
  inset-inline: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
  opacity: 0.35;
  transition: opacity 0.3s ease;
}
:root.dark .header__sweep, :root[data-theme='dark'] .header__sweep { opacity: 0.22; }
.header__inner {
  max-width: var(--wl-max-width);
  margin: 0 auto;
  padding: 0 var(--wl-gutter);
  padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left));
  padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right));
  height: var(--wl-header-height, 56px);
  min-height: var(--wl-header-height, 56px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
  width: 100%;
  direction: ltr !important; /* CRITICAL: Enforces Logo on LEFT, Profile & Actions on RIGHT across all viewports and locales */
}
.logo {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  flex-shrink: 0;
}
.logo__img { height: 26px; width: auto; border-radius: 6px; max-width: none; }
.logo__word {
  font-family: var(--wl-font-display);
  font-weight: 800;
  font-size: 16px;
  color: var(--wl-ink-strong);
  letter-spacing: -0.025em;
  white-space: nowrap;
}
.menu { display: flex; gap: 0.2rem; flex: 1; align-items: center; min-width: 0; overflow: hidden; }
.menu__link {
  padding: 0.4rem 0.7rem;
  font-size: 13px;
  font-weight: 500;
  color: var(--wl-ink-soft);
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.12s ease;
  white-space: nowrap;
}
.menu__link:hover { color: var(--wl-ink-strong); background: var(--wl-surface-soft); }
.menu__link.router-link-active { color: var(--wl-ink-strong); background: var(--wl-surface-soft); font-weight: 600; }
.header__search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 8px;
  padding: 0 0.6rem 0 0.7rem;
  height: 38px;
  max-height: 38px;
  min-width: 220px;
  max-width: 320px;
  flex-shrink: 1;
  transition: border-color 0.12s, box-shadow 0.12s;
  overflow: hidden;
}
.header__search:focus-within { border-color: var(--wl-primary); box-shadow: var(--wl-focus-ring); background: var(--wl-surface); }
.header__search-icon { font-size: 18px; color: var(--wl-muted); flex-shrink: 0; }
.header__search input { flex: 1; min-width: 0; min-height: 0; height: 100%; border: none; background: transparent; outline: none; font-size: 13px; color: var(--wl-ink); }
.header__search input::placeholder { color: var(--wl-muted); }
[dir="rtl"] .header__search input { direction: rtl; text-align: right; }
.header__search-kbd {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-bottom-width: 2px;
  padding: 0.1rem 0.35rem;
  border-radius: 6px;
  font-size: 10px;
  color: var(--wl-muted);
  flex-shrink: 0;
}
.header__actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
  margin-inline-start: auto;
  direction: ltr;
}
.header__auth-desktop {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}
/* NOTE: higher specificity than .icon-btn (which sets display:grid later in
 * this file) so the mobile-only person button stays hidden on desktop. */
.icon-btn.header__auth-mobile {
  display: none;
}
.icon-btn {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  color: var(--wl-ink-soft);
  display: grid;
  place-items: center;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  transition: all 0.12s ease;
  flex-shrink: 0;
}
.icon-btn:hover { border-color: var(--wl-primary); color: var(--wl-primary); background: var(--wl-primary-soft); }
.icon-btn:focus-visible { outline: none; box-shadow: var(--wl-focus-ring); border-color: var(--wl-primary); }
.icon-btn:active { transform: scale(0.94); }
.icon-btn__badge {
  position: absolute;
  top: -6px;
  inset-inline-end: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--wl-danger);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: grid;
  place-items: center;
  border-radius: var(--radius-full);
  border: 2px solid var(--wl-surface);
}
.btn {
  font-family: var(--wl-font-body);
  font-weight: 600;
  font-size: 13px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.12s ease;
  white-space: nowrap;
  flex-shrink: 0;
}
.btn-primary { background: var(--wl-primary); color: #fff; border-color: var(--wl-primary); }
.btn-primary:hover { background: var(--wl-primary-hover); }
.btn-ghost { background: var(--wl-surface); color: var(--wl-ink-strong); border-color: var(--wl-border); }
.btn-ghost:hover { background: var(--wl-surface-soft); }
.btn-sm { padding: 6px 12px; font-size: 12.5px; }
.header__user-wrap { position: relative; flex-shrink: 0; }
.header__user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.6rem 0.25rem 0.25rem;
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  border-radius: var(--radius-full);
  cursor: pointer;
  max-width: 180px;
}
.header__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: white;
  font-weight: 700;
  font-size: 0.75rem;
  overflow: hidden;
  flex-shrink: 0;
}
.header__avatar-img { width: 100%; height: 100%; object-fit: cover; }
.header__avatar-fallback { width: 100%; height: 100%; display: grid; place-items: center; font-size: 0.7rem; font-weight: 700; }
.header__user-text { display: flex; flex-direction: column; align-items: flex-start; line-height: 1; min-width: 0; }
.header__user-name { font-size: 0.8rem; font-weight: 600; color: var(--wl-ink-strong); max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.header__user-role { font-size: 10px; color: var(--wl-muted); }
.header__dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  left: auto;
  min-width: 220px;
  max-width: calc(100vw - 1.5rem);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 120;
}
[dir="rtl"] .header__dropdown {
  direction: rtl;
  text-align: right;
}
[dir="ltr"] .header__dropdown {
  direction: ltr;
  text-align: left;
}
.header__dropdown-head { padding: 0.9rem 1rem; border-bottom: 1px solid var(--wl-border); display: flex; flex-direction: column; gap: 0.15rem; background: var(--wl-surface-soft); }
.header__dropdown-head strong { font-size: 0.85rem; color: var(--wl-ink-strong); }
.header__dropdown-head span { font-size: 0.75rem; color: var(--wl-muted); word-break: break-all; }
.header__dropdown-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.65rem 1rem;
  background: none;
  border: none;
  color: var(--wl-ink);
  font-size: 0.85rem;
  cursor: pointer;
  text-decoration: none;
  min-height: 44px;
}
[dir="rtl"] .header__dropdown-item { text-align: right; justify-content: flex-start; }
[dir="ltr"] .header__dropdown-item { text-align: left; justify-content: flex-start; }
.header__dropdown-item:hover { background: var(--wl-surface-soft); }
.header__dropdown-item--danger { color: var(--wl-danger); border-top: 1px solid var(--wl-border); }
.header__burger {
  display: none;
  flex-direction: column;
  gap: 3px;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  min-width: 36px;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.header__burger span { width: 16px; height: 2px; background: var(--wl-ink-strong); border-radius: 999px; transition: all 0.15s ease; display: block; }
.header__burger span.open:nth-child(1) { transform: translateY(5px) rotate(45deg); }
.header__burger span.open:nth-child(2) { opacity: 0; }
.header__burger span.open:nth-child(3) { transform: translateY(-5px) rotate(-45deg); }
.header__drawer { display: none; }
@media (max-width: 1360px) {
  .header__inner { padding: 0 1.1rem; }
  .header__search { min-width: var(--wl-header-search-min, 170px); max-width: var(--wl-header-search-max, 230px); }
  .header__search-kbd { display: none; }
  .menu__link { padding: 0.4rem 0.55rem; font-size: 12.5px; }
}
@media (max-width: 1180px) {
  .header__search { min-width: 160px; max-width: 210px; }
  .menu__link { padding: 0.4rem 0.5rem; font-size: 12.5px; }
  .header__actions { gap: 0.35rem; }
}
@media (max-width: 1024px) {
  .header__search { display: none; }
  .menu { display: none; }
  .header__burger { display: flex; }
  .header__drawer {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.9rem 1rem 1.1rem;
    background: var(--wl-surface);
    border-top: 1px solid var(--wl-border);
    box-shadow: var(--shadow-lg);
    max-height: calc(100dvh - var(--wl-header-height, 56px));
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  [dir="rtl"] .header__drawer { direction: rtl; text-align: right; }
  [dir="ltr"] .header__drawer { direction: ltr; text-align: left; }
  .header__drawer-link {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.75rem 0.85rem;
    color: var(--wl-ink);
    text-decoration: none;
    border-radius: 8px;
    font-weight: 500;
    font-size: 14px;
    min-height: 44px;
  }
  .header__drawer-link:hover, .header__drawer-link.router-link-active { background: var(--wl-surface-soft); color: var(--wl-ink-strong); }
}
@media (max-width: 768px) {
  .header__auth-desktop { display: none; }
  .icon-btn.header__auth-mobile { display: inline-grid; }
}
@media (max-width: 640px) {
  .header__inner { gap: 0.5rem; }
  .header__user-text { display: none; }
  .header__user { padding: 0.2rem; border-radius: 50%; }
  .header__dropdown { min-width: 200px; max-width: calc(100vw - 1rem); right: 0; left: auto; }
  .header__actions { gap: 0.35rem; }
}
@media (max-width: 480px) {
  .header__inner { gap: 0.35rem; }
  .logo__word { display: none; }
  .logo__img { height: 24px; }
  .header__actions { gap: 0.25rem; }
  /* Keep ≥40px touch targets (WCAG 2.5.8 + 44px ergonomic baseline). */
  .icon-btn, .header__burger {
    width: 40px;
    height: 40px;
    min-width: 40px;
    min-height: 40px;
  }
}
@media (max-width: 360px) {
  .header__inner { gap: 0.25rem; }
  .header__actions { gap: 0.2rem; }
  .icon-btn, .header__burger {
    width: 40px;
    height: 40px;
    min-width: 40px;
    min-height: 40px;
  }
}
.drop-enter-active, .drop-leave-active { transition: all 0.15s ease; }
.drop-enter-from, .drop-leave-to { opacity: 0; transform: translateY(-4px) scale(0.98); }
.drawer-enter-active, .drawer-leave-active { transition: all 0.2s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
