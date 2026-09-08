<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t, locale } from '../../i18n'
import { salesService } from '../../di/container'
import AccountNav from '../../components/account/AccountNav.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import ChainSteps from '../../components/ui/ChainSteps.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import DataState from '../../components/ui/DataState.vue'
import BackButton from '../../components/ui/BackButton.vue'
import { resolveFileUrl } from '../../utils/file-url'
import type { RfqDto } from '../../domain/models/sales'

const route = useRoute()
const router = useRouter()
const rfq = ref<RfqDto | null>(null)
const loading = ref(true)
const linkedQuote = ref<{ id: string; status: string } | null>(null)

const localized = (en: string, ar: string) => (locale.value === 'ar' ? ar : en)

onMounted(async () => {
  const id = String(route.params.id)
  const found = await salesService.getRfq(id)
  rfq.value = found
  if (found) {
    linkedQuote.value = salesService.quotes.value.find((q) => q.rfqId === found.id) ?? null
  }
  loading.value = false
})
</script>

<template>
  <div class="page-shell rfq-detail-view">
    <BackButton fallback="/account/rfqs" variant="minimal" class="mb-3" />

    <!-- Breadcrumb -->
    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/account">{{ t('account.dashboard') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <router-link to="/account/rfqs">{{ t('sales.rfqTitle') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ rfq?.rfqNumber ?? '…' }}</span>
    </nav>

    <SkeletonLoader v-if="loading" type="card" :lines="6" height="220px" />
    <DataState
      v-else-if="!rfq"
      :empty="true"
      :empty-title="t('sales.noRfqs')"
      :empty-description="t('sales.noRfqsDesc')"
      :action-text="t('account.rfqs')"
      min-height="320px"
      @action="router.push({ name: 'account-rfqs' })"
    />

    <template v-else-if="rfq">
      <!-- Executive Header -->
      <header class="detail-header">
        <div class="header-main">
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('account.rfqDossier', { count: rfq.items.length }) }}</span>
          </div>
          <h1 class="mono rfq-heading">{{ rfq.rfqNumber }}</h1>
          <p class="mono rfq-sub">
            <span>{{ t('sales.submittedAt') }} {{ new Date(rfq.createdAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</span>
            <span v-if="rfq.companyName">•</span>
            <span v-if="rfq.companyName">{{ rfq.companyName }}</span>
          </p>
        </div>

        <StatusPill :status="rfq.status" />
      </header>

      <!-- Account Navigation Tab Bar -->
      <AccountNav />

      <!-- Chain Stepper Card -->
      <div class="stepper-card">
        <ChainSteps
          :steps="[t('sales.statusPending'), t('sales.statusQuoted'), t('sales.statusOrdered')]"
          :current="['Pending', 'Quoted', 'Ordered'].indexOf(rfq.status)"
        />
      </div>

      <!-- Detail 2-Column Grid -->
      <div class="detail-grid">
        <!-- Main: Line Items -->
        <main class="manifest-card">
          <div class="manifest-head">
            <div class="manifest-title-group">
              <span class="material-symbols-outlined text-[18px] text-indigo-600">checklist</span>
              <h2 class="manifest-title">{{ t('sales.lineItems') }}</h2>
            </div>
            <span class="mono item-chip">{{ t('account.itemsCount', { count: rfq.items.length }) }}</span>
          </div>

          <div class="items-stack">
            <article v-for="it in rfq.items" :key="it.id" class="rfq-item-card">
              <div class="thumb-box" :style="{ background: it.imageGradient || '#F8FAFC' }">
                <img
                  v-if="it.imageName"
                  :src="resolveFileUrl(it.imageName)"
                  :alt="localized(it.productNameEn, it.productNameEn)"
                  class="thumb-img"
                  loading="lazy"
                />
                <span v-else class="material-symbols-outlined text-[20px] text-slate-400">precision_manufacturing</span>
              </div>

              <div class="rfq-item-details">
                <h3 class="rfq-item-name">{{ localized(it.productNameEn, it.productNameAr || it.productNameEn) }}</h3>
                <div class="rfq-item-qty mono">{{ t('account.qtyUnits', { count: it.quantity }) }} · {{ Math.ceil(it.unitPrice ?? 0).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} USD {{ t('account.perUnitShort') }}</div>
                <div v-if="it.notes" class="rfq-item-notes mono">
                  <span class="font-bold">{{ t('account.specLabel') }}</span> {{ it.notes }}
                </div>
              </div>
            </article>
          </div>

          <!-- Notes Callout Banner if present -->
          <div v-if="rfq.note" class="notes-banner mono">
            <span class="material-symbols-outlined text-[16px] text-indigo-600">sticky_note_2</span>
            <span><strong>{{ t('sales.notes') }}:</strong> {{ rfq.note }}</span>
          </div>
        </main>

        <!-- Sidebar: Estimated Total & Linked Quote -->
        <aside class="side-panel">
          <section class="card total-card">
            <h2 class="side-title mono">{{ t('commerce.total') }}</h2>
            <div class="amount-val-box">
              <span class="mono amount-label">{{ t('sales.amount') }}</span>
              <strong class="mono amount-big">${{ Math.ceil(rfq.total ?? 0).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }} USD</strong>
            </div>
          </section>

          <!-- Linked Quote Card -->
          <section v-if="linkedQuote" class="card linked-card">
            <div class="linked-head">
              <h2 class="side-title mono">{{ t('sales.quoteTitle') }}</h2>
              <StatusPill :status="linkedQuote.status" />
            </div>
            <p class="linked-desc mono">{{ t('account.linkedQuoteDesc') }}</p>

            <button
              type="button"
              class="btn-view-quote mono"
              @click="router.push({ name: 'account-quote-detail', params: { id: linkedQuote.id } })"
            >
              <span class="material-symbols-outlined text-[16px]">visibility</span>
              <span>{{ t('marketplace.viewDetails') }}</span>
            </button>
          </section>

          <!-- Action Stack -->
          <div class="side-actions-stack">
            <button
              type="button"
              class="btn-back-rfqs mono"
              @click="router.push({ name: 'account-rfqs' })"
            >
              <span class="material-symbols-outlined text-[16px] icon--directional">arrow_back</span>
              <span>{{ t('account.backToRfqs') }}</span>
            </button>
            <button
              type="button"
              class="btn-create-rfq mono"
              @click="router.push({ name: 'account-rfqs' })"
            >
              <span class="material-symbols-outlined text-[16px]">add_circle</span>
              <span>{{ t('sales.submitRfq') }}</span>
            </button>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rfq-detail-view {
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
  background: #4F46E5;
}

.rfq-heading {
  font-size: 1.68rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.1;
}

.rfq-sub {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 11.5px;
  color: #64748B;
  margin: 0.35rem 0 0;
}

/* Stepper Card */
.stepper-card {
  background: var(--wl-surface, #FFFFFF);
  border: 1px solid var(--wl-border, #E2E8F0);
  border-radius: var(--wl-radius-card, 16px);
  padding: var(--wl-card-padding, 1.25rem 1.5rem);
  box-shadow: var(--wl-shadow-card, 0 1px 3px rgba(15, 23, 42, 0.05));
}

/* Detail 2-Column Grid */
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: var(--wl-page-gap, 1.5rem);
  align-items: start;
}

.manifest-card {
  background: var(--wl-surface, #FFFFFF);
  border: 1px solid var(--wl-border, #E2E8F0);
  border-radius: var(--wl-radius-card, 16px);
  padding: var(--wl-card-padding, 1.5rem);
  box-shadow: var(--wl-shadow-card, 0 1px 3px rgba(15, 23, 42, 0.05));
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.manifest-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--wl-border-subtle, #F1F5F9);
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
  border: 1px solid var(--wl-border);
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
}

.items-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.rfq-item-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 12px;
}

.thumb-box {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  overflow: hidden;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 1px solid #E2E8F0;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rfq-item-details {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
}

.rfq-item-name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
}

.rfq-item-qty {
  font-size: 11.5px;
  color: #64748B;
}

.rfq-item-notes {
  font-size: 11px;
  color: var(--wl-ink-soft);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  width: fit-content;
  margin-top: 0.25rem;
}

.notes-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
  color: var(--wl-ink-soft);
  background: var(--wl-primary-soft);
  border: 1px solid #C7D2FE;
  padding: 0.75rem 1rem;
  border-radius: 10px;
}

/* Sidebar */
.side-panel {
  display: flex;
  flex-direction: column;
  gap: var(--wl-page-gap, 1.25rem);
}

.card {
  background: var(--wl-surface, #FFFFFF);
  border: 1px solid var(--wl-border, #E2E8F0);
  border-radius: var(--wl-radius-card, 16px);
  padding: var(--wl-card-padding, 1.25rem);
  box-shadow: var(--wl-shadow-card, 0 1px 3px rgba(15, 23, 42, 0.05));
}

.side-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--wl-primary, #4F46E5);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin: 0;
}

.amount-val-box {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-top: 0.65rem;
}

.amount-label {
  font-size: 11px;
  color: #64748B;
  font-weight: 700;
}

.amount-big {
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
}

.linked-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.linked-desc {
  font-size: 12px;
  color: #64748B;
  margin: 0.5rem 0 1rem;
  line-height: 1.45;
}

.btn-view-quote {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 44px;
  width: 100%;
  background: #4F46E5;
  color: #FFFFFF;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px -2px rgba(79, 70, 229, 0.35);
  transition: all 0.18s ease;
}

.btn-view-quote:hover {
  background: #4338CA;
}

.side-actions-stack {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.btn-back-rfqs {
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

.btn-back-rfqs:hover {
  border-color: #4F46E5;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
}

.btn-create-rfq {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 46px;
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
  border: 1.5px solid rgba(var(--wl-primary-rgb), 0.3);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-create-rfq:hover {
  background: #4F46E5;
  color: #FFFFFF;
}

@media (max-width: 900px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
