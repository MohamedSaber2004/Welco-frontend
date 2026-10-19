<script setup lang="ts">
import { computed } from 'vue'
import { services } from '../../di/container'
import { t } from '../../i18n'

const support = computed(() => services.contentService.supportContact.value)

const email = computed(() => support.value?.supportEmail?.trim() || '')
const phone = computed(() => support.value?.phoneNumber?.trim() || '')
const whatsApp = computed(() => support.value?.whatsAppNumber?.trim() || '')
const facebook = computed(() => support.value?.facebookUrl?.trim() || '')
const instagram = computed(() => support.value?.instagramUrl?.trim() || '')

const hasAnyChannel = computed(() => {
  return Boolean(email.value || phone.value || whatsApp.value || facebook.value || instagram.value)
})

const waLink = computed(() => {
  const digits = whatsApp.value.replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : ''
})

const telLink = computed(() => {
  const digits = phone.value.replace(/\s+/g, '')
  return digits ? `tel:${digits}` : ''
})

const mailLink = computed(() => {
  return email.value ? `mailto:${email.value}` : ''
})

const displayWorkingHours = computed(() => {
  const raw = support.value?.workingHours
  if (raw && !raw.includes('Mon - Fri') && !raw.includes('GST') && !raw.includes('الاثنين - الجمعة')) {
    return raw
  }
  return t('footer.workingHours')
})

