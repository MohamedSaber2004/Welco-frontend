<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { useCart } from '../../composables/useCart'
import { salesService, companyService, authService, services, locationService } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import EmptyState from '../../components/ui/EmptyState.vue'
import QuantityStepper from '../../components/ui/QuantityStepper.vue'
import { productMediaUrl } from '../../utils/file-url'
import type { CurrencyDto } from '../../domain/models/marketplace'
import BackButton from '../../components/ui/BackButton.vue'
import AppImage from '../../components/ui/AppImage.vue'
import {
  distinctCurrenciesFromAddresses,
  resolveCurrencyCountry,
  currencyDisplaySymbol,
} from '../../utils/country-currency-map'

const router = useRouter()
const {
  items,
  total,
  convertedTotal,
  targetCurrency,
  count,
  currency,
  currencyCode,
  quoteNote,
  unconvertedIds,
  setQty,
  remove,
  clear,
  setNote,
  toDisplayCurrency,
  toRfqItems,
  getConvertedPrice,
  setTargetCurrency,
  refreshConversions,
} = useCart()
const localized = (en?: string | null, ar?: string | null) =>
  locale.value === 'ar' ? ar || en || '' : en || ar || ''

const submittingRfq = ref(false)
const availableCurrencies = ref<CurrencyDto[]>([])
const addressCurrencies = ref<string[]>([])
const showCurrencyDropdown = ref(false)
const currencySearchQuery = ref('')
const currencyDropdownEl = ref<HTMLElement | null>(null)
const isRefreshingRates = ref(false)

function onDocumentClick(e: MouseEvent) {
  if (showCurrencyDropdown.value && currencyDropdownEl.value) {
    if (!currencyDropdownEl.value.contains(e.target as Node)) {
      showCurrencyDropdown.value = false
    }
  }
}

onMounted(async () => {
  document.addEventListener('click', onDocumentClick)
  try {
    await services.marketplaceService.loadCurrencies()
    availableCurrencies.value = services.marketplaceService.currencies.value.filter((c) => c.isActive)
  } catch {
    availableCurrencies.value = []
  }
  try { await services.exchangeRateService.loadLatest('USD') } catch { }
  try { await refreshConversions() } catch { }
  try {
    await services.locationService.loadCountries().catch(() => {})
    await companyService.loadMyCompany().catch(() => {})
    const cid = companyService.myCompany.value?.id
    if (cid) {
      await companyService.loadCompanyAddresses(cid).catch(() => {})
      const addrs = companyService.companyAddresses.value as unknown as { countryId: string }[]
      const countries = locationService.countries.value as unknown as { id: string; code?: string | null; nameEn?: string | null; nameAr?: string | null }[]
      const distinct = distinctCurrenciesFromAddresses(addrs, countries)
      addressCurrencies.value = distinct
      if (distinct.length > 0) {
        const current = targetCurrency.value.toUpperCase()
        if (!distinct.includes(current)) {
          const preferred = distinct[0] as string
          if (preferred) setTargetCurrency(preferred)
        }
      }
    }
    if (items.value.length && targetCurrency.value === 'USD' && !addressCurrencies.value.length) {
      const firstCur = (items.value[0]?.product.currencyCode || 'USD').toUpperCase()
      if (firstCur !== 'USD') setTargetCurrency(firstCur)
    }
  } catch { }
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})

const activeCurrencyMeta = computed(() => {
  const code = targetCurrency.value.toUpperCase()
  const foundCur = availableCurrencies.value.find((c) => (c.code || '').toUpperCase() === code)
  const res = resolveCurrencyCountry(
    code,
    availableCurrencies.value,
    locationService.countries.value,
    locale.value,
  )
  const symbol = currencyDisplaySymbol(foundCur || { code }, locale.value)
  const isAddress = addressCurrencies.value.includes(code)
  return {
    code,
    symbol,
    countryName: localized(res.countryNameEn || null, res.countryNameAr || null),
    currencyName: localized(foundCur?.nameEn || res.currencyNameEn, foundCur?.nameAr || res.currencyNameAr),
    flag: res.flag,
    isAddress,
  }
})

interface QuickCurrencyOption {
  code: string
  symbol: string
  flag: string
  countryName: string
  currencyName: string
  title: string
  isAddress: boolean
}

// Distinct original currencies of items currently in the cart
const cartOriginalCurrencies = computed(() => {
  const set = new Set<string>()
  for (const it of items.value) {
    const code = (it.product.currencyCode || it.product.currency || 'USD').toUpperCase()
    if (code) set.add(code)
  }
  return Array.from(set)
})

