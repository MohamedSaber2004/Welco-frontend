<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { useCart } from '../../composables/useCart'
import { commerceService, salesService, companyService, authService, services } from '../../di/container'
import ChainSteps from '../../components/ui/ChainSteps.vue'
import BackButton from '../../components/ui/BackButton.vue'
import AppImage from '../../components/ui/AppImage.vue'
import { productMediaUrl } from '../../utils/file-url'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { distinctCurrenciesFromAddresses } from '../../utils/country-currency-map'

const router = useRouter()
const { items, total, convertedTotal, targetCurrency, count, currency, toDisplayCurrency, quoteNote, clear, getConvertedPrice, setTargetCurrency, unconvertedIds, refreshConversions } = useCart()

const localized = (en: string, ar: string) => (locale.value === 'ar' ? ar : en)

const placing = ref(false)
const submittingRfq = ref(false)
const error = ref<string | null>(null)

const selectedCurrency = computed(() => targetCurrency.value)
const displayTotal = computed(() => Math.ceil(convertedTotal.value).toLocaleString(locale.value === 'ar' ? 'ar-EG' : 'en-US'))
const addressCurrencyOptions = ref<string[]>([])

onMounted(async () => {
  if (!items.value.length) {
    void router.replace({ name: 'marketplace' })
    return
  }
  // Needed to resolve the cart currency code to its id for the order payload.
  void services.marketplaceService.loadCurrencies().catch(() => {})
  try { await services.exchangeRateService.loadLatest('USD') } catch { }
  try { await refreshConversions() } catch { }
  // Derive address-based currency options
  try {
    await services.locationService.loadCountries().catch(() => {})
    await companyService.loadMyCompany().catch(() => {})
    const cid = companyService.myCompany.value?.id
    if (cid) {
      await companyService.loadCompanyAddresses(cid).catch(() => {})
      const addrs = companyService.companyAddresses.value as unknown as { countryId: string }[]
      const countries = services.locationService.countries.value as unknown as { id: string; code?: string | null; nameEn?: string | null; nameAr?: string | null }[]
      addressCurrencyOptions.value = distinctCurrenciesFromAddresses(addrs, countries)
    }
  } catch { }
})

async function placeOrder() {
  if (!items.value.length || placing.value) return
  placing.value = true
  error.value = null
  try {
    const code = targetCurrency.value || toDisplayCurrency()
    const currencyId = services.marketplaceService.currencies.value.find((c) => c.code === code)?.id
    const res = await commerceService.placeOrder({
      userId: authService.user.value?.id ?? undefined,
      companyId: companyService.myCompany.value?.id ?? undefined,
      currencyId,
      currencyCode: code,
      items: items.value.map((i) => ({ productId: i.product.id, quantity: i.quantity, unitPrice: getConvertedPrice(i.product) })),
    })
    if (res.ok && res.order) {
      clear()
      void router.replace({ name: 'order-confirmation', params: { orderNumber: res.order.orderNumber } })
    } else if (!res.ok) {
      error.value = res.error
    }
  } finally {
    placing.value = false
  }
}

async function convertToQuote() {
  if (!items.value.length || submittingRfq.value) return
  if (!authService.isAuthenticated) {
    void router.push({ name: 'login', query: { redirect: '/checkout' } })
    return
  }
  await companyService.loadMyCompany()
  const company = companyService.myCompany.value
  if (!company) { toastService.info(t('distributor.pendingApproval')); return }
  submittingRfq.value = true
  try {
    const res = await salesService.createRfq({
      companyId: company.id,
      note: quoteNote.value || undefined,
      items: items.value.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: i.product.price })),
    })
    if (res.ok && res.rfq) {
      clear()
      toastService.success(t('sales.rfqSubmitted', { rfqNumber: res.rfq.rfqNumber }))
      void router.push({ name: 'account-rfq-detail', params: { id: res.rfq.id } })
    } else if (!res.ok) error.value = res.error
  } finally { submittingRfq.value = false }
}
</script>

