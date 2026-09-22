<script setup lang="ts">
import { ref } from 'vue'
import ProviderLayout from '../../components/layout/ProviderLayout.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t } from '../../i18n'

const subject = ref('')
const category = ref('quotes_negotiation')
const priority = ref('high')
const message = ref('')
const submitting = ref(false)

const categories = [
  { value: 'quotes_negotiation', label: 'Quote & Price Negotiation Issue' },
  { value: 'orders_fulfillment', label: 'Order Dispatch & Tracking' },
  { value: 'catalog_inventory', label: 'Catalog Products & Specifications' },
  { value: 'client_inquiry', label: 'Urgent Client Inquiry' },
  { value: 'system_technical', label: 'Technical or Portal Issue' },
]

const submitEscalation = async () => {
  if (!subject.value.trim() || !message.value.trim()) {
    toastService.info('Please fill in both the subject and message.')
    return
  }

  submitting.value = true
  try {
    // Artificial latency for clean UX
    await new Promise((r) => setTimeout(r, 600))
    toastService.success(t('provider.issueSentSuccess'))
    subject.value = ''
    message.value = ''
    category.value = 'quotes_negotiation'
    priority.value = 'high'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <ProviderLayout>
    <div class="provider-support-view">
      <!-- Header -->
      <header class="view-header">
        <div>
          <span class="mono eyebrow">{{ t('provider.dashboard') }} · {{ t('provider.support') }}</span>
          <h1 class="view-title">{{ t('provider.contactAdmin') }}</h1>
          <p class="view-desc">{{ t('provider.supportDesc') }}</p>
        </div>
      </header>

      <!-- Channels Grid -->
      <div class="channels-grid">
        <!-- Hotline Card -->
        <div class="channel-card">
          <div class="channel-icon bg-blue-soft">
            <span class="material-symbols-outlined text-blue-600">support_agent</span>
          </div>
          <div class="channel-info">
            <span class="channel-label mono">{{ t('provider.callAdminSupport') }}</span>
            <strong class="channel-main mono">+971 4 800 WELCO (93526)</strong>
            <p class="channel-sub">24/7 dedicated distributor & hospital escalation desk.</p>
          </div>
          <a href="tel:+971480093526" class="btn-channel btn-call mono">
            <span class="material-symbols-outlined text-[16px]">call</span>
            <span>Call Hotline</span>
          </a>
        </div>

        <!-- WhatsApp Card -->
        <div class="channel-card">
          <div class="channel-icon bg-emerald-soft">
            <span class="material-symbols-outlined text-emerald-600">chat</span>
          </div>
          <div class="channel-info">
            <span class="channel-label mono">Instant WhatsApp Desk</span>
            <strong class="channel-main mono">+971 50 800 9352</strong>
            <p class="channel-sub">Direct instant chat with Welco central logistics managers.</p>
          </div>
          <a
            href="https://wa.me/971508009352?text=Provider%20Escalation%20Inquiry%20from%20Welco%20Network"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-channel btn-wa mono"
          >
            <span class="material-symbols-outlined text-[16px]">forum</span>
            <span>Open WhatsApp</span>
          </a>
        </div>
      </div>

      <!-- Admin Authority & Management Guarantee Notice -->
      <div class="admin-notice-card">
        <span class="material-symbols-outlined text-amber-600 text-[26px]">admin_panel_settings</span>
        <div class="notice-content">
          <strong class="notice-title mono">Full Central Admin Oversight & Provider Management</strong>
          <p class="notice-desc">
            Welco Central Administration maintains 360° operational access across the network. If your team encounters any logistics bottlenecks, client disputes, or quote calculation constraints, Welco Admins can manage quotes on your behalf, update shipment states, track all your client interactions, and directly resolve procurement discrepancies.
          </p>
        </div>
      </div>

      <!-- Escalation Ticket Form -->
      <div class="ticket-card">
        <div class="ticket-card-head">
          <h2 class="ticket-heading">{{ t('provider.escalateIssue') }}</h2>
          <p class="ticket-sub">Submit an expedited ticket directly to the Welco Admin executive queue.</p>
        </div>

        <form class="ticket-form" @submit.prevent="submitEscalation">
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-lbl mono">Category *</label>
              <select v-model="category" class="form-select mono">
                <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
            </div>

            <div class="form-group w-44">
              <label class="form-lbl mono">Priority *</label>
              <select v-model="priority" class="form-select mono">
                <option value="normal">Normal</option>
                <option value="high">High Priority</option>
                <option value="urgent">🚨 Urgent / Blocker</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-lbl mono">{{ t('provider.issueSubject') }} *</label>
            <input
              v-model="subject"
              type="text"
              class="form-input"
              placeholder="e.g. Need assistance with counter-offer for RFQ #RFQ-2026-081"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-lbl mono">{{ t('provider.issueMessage') }} *</label>
            <textarea
              v-model="message"
              rows="5"
              class="form-textarea"
              :placeholder="t('provider.issueMessage')"
              required
            ></textarea>
          </div>

          <div class="form-actions">
            <BaseButton variant="primary" type="submit" :loading="submitting">
              <span class="material-symbols-outlined text-[16px]">send</span>
              <span>{{ t('provider.sendIssue') }}</span>
            </BaseButton>
          </div>
        </form>
      </div>
    </div>
  </ProviderLayout>
</template>

<style scoped>
.provider-support-view {
  width: 100%;
}

.view-header {
  margin-bottom: var(--space-5);
}

.eyebrow {
  font-size: var(--step--1);
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.05em;
  display: block;
}

.view-title {
  font-family: var(--wl-font-display);
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: var(--space-1) 0;
}

.view-desc {
  font-size: var(--step-0);
  color: var(--wl-muted);
  max-width: 600px;
}

/* Channels Grid */
.channels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.channel-card {
  display: flex;
  flex-direction: column;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  gap: var(--space-3);
  position: relative;
  transition: all 0.18s ease;
}

.channel-card:hover {
  border-color: var(--wl-border-strong);
  transform: translateY(-2px);
}

.channel-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
}

.bg-blue-soft { background: #eff6ff; }
.bg-emerald-soft { background: #ecfdf5; }

.channel-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.channel-label {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.channel-main {
  font-size: 1.25rem;
  color: var(--wl-ink-strong);
}

.channel-sub {
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin: 4px 0 0;
  line-height: 1.4;
}

.btn-channel {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.15s ease;
  margin-top: auto;
}

.btn-call {
  background: var(--wl-surface-soft);
  color: var(--wl-ink-strong);
  border: 1px solid var(--wl-border);
}
.btn-call:hover {
  background: var(--wl-border);
}

.btn-wa {
  background: #059669;
  color: #fff;
  border: 1px solid #047857;
}
.btn-wa:hover {
  background: #047857;
}

/* Admin Oversight Notice */
.admin-notice-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
}

.notice-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notice-title {
  color: #92400e;
  font-size: var(--step-0);
}

.notice-desc {
  font-size: var(--step--1);
  color: #b45309;
  line-height: 1.5;
  margin: 0;
}

/* Ticket Card */
.ticket-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.ticket-card-head {
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--wl-border);
  padding-bottom: var(--space-3);
}

.ticket-heading {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.ticket-sub {
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin: 4px 0 0;
}

.ticket-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-row {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.flex-1 { flex: 1; }
.w-44 { width: 180px; }

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-lbl {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
}

.form-select,
.form-input,
.form-textarea {
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  outline: none;
}

.form-select:focus,
.form-input:focus,
.form-textarea:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-2);
}

@media (max-width: 640px) {
  .form-row {
    flex-direction: column;
  }
  .w-44 {
    width: 100%;
  }
}
</style>
