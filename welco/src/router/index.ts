import { createRouter, createWebHistory } from 'vue-router'
import { t, type MessageKey } from '../i18n'
import { services } from '../di/container'
import { toastService } from '../infrastructure/feedback/toast.service'

declare module 'vue-router' {
  interface RouteMeta {
    titleKey?: MessageKey
    requiresAuth?: boolean
    guestOnly?: boolean
    requiresAdmin?: boolean
    isLandingPage?: boolean
    hideFooter?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: { titleKey: 'nav.home', isLandingPage: true },
    },
    {
      path: '/auth/login',
      name: 'login',
      component: () => import('../views/auth/LoginView.vue'),
      meta: { titleKey: 'auth.loginTitle', guestOnly: true },
    },
    {
      path: '/auth/register',
      name: 'register',
      component: () => import('../views/auth/RegisterView.vue'),
      meta: { titleKey: 'auth.registerTitle', guestOnly: true },
    },
    {
      path: '/auth/verify-email',
      name: 'verify-email',
      component: () => import('../views/auth/VerifyEmailView.vue'),
      meta: { titleKey: 'auth.verifyTitle', guestOnly: true },
    },
    {
      path: '/auth/forgot-password',
      name: 'forgot-password',
      component: () => import('../views/auth/ForgotPasswordView.vue'),
      meta: { titleKey: 'auth.forgotTitle', guestOnly: true },
    },
    {
      path: '/auth/verify-password-otp',
      name: 'verify-password-otp',
      component: () => import('../views/auth/VerifyPasswordOtpView.vue'),
      meta: { titleKey: 'auth.verifyTitle', guestOnly: true },
    },
    {
      path: '/auth/reset-password',
      name: 'reset-password',
      component: () => import('../views/auth/ResetPasswordView.vue'),
      meta: { titleKey: 'auth.resetTitle', guestOnly: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { titleKey: 'nav.profile', requiresAuth: true },
    },
    {
      path: '/addresses',
      name: 'addresses',
      component: () => import('../views/AddressesView.vue'),
      meta: { titleKey: 'nav.addresses', requiresAuth: true },
    },
    {
      path: '/locations',
      name: 'locations',
      component: () => import('../views/LocationsView.vue'),
      meta: { titleKey: 'nav.locations', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/marketplace',
      name: 'marketplace',
      component: () => import('../views/marketplace/CatalogView.vue'),
      meta: { titleKey: 'marketplace.title' },
    },
    {
      path: '/marketplace/product/:id',
      name: 'marketplace-product',
      component: () => import('../views/marketplace/ProductDetailView.vue'),
      meta: { titleKey: 'marketplace.title' },
    },
    {
      path: '/wishlist',
      name: 'wishlist',
      component: () => import('../views/marketplace/WishlistView.vue'),
      meta: { titleKey: 'marketplace.wishlistTitle', requiresAuth: true },
    },
    {
      path: '/cart',
      name: 'cart',
      component: () => import('../views/marketplace/CartView.vue'),
      meta: { titleKey: 'nav.cart' },
    },
    {
      path: '/checkout',
      name: 'checkout',
      component: () => import('../views/marketplace/CheckoutView.vue'),
      meta: { titleKey: 'nav.checkout', requiresAuth: true },
    },
    {
      path: '/checkout/confirmation/:orderNumber',
      name: 'order-confirmation',
      component: () => import('../views/marketplace/OrderConfirmationView.vue'),
      meta: { titleKey: 'commerce.orderConfirmationTitle', requiresAuth: true },
    },
    {
      path: '/track-order',
      name: 'order-tracking',
      component: () => import('../views/marketplace/OrderTrackingView.vue'),
      meta: { titleKey: 'commerce.trackingTitle', requiresAuth: true },
    },
    {
      path: '/account',
      name: 'account',
      component: () => import('../views/account/AccountDashboardView.vue'),
      meta: { titleKey: 'account.dashboard', requiresAuth: true },
    },
    {
      path: '/account/rfqs',
      name: 'account-rfqs',
      component: () => import('../views/account/RfqListView.vue'),
      meta: { titleKey: 'sales.rfqTitle', requiresAuth: true },
    },
    {
      path: '/account/rfqs/:id',
      name: 'account-rfq-detail',
      component: () => import('../views/account/RfqDetailView.vue'),
      meta: { titleKey: 'sales.rfqDetail', requiresAuth: true },
    },
    {
      path: '/account/quotes/:id',
      name: 'account-quote-detail',
      component: () => import('../views/account/QuoteDetailView.vue'),
      meta: { titleKey: 'sales.quoteDetail', requiresAuth: true },
    },
    {
      path: '/account/quotes',
      name: 'account-quotes',
      component: () => import('../views/account/QuoteListView.vue'),
      meta: { titleKey: 'sales.quoteTitle', requiresAuth: true },
    },
    {
      path: '/account/orders',
      name: 'account-orders',
      component: () => import('../views/account/OrderHistoryView.vue'),
      meta: { titleKey: 'commerce.ordersTitle', requiresAuth: true },
    },
    {
      path: '/account/orders/:id',
      name: 'account-order-detail',
      component: () => import('../views/account/OrderDetailView.vue'),
      meta: { titleKey: 'commerce.orderDetailTitle', requiresAuth: true },
    },
    {
      path: '/oem',
      name: 'oem',
      component: () => import('../views/trade/OemView.vue'),
      meta: { titleKey: 'nav.oem', isLandingPage: true },
    },
    {
      path: '/certifications',
      name: 'certifications',
      component: () => import('../views/quality/CertificationsView.vue'),
      meta: { titleKey: 'nav.certifications', isLandingPage: true },
    },
    {
      path: '/help',
      name: 'help',
      component: () => import('../views/support/HelpCenterView.vue'),
      meta: { titleKey: 'nav.help' },
    },
    {
      path: '/help/my-tickets',
      name: 'help-my-tickets',
      component: () => import('../views/support/MyTicketsView.vue'),
      meta: { titleKey: 'nav.help', requiresAuth: true, hideFooter: true },
    },
    {
      path: '/catalog/:slug',
      name: 'landing-page',
      component: () => import('../views/catalog/LandingPageView.vue'),
      meta: { titleKey: 'catalog.title', isLandingPage: true },
    },
    {
      path: '/admin',
      name: 'admin-dashboard',
      component: () => import('../views/admin/AdminDashboardView.vue'),
      meta: { titleKey: 'admin.dashboard', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/sales',
      name: 'admin-sales',
      component: () => import('../views/admin/SalesAdminView.vue'),
      meta: { titleKey: 'admin.sales', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/orders',
      name: 'admin-orders',
      component: () => import('../views/admin/OrdersAdminView.vue'),
      meta: { titleKey: 'admin.orders', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/companies',
      name: 'admin-companies',
      component: () => import('../views/admin/CompaniesAdminView.vue'),
      meta: { titleKey: 'admin.companies', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/countries',
      name: 'admin-countries',
      component: () => import('../views/admin/CountriesAdminView.vue'),
      meta: { titleKey: 'admin.countries', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/cities',
      name: 'admin-cities',
      component: () => import('../views/admin/CitiesAdminView.vue'),
      meta: { titleKey: 'admin.cities', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/zones',
      name: 'admin-zones',
      component: () => import('../views/admin/ZonesAdminView.vue'),
      meta: { titleKey: 'admin.zones', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('../views/admin/UsersAdminView.vue'),
      meta: { titleKey: 'admin.users', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/catalog',
      name: 'admin-catalog',
      component: () => import('../views/admin/CatalogAdminView.vue'),
      meta: { titleKey: 'nav.catalog', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/products',
      redirect: '/admin/catalog?tab=products',
    },
    {
      path: '/admin/categories',
      redirect: '/admin/catalog?tab=categories',
    },
    {
      path: '/admin/certifications',
      name: 'admin-certifications',
      component: () => import('../views/admin/CertificationsAdminView.vue'),
      meta: { titleKey: 'certifications.title', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/help',
      name: 'admin-help',
      component: () => import('../views/admin/HelpAdminView.vue'),
      meta: { titleKey: 'nav.help', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/tickets',
      name: 'admin-tickets',
      component: () => import('../views/admin/TicketsAdminView.vue'),
      meta: { titleKey: 'nav.help', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/audit-logs',
      name: 'admin-audit-logs',
      component: () => import('../views/admin/AuditLogAdminView.vue'),
      meta: { titleKey: 'admin.auditLogs', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/documents',
      redirect: '/admin/certifications?tab=documents',
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = services.authService
  let isAuthenticated = auth.isAuthenticated

  if (to.meta.requiresAuth && isAuthenticated) {
    await auth.ensureValidSession()
    isAuthenticated = auth.isAuthenticated
  }

  const isSeller = auth.isAdmin.value || auth.isWelcoStaff.value

  if (isAuthenticated && isSeller && (to.name === 'home' || to.path === '/')) {
    return { name: 'admin-dashboard' }
  }
  if (isAuthenticated && isSeller && (to.path.startsWith('/account') || to.name === 'help-my-tickets')) {
    return { name: 'admin-dashboard' }
  }
  if (isAuthenticated && !isSeller && to.path.startsWith('/admin')) {
    return { name: 'home' }
  }
  if (isAuthenticated && auth.isOrganizationUser.value) {
    const user = auth.user.value
    const hasCompany = !!(user?.companyId)
    const buyerGuarded = to.path.startsWith('/account') || to.path === '/cart' || to.path === '/checkout' || to.path === '/wishlist'
    if (!hasCompany && buyerGuarded) {
      await auth.loadProfile().catch(() => null)
      if (auth.user.value?.companyId) return true
      toastService.info(t('distributor.pendingApproval'))
      return { name: 'home' }
    }
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && isAuthenticated) {
    if (isSeller) return { name: 'admin-dashboard' }
    return { name: 'home' }
  }
  if (to.meta.requiresAdmin) {
    if (!isSeller) return { name: 'home' }
    const adminOnly = [
      '/admin/users',
      '/admin/companies',
      '/admin/countries',
      '/admin/cities',
      '/admin/zones',
      '/admin/audit-logs',
      '/admin/certifications',
      '/admin/documents',
    ]
    const isAdminOnlyPath = adminOnly.some((p) => to.path.startsWith(p))
    if (isAdminOnlyPath && !auth.isAdmin.value) return { name: 'admin-dashboard' }
  }
})

router.afterEach((to) => {
  const key = to.meta.titleKey
  if (key) {
    document.title = `${t(key)} · Welco`
  } else {
    document.title = 'Welco'
  }

  const text = key ? t(key) : document.title
  let announcer = document.querySelector('.visually-hidden[aria-live="polite"]') as HTMLElement | null
  if (!announcer) {
    announcer = document.createElement('div')
    announcer.className = 'visually-hidden'
    announcer.setAttribute('aria-live', 'polite')
    announcer.setAttribute('aria-atomic', 'true')
    document.body.appendChild(announcer)
  }
  announcer.textContent = ''
  setTimeout(() => {
    if (announcer) announcer.textContent = text
  }, 100)
})

export default router