const cleanDisplayUrl = (url: string): string => {
  try {
    const parsed = new URL(url)
    return parsed.pathname && parsed.pathname !== '/'
      ? `${parsed.hostname}${parsed.pathname}`
      : parsed.hostname
  } catch {
    return url.replace(/^https?:\/\//i, '')
  }
}
</script>

<template>
  <section v-if="hasAnyChannel" class="support-channels-section" aria-labelledby="support-channels-heading">
    <div class="support-channels-container">
      <!-- Section Header -->
      <div class="support-channels-header">
        <div class="header-content">
          <div class="eyebrow mono">
            <span class="status-pulse" aria-hidden="true"></span>
            <span>{{ t('help.channelsTitle') }}</span>
          </div>
          <h2 id="support-channels-heading" class="section-title">
            {{ t('help.channelsTitle') }}
          </h2>
          <p class="section-desc">
            {{ t('help.channelsDesc') }}
          </p>
        </div>

        <!-- Working Hours Badge -->
        <div class="hours-badge">
          <span class="material-symbols-outlined hours-icon" aria-hidden="true">schedule</span>
          <div class="hours-info">
            <span class="hours-label mono">{{ t('footer.workingHoursLabel') }}</span>
            <span class="hours-value">{{ displayWorkingHours }}</span>
          </div>
        </div>
      </div>

      <!-- Channels Grid -->
      <div class="channels-grid">
        <!-- WhatsApp Card -->
        <a
          v-if="whatsApp && waLink"
          :href="waLink"
          target="_blank"
          rel="noopener noreferrer"
          class="channel-tile channel-tile--whatsapp"
        >
          <div class="tile-icon tile-icon--whatsapp">
            <svg class="brand-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.696c1.004.577 1.84.887 2.806.887 3.182 0 5.768-2.587 5.768-5.768.001-3.181-2.585-5.768-5.768-5.768zm7.337 5.768c0 4.053-3.284 7.337-7.337 7.337-1.258 0-2.457-.333-3.528-.934l-3.921 1.028 1.047-3.822c-.689-1.127-1.077-2.443-1.077-3.609 0-4.053 3.284-7.337 7.337-7.337 4.053 0 7.337 3.284 7.337 7.337z"/>
            </svg>
          </div>
          <div class="tile-body">
            <div class="tile-header">
              <span class="tile-type mono">{{ t('help.channelWaTitle') }}</span>
              <span class="status-dot status-dot--online" title="Direct Desk"></span>
            </div>
            <strong class="tile-value mono" dir="ltr">{{ whatsApp }}</strong>
            <p class="tile-note">{{ t('help.channelWaNote') }}</p>
          </div>
          <div class="tile-action">
            <span class="action-text mono">{{ t('common.open') || 'WhatsApp' }}</span>
            <span class="material-symbols-outlined action-arrow icon--directional" aria-hidden="true">arrow_forward</span>
          </div>
        </a>

        <!-- Telephone Card -->
        <a
          v-if="phone && telLink"
          :href="telLink"
          class="channel-tile channel-tile--phone"
        >
          <div class="tile-icon tile-icon--phone">
            <span class="material-symbols-outlined" aria-hidden="true">call</span>
          </div>
          <div class="tile-body">
            <div class="tile-header">
              <span class="tile-type mono">{{ t('help.channelPhoneTitle') }}</span>
            </div>
            <strong class="tile-value mono" dir="ltr">{{ phone }}</strong>
            <p class="tile-note">{{ t('help.channelPhoneNote') }}</p>
          </div>
          <div class="tile-action">
            <span class="action-text mono">{{ t('admin.callUsPhoneLabel') || 'Call' }}</span>
            <span class="material-symbols-outlined action-arrow icon--directional" aria-hidden="true">call_made</span>
          </div>
        </a>

        <!-- Email Card -->
        <a
          v-if="email && mailLink"
          :href="mailLink"
          class="channel-tile channel-tile--email"
        >
          <div class="tile-icon tile-icon--email">
            <span class="material-symbols-outlined" aria-hidden="true">mail</span>
          </div>
          <div class="tile-body">
            <div class="tile-header">
              <span class="tile-type mono">{{ t('help.channelEmailTitle') }}</span>
            </div>
            <strong class="tile-value mono truncate">{{ email }}</strong>
            <p class="tile-note">{{ t('help.channelEmailNote') }}</p>
          </div>
          <div class="tile-action">
            <span class="action-text mono">{{ t('common.send') || 'Email' }}</span>
            <span class="material-symbols-outlined action-arrow icon--directional" aria-hidden="true">arrow_forward</span>
          </div>
        </a>

        <!-- Facebook Card -->
        <a
          v-if="facebook"
          :href="facebook"
          target="_blank"
          rel="noopener noreferrer"
          class="channel-tile channel-tile--facebook"
        >
          <div class="tile-icon tile-icon--facebook">
            <svg class="brand-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <div class="tile-body">
            <div class="tile-header">
              <span class="tile-type mono">{{ t('help.facebookChannel') }}</span>
            </div>
            <strong class="tile-value mono truncate" dir="ltr">{{ cleanDisplayUrl(facebook) }}</strong>
            <p class="tile-note">{{ t('help.facebookChannelNote') }}</p>
          </div>
          <div class="tile-action">
            <span class="action-text mono">{{ t('common.open') || 'Visit' }}</span>
            <span class="material-symbols-outlined action-arrow icon--directional" aria-hidden="true">open_in_new</span>
          </div>
        </a>

        <!-- Instagram Card -->
        <a
          v-if="instagram"
          :href="instagram"
          target="_blank"
          rel="noopener noreferrer"
          class="channel-tile channel-tile--instagram"
        >
          <div class="tile-icon tile-icon--instagram">
            <svg class="brand-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </div>
          <div class="tile-body">
            <div class="tile-header">
              <span class="tile-type mono">{{ t('help.instagramChannel') }}</span>
            </div>
            <strong class="tile-value mono truncate" dir="ltr">{{ cleanDisplayUrl(instagram) }}</strong>
            <p class="tile-note">{{ t('help.instagramChannelNote') }}</p>
          </div>
          <div class="tile-action">
            <span class="action-text mono">{{ t('common.open') || 'Visit' }}</span>
            <span class="material-symbols-outlined action-arrow icon--directional" aria-hidden="true">open_in_new</span>
          </div>
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.support-channels-section {
  position: relative;
  background: var(--wl-surface);
  border-top: 1px solid var(--wl-border);
  border-bottom: 1px solid var(--wl-border);
  padding: clamp(3rem, 5vw, 4.5rem) var(--wl-gutter);
  padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left));
  padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right));
  overflow: hidden;
}

.support-channels-section::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, rgba(105, 169, 255, 0.4) 50%, transparent 100%);
  pointer-events: none;
}

.support-channels-container {
  max-width: var(--wl-max-width);
  margin: 0 auto;
}

/* Header */
.support-channels-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
  margin-bottom: 2.25rem;
  flex-wrap: wrap;
}

.header-content {
  max-width: 680px;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--wl-primary);
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.status-pulse {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: #10b981;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: pulse-ring 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
}

@keyframes pulse-ring {
  0% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
}

.section-title {
  font-size: clamp(1.4rem, 2.4vw, 1.85rem);
  font-weight: 800;
  color: var(--wl-ink-strong);
  letter-spacing: -0.02em;
  line-height: 1.25;
  margin: 0 0 0.5rem;
}