<template>
  <div class="page-shell checkout-page">
    <!-- Breadcrumb & Back -->
    <div class="checkout-nav">
      <BackButton fallback="/cart" variant="ghost" />
      <nav class="breadcrumb mono" :aria-label="t('common.breadcrumb')">
        <router-link to="/marketplace">{{ t('nav.marketplace') }}</router-link>
        <span class="sep icon--directional" aria-hidden="true">/</span>
        <router-link to="/cart">{{ t('nav.cart') }}</router-link>
        <span class="sep icon--directional" aria-hidden="true">/</span>
        <span class="current">{{ t('nav.checkout') }}</span>
      </nav>
    </div>

    <!-- Header Section -->
    <header class="checkout-hero">
      <div class="checkout-hero__info">
        <div class="checkout-eyebrow mono">
          <span class="secure-dot" aria-hidden="true"></span>
          <span>{{ t('checkout.secureTitle') }}</span>
        </div>
        <h1 class="checkout-title">{{ t('commerce.checkoutTitle') }}</h1>
        <p class="checkout-desc">{{ t('commerce.checkoutSubtitle') }}</p>
      </div>
    </header>

    <!-- Progress Stepper -->
    <div class="stepper-wrap">
      <ChainSteps
        :steps="[t('marketplace.quoteCart'), t('commerce.orderSummary'), t('commerce.orderConfirmationTitle')]"
        :current="1"
      />
    </div>

    <div v-if="error" class="modal-error" style="margin-bottom: 1.5rem" role="alert">
      {{ error }}
    </div>

    <div class="checkout-layout">
      <!-- Left Column: Order Items -->
      <main class="checkout-main">
        <!-- Currency Selection Row - address based -->
        <div class="curr-selector-card">
          <div class="curr-selector-left">
            <span class="mono curr-label">{{ t('checkout.currency') }}:</span>
            <div class="curr-chips">
              <template v-if="addressCurrencyOptions.length>1">
                <button v-for="code in addressCurrencyOptions" :key="code" type="button" class="curr-chip mono" :class="{ active: code===targetCurrency }" @click="setTargetCurrency(code)">{{ code }}</button>
              </template>
              <span v-else class="curr-chip mono active" :title="t('checkout.exchangeLocked')">{{ targetCurrency }}</span>
            </div>
          </div>
          <span class="curr-lock mono">{{ addressCurrencyOptions.length>1 ? t('cart.activeCurrency') : t('checkout.exchangeLocked') }}</span>
        </div>
        <div v-if="unconvertedIds.length" class="rate-warn mono" role="alert">
          <span class="material-symbols-outlined text-[14px]">warning</span>
          <span>{{ t('cart.rateUnavailable', { count: unconvertedIds.length }) }}</span>
        </div>

        <!-- Verified Items Summary Section -->
        <section class="checkout-card" aria-labelledby="items-heading">
          <div class="checkout-card__head">
            <h2 id="items-heading" class="card-heading">
              <span>{{ t('commerce.orderSummary') }}</span>
              <span class="item-count-chip mono">{{ count }} items</span>
            </h2>
          </div>

          <div class="line-items-list">
            <article v-for="it in items" :key="it.product.id" class="line-item">
              <div class="line-item__thumb" :style="{ background: it.product.imageGradient || 'var(--wl-surface-soft)' }">
                <AppImage
                  :src="it.product.imageName"
                  placeholder-type="product"
                  :placeholder-text="it.product.sku"
                  :alt="localized(it.product.nameEn, it.product.nameAr)"
                  fit="contain"
                  class="line-item__thumb-img"
                />
              </div>

              <div class="line-item__info">
                <h3 class="line-item__name">{{ localized(it.product.nameEn, it.product.nameAr) }}</h3>
                <div class="line-item__sub mono">
                  <span>SKU: {{ it.product.sku }}</span>
                  <span class="dot">•</span>
                  <span>{{ it.product.material || 'AISI 420 Stainless' }}</span>
                </div>
              </div>

              <div class="line-item__pricing">
                <div class="mono line-item__calc">
                  <span v-if="(it.product.currencyCode||'USD').toUpperCase()!==targetCurrency"> {{ Math.ceil(it.product.price).toLocaleString(locale==='ar'?'ar-EG':'en-US') }} {{ it.product.currencyCode }} → </span>
                  {{ it.quantity }} × {{ Math.ceil(getConvertedPrice(it.product)).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} {{ targetCurrency }}
                </div>
                <strong class="mono line-item__total">
                  {{ Math.ceil(it.quantity * getConvertedPrice(it.product)).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} {{ targetCurrency }}
                </strong>
              </div>
            </article>
          </div>
        </section>

      </main>

      <!-- Right Column: Commercial Summary (Sticky) -->
      <aside class="checkout-summary-col">
        <div class="summary-card">
          <div class="summary-head">
            <h2 class="summary-title">{{ t('commerce.orderSummary') }}</h2>
            <span class="summary-badge mono">{{ t('checkout.escrowSecure') }}</span>
          </div>

          <div class="summary-rows">
            <div class="summary-row">
              <span class="mono">{{ t('commerce.subtotal') }}</span>
              <strong class="mono">{{ Math.ceil(convertedTotal).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} {{ targetCurrency }}</strong>
            </div>

            <div class="summary-row">
              <span class="mono">{{ t('checkout.duties') }}</span>
              <span class="mono text-muted text-xs">{{ t('checkout.calcCustoms') }}</span>
            </div>

            <div class="summary-divider"></div>

            <div class="summary-row summary-row--total">
              <span class="total-label mono">{{ t('commerce.total') }}</span>
              <strong class="total-val mono">
                {{ Math.ceil(convertedTotal).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} <span class="total-curr">{{ targetCurrency }}</span>
              </strong>
            </div>
          </div>

          <div class="summary-note-box mono">
            <span class="material-symbols-outlined text-[15px]">info</span>
            <span>{{ t('commerce.dutiesNote') }}</span>
          </div>

          <div class="summary-actions">
            <button
              class="btn btn-primary btn-block btn-lg"
              type="button"
              :disabled="placing"
              @click="placeOrder"
            >
              <span class="material-symbols-outlined text-[18px]">verified</span>
              <span>{{ placing ? t('commerce.placingOrder') : t('commerce.placeOrder') }}</span>
            </button>

            <button
              class="btn btn-ghost btn-block"
              type="button"
              :disabled="submittingRfq"
              @click="convertToQuote"
            >
              <span class="material-symbols-outlined text-[16px]">request_quote</span>
              <span>{{ t('checkout.convertToQuote') }}</span>
            </button>

            <router-link to="/cart" class="btn btn-ghost btn-block btn-sm">
              <span class="material-symbols-outlined text-[16px] icon--directional">arrow_back</span>
              <span>{{ t('common.back') }}</span>
            </router-link>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.checkout-page {
  width: 100%;
}

.checkout-nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 11px;
  color: var(--wl-muted);
}

.breadcrumb a {
  color: var(--wl-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.breadcrumb a:hover {
  color: var(--wl-primary);
}

.breadcrumb .sep {
  color: var(--wl-border);
}

.breadcrumb .current {
  color: var(--wl-ink-strong);
  font-weight: 700;
}

/* Header */
.checkout-hero {
  margin-bottom: 1.75rem;
}

.checkout-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 0.4rem;
}

.secure-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--wl-success);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}

.checkout-title {
  font-family: var(--wl-font-display);
  font-size: clamp(1.85rem, 3.2vw, 2.4rem);
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  line-height: 1.1;
  margin: 0 0 0.4rem;
}

.checkout-desc {
  font-size: 0.95rem;
  color: var(--wl-ink-soft);
  margin: 0;
}

.stepper-wrap {
  margin-bottom: 2rem;
}

/* Layout */
.checkout-layout {
  display: grid;
  grid-template-columns: 1fr 390px;
  gap: 2.25rem;
  align-items: start;
}

.checkout-main {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

/* Currency Card */
.curr-selector-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.95rem 1.25rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 12px;
  box-shadow: var(--shadow-xs);
  flex-wrap: wrap;
  gap: 0.85rem;
}

.curr-selector-left {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
}

.curr-label {
  font-size: 10.5px;
  color: var(--wl-muted);
  font-weight: 700;
  letter-spacing: 0.06em;
}

.rate-warn {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.75rem;
  padding: 0.6rem 1.25rem;
  background: var(--wl-warning-soft);
  border: 1px solid var(--wl-warning);
  color: var(--wl-amber);
  border-radius: 12px;
  font-size: 11.5px;
  font-weight: 600;
}

.curr-chips {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.curr-chip {
  border: 1px solid var(--wl-border);
  padding: 0.3rem 0.75rem;
  font-size: 11.5px;
  background: var(--wl-surface-soft);
  color: var(--wl-ink-soft);
  cursor: pointer;
  border-radius: 9999px;
  font-weight: 700;
  transition: all 0.16s var(--wl-ease-spring);
}

.curr-chip:hover {
  border-color: var(--wl-primary);
  color: var(--wl-primary);
}
.curr-chip--default {
  border-color: rgba(79, 70, 229, 0.2);
  background: var(--wl-primary-soft);
  font-weight: 800;
}

.curr-chip.active {
  background: var(--wl-primary);
  color: #ffffff;
  border-color: var(--wl-primary);
  box-shadow: 0 2px 6px rgba(79, 70, 229, 0.3);
}

.curr-lock {
  font-size: 10.5px;
  color: var(--wl-muted);
}

/* Cards */
.checkout-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 14px;
  padding: 1.5rem;
  box-shadow: var(--wl-shadow-card);
}

.checkout-card__head {
  margin-bottom: 1.25rem;
}

.card-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 10px;
  color: #4F46E5;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 0.25rem;
}

.card-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--wl-font-display);
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.015em;
  color: var(--wl-ink-strong);
  margin: 0;
}

