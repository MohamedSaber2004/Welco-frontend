<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authService, wishlistService } from '../../di/container'
import { useCart } from '../../composables/useCart'
import { t, locale, setLocale } from '../../i18n'
import { AppLanguage } from '../../domain/models/user'
import { resolveFileUrl } from '../../utils/file-url'

const route = useRoute()
const router = useRouter()

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

const isAuthed = computed(() => authService.isAuthenticated)
const isAdmin = computed(() => authService.isAdmin.value)
const isStaff = computed(() => authService.isWelcoStaff.value && !isAdmin.value)
const isSeller = computed(() => authService.isAdmin.value || authService.isWelcoStaff.value)
const isBuyer = computed(() => authService.isOrganizationUser.value)
const user = computed(() => authService.user.value)

const { count: cartCount } = useCart()
const wishlistCount = computed(() => wishlistService.count.value)

// Hide on auth routes (login, register, forgot-password)
const isAuthPage = computed(() => route.path.startsWith('/auth'))

const moreOpen = ref(false)

// Close sheet on route navigation
watch(
  () => route.fullPath,
  () => {
    moreOpen.value = false
  },
)

const toggleMore = () => {
  moreOpen.value = !moreOpen.value
}

const closeMore = () => {
  moreOpen.value = false
}

const navigateTo = (path: string) => {
  closeMore()
  void router.push(path)
}

const handleLogout = async () => {
  closeMore()
  await authService.logout()
}

const userRoleLabel = computed(() => {
  if (!user.value) return ''
  if (isAdmin.value) return t('admin.roleAdmin')
  if (isStaff.value) return t('admin.welcoStaff')
  return t(`admin.${authService.resolveBusinessRoleKey()}`)
})

const avatarSrc = computed(() => {
  const name = user.value?.profilePictureName
  if (!name) return ''
  return resolveFileUrl(name, '')
})

const avatarInitials = computed(() => {
  const n = user.value?.fullName?.trim() ?? user.value?.email ?? '?'
  return n.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?'
})