// Curated list of quick switcher options (addresses + items + current + regional favorites)
const quickCurrencyOptions = computed<QuickCurrencyOption[]>(() => {
  const list: string[] = []
  for (const code of addressCurrencies.value) {
    if (code && !list.includes(code)) list.push(code)
  }
  for (const code of cartOriginalCurrencies.value) {
    if (code && !list.includes(code)) list.push(code)
  }
  const current = targetCurrency.value.toUpperCase()
  if (current && !list.includes(current)) list.push(current)

  for (const c of availableCurrencies.value.slice(0, 8)) {
    const code = (c.code || '').toUpperCase()
    if (code && !list.includes(code)) list.push(code)
  }

  return list.map((code) => {
    const found = availableCurrencies.value.find((c) => (c.code || '').toUpperCase() === code)
    const res = resolveCurrencyCountry(
      code,
      availableCurrencies.value,
      locationService.countries.value,
      locale.value,
    )
    const symbol = currencyDisplaySymbol(found || { code }, locale.value)
    const countryName = localized(res.countryNameEn || null, res.countryNameAr || null)
    const currencyName = localized(found?.nameEn || res.currencyNameEn, found?.nameAr || res.currencyNameAr)
    return {
      code,
      symbol,
      flag: res.flag,
      countryName,
      currencyName,
      title: countryName ? `${countryName} (${currencyName})` : `${currencyName} (${code})`,
      isAddress: addressCurrencies.value.includes(code),
    }
  })
})

// Searchable full list of all available currencies
const filteredAllCurrencies = computed(() => {
  const q = currencySearchQuery.value.trim().toLowerCase()
  const source = availableCurrencies.value

  return source
    .map((c) => {
      const code = (c.code || '').toUpperCase()
      const res = resolveCurrencyCountry(
        code,
        availableCurrencies.value,
        locationService.countries.value,
        locale.value,
      )
      const symbol = currencyDisplaySymbol(c, locale.value)
      const countryName = localized(res.countryNameEn || null, res.countryNameAr || null)
      const currencyName = localized(c.nameEn, c.nameAr)
      const isAddress = addressCurrencies.value.includes(code)
      return {
        code,
        symbol,
        flag: res.flag,
        countryName,
        currencyName,
        title: countryName || currencyName,
        isAddress,
      }
    })
    .filter((c) => {
      if (!c) return false
      if (!q) return true
      const matchCode = c.code ? String(c.code).toLowerCase().includes(q) : false
      const matchCountry = c.countryName ? String(c.countryName).toLowerCase().includes(q) : false
      const matchCurrency = c.currencyName ? String(c.currencyName).toLowerCase().includes(q) : false
      const matchSymbol = c.symbol ? String(c.symbol).toLowerCase().includes(q) : false
      return matchCode || matchCountry || matchCurrency || matchSymbol
    })
})

function selectCurrency(code: string) {
  setTargetCurrency(code)
  showCurrencyDropdown.value = false
  currencySearchQuery.value = ''
}

async function handleRefreshRates() {
  if (isRefreshingRates.value) return
  isRefreshingRates.value = true
  try {
    await services.exchangeRateService.loadLatest('USD')
    await refreshConversions()
    toastService.success(t('cart.liveRateBadge'))
  } catch {
    // fallback
  } finally {
    isRefreshingRates.value = false
  }
}

const goCheckout = () => {
  if (!items.value.length) return
  void router.push({ name: 'checkout' })
}

