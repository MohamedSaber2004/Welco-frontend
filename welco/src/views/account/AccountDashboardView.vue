<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { authService, salesService, commerceService, companyService } from '../../di/container'
import AccountNav from '../../components/account/AccountNav.vue'
import StatCard from '../../components/ui/StatCard.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import ErrorState from '../../components/ui/ErrorState.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import { useWishlist } from '../../composables/useWishlist'

const { wishlistIds } = useWishlist()
const router = useRouter()
const loadError = ref<string | null>(null)

const loading = computed(() => salesService.loading.value || commerceService.loading.value || companyService.loading.value)

const user = computed(() => authService.user.value)
const myCompany = computed(() => companyService.myCompany.value)

const openRfqs = computed(() => salesService.rfqs.value.filter((r) => r.status === 'Pending').length)
const quotesAwaiting = computed(() => salesService.quotes.value.filter((q) => q.status === 'Sent' || q.status === 'Draft').length)
const activeOrders = computed(() => commerceService.orders.value.filter((o) => o.status !== 'Delivered' && o.status !== 'Cancelled').length)
const ytdValue = computed(() => {
  const year = new Date().getFullYear()
  return commerceService.orders.value
    .filter((o) => new Date(o.createdAt).getFullYear() === year)
    .reduce((s, o) => s + o.totalAmount, 0)
})

const awaitingQuotes = computed(() => salesService.quotes.value.filter((q) => q.status === 'Sent' || q.status === 'Draft'))
const recentRfqs = computed(() => salesService.rfqs.value.slice(0, 4))
const orderCurrency = computed(() => commerceService.orders.value[0]?.currencyCode || 'USD')
const wishlistCount = computed(() => wishlistIds.value.length)

const realOrderSpendSparkline = computed(() => {
  const orders = commerceService.orders.value
  if (!orders.length) return undefined
  const months: number[] = [0, 0, 0, 0, 0, 0]
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const ym = `${new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7)}`
    const sum = orders.filter((o) => o.createdAt?.startsWith(ym)).reduce((acc, o) => acc + o.totalAmount, 0)
    months[5 - i] = Math.round(sum)
  }
  return months.some((v) => v > 0) ? months : undefined
})

const realRfqSparkline = computed(() => {
  const rfqs = salesService.rfqs.value
  if (!rfqs.length) return undefined
  const months: number[] = [0, 0, 0, 0, 0, 0]
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const ym = `${new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7)}`
    const count = rfqs.filter((r) => r.createdAt?.startsWith(ym)).length
    months[5 - i] = count
  }
  return months.some((v) => v > 0) ? months : undefined
})

const procurementPipeline = computed(() => {
  const allOrders = commerceService.orders.value
  const allRfqs = salesService.rfqs.value
  const allQuotes = salesService.quotes.value

  const pendingRfqs = allRfqs.filter((r) => r.status === 'Pending').length
  const actionableQuotes = allQuotes.filter((q) => q.status === 'Sent' || q.status === 'Draft').length
  const processingOrders = allOrders.filter((o) => o.status === 'Pending' || o.status === 'Confirmed').length
  const deliveredOrders = allOrders.filter((o) => o.status === 'Delivered').length

  const total = pendingRfqs + actionableQuotes + processingOrders + deliveredOrders || 1

  return [
    { label: t('account.pipeRfq'), count: pendingRfqs, pct: Math.round((pendingRfqs / total) * 100), color: '#F59E0B', icon: 'request_quote', to: '/account/rfqs', status: t('account.pipeStatusPending') },
    { label: t('account.pipeQuotes'), count: actionableQuotes, pct: Math.round((actionableQuotes / total) * 100), color: '#10B981', icon: 'description', to: '/account/quotes', status: t('account.pipeStatusAwaiting') },
    { label: t('account.pipeProduction'), count: processingOrders, pct: Math.round((processingOrders / total) * 100), color: '#4F46E5', icon: 'precision_manufacturing', to: '/account/orders', status: t('account.pipeStatusManufacturing') },
    { label: t('account.pipeDelivered'), count: deliveredOrders, pct: Math.round((deliveredOrders / total) * 100), color: '#64748B', icon: 'verified', to: '/account/orders', status: t('account.pipeStatusReceived') },
  ]
})