// Check if a route is active
const isPathActive = (path: string, exact = false) => {
  if (exact) return route.path === path
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<template>
  <div v-if="!isAuthPage" class="mobile-nav-root">
    <!-- Persistent Bottom Bar -->
    <nav class="mobile-bar" :aria-label="t('nav.navigation')">
      <!-- Admin Mode Tabs -->
      <template v-if="isAdmin">
        <router-link to="/admin" class="bar-tab" :class="{ 'is-active': isPathActive('/admin', true) }">
          <span class="material-symbols-outlined tab-icon">dashboard</span>
          <span class="tab-label">{{ t('admin.dashboard') }}</span>
        </router-link>

        <router-link to="/admin/sales" class="bar-tab" :class="{ 'is-active': isPathActive('/admin/sales') }">
          <span class="material-symbols-outlined tab-icon">request_quote</span>
          <span class="tab-label">{{ t('admin.sales') }}</span>
        </router-link>

        <router-link to="/admin/orders" class="bar-tab" :class="{ 'is-active': isPathActive('/admin/orders') }">
          <span class="material-symbols-outlined tab-icon">local_shipping</span>
          <span class="tab-label">{{ t('admin.orders') }}</span>
        </router-link>

        <router-link to="/admin/catalog" class="bar-tab" :class="{ 'is-active': isPathActive('/admin/catalog') }">
          <span class="material-symbols-outlined tab-icon">inventory_2</span>
          <span class="tab-label">{{ t('nav.catalog') }}</span>
        </router-link>
      </template>

      <!-- Staff Mode Tabs -->
      <template v-else-if="isStaff">
        <router-link to="/admin" class="bar-tab" :class="{ 'is-active': isPathActive('/admin', true) }">
          <span class="material-symbols-outlined tab-icon">dashboard</span>
          <span class="tab-label">{{ t('admin.dashboard') }}</span>
        </router-link>

        <router-link to="/admin/sales" class="bar-tab" :class="{ 'is-active': isPathActive('/admin/sales') }">
          <span class="material-symbols-outlined tab-icon">request_quote</span>
          <span class="tab-label">{{ t('admin.sales') }}</span>
        </router-link>

        <router-link to="/admin/orders" class="bar-tab" :class="{ 'is-active': isPathActive('/admin/orders') }">
          <span class="material-symbols-outlined tab-icon">local_shipping</span>
          <span class="tab-label">{{ t('admin.orders') }}</span>
        </router-link>

        <router-link to="/admin/tickets" class="bar-tab" :class="{ 'is-active': isPathActive('/admin/tickets') }">
          <span class="material-symbols-outlined tab-icon">support_agent</span>
          <span class="tab-label">Tickets</span>
        </router-link>
      </template>

      <!-- Buyer Mode Tabs -->
      <template v-else-if="isBuyer && isAuthed">
        <router-link to="/" class="bar-tab" :class="{ 'is-active': isPathActive('/', true) }">
          <span class="material-symbols-outlined tab-icon">home</span>
          <span class="tab-label">{{ t('nav.home') }}</span>
        </router-link>

        <router-link to="/marketplace" class="bar-tab" :class="{ 'is-active': isPathActive('/marketplace') }">
          <span class="material-symbols-outlined tab-icon">storefront</span>
          <span class="tab-label">{{ t('nav.marketplace') }}</span>
        </router-link>

        <router-link to="/account" class="bar-tab" :class="{ 'is-active': isPathActive('/account') }">
          <span class="material-symbols-outlined tab-icon">dashboard</span>
          <span class="tab-label">{{ t('nav.account') }}</span>
        </router-link>

        <router-link to="/cart" class="bar-tab" :class="{ 'is-active': isPathActive('/cart') }">
          <div class="tab-icon-wrap">
            <span class="material-symbols-outlined tab-icon">shopping_bag</span>
            <span v-if="cartCount > 0" class="tab-badge">{{ cartCount > 9 ? '9+' : cartCount }}</span>
          </div>
          <span class="tab-label">{{ t('nav.cart') }}</span>
        </router-link>
      </template>

      <!-- Guest Tabs -->
      <template v-else>
        <router-link to="/" class="bar-tab" :class="{ 'is-active': isPathActive('/', true) }">
          <span class="material-symbols-outlined tab-icon">home</span>
          <span class="tab-label">{{ t('nav.home') }}</span>
        </router-link>

        <router-link to="/marketplace" class="bar-tab" :class="{ 'is-active': isPathActive('/marketplace') }">
          <span class="material-symbols-outlined tab-icon">storefront</span>
          <span class="tab-label">{{ t('nav.marketplace') }}</span>
        </router-link>

        <router-link to="/certifications" class="bar-tab" :class="{ 'is-active': isPathActive('/certifications') }">
          <span class="material-symbols-outlined tab-icon">verified</span>
          <span class="tab-label">{{ t('nav.certifications') }}</span>
        </router-link>

        <router-link to="/help" class="bar-tab" :class="{ 'is-active': isPathActive('/help') }">
          <span class="material-symbols-outlined tab-icon">help</span>
          <span class="tab-label">{{ t('nav.help') }}</span>
        </router-link>
      </template>

      <!-- The 5th Action: "All Pages / Menu" Trigger -->
      <button
        type="button"
        class="bar-tab bar-tab--more"
        :class="{ 'is-active': moreOpen }"
        :aria-expanded="moreOpen"
        aria-label="All allowed pages"
        @click="toggleMore"
      >
        <div class="tab-icon-wrap">
          <span class="material-symbols-outlined tab-icon">{{ moreOpen ? 'close' : 'apps' }}</span>
        </div>
        <span class="tab-label">{{ moreOpen ? t('common.cancel') : t('nav.more') }}</span>
      </button>
    </nav>

    <!-- Accessible "All Allowed Pages" Bottom Sheet -->
    <Transition name="sheet-backdrop">
      <div v-if="moreOpen" class="sheet-backdrop" aria-hidden="true" @click="closeMore"></div>
    </Transition>

    <Transition name="sheet-slide">
      <section
        v-if="moreOpen"
        class="sheet-modal"
        role="dialog"
        aria-modal="true"
        aria-label="All Pages"
      >
        <!-- Drag pill indicator -->
        <div class="sheet-drag" aria-hidden="true" @click="closeMore"></div>

        <!-- Sheet Header: User Identity & Profile Quick-Access -->
        <header class="sheet-head">
          <div class="sheet-user">
            <div class="sheet-avatar" :style="{ background: user?.tint || '#4F46E5' }">
              <img v-if="avatarSrc" :src="avatarSrc" :alt="user?.fullName ?? 'User'" class="sheet-avatar-img" />
              <span v-else class="sheet-avatar-text">{{ avatarInitials }}</span>
            </div>
            <div class="sheet-user__meta">
              <strong class="sheet-user__name">{{ isAuthed ? user?.fullName : 'Guest Practitioner' }}</strong>
              <span class="sheet-user__role mono">{{ isAuthed ? userRoleLabel : 'Welcome to Welco' }}</span>
            </div>
          </div>
          <button type="button" class="sheet-close" aria-label="Close" @click="closeMore">
            <span class="material-symbols-outlined">close</span>
          </button>
        </header>

        <!-- Categorized Nav Grid of All Allowed Pages -->
        <div class="sheet-body">
          <!-- Section: Admin & Staff Management (if seller) -->
          <div v-if="isSeller" class="sheet-section">
            <div class="sheet-section-title mono">CONSOLE & OPERATIONS</div>
            <div class="sheet-grid">
              <button type="button" class="sheet-item" @click="navigateTo('/admin')">
                <span class="sheet-icon-box sheet-icon--primary">
                  <span class="material-symbols-outlined">dashboard</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('admin.dashboard') }}</strong>
                  <small>Overview & telemetry</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/admin/sales')">
                <span class="sheet-icon-box sheet-icon--amber">
                  <span class="material-symbols-outlined">request_quote</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('admin.sales') }}</strong>
                  <small>RFQ & Quote pipeline</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/admin/orders')">
                <span class="sheet-icon-box sheet-icon--indigo">
                  <span class="material-symbols-outlined">local_shipping</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('admin.orders') }}</strong>
                  <small>Order dispatch</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/admin/catalog')">
                <span class="sheet-icon-box sheet-icon--teal">
                  <span class="material-symbols-outlined">inventory_2</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.catalog') }}</strong>
                  <small>Products & categories</small>
                </span>
              </button>

              <button v-if="isAdmin" type="button" class="sheet-item" @click="navigateTo('/admin/companies')">
                <span class="sheet-icon-box sheet-icon--slate">
                  <span class="material-symbols-outlined">apartment</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('admin.companies') }}</strong>
                  <small>Distributors directory</small>
                </span>
              </button>

              <button v-if="isAdmin" type="button" class="sheet-item" @click="navigateTo('/admin/users')">
                <span class="sheet-icon-box sheet-icon--purple">
                  <span class="material-symbols-outlined">group</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('admin.users') }}</strong>
                  <small>Practitioners & access</small>
                </span>
              </button>

              <button v-if="isAdmin" type="button" class="sheet-item" @click="navigateTo('/admin/countries')">
                <span class="sheet-icon-box sheet-icon--emerald">
                  <span class="material-symbols-outlined">public</span>
                </span>
                <span class="sheet-item__text">
                  <strong>Territory</strong>
                  <small>Countries, cities, zones</small>
                </span>
              </button>

              <button v-if="isAdmin" type="button" class="sheet-item" @click="navigateTo('/admin/audit-logs')">
                <span class="sheet-icon-box sheet-icon--slate">
                  <span class="material-symbols-outlined">history</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('admin.auditLogs') }}</strong>
                  <small>Security ledger</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/admin/tickets')">
                <span class="sheet-icon-box sheet-icon--amber">
                  <span class="material-symbols-outlined">support_agent</span>
                </span>
                <span class="sheet-item__text">
                  <strong>Support Tickets</strong>
                  <small>Inquiries queue</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/admin/help')">
                <span class="sheet-icon-box sheet-icon--teal">
                  <span class="material-symbols-outlined">help</span>
                </span>
                <span class="sheet-item__text">
                  <strong>Help Management</strong>
                  <small>Articles & guides</small>
                </span>
              </button>
            </div>
          </div>

          <!-- Section: Institutional Desk (Buyer) -->
          <div v-if="isBuyer && isAuthed" class="sheet-section">
            <div class="sheet-section-title mono">ORGANIZATION DESK</div>
            <div class="sheet-grid">
              <button type="button" class="sheet-item" @click="navigateTo('/account')">
                <span class="sheet-icon-box sheet-icon--primary">
                  <span class="material-symbols-outlined">dashboard</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('account.dashboard') }}</strong>
                  <small>Procurement overview</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/account/rfqs')">
                <span class="sheet-icon-box sheet-icon--amber">
                  <span class="material-symbols-outlined">request_quote</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('sales.rfqTitle') }}</strong>
                  <small>Active RFQ submissions</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/account/quotes')">
                <span class="sheet-icon-box sheet-icon--teal">
                  <span class="material-symbols-outlined">description</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('sales.quoteTitle') }}</strong>
                  <small>Issued proposals</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/account/orders')">
                <span class="sheet-icon-box sheet-icon--indigo">
                  <span class="material-symbols-outlined">local_shipping</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('commerce.ordersTitle') }}</strong>
                  <small>Order history & dispatch</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/addresses')">
                <span class="sheet-icon-box sheet-icon--emerald">
                  <span class="material-symbols-outlined">location_on</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.addresses') }}</strong>
                  <small>Delivery locations</small>
                </span>
              </button>
            </div>
          </div>

          <!-- Section: Commercial & Catalog -->
          <div class="sheet-section">
            <div class="sheet-section-title mono">MARKETPLACE & CATALOG</div>
            <div class="sheet-grid">
              <button type="button" class="sheet-item" @click="navigateTo('/')">
                <span class="sheet-icon-box sheet-icon--primary">
                  <span class="material-symbols-outlined">home</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.home') }}</strong>
                  <small>Main storefront</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/marketplace')">
                <span class="sheet-icon-box sheet-icon--teal">
                  <span class="material-symbols-outlined">storefront</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.marketplace') }}</strong>
                  <small>Full instrument catalog</small>
                </span>
              </button>

              <button v-if="!isSeller" type="button" class="sheet-item" @click="navigateTo('/cart')">
                <span class="sheet-icon-box sheet-icon--amber">
                  <span class="material-symbols-outlined">shopping_bag</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.cart') }}</strong>
                  <small v-if="cartCount > 0">{{ cartCount }} item(s) in quote</small>
                  <small v-else>Active quote basket</small>
                </span>
              </button>

              <button v-if="!isSeller && isAuthed" type="button" class="sheet-item" @click="navigateTo('/wishlist')">
                <span class="sheet-icon-box sheet-icon--rose">
                  <span class="material-symbols-outlined">favorite</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.wishlist') }}</strong>
                  <small>{{ wishlistCount }} saved instruments</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/oem')">
                <span class="sheet-icon-box sheet-icon--indigo">
                  <span class="material-symbols-outlined">precision_manufacturing</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.oem') }}</strong>
                  <small>Custom private label</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/certifications')">
                <span class="sheet-icon-box sheet-icon--emerald">
                  <span class="material-symbols-outlined">verified</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.certifications') }}</strong>
                  <small>ISO & CE compliance</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/track-order')">
                <span class="sheet-icon-box sheet-icon--slate">
                  <span class="material-symbols-outlined">local_shipping</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.trackOrder') }}</strong>
                  <small>Live consignment status</small>
                </span>
              </button>
            </div>
          </div>

          <!-- Section: Support & Help -->
          <div class="sheet-section">
            <div class="sheet-section-title mono">SUPPORT & CLINICAL HELP</div>
            <div class="sheet-grid">
              <button type="button" class="sheet-item" @click="navigateTo('/help')">
                <span class="sheet-icon-box sheet-icon--teal">
                  <span class="material-symbols-outlined">help</span>
                </span>
                <span class="sheet-item__text">
                  <strong>{{ t('nav.help') }}</strong>
                  <small>Guides & documentation</small>
                </span>
              </button>

              <button v-if="isAuthed && !isSeller" type="button" class="sheet-item" @click="navigateTo('/help/my-tickets')">
                <span class="sheet-icon-box sheet-icon--amber">
                  <span class="material-symbols-outlined">confirmation_number</span>
                </span>
                <span class="sheet-item__text">
                  <strong>My Tickets</strong>
                  <small>Track support inquiries</small>
                </span>
              </button>

              <button type="button" class="sheet-item" @click="navigateTo('/locations')">
                <span class="sheet-icon-box sheet-icon--slate">
                  <span class="material-symbols-outlined">public</span>
                </span>
                <span class="sheet-item__text">
                  <strong>Territory Coverage</strong>
                  <small>Global clinical logistics</small>
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Sheet Footer: Profile, Settings, Logout -->
        <footer class="sheet-foot">
          <template v-if="isAuthed">
            <button type="button" class="sheet-foot-btn" @click="navigateTo('/profile')">
              <span class="material-symbols-outlined text-[18px]">manage_accounts</span>
              <span>{{ t('nav.profile') }}</span>
            </button>
            <button type="button" class="sheet-foot-btn" @click="toggleLang">
              <span class="material-symbols-outlined text-[18px]">language</span>
              <span>{{ locale === 'ar' ? 'English' : 'العربية' }}</span>
            </button>
            <button type="button" class="sheet-foot-btn sheet-foot-btn--danger" @click="handleLogout">
              <span class="material-symbols-outlined text-[18px]">logout</span>
              <span>{{ t('nav.logout') }}</span>
            </button>
          </template>
          <template v-else>
            <button type="button" class="sheet-foot-btn sheet-foot-btn--primary" @click="navigateTo('/auth/login')">
              <span class="material-symbols-outlined text-[18px]">login</span>
              <span>{{ t('nav.login') }}</span>
            </button>
            <button type="button" class="sheet-foot-btn" @click="toggleLang">
              <span class="material-symbols-outlined text-[18px]">language</span>
              <span>{{ locale === 'ar' ? 'English' : 'العربية' }}</span>
            </button>
            <button type="button" class="sheet-foot-btn" @click="navigateTo('/auth/register')">
              <span class="material-symbols-outlined text-[18px]">person_add</span>
              <span>{{ t('nav.register') }}</span>
            </button>
          </template>
        </footer>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.mobile-nav-root {
  display: contents;
}

