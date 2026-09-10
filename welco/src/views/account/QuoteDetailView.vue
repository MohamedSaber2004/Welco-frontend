<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { commerceService, companyService, salesService, services } from '../../di/container'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import AccountNav from '../../components/account/AccountNav.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import DataState from '../../components/ui/DataState.vue'
import BackButton from '../../components/ui/BackButton.vue'
import type { QuoteDto } from '../../domain/models/sales'

const route = useRoute()
const router = useRouter()
const quote = ref<QuoteDto | null>(null)
const loading = ref(true)
const acting = ref(false)
const placingOrder = ref(false)

const localized = (en: string, ar: string) => (locale.value === 'ar' ? ar : en)

onMounted(async () => {
  try {
    const id = String(route.params.id)
    const found = await salesService.getQuote(id)
    quote.value = found
  } finally {
    loading.value = false
  }
})

async function decide(approve: boolean) {
  if (!quote.value) return
  const ok = await confirmService.confirm({
    title: t(approve ? 'sales.approve' : 'sales.decline'),
    message: t(approve ? 'sales.approveConfirm' : 'sales.declineConfirm'),
    variant: approve ? 'primary' : 'danger',
    confirmText: t(approve ? 'sales.approve' : 'sales.decline'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return
  acting.value = true
  try {
    const res = approve
      ? await salesService.approveQuote(quote.value.id)
      : await salesService.declineQuote(quote.value.id)
    if (res.ok) {
      const refreshed = await salesService.getQuote(quote.value.id)
      if (refreshed) quote.value = refreshed
    } else {
      toastService.error(res.error)
    }
  } finally {
    acting.value = false
  }
}

async function placeOrderFromQuote() {
  if (!quote.value || !quote.value.items.length || placingOrder.value) return
  const ok = await confirmService.confirm({
    title: t('sales.placeOrder'),
    message: t('sales.placeOrderConfirm'),
    variant: 'primary',
    confirmText: t('sales.placeOrder'),
    cancelText: t('common.cancel'),
  })
  if (!ok) return
  placingOrder.value = true
  try {
    // The order belongs to the company that owns the RFQ this quote answers.
    let companyId: string | undefined
    const rfq = await salesService.getRfq(quote.value.rfqId)
    companyId = rfq?.companyId
    if (!companyId) {
      await companyService.loadMyCompany().catch(() => {})
      companyId = companyService.myCompany.value?.id ?? undefined
    }
    if (!companyId) {
      toastService.info(t('distributor.pendingApproval'))
      return
    }
    // Customer-only: ensure quote belongs to my company
    const myCompanyId = companyService.myCompany.value?.id
    if (myCompanyId && rfq && rfq.companyId !== myCompanyId) {
      toastService.error(t('common.error'))
      return
    }
    const currencyCode = quote.value.currency || 'USD'
    const currencyId = services.marketplaceService.currencies.value.find((c) => c.code === currencyCode)?.id
    const res = await commerceService.placeOrder({
      companyId,
      currencyId,
      currencyCode,
      quoteId: quote.value.id,
      items: quote.value.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    })
    if (res.ok && res.order) {
      void router.push({ name: 'account-order-detail', params: { id: res.order.id } })
    } else if (!res.ok) {
      toastService.error(res.error)
    }
  } finally {
    placingOrder.value = false
  }
}
</script>

<template>
  <div class="page-shell quote-detail-view">
    <BackButton fallback="/account/quotes" variant="minimal" class="mb-3" />

    <!-- Breadcrumb -->
    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/account">{{ t('account.dashboard') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <router-link to="/account/quotes">{{ t('sales.quoteTitle') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ quote?.quoteNumber ?? '…' }}</span>
    </nav>

    <SkeletonLoader v-if="loading" type="card" :lines="6" height="220px" />
    <DataState
      v-else-if="!quote"
      :empty="true"
      :empty-title="t('sales.noQuotes')"
      :empty-description="t('sales.noQuotesDesc')"
      :action-text="t('account.quotes')"
      min-height="320px"
      @action="router.push({ name: 'account-quotes' })"
    />

    <template v-else-if="quote">
      <!-- Executive Header -->
      <header class="detail-header">
        <div class="header-main">
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('account.quoteDossier', { count: quote.items.length }) }}</span>
          </div>
          <h1 class="mono quote-heading">{{ quote.quoteNumber }}</h1>
          <p class="mono quote-sub">
            <span>{{ t('account.refRfq', { number: quote.rfqNumber ?? '' }) }}</span>
            <span>•</span>
            <span>{{ t('account.validThroughDate', { date: new Date(quote.validUntil).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }) }}</span>
          </p>
        </div>

        <StatusPill :status="quote.status" />
      </header>

      <!-- Account Navigation Tab Bar -->
      <AccountNav />

      <!-- Detail 2-Column Grid -->
      <div class="detail-grid">
        <!-- Main: Line items -->
        <main class="manifest-card">
          <div class="manifest-head">
            <div class="manifest-title-group">
              <span class="material-symbols-outlined text-[18px] text-indigo-600">format_list_bulleted</span>
              <h2 class="manifest-title">{{ t('sales.lineItems') }}</h2>
            </div>
            <span class="mono item-chip">{{ t('account.itemsCount', { count: quote.items.length }) }}</span>
          </div>

          <div class="items-stack">
            <article v-for="it in quote.items" :key="it.id" class="line-item-row">
              <div class="item-primary">
                <h3 class="item-title">{{ localized(it.productNameEn, it.productNameAr || it.productNameEn) }}</h3>
                <div class="item-math mono">
                  <span>{{ t('account.qtyUnits', { count: it.quantity }) }}</span>
                  <span>•</span>
                  <span>{{ Math.ceil(it.unitPrice).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} {{ quote.currency || 'USD' }} {{ t('account.perUnitShort') }}</span>
                </div>
              </div>

              <div class="item-subtotal mono">
                {{ Math.ceil(it.quantity * it.unitPrice).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} {{ quote.currency || 'USD' }}
              </div>
            </article>
          </div>
        </main>

        <!-- Sidebar: Commercial Summary & Decisions -->
        <aside class="side-panel">
          <section class="card amount-card">
            <h2 class="side-title mono">{{ t('sales.amount') }}</h2>
            <div class="amount-val-box">
              <span class="mono amount-label">{{ t('commerce.total') }}</span>
              <strong class="mono amount-big">
                ${{ Math.ceil(quote.amount).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} {{ quote.currency || 'USD' }}
              </strong>
            </div>
            <div class="validity-row mono">
              <span class="material-symbols-outlined text-[15px] text-slate-400">schedule</span>
              <span>{{ t('account.validThroughDate', { date: new Date(quote.validUntil).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }) }}</span>
            </div>
          </section>

          <!-- Decision Action Block if Sent or Draft -->
          <section
            v-if="quote.status === 'Sent' || quote.status === 'Draft'"
            class="card decision-card"
          >
            <h2 class="side-title mono">{{ t('account.quotesAwaiting') }}</h2>
            <p class="decision-desc mono">{{ t('sales.convertedToOrder') }}</p>

            <div class="decision-btns-stack">
              <button
                class="btn-approve mono"
                type="button"
                :disabled="acting"
                @click="decide(true)"
              >
                <span class="material-symbols-outlined text-[18px]">verified</span>
                <span>{{ acting ? t('account.processing') : t('sales.approve') }}</span>
              </button>
              <button
                class="btn-decline mono"
                type="button"
                :disabled="acting"
                @click="decide(false)"
              >
                <span class="material-symbols-outlined text-[18px]">cancel</span>
                <span>{{ t('sales.decline') }}</span>
              </button>
            </div>
          </section>

          <!-- Approved State Banner -->
          <section v-else-if="quote.status === 'Approved'" class="card approved-card">
            <div class="approved-head mono">
              <span class="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{{ t('sales.statusApproved') }}</span>
            </div>
            <p class="decision-desc mono">{{ t('sales.convertedToOrder') }}</p>
            <button
              class="btn-place-order mono"
              type="button"
              :disabled="placingOrder || !quote.items.length"
              @click="placeOrderFromQuote"
            >
              <span class="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>
              <span>{{ placingOrder ? t('sales.placingOrder') : t('sales.placeOrder') }}</span>
            </button>
            <button
              class="btn-view-order mono btn-view-order--secondary"
              type="button"
              @click="router.push({ name: 'account-orders' })"
            >
              <span class="material-symbols-outlined text-[16px]">receipt_long</span>
              <span>{{ t('account.orders') }}</span>
            </button>
          </section>

          <!-- Action Stack -->
          <div class="side-actions-stack">
            <button
              type="button"
              class="btn-back-quotes mono"
              @click="router.push({ name: 'account-quotes' })"
            >
              <span class="material-symbols-outlined text-[16px] icon--directional">arrow_back</span>
              <span>{{ t('account.backToQuotes') }}</span>
            </button>
            <button
              type="button"
              class="btn-back-quotes mono"
              @click="router.push({ name: 'account-rfq-detail', params: { id: quote.rfqId } })"
            >
              <span class="material-symbols-outlined text-[16px]">description</span>
              <span>{{ t('sales.rfqDetail') }}</span>
            </button>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.quote-detail-view {
  width: 100%;
}

.crumb-bar {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 11px;
  color: var(--wl-muted);
}

.crumb-bar a {
  color: var(--wl-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.crumb-bar a:hover {
  color: var(--wl-primary);
}

.crumb-sep {
  color: var(--wl-muted-soft);
}

.crumb-active {
  color: var(--wl-ink-strong);
  font-weight: 700;
}

/* Header */
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.header-main {
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
  background: var(--wl-primary);
}

.quote-heading {
  font-size: 1.68rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.1;
}

.quote-sub {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 11.5px;
  color: var(--wl-muted);
  margin: 0.35rem 0 0;
}

/* Detail 2-Column Grid */
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: var(--wl-page-gap, 1.5rem);
  align-items: start;
}

.manifest-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border, #E2E8F0);
  border-radius: var(--wl-radius-card, 16px);
  padding: var(--wl-card-padding, 1.5rem);
  box-shadow: var(--wl-shadow-card, 0 1px 3px rgba(0, 10, 25, 0.05));
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.manifest-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--wl-border);
}

.manifest-title-group {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.manifest-title {
  font-size: 14.5px;
  font-weight: 800;
  color: var(--wl-ink-strong, #0F172A);
  margin: 0;
}

.item-chip {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border, var(--wl-border));
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
}

.items-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.line-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--wl-border);
}

.item-primary {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.item-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--wl-ink-strong, #0F172A);
  margin: 0;
}

.item-math {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 11.5px;
  color: var(--wl-muted, #64748B);
}

.item-subtotal {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wl-ink-strong, #0F172A);
}

/* Sidebar */
.side-panel {
  display: flex;
  flex-direction: column;
  gap: var(--wl-page-gap, 1.25rem);
}

.card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border, #E2E8F0);
  border-radius: var(--wl-radius-card, 16px);
  padding: var(--wl-card-padding, 1.25rem);
  box-shadow: var(--wl-shadow-card, 0 1px 3px rgba(0, 10, 25, 0.05));
}

.side-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--wl-primary, #69a9ff);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin: 0 0 0.75rem;
}

.amount-val-box {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--wl-border);
}