async function loadDashboard(): Promise<void> {
  loadError.value = null
  try {
    await Promise.allSettled([
      salesService.loadAll(),
      commerceService.loadOrders(),
      companyService.loadMyCompany(),
    ])
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(loadDashboard)
</script>

<template>
  <div class="page-shell org-shell">
    <nav class="org-crumb mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/">{{ t('nav.home') }}</router-link>
      <span class="crumb-sep icon--directional" aria-hidden="true">/</span>
      <span class="crumb-current">{{ t('account.dashboard') }}</span>
    </nav>

    <header class="org-head">
      <div class="org-head__main">
        <div class="org-eyebrow mono">
          <span class="live-dot" aria-hidden="true"></span>
          <span>{{ t('account.deskEyebrow') }}</span>
        </div>
        <h1 class="org-title">
          {{ user?.fullName ? t('account.welcomeBack', { name: user.fullName }) : t('account.dashboard') }}
        </h1>
        <p class="org-desc">
          {{ t('account.dashboardSubtitle') }}
        </p>

        <div class="org-head__actions">
          <BaseButton
            variant="primary"
            size="sm"
            @click="router.push({ name: 'marketplace' })"
          >
            <span class="material-symbols-outlined text-[16px]">add</span>
            <span>{{ t('account.newRfq') }}</span>
          </BaseButton>

          <BaseButton
            variant="ghost"
            size="sm"
            @click="router.push({ name: 'certifications' })"
          >
            <span class="material-symbols-outlined text-[16px]">verified</span>
            <span>{{ t('account.isoDossier') }}</span>
          </BaseButton>
        </div>
      </div>

      <div v-if="myCompany" class="org-company-card">
        <div class="company-card__top">
          <div class="company-card__avatar">
            <span class="material-symbols-outlined">domain</span>
          </div>
          <div class="company-card__meta">
            <span class="mono company-card__role">{{ t('account.verifiedBuyer') }}</span>
            <strong class="company-card__name">{{ myCompany.name }}</strong>
          </div>
        </div>

        <div class="company-card__details">
          <span class="company-pill company-pill--verified mono">
            <span class="pill-dot"></span>
            {{ t('account.verifiedPartner') }}
          </span>
          <span class="company-pill mono">
            {{ t('account.tierLevel', { tier: myCompany.tierLevel }) }}
          </span>
          <span v-if="myCompany.countryNameEn" class="company-country mono">
            {{ myCompany.countryNameEn }}
          </span>
        </div>
      </div>
    </header>

    <AccountNav />

    <ErrorState v-if="loadError" :message="loadError" @retry="loadDashboard" />
    <div v-else-if="loading" class="dashboard-skeleton-wrap">
      <SkeletonLoader type="stats-grid" :count="4" />
      <div style="margin-top: 1.5rem">
        <SkeletonLoader type="table" :count="4" />
      </div>
    </div>

    <template v-else>
      <div class="stats-grid">
        <StatCard
          :label="t('account.statOpenRfqs')"
          :value="openRfqs"
          to="/account/rfqs"
          tone="amber"
          :trend="openRfqs > 0 ? t('account.trendActive', { count: openRfqs }) : t('account.trendNone')"
          :sparkline="realRfqSparkline"
        >
          <template #icon><span class="material-symbols-outlined text-[18px]">request_quote</span></template>
        </StatCard>

        <StatCard
          :label="t('account.statQuotes')"
          :value="quotesAwaiting"
          to="/account/quotes"
          tone="emerald"
          :trend="quotesAwaiting > 0 ? t('account.trendAwaiting', { count: quotesAwaiting }) : t('account.trendUpToDate')"
        >
          <template #icon><span class="material-symbols-outlined text-[18px]">description</span></template>
        </StatCard>

        <StatCard
          :label="t('account.statActiveOrders')"
          :value="activeOrders"
          to="/account/orders"
          tone="indigo"
          :trend="activeOrders > 0 ? t('account.trendProcessing', { count: activeOrders }) : t('account.trendNone')"
          :sparkline="realOrderSpendSparkline"
        >
          <template #icon><span class="material-symbols-outlined text-[18px]">receipt_long</span></template>
        </StatCard>

        <StatCard
          :label="t('account.statYtd')"
          :value="`${Math.ceil(ytdValue).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')} ${orderCurrency}`"
          tone="slate"
          :trend="t('account.trendYtd')"
          :sparkline="realOrderSpendSparkline"
        >
          <template #icon><span class="material-symbols-outlined text-[18px]">payments</span></template>
        </StatCard>
      </div>

      <section class="card pipeline-card">
        <div class="pipeline-head">
          <div>
            <div class="pipeline-eyebrow mono">
              <span class="live-dot" aria-hidden="true"></span>
              <span>{{ t('account.pipelineEyebrow') }}</span>
            </div>
            <h2 class="pipeline-title">{{ t('account.pipelineTitle') }}</h2>
          </div>
          <span class="pipeline-counter mono">{{ t('account.activeLifecycle', { count: openRfqs + quotesAwaiting + activeOrders }) }}</span>
        </div>

        <div class="pipeline-stepper">
          <router-link
            v-for="step in procurementPipeline"
            :key="step.label"
            :to="step.to"
            class="pipeline-step"
            :class="{ 'is-active': step.count > 0 }"
          >
            <div class="step-meta">
              <span class="material-symbols-outlined step-icon" :style="{ color: step.color }">{{ step.icon }}</span>
              <span class="step-label mono">{{ step.label }}</span>
            </div>
            <div class="step-count-box">
              <strong class="step-count mono">{{ step.count }}</strong>
              <span class="step-status mono">{{ step.status }}</span>
            </div>
            <div class="step-bar">
              <div class="step-bar__fill" :style="{ width: `${Math.max(step.pct, step.count > 0 ? 15 : 6)}%`, background: step.color }"></div>
            </div>
          </router-link>
        </div>
      </section>

      <div class="dash-grid">
        <section class="workbench-card">
          <div class="card-head">
            <div>
              <div class="card-eyebrow mono">
                <span class="material-symbols-outlined text-[14px]">fact_check</span>
                <span>{{ t('account.actionRequired') }}</span>
              </div>
              <h2 class="card-title">{{ t('sales.quoteTitle') }} · {{ t('account.quotesAwaiting') }}</h2>
            </div>
          </div>

          <div v-if="!awaitingQuotes.length" class="empty-tray">
            <div class="empty-icon-box">
              <span class="material-symbols-outlined text-[24px]">task_alt</span>
            </div>
            <p class="empty-text mono">{{ t('account.nothingAwaiting') }}</p>
            <span class="empty-hint">{{ t('account.reviewQuotesHint') }}</span>
          </div>

          <div v-else class="quote-list">
            <div
              v-for="q in awaitingQuotes"
              :key="q.id"
              class="quote-item"
              @click="router.push({ name: 'account-quote-detail', params: { id: q.id } })"
            >
              <div class="quote-left">
                <div class="quote-header-line">
                  <span class="quote-num mono">{{ q.quoteNumber }}</span>
                  <span class="quote-validity mono">{{ t('account.validUntilDate', { date: new Date(q.validUntil).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }) }}</span>
                </div>
                <div class="quote-rfq mono">{{ t('account.rfqRef', { number: q.rfqNumber ?? '' }) }}</div>
              </div>

              <div class="quote-right">
                <span class="quote-amount mono-num">
                  {{ Math.ceil(q.amount).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} {{ q.currency || 'USD' }}
                </span>
                <StatusPill :status="q.status" />
              </div>
            </div>
          </div>
        </section>

        <section class="workbench-card">
          <div class="card-head">
            <div>
              <div class="card-eyebrow mono">
                <span class="material-symbols-outlined text-[14px]">list_alt</span>
                <span>{{ t('account.inquiryQueue') }}</span>
              </div>
              <h2 class="card-title">{{ t('sales.rfqTitle') }}</h2>
            </div>
          </div>

          <div v-if="!recentRfqs.length" class="empty-tray">
            <div class="empty-icon-box">
              <span class="material-symbols-outlined text-[24px]">post_add</span>
            </div>
            <p class="empty-text mono">{{ t('sales.noRfqs') }}</p>
            <span class="empty-hint">{{ t('sales.noRfqsDesc') }}</span>
            <BaseButton
              variant="outline"
              size="sm"
              style="margin-top: 0.75rem"
              @click="router.push({ name: 'marketplace' })"
            >
              {{ t('account.createFirstRfq') }}
            </BaseButton>
          </div>

          <div v-else class="quote-list">
            <div
              v-for="r in recentRfqs"
              :key="r.id"
              class="quote-item"
              @click="router.push({ name: 'account-rfq-detail', params: { id: r.id } })"
            >
              <div class="quote-left">
                <div class="quote-header-line">
                  <span class="quote-num mono">{{ r.rfqNumber }}</span>
                  <span class="quote-validity mono">{{ new Date(r.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</span>
                </div>
                <div class="quote-rfq mono">{{ t('account.productsSpecified', { count: r.items.length }) }}</div>
              </div>

              <div class="quote-right">
                <span class="quote-amount mono-num">
                  ${{ Math.ceil(r.total ?? 0).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}
                </span>
                <StatusPill :status="r.status" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <section class="bento-section">
        <div class="bento-head">
          <div class="bento-title-group">
            <span class="mono bento-tag">{{ t('account.bentoTag') }}</span>
            <h3 class="bento-title">{{ t('account.bentoTitle') }}</h3>
          </div>
          <span class="mono bento-note">{{ t('account.bentoNote') }}</span>
        </div>

        <div class="bento-grid">
          <router-link to="/account/orders" class="bento-card">
            <div class="bento-icon-box bento-icon--indigo">
              <span class="material-symbols-outlined">receipt_long</span>
            </div>
            <div class="bento-content">
              <span class="mono bento-item-tag">{{ t('account.bentoOrdersTag') }}</span>
              <strong class="bento-item-title">{{ t('account.bentoOrdersTitle') }}</strong>
              <p class="bento-item-desc">{{ t('account.bentoOrdersDesc') }}</p>
            </div>
            <span class="material-symbols-outlined icon--directional bento-arrow">arrow_forward</span>
          </router-link>

          <router-link to="/certifications" class="bento-card">
            <div class="bento-icon-box bento-icon--emerald">
              <span class="material-symbols-outlined">verified_user</span>
            </div>
            <div class="bento-content">
              <span class="mono bento-item-tag">{{ t('account.bentoCertsTag') }}</span>
              <strong class="bento-item-title">{{ t('account.bentoCertsTitle') }}</strong>
              <p class="bento-item-desc">{{ t('account.bentoCertsDesc') }}</p>
            </div>
            <span class="material-symbols-outlined icon--directional bento-arrow">arrow_forward</span>
          </router-link>

          <router-link to="/wishlist" class="bento-card">
            <div class="bento-icon-box bento-icon--amber">
              <span class="material-symbols-outlined">bookmark</span>
            </div>
            <div class="bento-content">
              <span class="mono bento-item-tag">{{ t('account.bentoFavTag') }}</span>
              <strong class="bento-item-title">{{ t('account.bentoFavTitle', { count: wishlistCount }) }}</strong>
              <p class="bento-item-desc">{{ t('account.bentoFavDesc') }}</p>
            </div>
            <span class="material-symbols-outlined icon--directional bento-arrow">arrow_forward</span>
          </router-link>

          <router-link to="/addresses" class="bento-card">
            <div class="bento-icon-box bento-icon--slate">
              <span class="material-symbols-outlined">local_hospital</span>
            </div>
            <div class="bento-content">
              <span class="mono bento-item-tag">{{ t('account.bentoAddrTag') }}</span>
              <strong class="bento-item-title">{{ t('account.bentoAddrTitle') }}</strong>
              <p class="bento-item-desc">{{ t('account.bentoAddrDesc') }}</p>
            </div>
            <span class="material-symbols-outlined icon--directional bento-arrow">arrow_forward</span>
          </router-link>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.org-shell {
  max-width: var(--wl-max-width);
  margin: 0 auto;
  padding: var(--wl-page-padding-top) var(--wl-gutter) var(--wl-page-padding-bottom);
  padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left));
  padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right));
  width: 100%;
  box-sizing: border-box;
}

.org-crumb {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
  color: var(--wl-muted);
  background: var(--wl-surface);
  padding: 0.35rem 0.8rem;
  border-radius: 9999px;
  border: 1px solid var(--wl-border);
  margin-bottom: 1.5rem;
}

.org-crumb a {
  color: var(--wl-muted);
  text-decoration: none;
  transition: color 0.15s;
}

.org-crumb a:hover {
  color: var(--wl-ink-strong);
}

.crumb-sep {
  opacity: 0.45;
  font-size: 11px;
}

.crumb-current {
  color: var(--wl-ink-strong);
  font-weight: 600;
}

.org-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
  margin-bottom: 1.75rem;
  flex-wrap: wrap;
}

.org-head__main {
  flex: 1;
  min-width: 0;
  width: 100%;
}

.org-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 11px;
  color: #4F46E5;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 0.5rem;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10B981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
}

.org-title {
  font-size: clamp(1.8rem, 3.2vw, 2.5rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--wl-ink-strong);
  line-height: 1.1;
  margin: 0 0 0.5rem;
}

.org-desc {
  font-size: 14.5px;
  color: var(--wl-ink-soft);
  max-width: 600px;
  line-height: 1.55;
  margin: 0 0 1.25rem;
}

.org-head__actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.org-company-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 12px;
  padding: 1.15rem 1.4rem;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 280px;
  border-inline-start: 3px solid #6366F1;
}