/* Hidden on desktop and tablet (> 768px) */
.mobile-bar {
  display: none;
}

@media (max-width: 768px) {
  .mobile-bar {
    display: flex;
    align-items: center;
    justify-content: space-around;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: var(--wl-surface);
    backdrop-filter: blur(18px) saturate(1.2);
    -webkit-backdrop-filter: blur(18px) saturate(1.2);
    border-top: 1px solid var(--wl-border);
    box-shadow: 0 -4px 16px rgba(15, 23, 42, 0.05);
    z-index: 100;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    box-sizing: content-box;
  }

  .mobile-bar::before {
    content: '';
    position: absolute;
    top: 0;
    inset-inline: 0;
    height: 1.5px;
    background: var(--wl-laser-sweep);
    opacity: 0.35;
    pointer-events: none;
  }

  .bar-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    flex: 1;
    height: 100%;
    min-width: 0;
    padding: 0.35rem 0.2rem;
    color: var(--wl-ink-soft);
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
    -webkit-tap-highlight-color: transparent;
  }

  .bar-tab:active {
    transform: scale(0.92);
  }

  .bar-tab.is-active {
    color: var(--wl-primary);
  }

  .bar-tab.is-active .tab-icon {
    transform: translateY(-1px);
  }

  .tab-icon-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .tab-icon {
    font-size: 22px;
    line-height: 1;
    transition: transform 0.15s ease;
  }

  .tab-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 78px;
    line-height: 1.15;
    padding: 0 2px;
  }

  .tab-badge {
    position: absolute;
    top: -5px;
    inset-inline-end: -8px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: var(--wl-danger);
    color: #ffffff;
    font-size: 9px;
    font-weight: 700;
    border-radius: 999px;
    display: grid;
    place-items: center;
    border: 2px solid var(--wl-surface);
  }

  .bar-tab--more {
    color: var(--wl-ink-strong);
  }

  .bar-tab--more.is-active {
    color: var(--wl-primary);
  }
}

