<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../../i18n'
import { authService, services } from '../../di/container'

const support = computed(() => services.contentService.supportContact.value)
// Footer shows general guest links only; account links render for authed users.
const isAuthed = computed(() => authService.isAuthenticated)
</script>

<template>
  <footer class="footer">
    <div class="footer__inner" :class="{ 'is-guest': !isAuthed }">
      <div class="footer__brand">
        <div class="footer__logo">
          <img src="/logo.jpeg" alt="Welco" width="120" height="28" loading="lazy" />
          <span class="brand-title">Welco Surgical</span>
        </div>
        <p class="brand-desc">{{ t('footer.brandDesc') }}</p>
        <div class="footer-badges mono">
          <span class="footer-badge">ISO 13485:2016</span>
          <span class="footer-badge">CE MDR CLASS IIa</span>
          <span class="footer-badge">UDI LOT-TRACEABLE</span>
        </div>
      </div>

      <div class="footer__col">
        <h4>{{ t('footer.product') }}</h4>
        <router-link to="/marketplace" class="footer__link">{{ t('nav.marketplace') }}</router-link>
        <router-link to="/certifications" class="footer__link">{{ t('nav.certifications') }}</router-link>
        <router-link to="/oem" class="footer__link">{{ t('nav.oem') }}</router-link>
      </div>

      <div v-if="isAuthed" class="footer__col">
        <h4>{{ t('footer.account') }}</h4>
        <router-link to="/account" class="footer__link">{{ t('nav.account') }}</router-link>
        <router-link to="/account/rfqs" class="footer__link">{{ t('sales.rfqTitle') }}</router-link>
        <router-link to="/account/quotes" class="footer__link">{{ t('sales.quoteTitle') }}</router-link>
        <router-link to="/account/orders" class="footer__link">{{ t('commerce.ordersTitle') }}</router-link>
        <router-link to="/addresses" class="footer__link">{{ t('profile.addresses') }}</router-link>
      </div>

      <div class="footer__col">
        <h4>{{ t('footer.support') }}</h4>
        <router-link to="/help" class="footer__link">{{ t('footer.helpCenter') }}</router-link>
        <router-link v-if="isAuthed" to="/help/my-tickets" class="footer__link">{{ t('help.myTickets') }}</router-link>
        <a v-if="support.supportEmail" class="footer__link" :href="'mailto:' + support.supportEmail">
          {{ support.supportEmail }}
        </a>
        <a v-if="support.phoneNumber" class="footer__link" :href="'tel:' + support.phoneNumber.replace(/\s+/g, '')">
          {{ support.phoneNumber }}
        </a>
        <span v-if="support.workingHours" class="footer__note mono">{{ support.workingHours }}</span>
      </div>
    </div>

    <!-- Verification & Compliance Bar -->
    <div class="footer__bottom">
      <div class="footer__bottom-left">
        <span>© {{ new Date().getFullYear() }} Welco Surgical Instruments GmbH / FZ-LLC. All rights reserved.</span>
        <span class="compliance-note">Passivated Stainless Steel DIN EN ISO 17664 · 134°C Autoclave Validated.</span>
      </div>
      <div class="footer__bottom-right mono">
        <span class="telemetry-pill">
          <span class="status-dot"></span>
          <span>{{ t('footer.productionOnline') }}</span>
        </span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  background: var(--wl-surface);
  border-top: 1px solid var(--wl-border);
  padding: 3rem var(--wl-gutter) 1.5rem;
  position: relative;
  padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left, 0px));
  padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right, 0px));
  padding-bottom: max(1.5rem, env(safe-area-inset-bottom, 0px));
}
.footer::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
  opacity: 0.85;
}
.footer__inner {
  max-width: var(--wl-max-width);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.5fr repeat(3, 1fr);
  gap: 2.5rem;
}
.footer__inner.is-guest {
  grid-template-columns: 1.5fr repeat(2, 1fr);
}

.footer__logo {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
}

.footer__logo img {
  height: 26px;
  width: auto;
  border-radius: 6px;
}

.brand-title {
  font-family: var(--wl-font-display);
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  letter-spacing: -0.015em;
}

.brand-desc {
  margin: 0.85rem 0 1.15rem;
  font-size: 13px;
  color: var(--wl-ink-soft);
  line-height: 1.6;
  max-width: 320px;
}

.footer-badges {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.footer-badge {
  font-size: 9.5px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(79, 70, 229, 0.2);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-xs);
}

.footer__col h4 {
  font-family: var(--wl-font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--wl-ink-strong);
  margin-bottom: 0.95rem;
  font-weight: 700;
}

.footer__link {
  display: block;
  font-size: 13.5px;
  padding: 0.35rem 0;
  color: var(--wl-ink-soft);
  text-decoration: none;
  transition: color 0.15s ease, transform 0.15s ease;
}

.footer__link:hover {
  color: var(--wl-primary);
  transform: translateX(2px);
}

.footer__note {
  display: block;
  font-size: 10.5px;
  color: var(--wl-muted);
  padding: 0.35rem 0;
  line-height: 1.5;
}
[dir='rtl'] .footer__link:hover {
  transform: translateX(-2px);
}
@media (hover: none) {
  .footer__link:hover { transform: none; }
  .footer__link:active { color: var(--wl-primary); }
}

.footer__bottom {
  max-width: var(--wl-max-width);
  margin: 2.5rem auto 0;
  border-top: 1px solid var(--wl-border);
  padding-top: 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--wl-muted);
}

.footer__bottom-left {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.compliance-note {
  font-size: 10.5px;
  color: var(--wl-muted-soft);
}

.telemetry-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-success);
  background: var(--wl-success-soft);
  border: 1px solid rgba(16, 185, 129, 0.18);
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
}
:root.dark .telemetry-pill, :root[data-theme='dark'] .telemetry-pill { border-color: rgba(52,211,153,0.22); }

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
}

@media (max-width: 1024px) {
  .footer__inner { gap: 2rem; }
}
@media (max-width: 900px) {
  .footer__inner {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.75rem;
  }
  .footer__brand { grid-column: 1 / -1; }
}
@media (max-width: 640px) {
  .footer { padding: 2rem var(--wl-gutter) max(1.25rem, env(safe-area-inset-bottom, 0px)); }
  .footer__inner { grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .footer__link { font-size: 13px; padding: 0.4rem 0; min-height: 32px; display: flex; align-items: center; }
  .footer__bottom { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
}
@media (max-width: 480px) {
  .footer__inner { grid-template-columns: 1fr; gap: 1.25rem; }
  .footer__bottom { gap: 0.6rem; }
  .brand-desc { max-width: 100%; }
}
@media (max-width: 360px) {
  .footer__inner { gap: 1rem; }
  .footer-badges { gap: 0.3rem; }
  .footer-badge { font-size: 9px; padding: 0.15rem 0.4rem; }
}
</style>
