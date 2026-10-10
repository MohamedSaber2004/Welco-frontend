<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../../i18n'
import { authService, services } from '../../di/container'

const support = computed(() => services.contentService.supportContact.value)
// Footer shows general guest links only; account links render for authed users.
const isAuthed = computed(() => authService.isAuthenticated)

const effectiveEmail = computed(() => support.value?.supportEmail || 'support@welco.health')
const effectivePhone = computed(() => support.value?.phoneNumber || '+971 4 800 9352')

const displayWorkingHours = computed(() => {
  const raw = support.value?.workingHours
  // If the backend has a custom string that is NOT the dummy GST/Mon-Fri seed
  if (raw && !raw.includes('Mon - Fri') && !raw.includes('GST') && !raw.includes('الاثنين - الجمعة')) {
    return raw
  }
  return t('footer.workingHours')
})
</script>

<template>
  <footer class="footer">
    <div class="footer__inner" :class="{ 'is-guest': !isAuthed }">
      <div class="footer__brand">
        <div class="footer__logo">
          <img src="/logo.jpeg" alt="Welco" width="120" height="28" loading="lazy" />
          <span class="brand-title">{{ t('footer.brandTitle') }}</span>
        </div>
        <p class="brand-desc">{{ t('footer.brandDesc') }}</p>
        <div class="footer-badges">
          <span class="footer-badge">{{ t('footer.badgeIso') }}</span>
          <span class="footer-badge">{{ t('footer.badgeCe') }}</span>
          <span class="footer-badge">{{ t('footer.badgeVerified') }}</span>
        </div>
      </div>

      <div class="footer__col">
        <h4>{{ t('footer.product') }}</h4>
        <router-link to="/marketplace" class="footer__link">{{ t('nav.marketplace') }}</router-link>
        <router-link to="/most-selling" class="footer__link">{{ t('home.mostSellingTitle') }}</router-link>
        <router-link to="/categories" class="footer__link">{{ t('marketplace.categoriesTitle') }}</router-link>
        <router-link to="/providers" class="footer__link">{{ t('nav.providers') }}</router-link>
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
        <router-link to="/about" class="footer__link">{{ t('nav.about') }}</router-link>
        <router-link to="/help" class="footer__link">{{ t('footer.helpCenter') }}</router-link>
        <router-link v-if="isAuthed" to="/help/my-tickets" class="footer__link">{{ t('help.myTickets') }}</router-link>
        
        <div class="footer__contact-items">
          <a class="footer__contact-item" :href="'mailto:' + effectiveEmail">
            <span class="material-symbols-outlined contact-icon" aria-hidden="true">mail</span>
            <span>{{ effectiveEmail }}</span>
          </a>
          <a class="footer__contact-item" :href="'tel:' + effectivePhone.replace(/\s+/g, '')">
            <span class="material-symbols-outlined contact-icon" aria-hidden="true">call</span>
            <span dir="ltr">{{ effectivePhone }}</span>
          </a>
          <div class="footer__contact-item footer__contact-hours">
            <span class="material-symbols-outlined contact-icon" aria-hidden="true">schedule</span>
            <div class="hours-wrap">
              <span class="hours-label">{{ t('footer.workingHoursLabel') }}</span>
              <span class="hours-val">{{ displayWorkingHours }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Status & Copyright Bar -->
    <div class="footer__bottom">
      <div class="footer__bottom-left">
        <span>{{ t('footer.copyright', { year: new Date().getFullYear() }) }}</span>
      </div>
      <div class="footer__bottom-right">
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
  background: #FFFFFF !important;
  color: #243B53 !important;
  border-top: 1px solid var(--color-border, #D9E2EC) !important;
  box-shadow: 0 -4px 24px rgba(16, 42, 67, 0.04);
  padding: clamp(3.2rem, 5vw, 4.8rem) var(--wl-gutter) 1.5rem;
  position: relative;
  padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left, 0px));
  padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right, 0px));
  padding-bottom: max(1.5rem, env(safe-area-inset-bottom, 0px));
}
.footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #071520 0%, #00A389 50%, #0EA5E9 100%);
  display: block !important;
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
  gap: 0.75rem;
}

.footer__logo img {
  height: 32px;
  width: auto;
  border-radius: 6px;
  border: 1px solid #D8E2EC;
  background: #FFFFFF;
}

.brand-title {
  font-family: var(--wl-font-display);
  font-size: 1.25rem;
  font-weight: 800;
  color: #071520;
  letter-spacing: -0.015em;
}

.brand-desc {
  margin: 0.85rem 0 1.25rem;
  font-size: 14px;
  color: #486581;
  line-height: 1.65;
  max-width: 320px;
}

.footer-badges {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.footer-badge {
  font-size: 11px;
  font-weight: 700;
  color: #00A389;
  background: #E8F8F5;
  border: 1px solid rgba(0, 163, 137, 0.3);
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  letter-spacing: 0.03em;
}

.footer__col h4,
.footer__title {
  font-family: var(--font-display);
  font-size: 12.5px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #071520;
  margin-bottom: 1.1rem;
  font-weight: 800;
}

.footer__link {
  display: block;
  font-size: 14px;
  font-weight: 500;
  padding: 0.35rem 0;
  color: #243B53;
  text-decoration: none;
  transition: color 0.15s ease, transform 0.15s ease;
}

.footer__link:hover {
  color: #00A389;
  transform: translateX(3px);
  font-weight: 600;
}

.footer__contact-items {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.footer__contact-item {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 13.5px;
  font-weight: 500;
  color: #243B53;
  text-decoration: none;
  transition: color 0.15s ease, transform 0.15s ease;
}

.footer__contact-item:hover {
  color: #147D92;
  transform: translateX(2px);
}
[dir='rtl'] .footer__contact-item:hover {
  transform: translateX(-2px);
}

.contact-icon {
  font-size: 18px;
  color: #147D92;
  flex-shrink: 0;
}

.footer__contact-hours {
  align-items: flex-start;
  margin-top: 0.25rem;
  padding: 0.55rem 0.75rem;
  background: #F7FAFC;
  border-radius: 8px;
  border: 1px solid #E2E8F0;
}

.footer__contact-hours:hover {
  transform: none;
}

.hours-wrap {
  display: flex;
  flex-direction: column;
  gap: 3px;
  line-height: 1.35;
}

.hours-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #627D98;
}

.hours-val {
  font-size: 12.5px;
  font-weight: 600;
  color: #0F3D56;
}

.footer__note {
  display: block;
  font-size: 11.5px;
  color: #627D98;
  padding: 0.35rem 0;
  line-height: 1.5;
}
[dir='rtl'] .footer__link:hover {
  transform: translateX(-3px);
}
@media (hover: none) {
  .footer__link:hover { transform: none; }
  .footer__link:active { color: #147D92; }
}

.footer__bottom {
  max-width: var(--wl-max-width);
  margin: 2.75rem auto 0;
  border-top: 1px solid #E2E8F0;
  padding-top: 1.35rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 12.5px;
  color: #486581;
}

.footer__bottom-left {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.compliance-note {
  font-size: 11.5px;
  color: #627D98;
}

.telemetry-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #15803D;
  background: #F0FDF4;
  border: 1px solid #86EFAC;
  padding: 0.3rem 0.65rem;
  border-radius: 6px;
}
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #16A34A;
  box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25);
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