/* Bottom Sheet Modal */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 150;
}

.sheet-modal {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 85dvh;
  background: var(--wl-surface);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  box-shadow: 0 -10px 40px rgba(15, 23, 42, 0.25);
  border-top: 1px solid var(--wl-border);
  z-index: 160;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
}

.sheet-drag {
  width: 36px;
  height: 4px;
  background: var(--wl-border);
  border-radius: 999px;
  margin: 10px auto 4px;
  cursor: pointer;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--wl-border);
  background: var(--wl-surface-soft);
}

.sheet-user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.sheet-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
  font-size: 12px;
  overflow: hidden;
  flex-shrink: 0;
}

.sheet-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sheet-user__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.2;
}

.sheet-user__name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-user__role {
  font-size: 10px;
  color: var(--wl-muted);
}

.sheet-close {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  color: var(--wl-ink-soft);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.sheet-close:active {
  transform: scale(0.92);
}

.sheet-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sheet-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sheet-section-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--wl-muted);
  padding: 0 0.25rem;
}

.sheet-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.55rem;
}

@media (max-width: 440px) {
  .sheet-grid {
    grid-template-columns: 1fr;
    gap: 0.45rem;
  }
}

.sheet-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.8rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  text-align: start;
  cursor: pointer;
  color: inherit;
  font-family: inherit;
  transition: all 0.12s ease;
  min-height: 52px;
}