.company-card__top {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.company-card__avatar {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.1);
  color: #4F46E5;
  display: grid;
  place-items: center;
  font-size: 20px;
}

.company-card__meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.company-card__role {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #4F46E5;
}

.company-card__name {
  font-size: 14px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  letter-spacing: -0.01em;
}

.company-card__details {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.company-pill {
  font-size: 10.5px;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  color: var(--wl-ink-soft);
}

.company-pill--verified {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.25);
  color: #059669;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.pill-dot {
  width: 4.5px;
  height: 4.5px;
  border-radius: 50%;
  background: #10B981;
}

.company-country {
  font-size: 11px;
  color: var(--wl-muted);
}


.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
  margin-bottom: 1.75rem;
}
    .pipeline-card {
      padding: 1.4rem 1.6rem;
      background: var(--wl-surface);
      border: 1px solid var(--wl-border);
      border-radius: 14px;
      box-shadow: var(--wl-shadow-card);
      margin-bottom: 1.75rem;
      position: relative;
      overflow: hidden;
    }

      .pipeline-card::before {
        content: '';
        position: absolute;
        top: 0;
        inset-inline: 0;
        height: 2px;
        background: linear-gradient(90deg, #F59E0B, #10B981, #4F46E5, #6366F1);
        opacity: 0.85;
      }

    .pipeline-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 1rem;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
    }

    .pipeline-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 10.5px;
      color: #4F46E5;
      font-weight: 700;
      letter-spacing: 0.08em;
      margin-bottom: 0.25rem;
    }

    .pipeline-title {
      font-family: var(--wl-font-display);
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.015em;
      color: var(--wl-ink-strong);
      margin: 0;
    }

    .pipeline-counter {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--wl-muted);
      background: var(--wl-surface-soft);
      border: 1px solid var(--wl-border);
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
    }

    .pipeline-stepper {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.85rem;
    }

    .pipeline-step {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.85rem 0.95rem;
      background: var(--wl-surface-soft);
      border: 1px solid var(--wl-border);
      border-radius: 10px;
      text-decoration: none;
      color: inherit;
      transition: transform 0.16s var(--wl-ease-spring), border-color 0.16s ease, box-shadow 0.16s ease;
    }

      .pipeline-step:hover {
        border-color: rgba(79, 70, 229, 0.35);
        box-shadow: var(--shadow-sm);
        transform: translateY(-1.5px);
      }

      .pipeline-step.is-active {
        background: var(--wl-surface);
        border-color: var(--wl-border);
      }

    .step-meta {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .step-icon {
      font-size: 17px;
    }

    .step-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--wl-ink-strong);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .step-count-box {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .step-count {
      font-size: 1.35rem;
      font-weight: 800;
      line-height: 1;
      color: var(--wl-ink-strong);
    }

    .step-status {
      font-size: 10px;
      color: var(--wl-muted);
      font-weight: 600;
      text-align: end;
      white-space: nowrap;
    }

    .step-bar {
      height: 5px;
      background: rgba(0, 0, 0, 0.06);
      border-radius: 9999px;
      overflow: hidden;
      margin-top: 0.15rem;
    }

    :root[data-theme='dark'] .step-bar {
      background: rgba(255, 255, 255, 0.08);
    }

    .step-bar__fill {
      height: 100%;
      border-radius: 9999px;
      transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @media (max-width: 900px) {
      .pipeline-stepper {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 540px) {
      .pipeline-stepper {
        grid-template-columns: 1fr;
      }
    }
    .dash-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
      margin-bottom: 2rem;
    }

    .workbench-card {
      background: var(--wl-surface);
      border: 1px solid var(--wl-border);
      border-radius: 14px;
      padding: 1.4rem;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
      display: flex;
      flex-direction: column;
    }

    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.15rem;
      gap: 0.75rem;
    }

    .card-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #6366F1;
      margin-bottom: 0.2rem;
    }

    .card-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--wl-ink-strong);
      margin: 0;
    }

    .view-all-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 11.5px;
      font-weight: 600;
      color: #4F46E5;
      text-decoration: none;
      transition: color 0.15s;
    }

      .view-all-link:hover {
        color: #3730A3;
      }

    .empty-tray {
      padding: 2.25rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .empty-icon-box {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: var(--wl-surface-soft);
      color: var(--wl-muted);
      display: grid;
      place-items: center;
      margin-bottom: 0.75rem;
    }

    .empty-text {
      font-size: 13px;
      font-weight: 600;
      color: var(--wl-ink-strong);
      margin-bottom: 0.25rem;
    }

    .empty-hint {
      font-size: 11.5px;
      color: var(--wl-muted);
    }

    .quote-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .quote-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.85rem 1rem;
      border: 1px solid var(--wl-border);
      border-radius: 9px;
      background: var(--wl-surface-soft);
      cursor: pointer;
      transition: all 0.15s ease;
      gap: 1rem;
    }

      .quote-item:hover {
        background: var(--wl-surface);
        border-color: rgba(99, 102, 241, 0.4);
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
        transform: translateY(-1px);
      }

    .quote-left {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .quote-header-line {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex-wrap: wrap;
    }

    .quote-num {
      font-size: 13px;
      font-weight: 700;
      color: var(--wl-ink-strong);
    }

    .quote-validity {
      font-size: 11px;
      color: var(--wl-muted);
    }

    .quote-rfq {
      font-size: 11px;
      color: var(--wl-ink-soft);
    }

    .quote-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.35rem;
    }

    .quote-amount {
      font-size: 13.5px;
      font-weight: 700;
      color: var(--wl-ink-strong);
    }
    .bento-section {
      background: var(--wl-surface);
      border: 1px solid var(--wl-border);
      border-radius: 14px;
      padding: 1.5rem 1.75rem;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
    }

    .bento-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 1.35rem;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .bento-tag {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #4F46E5;
      display: block;
      margin-bottom: 0.2rem;
    }

    .bento-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--wl-ink-strong);
      margin: 0;
    }

    .bento-note {
      font-size: 10.5px;
      color: var(--wl-muted);
      letter-spacing: 0.06em;
    }

    .bento-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }

    .bento-card {
      border: 1px solid var(--wl-border);
      background: var(--wl-surface-soft);
      border-radius: 11px;
      padding: 1.25rem;
      text-decoration: none;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }

      .bento-card:hover {
        background: var(--wl-surface);
        border-color: #6366F1;
        transform: translateY(-2px);
        box-shadow: 0 8px 20px -4px rgba(99, 102, 241, 0.12);
      }

    .bento-icon-box {
      width: 38px;
      height: 38px;
      border-radius: 9px;
      display: grid;
      place-items: center;
      font-size: 20px;
    }

    .bento-icon--indigo {
      background: rgba(99, 102, 241, 0.1);
      color: #4F46E5;
    }

    .bento-icon--emerald {
      background: rgba(16, 185, 129, 0.1);
      color: #059669;
    }

    .bento-icon--amber {
      background: rgba(245, 158, 11, 0.1);
      color: #D97706;
    }

    .bento-icon--slate {
      background: rgba(100, 116, 139, 0.1);
      color: #475569;
    }

    .bento-content {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 1;
    }

    .bento-item-tag {
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--wl-muted);
    }

    .bento-item-title {
      font-size: 13.5px;
      font-weight: 700;
      color: var(--wl-ink-strong);
    }

    .bento-item-desc {
      font-size: 11.5px;
      color: var(--wl-ink-soft);
      line-height: 1.45;
      margin: 0;
    }

    .bento-arrow {
      position: absolute;
      top: 1.25rem;
      inset-inline-end: 1.25rem;
      font-size: 16px;
      color: var(--wl-muted);
      transition: all 0.18s;
    }

    .bento-card:hover .bento-arrow {
      color: #4F46E5;
      transform: translateX(3px);
    }

    @media (max-width: 1080px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }

      .pipeline-stepper {
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
      }

      .bento-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 0.85rem;
      }
    }

    @media (max-width: 820px) {
      .org-shell {
        padding: 1.25rem 1.25rem 2.5rem;
        padding-inline-start: max(1.25rem, env(safe-area-inset-left));
        padding-inline-end: max(1.25rem, env(safe-area-inset-right));
      }

      .org-head {
        gap: 1.25rem;
        margin-bottom: 1.25rem;
        flex-direction: column;
      }

      .org-company-card {
        width: 100%;
        min-width: 0;
      }

      .dash-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .pipeline-stepper {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 640px) {
      .org-shell {
        padding: 1rem 1rem 2rem;
        padding-inline-start: max(1rem, env(safe-area-inset-left));
        padding-inline-end: max(1rem, env(safe-area-inset-right));
      }

      .org-title {
        font-size: clamp(1.4rem, 5.5vw, 1.95rem);
      }

      .org-head__actions {
        display: flex;
        flex-direction: column;
        width: 100%;
        gap: 0.45rem;
      }

        .org-head__actions > * {
          width: 100%;
          justify-content: center;
        }

      .stats-grid {
        grid-template-columns: 1fr;
        gap: 0.75rem;
        margin-bottom: 1.25rem;
      }

      .pipeline-card {
        padding: 1.15rem 1rem;
        margin-bottom: 1.25rem;
      }

      .workbench-card {
        padding: 1.15rem 1rem;
      }

      .quote-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.65rem;
        padding: 0.75rem 0.85rem;
      }

      .quote-right {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px dashed var(--wl-border);
        padding-top: 0.5rem;
      }

      .bento-grid {
        grid-template-columns: 1fr;
        gap: 0.75rem;
      }

      .bento-card {
        padding: 1rem 1.15rem;
      }
    }

    @media (max-width: 480px) {
      .org-shell {
        padding: 0.85rem 0.85rem 1.75rem;
        padding-inline-start: max(0.85rem, env(safe-area-inset-left));
        padding-inline-end: max(0.85rem, env(safe-area-inset-right));
      }

      .pipeline-stepper {
        grid-template-columns: 1fr;
        gap: 0.55rem;
      }

      .pipeline-head {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }

      .pipeline-counter {
        font-size: 10.5px;
        padding: 0.25rem 0.55rem;
      }

      .company-card__top {
        gap: 0.65rem;
      }

      .company-card__details {
        gap: 0.35rem;
      }

      .quote-header-line {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.2rem;
      }
    }
</style>