.section-desc {
  font-size: 0.95rem;
  color: var(--wl-muted);
  line-height: 1.55;
  margin: 0;
}

.hours-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  border-radius: var(--wl-radius-lg, 12px);
  background: var(--wl-surface-soft, rgba(0, 10, 25, 0.02));
  border: 1px solid var(--wl-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.hours-icon {
  font-size: 20px;
  color: var(--wl-primary);
}

.hours-info {
  display: flex;
  flex-direction: column;
}

.hours-label {
  font-size: 10px;
  color: var(--wl-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hours-value {
  font-size: 12px;
  font-weight: 700;
  color: var(--wl-ink-strong);
}

/* Channels Grid */
.channels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
}

/* Individual Channel Tile */
.channel-tile {
  display: flex;
  flex-direction: column;
  padding: 1.35rem;
  border-radius: var(--wl-radius-xl, 16px);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  text-decoration: none;
  color: inherit;
  box-shadow: 0 2px 8px rgba(0, 10, 25, 0.03);
  transition: transform 0.22s var(--wl-ease-spring, cubic-bezier(0.16, 1, 0.3, 1)),
              box-shadow 0.22s ease,
              border-color 0.22s ease;
  position: relative;
  overflow: hidden;
}

.channel-tile::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0;
  transition: opacity 0.22s ease;
  pointer-events: none;
}

.channel-tile:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 28px -6px rgba(0, 20, 50, 0.08);
}

.channel-tile:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

/* Tile Icons */
.tile-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.channel-tile:hover .tile-icon {
  transform: scale(1.08);
}

.brand-svg {
  width: 22px;
  height: 22px;
}

/* WhatsApp Styling */
.channel-tile--whatsapp:hover {
  border-color: rgba(37, 211, 102, 0.5);
}
.tile-icon--whatsapp {
  background: rgba(37, 211, 102, 0.12);
  color: #25D366;
}

/* Phone Styling */
.channel-tile--phone:hover {
  border-color: rgba(59, 130, 246, 0.5);
}
.tile-icon--phone {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

/* Email Styling */
.channel-tile--email:hover {
  border-color: rgba(99, 102, 241, 0.5);
}
.tile-icon--email {
  background: rgba(99, 102, 241, 0.12);
  color: #4f46e5;
}

/* Facebook Styling */
.channel-tile--facebook:hover {
  border-color: rgba(24, 119, 242, 0.5);
}
.tile-icon--facebook {
  background: rgba(24, 119, 242, 0.12);
  color: #1877F2;
}

/* Instagram Styling */
.channel-tile--instagram:hover {
  border-color: rgba(225, 48, 108, 0.5);
}
.tile-icon--instagram {
  background: linear-gradient(135deg, rgba(240, 148, 51, 0.12) 0%, rgba(225, 48, 108, 0.12) 100%);
  color: #E1306C;
}

/* Tile Body */
.tile-body {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.tile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.35rem;
}

.tile-type {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--wl-muted);
  letter-spacing: 0.05em;
}

.status-dot--online {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: #10b981;
}

.tile-value {
  font-size: 14px;
  font-weight: 800;
  color: var(--wl-ink-strong);
  line-height: 1.3;
  margin-bottom: 0.35rem;
  word-break: break-all;
}

.tile-note {
  font-size: 12px;
  color: var(--wl-muted);
  line-height: 1.45;
  margin: 0 0 1rem;
}

/* Tile Action Button Row */
.tile-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.85rem;
  border-top: 1px dashed var(--wl-border);
  margin-top: auto;
  font-size: 12px;
  font-weight: 700;
  color: var(--wl-primary);
  transition: color 0.15s ease;
}

.channel-tile:hover .tile-action {
  color: var(--wl-primary-strong, #1d4ed8);
}

.action-arrow {
  font-size: 16px;
  transition: transform 0.2s ease;
}

.channel-tile:hover .action-arrow {
  transform: translateX(4px);
}

[dir="rtl"] .channel-tile:hover .action-arrow {
  transform: translateX(-4px);
}

@media (max-width: 640px) {
  .support-channels-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1.25rem;
  }
  .hours-badge {
    align-self: flex-start;
  }
  .channels-grid {
    grid-template-columns: 1fr;
  }
}
</style>