.sheet-item:hover,
.sheet-item:active {
  background: var(--wl-surface);
  border-color: var(--wl-primary);
  transform: translateY(-1px);
}

.sheet-icon-box {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-size: 17px;
  flex-shrink: 0;
}

.sheet-icon-box .material-symbols-outlined {
  font-size: 18px;
}

.sheet-icon--primary { background: rgba(79, 70, 229, 0.12); color: #4F46E5; }
.sheet-icon--amber   { background: rgba(245, 158, 11, 0.12); color: #D97706; }
.sheet-icon--indigo  { background: rgba(99, 102, 241, 0.12); color: #4F46E5; }
.sheet-icon--teal    { background: rgba(13, 148, 136, 0.12); color: #0D9488; }
.sheet-icon--emerald { background: rgba(16, 185, 129, 0.12); color: #059669; }
.sheet-icon--purple  { background: rgba(147, 51, 234, 0.12); color: #9333EA; }
.sheet-icon--rose    { background: rgba(225, 29, 72, 0.12); color: #E11D48; }
.sheet-icon--slate   { background: rgba(100, 116, 139, 0.12); color: #475569; }

.sheet-item__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}

.sheet-item__text strong {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-item__text small {
  font-size: 10.5px;
  color: var(--wl-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-foot {
  display: flex;
  gap: 0.6rem;
  padding: 0.85rem 1.15rem;
  border-top: 1px solid var(--wl-border);
  background: var(--wl-surface-soft);
}

.sheet-foot-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  color: var(--wl-ink-strong);
  transition: all 0.12s ease;
  min-height: 42px;
}

.sheet-foot-btn:active {
  transform: scale(0.96);
}

.sheet-foot-btn--primary {
  background: var(--wl-primary);
  color: #fff;
  border-color: var(--wl-primary);
}

.sheet-foot-btn--danger {
  color: var(--wl-danger);
}

/* Transitions */
.sheet-backdrop-enter-active,
.sheet-backdrop-leave-active {
  transition: opacity 0.2s ease;
}

.sheet-backdrop-enter-from,
.sheet-backdrop-leave-to {
  opacity: 0;
}

.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateY(100%);
}
</style>