const handleClear = async () => {
  const ok = await confirmService.confirm({
    title: t('common.delete'),
    message: t('cart.confirmClear'),
    variant: 'danger',
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return
  clear()
}

const handleRemove = async (id: string) => {
  const ok = await confirmService.confirm({
    title: t('marketplace.remove'),
    message: t('cart.confirmRemove'),
    variant: 'danger',
    confirmText: t('marketplace.remove'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return
  remove(id)
}

const submitRfq = async () => {
  if (!items.value.length || submittingRfq.value) return
  if (!authService.isAuthenticated) {
    toastService.info(t('sales.submitRfq'))
    void router.push({ name: 'login', query: { redirect: '/cart' } })
    return
  }
  // Force-refresh company data (bypass cache) to guarantee we have a fresh companyId
  await companyService.loadMyCompany(true)
  const company = companyService.myCompany.value

  // Resolve companyId: prefer company.id, fall back to the id stored on the auth user
  const companyId: string | null | undefined =
    company?.id || authService.user.value?.companyId || null

  if (!companyId) {
    toastService.info(t('distributor.pendingApproval'))
    return
  }
  submittingRfq.value = true
  try {
    const res = await salesService.createRfq({
      companyId,
      note: quoteNote.value || undefined,
      items: toRfqItems(),
    })
    if (res.ok && res.rfq) {
      clear()
      void router.push({ name: 'account-rfq-detail', params: { id: res.rfq.id } })
    } else if (!res.ok) {
      toastService.error(res.error)
    }
  } finally {
    submittingRfq.value = false
  }
}
</script>

<template>
  <div class="page-shell cart-page">
    <!-- Breadcrumb & Back Action -->
    <div class="cart-nav">
      <BackButton fallback="/marketplace" variant="ghost" />
      <nav class="breadcrumb mono" :aria-label="t('common.breadcrumb')">
        <router-link to="/">{{ t('nav.home') }}</router-link>
        <span class="sep icon--directional" aria-hidden="true">/</span>
        <router-link to="/marketplace">{{ t('nav.marketplace') }}</router-link>
        <span class="sep icon--directional" aria-hidden="true">/</span>
        <span class="current">{{ t('marketplace.quoteCart') }}</span>
      </nav>
    </div>

    <!-- Header Section -->
    <header class="cart-hero">
      <div class="cart-hero__info">
        <div class="cart-eyebrow mono">
          <span class="cart-dot" aria-hidden="true"></span>
          <span>{{ t('cart.trayEyebrow', { count }) }}</span>
        </div>
        <h1 class="cart-title">{{ t('marketplace.quoteCart') }}</h1>
        <p class="cart-desc">{{ t('marketplace.checkoutSubtitle') }}</p>
      </div>

      <div class="cart-hero__actions">
        <button class="btn btn-ghost" type="button" @click="router.push({ name: 'marketplace' })">
          <span class="material-symbols-outlined text-[16px] icon--directional">arrow_back</span>
          <span>{{ t('marketplace.continueShopping') }}</span>
        </button>
        <button v-if="items.length" class="btn btn-ghost text-danger" type="button" @click="handleClear">
          <span class="material-symbols-outlined text-[16px]">delete_sweep</span>
          <span>{{ t('common.delete') }}</span>
        </button>
      </div>
    </header>

    <!-- Empty State -->
    <EmptyState
      v-if="!items.length"
      :title="t('marketplace.cartEmpty')"
      :description="t('marketplace.cartEmptyDesc')"
      :action-text="t('marketplace.browseMarketplace')"
      icon="shopping_basket"
      @action="router.push({ name: 'marketplace' })"
    />

    <!-- Cart Layout -->
    <div v-else class="cart-layout">
      <!-- Main Column: Sterile Tray Line Items -->
      <main class="cart-main">
        <!-- Active Currency Hub & Multi-Currency Switcher -->
        <section class="currency-hub-card" aria-labelledby="curr-hub-heading">
          <!-- Left: Active Currency Status Dossier -->
          <div class="curr-hub__main">
            <div class="curr-hub__badge-group">
              <span class="fx-live-pill mono">
                <span class="fx-dot" :class="{ 'is-spinning': isRefreshingRates }"></span>
                <span>{{ t('cart.liveRateBadge') }}</span>
              </span>
              <span v-if="activeCurrencyMeta.isAddress" class="address-curr-badge mono">
                <span class="material-symbols-outlined text-[13px]">location_on</span>
                <span>{{ t('cart.addressCurrencyTag') }}</span>
              </span>
            </div>

            <div class="curr-hub__active-hero">
              <span class="active-flag" aria-hidden="true">{{ activeCurrencyMeta.flag }}</span>
              <div class="active-titles">
                <div class="active-code-line">
                  <strong class="active-code mono">{{ activeCurrencyMeta.code }}</strong>
                  <span class="active-symbol-badge mono">{{ activeCurrencyMeta.symbol }}</span>
                </div>
                <div class="active-country-desc">
                  <template v-if="activeCurrencyMeta.countryName">
                    <span>{{ activeCurrencyMeta.countryName }}</span>
                    <span class="dot-sep">•</span>
                  </template>
                  <span>{{ activeCurrencyMeta.currencyName }}</span>
                </div>
              </div>
            </div>

            <p class="curr-hub__hint mono">{{ t('cart.currencyHelp') }}</p>
          </div>

          <!-- Right: Smart Currency Switcher Chips & More Dropdown -->
          <div class="curr-hub__controls">
            <div class="chips-label-row">
              <span class="mono chips-lbl">{{ t('cart.activeCurrency') }}</span>
              <button
                type="button"
                class="btn-refresh-rates mono"
                :title="t('cart.refreshRates')"
                :disabled="isRefreshingRates"
                @click="handleRefreshRates"
              >
                <span class="material-symbols-outlined text-[15px]" :class="{ 'spin-anim': isRefreshingRates }">sync</span>
                <span>{{ t('cart.refreshRates') }}</span>
              </button>
            </div>

            <!-- Quick Pills -->
            <div class="curr-pills-wrap">
              <button
                v-for="opt in quickCurrencyOptions"
                :key="opt.code"
                type="button"
                class="curr-pill mono"
                :class="{ 'is-active': opt.code === targetCurrency }"
                :title="opt.title"
                @click="setTargetCurrency(opt.code)"
              >
                <span class="pill-flag">{{ opt.flag }}</span>
                <span class="pill-code">{{ opt.code }}</span>
                <span class="pill-sym">{{ opt.symbol }}</span>
                <span v-if="opt.isAddress" class="pill-addr-dot" :title="t('cart.addressCurrencyTag')">📍</span>
                <span v-if="opt.code === targetCurrency" class="material-symbols-outlined text-[13px] check-icon">check</span>
              </button>

              <!-- More Currencies Dropdown Trigger -->
              <div ref="currencyDropdownEl" class="more-curr-wrapper">
                <button
                  type="button"
                  class="curr-pill curr-pill--more mono"
                  :class="{ 'is-open': showCurrencyDropdown }"
                  @click.stop="showCurrencyDropdown = !showCurrencyDropdown"
                >
                  <span class="material-symbols-outlined text-[16px]">travel_explore</span>
                  <span>{{ t('cart.selectOtherCurrency') }}</span>
                  <span class="material-symbols-outlined text-[16px] chev-icon">expand_more</span>
                </button>

                <!-- Popover -->
                <div v-if="showCurrencyDropdown" class="curr-dropdown-popover" @click.stop>
                  <div class="popover-search-wrap">
                    <span class="material-symbols-outlined search-ic">search</span>
                    <input
                      v-model="currencySearchQuery"
                      type="text"
                      class="popover-search-input mono"
                      :placeholder="t('cart.searchCurrency')"
                      autofocus
                    />
                    <button
                      v-if="currencySearchQuery"
                      type="button"
                      class="clear-search-btn"
                      @click="currencySearchQuery = ''"
                    >
                      <span class="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>

                  <div class="popover-items-list">
                    <div v-if="!filteredAllCurrencies.length" class="popover-empty mono">
                      No currencies found
                    </div>
                    <button
                      v-for="c in filteredAllCurrencies"
                      :key="c.code"
                      type="button"
                      class="popover-item-btn mono"
                      :class="{ 'is-active': c.code === targetCurrency }"
                      @click="selectCurrency(c.code)"
                    >
                      <span class="p-flag">{{ c.flag }}</span>
                      <div class="p-info">
                        <div class="p-line-1">
                          <strong class="p-country">{{ c.title }}</strong>
                          <span v-if="c.isAddress" class="p-addr-badge">📍 {{ t('cart.addressCurrencyTag') }}</span>
                        </div>
                        <div class="p-line-2">
                          <span>{{ c.currencyName }}</span>
                        </div>
                      </div>
                      <span class="p-code-badge">{{ c.code }}</span>
                      <span class="p-sym-badge">{{ c.symbol }}</span>
                      <span v-if="c.code === targetCurrency" class="material-symbols-outlined text-[16px] text-indigo-600">check_circle</span>
                    </button>
                  </div>

                  <div class="popover-footer mono">
                    <span>{{ t('cart.allCurrenciesCount', { count: availableCurrencies.length || 155 }) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <div v-if="unconvertedIds.length" class="rate-warn mono" role="alert">
          <span class="material-symbols-outlined text-[14px]">warning</span>
          <span>{{ t('cart.rateUnavailable', { count: unconvertedIds.length }) }}</span>
        </div>

        <!-- Items Article List -->
        <section class="cart-items-card" aria-labelledby="tray-heading">
          <div class="items-card-head">
            <h2 id="tray-heading" class="items-heading">
              <span>{{ t('cart.trayHeading') }}</span>
              <span class="items-count-pill mono">{{ t('cart.itemsCount', { count }) }}</span>
            </h2>
          </div>

          <div class="cart-lines-list">
            <article v-for="it in items" :key="it.product.id" class="cart-line">
              <div class="cart-line__media">
                <div class="cart-thumb" :style="{ background: it.product.imageGradient || 'var(--wl-surface-soft)' }">
                  <AppImage
                    :src="it.product.imageName"
                    placeholder-type="product"
                    :placeholder-text="it.product.sku"
                    :alt="localized(it.product.nameEn, it.product.nameAr)"
                    fit="contain"
                    class="cart-thumb__img"
                  />
                </div>

                <div class="cart-line__details">
                  <h3 class="cart-line__title" dir="auto">{{ localized(it.product.nameEn, it.product.nameAr) }}</h3>
                  <div class="cart-line__title-alt mono" dir="auto" :lang="locale === 'ar' ? 'en' : 'ar'">
                    {{ locale === 'ar' ? it.product.nameEn : it.product.nameAr }}
                  </div>
                  <div class="cart-line__meta mono">
                    <span>SKU: {{ it.product.sku }}</span>
                    <span class="dot">•</span>
                    <span>{{ t('marketplace.minOrder', { qty: it.product.minOrderQty }) }}</span>
                  </div>
                  <div class="cart-line__price mono">
                    <div v-if="(it.product.currencyCode||'USD').toUpperCase()!==targetCurrency" class="orig-price-wrap">
                      <span class="orig-pill">{{ t('cart.originalPrice') }} {{ Math.ceil(it.product.price).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} {{ it.product.currencyCode || 'USD' }}</span>
                      <span class="material-symbols-outlined text-[12px] conv-arrow icon--directional">arrow_forward</span>
                    </div>
                    <div class="active-unit-price">
                      <strong class="active-unit-val">{{ activeCurrencyMeta.symbol }} {{ Math.ceil(getConvertedPrice(it.product)).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</strong>
                      <span class="active-unit-code">{{ targetCurrency }}</span>
                      <span class="active-unit-per">{{ t('account.perUnitShort') }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="cart-line__controls">
                <QuantityStepper
                  :model-value="it.quantity"
                  :min="it.product.minOrderQty"
                  :max="it.product.stock"
                  @update:model-value="setQty(it.product.id, $event)"
                />

                <div class="cart-line__total mono">
                  <span class="total-lbl">{{ t('commerce.subtotal') }}</span>
                  <strong class="total-fig">
                    <span class="total-sym">{{ activeCurrencyMeta.symbol }}</span>
                    <span>{{ Math.ceil(getConvertedPrice(it.product) * it.quantity).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</span>
                    <span class="total-code">{{ targetCurrency }}</span>
                  </strong>
                </div>

                <button
                  type="button"
                  class="line-remove-btn"
                  :title="t('marketplace.remove')"
                  :aria-label="t('marketplace.remove')"
                  @click="handleRemove(it.product.id)"
                >
                  <span class="material-symbols-outlined text-[18px]">delete_outline</span>
                </button>
              </div>
            </article>
          </div>
        </section>
      </main>

      <!-- Right Column: Order / Quote Summary -->
      <aside class="cart-summary-col">
        <div class="summary-card">
          <div class="summary-head">
            <h2 class="summary-title">{{ t('commerce.orderSummary') }}</h2>
            <span class="summary-badge mono">{{ t('cart.directRfqBadge') }}</span>
          </div>

          <div class="summary-rows">
            <div class="summary-row">
              <span class="mono">{{ count }} {{ t('marketplace.products') }}</span>
              <strong class="mono">{{ activeCurrencyMeta.symbol }} {{ Math.ceil(convertedTotal).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} {{ targetCurrency }}</strong>
            </div>

            <div class="summary-divider"></div>

            <div class="summary-row summary-row--total">
              <span class="total-lbl mono">{{ t('commerce.total') }}</span>
              <strong class="total-val mono">
                <span class="total-sym">{{ activeCurrencyMeta.symbol }}</span>
                <span>{{ Math.ceil(convertedTotal).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</span>
                <span class="total-curr">{{ targetCurrency }}</span>
              </strong>
            </div>

            <div class="fx-live-note">
              <span class="material-symbols-outlined text-[15px] text-emerald-600">currency_exchange</span>
              <span>{{ t('cart.currencyHelp') }}</span>
            </div>
          </div>

          <!-- Notes Section -->
          <div class="notes-block">
            <label for="cart-quote-notes" class="notes-lbl mono">{{ t('sales.notes') }}</label>
            <textarea
              id="cart-quote-notes"
              :value="quoteNote"
              :placeholder="t('marketplace.quoteNotePlaceholder')"
              rows="3"
              class="notes-textarea"
              @input="setNote(($event.target as HTMLTextAreaElement).value)"
            ></textarea>
          </div>

          <!-- Actions -->
          <div class="summary-actions">
            <button class="btn btn-primary btn-block btn-lg" type="button" @click="goCheckout">
              <span class="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>
              <span>{{ t('commerce.placeOrder') }} · {{ activeCurrencyMeta.symbol }} {{ Math.ceil(convertedTotal).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} {{ targetCurrency }}</span>
            </button>

            <button
              class="btn btn-ghost btn-block"
              type="button"
              :disabled="submittingRfq"
              @click="submitRfq"
            >
              <span class="material-symbols-outlined text-[18px]">request_quote</span>
              <span>{{ submittingRfq ? t('sales.submittingRfq') : t('sales.submitRfq') }}</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.cart-page {
  width: 100%;
}

.cart-nav {
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

/* Hero Header */
.cart-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1.5rem;
  flex-wrap: wrap;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--wl-border);
  margin-bottom: 2rem;
}

.cart-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 0.35rem;
}

.cart-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--wl-primary);
  box-shadow: 0 0 0 3px var(--wl-primary-soft);
}

.cart-title {
  font-family: var(--wl-font-display);
  font-size: clamp(1.85rem, 3.2vw, 2.4rem);
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  line-height: 1.1;
  margin: 0 0 0.35rem;
}

.cart-desc {
  font-size: 0.95rem;
  color: var(--wl-ink-soft);
  margin: 0;
}

.cart-hero__actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.text-danger {
  color: #DC2626 !important;
}

/* Layout */
.cart-layout {
  display: grid;
  grid-template-columns: 1fr 390px;
  gap: 2.25rem;
  align-items: start;
}

.cart-main {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* =========================================================================
   Active Currency Hub & Smart Switcher
   ========================================================================= */
.currency-hub-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--wl-radius-card, 16px);
  padding: 1.25rem 1.5rem;
  box-shadow: var(--wl-shadow-card, 0 1px 3px rgba(15, 23, 42, 0.05));
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  position: relative;
}

.curr-hub__main {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 240px;
}

.curr-hub__badge-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.fx-live-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 10px;
  font-weight: 700;
  color: #047857;
  background: #ECFDF5;
  border: 1px solid #A7F3D0;
  padding: 0.18rem 0.55rem;
  border-radius: 9999px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.fx-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10B981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
}

.address-curr-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--wl-primary, #4F46E5);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  padding: 0.18rem 0.55rem;
  border-radius: 9999px;
}

.curr-hub__active-hero {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.active-flag {
  font-size: 32px;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.1));
}

.active-titles {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.active-code-line {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.active-code {
  font-size: 1.28rem;
  font-weight: 800;
  color: var(--wl-ink-strong, #0F172A);
  letter-spacing: -0.01em;
  line-height: 1.1;
}

.active-symbol-badge {
  font-size: 12px;
  font-weight: 800;
  color: var(--wl-primary, #4F46E5);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  padding: 0.1rem 0.45rem;
  border-radius: 6px;
  line-height: 1.2;
}

.active-country-desc {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--wl-muted, #64748B);
}

.dot-sep {
  opacity: 0.5;
}

.curr-hub__hint {
  font-size: 11px;
  color: var(--wl-muted, #64748B);
  margin: 0;
  line-height: 1.4;
}

/* Right: Switcher Controls */
.curr-hub__controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 280px;
  max-width: 600px;
}

.chips-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.chips-lbl {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-muted, #64748B);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.btn-refresh-rates {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: transparent;
  border: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--wl-muted, #64748B);
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.btn-refresh-rates:hover:not(:disabled) {
  color: var(--wl-primary, #4F46E5);
  background: var(--wl-primary-soft);
}

.btn-refresh-rates:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spin-anim {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.curr-pills-wrap {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  position: relative;
}

.curr-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 38px;
  padding: 0 0.75rem;
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border, #E2E8F0);
  border-radius: 9px;
  font-size: 12px;
  font-weight: 700;
  color: var(--wl-ink-strong, #0F172A);
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.curr-pill:hover {
  border-color: var(--wl-primary, #4F46E5);
  color: var(--wl-primary, #4F46E5);
  transform: translateY(-1px);
}

.curr-pill.is-active {
  background: var(--wl-primary, #4F46E5);
  border-color: var(--wl-primary, #4F46E5);
  color: #FFFFFF;
  box-shadow: 0 3px 10px rgba(79, 70, 229, 0.3);
}

.curr-pill.is-active .pill-sym {
  background: rgba(255, 255, 255, 0.22);
  color: #FFFFFF;
}

.curr-pill.is-active .check-icon {
  color: #FFFFFF;
}

.pill-flag {
  font-size: 14px;
}

.pill-code {
  font-weight: 800;
}

.pill-sym {
  font-size: 11px;
  opacity: 0.85;
  background: var(--wl-surface-soft);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}

.pill-addr-dot {
  font-size: 11px;
}

.curr-pill--more {
  background: var(--wl-surface-soft);
  border-style: dashed;
  color: var(--wl-muted, #64748B);
}

.curr-pill--more:hover,
.curr-pill--more.is-open {
  border-style: solid;
  border-color: var(--wl-primary, #4F46E5);
  color: var(--wl-primary, #4F46E5);
  background: var(--wl-primary-soft);
}

.chev-icon {
  transition: transform 0.18s ease;
}

.curr-pill--more.is-open .chev-icon {
  transform: rotate(180deg);
}

/* More Currencies Dropdown Popover */
.more-curr-wrapper {
  position: relative;
}

.curr-dropdown-popover {
  position: absolute;
  top: calc(100% + 8px);
  inset-inline-end: 0;
  width: 330px;
  max-width: 90vw;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border, #E2E8F0);
  border-radius: 12px;
  box-shadow: 0 14px 36px -4px rgba(15, 23, 42, 0.15), 0 4px 12px rgba(15, 23, 42, 0.08);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  z-index: 70;
  animation: popoverFadeIn 0.16s ease-out;
}

@keyframes popoverFadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.popover-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-ic {
  position: absolute;
  inset-inline-start: 10px;
  font-size: 18px;
  color: var(--wl-muted, #94A3B8);
  pointer-events: none;
}

.popover-search-input {
  width: 100%;
  height: 38px;
  padding: 0 10px;
  padding-inline-start: 34px;
  padding-inline-end: 28px;
  background: var(--wl-surface-soft);
  border: 1.5px solid var(--wl-border, var(--wl-border));
  border-radius: 8px;
  font-size: 12.5px;
  color: var(--wl-ink-strong, #0F172A);
  outline: none;
  transition: all 0.15s ease;
}

.popover-search-input:focus {
  background: var(--wl-surface);
  border-color: var(--wl-primary, #4F46E5);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.clear-search-btn {
  position: absolute;
  inset-inline-end: 8px;
  background: transparent;
  border: none;
  color: var(--wl-muted, #94A3B8);
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 0.2rem;
}

.popover-items-list {
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-inline-end: 0.2rem;
}

.popover-items-list::-webkit-scrollbar {
  width: 5px;
}
.popover-items-list::-webkit-scrollbar-thumb {
  background: #CBD5E1;
  border-radius: 4px;
}

.popover-item-btn {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.65rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  text-align: start;
  cursor: pointer;
  transition: all 0.14s ease;
  width: 100%;
}

.popover-item-btn:hover {
  background: var(--wl-surface-soft);
  border-color: var(--wl-border, var(--wl-border));
}

.popover-item-btn.is-active {
  background: var(--wl-primary-soft);
  border-color: rgba(var(--wl-primary-rgb), 0.3);
}

.p-flag {
  font-size: 18px;
  flex-shrink: 0;
}

.p-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
  min-width: 0;
}

.p-line-1 {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.p-country {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--wl-ink-strong, #0F172A);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.p-addr-badge {
  font-size: 9.5px;
  font-weight: 700;
  color: var(--wl-primary, #4F46E5);
}

.p-line-2 {
  font-size: 11px;
  color: var(--wl-muted, #64748B);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.p-code-badge {
  font-size: 11px;
  font-weight: 800;
  color: var(--wl-ink-strong, #0F172A);
  background: var(--wl-surface-soft);
  padding: 0.15rem 0.4rem;
  border-radius: 5px;
}

.p-sym-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-primary, #4F46E5);
  background: var(--wl-primary-soft);
  padding: 0.15rem 0.35rem;
  border-radius: 5px;
}

.popover-empty {
  padding: 1.5rem 1rem;
  text-align: center;
  font-size: 12px;
  color: var(--wl-muted, #64748B);
}

.popover-footer {
  padding-top: 0.45rem;
  border-top: 1px solid var(--wl-border, #F1F5F9);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--wl-muted, #94A3B8);
  text-align: center;
}

.rate-warn {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 1.15rem;
  background: var(--wl-warning-soft);
  border: 1px solid var(--wl-warning);
  color: var(--wl-amber);
  border-radius: 10px;
  font-size: 11.5px;
  font-weight: 600;
}

/* Items Card */
.cart-items-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 14px;
  padding: 1.5rem;
  box-shadow: var(--wl-shadow-card);
}

.items-card-head {
  margin-bottom: 1.25rem;
}

.items-heading {
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

.items-count-pill {
  font-size: 11px;
  font-weight: 600;
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
}

/* Lines */
.cart-lines-list {
  display: flex;
  flex-direction: column;
}

.cart-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--wl-surface-soft);
  flex-wrap: wrap;
}

.cart-line:last-child {
  border-bottom: none;
}

.cart-line__media {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 260px;
}

.cart-thumb {
  width: 64px;
  height: 64px;
  border-radius: 10px;
  border: 1px solid var(--wl-border);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}

.cart-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cart-line__details {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
  min-width: 0;
}

.cart-line__title {
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.3;
}

.cart-line__title-alt {
  font-size: 11px;
  color: var(--wl-muted);
}

.cart-line__meta {
  font-size: 11px;
  color: var(--wl-muted);
  display: flex;
  gap: 0.4rem;
}

.cart-line__price {
  font-size: 11.5px;
  color: var(--wl-ink-strong);
  font-weight: 600;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.orig-price-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.orig-pill {
  font-size: 10.5px;
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
}

.conv-arrow {
  color: var(--wl-muted);
}

.active-unit-price {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
}

.active-unit-val {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
}

.active-unit-code {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-muted);
}

.active-unit-per {
  font-size: 11px;
  color: var(--wl-muted);
}

.cart-line__controls {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-shrink: 0;
}

.cart-line__total {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
  min-width: 110px;
}

.total-lbl {
  font-size: 9.5px;
  color: var(--wl-muted);
  letter-spacing: 0.05em;
}

.total-fig {
  font-size: 14px;
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.line-remove-btn {
  background: none;
  border: 1px solid var(--wl-border);
  width: 34px;
  height: 34px;
  border-radius: 8px;
  color: var(--wl-muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.15s ease;
}

.line-remove-btn:hover {
  background: rgba(220, 38, 38, 0.08);
  border-color: rgba(220, 38, 38, 0.3);
  color: #DC2626;
}

/* Summary Column */
.cart-summary-col {
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
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
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
  font-size: 13px;
}

.summary-divider {
  height: 1px;
  background: var(--wl-border);
  margin: 0.4rem 0;
}

.summary-row--total {
  font-size: 14px;
}

.total-lbl {
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

.total-sym {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--wl-primary);
  margin-inline-end: 0.25rem;
}

.total-code {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-muted);
  margin-inline-start: 0.35rem;
}

.sum-code {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-muted);
  margin-inline-start: 0.3rem;
}

.fx-live-note {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.65rem 0.85rem;
  background: var(--wl-success-soft);
  border: 1px solid var(--wl-border);
  border-radius: 8px;
  font-size: 11.5px;
  color: var(--wl-success);
  margin-top: 0.75rem;
  line-height: 1.4;
}

/* Notes Block */
.notes-block {
  margin: 1.25rem 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.notes-lbl {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.05em;
}

.notes-textarea {
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  padding: 0.75rem 0.9rem;
  background: var(--wl-surface);
  font-family: var(--wl-font-body);
  font-size: 13px;
  color: var(--wl-ink-strong);
  resize: vertical;
  line-height: 1.5;
  transition: border-color 0.18s var(--wl-ease-spring), box-shadow 0.18s var(--wl-ease-spring);
}

.notes-textarea:focus {
  outline: none;
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.summary-actions {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

@media (max-width: 980px) {
  .cart-layout {
    grid-template-columns: 1fr;
  }
  .cart-summary-col {
    position: static;
  }
}
</style>