.item-count-chip {
  font-size: 11px;
  font-weight: 600;
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
}

/* Line items */
.line-items-list {
  display: flex;
  flex-direction: column;
}

.line-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--wl-surface-soft);
}

.line-item:last-child {
  border-bottom: none;
}

.line-item__thumb {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  border: 1px solid var(--wl-border);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}

.line-item__thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.line-item__info {
  flex: 1;
  min-width: 0;
}

.line-item__name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0 0 0.2rem;
  line-height: 1.3;
}

.line-item__sub {
  font-size: 11px;
  color: var(--wl-muted);
  display: flex;
  gap: 0.4rem;
}

.line-item__pricing {
  text-align: end;
  flex-shrink: 0;
}

.line-item__calc {
  font-size: 11px;
  color: var(--wl-muted);
}

.line-item__total {
  font-size: 13.5px;
  color: var(--wl-ink-strong);
  font-weight: 700;
}

/* Summary Card */
.checkout-summary-col {
  position: sticky;
  top: calc(var(--wl-header-height) + 20px);
}

.summary-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 16px;
  padding: 1.65rem 1.75rem;
  box-shadow: var(--wl-shadow-card);
  position: relative;
  overflow: hidden;
}

.summary-card::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
}

.summary-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.summary-title {
  font-family: var(--wl-font-display);
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.015em;
  color: var(--wl-ink-strong);
  margin: 0;
}

.summary-badge {
  font-size: 9.5px;
  font-weight: 700;
  color: var(--wl-success);
  background: var(--wl-success-soft);
  border: 1px solid var(--wl-border);
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
}

.summary-rows {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12.5px;
}

.summary-divider {
  height: 1px;
  background: var(--wl-border);
  margin: 0.4rem 0;
}

.summary-row--total {
  font-size: 14px;
}

.total-label {
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.total-val {
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.total-curr {
  font-size: 0.95rem;
  color: var(--wl-primary);
}

.summary-note-box {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  font-size: 11px;
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 8px;
  padding: 0.65rem 0.85rem;
  margin: 1.15rem 0 1.35rem;
  line-height: 1.5;
}

.summary-actions {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

@media (max-width: 980px) {
  .checkout-layout {
    grid-template-columns: 1fr;
  }
  .checkout-summary-col {
    position: static;
  }
}
</style>