.amount-label {
  font-size: 11px;
  color: var(--wl-muted);
  font-weight: 700;
}

.amount-big {
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.validity-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 11.5px;
  color: var(--wl-muted);
  margin-top: 0.65rem;
}

.decision-desc {
  font-size: 12px;
  color: var(--wl-muted);
  line-height: 1.45;
  margin: 0 0 1rem;
}

.decision-btns-stack {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.btn-approve {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 48px;
  background: var(--wl-success);
  color: var(--wl-on-primary);
  border: none;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px -2px rgba(5, 150, 105, 0.35);
  transition: all 0.18s ease;
}

.btn-approve:hover:not(:disabled) {
  background: #047857;
}

.btn-decline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 44px;
  background: var(--wl-surface);
  color: var(--wl-danger);
  border: 1.5px solid rgba(237, 66, 69, 0.35);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-decline:hover:not(:disabled) {
  background: var(--wl-danger-soft);
}

.approved-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 12px;
  font-weight: 800;
  color: var(--wl-success);
  margin-bottom: 0.4rem;
}

.btn-view-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 46px;
  width: 100%;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.btn-place-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 48px;
  width: 100%;
  background: var(--wl-success);
  color: var(--wl-on-primary);
  border: none;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px -2px rgba(5, 150, 105, 0.35);
  transition: all 0.18s ease;
  margin-bottom: 0.65rem;
}

.btn-place-order:hover:not(:disabled) {
  background: #047857;
}

.btn-place-order:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-view-order--secondary {
  background: var(--wl-surface);
  color: var(--wl-primary);
  border: 1.5px solid rgba(var(--wl-primary-rgb), 0.3);
}

.side-actions-stack {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.btn-back-quotes {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 46px;
  background: var(--wl-surface);
  color: var(--wl-ink-soft);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-back-quotes:hover {
  border-color: var(--wl-primary);
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
}

@media (max-width: 900px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>

