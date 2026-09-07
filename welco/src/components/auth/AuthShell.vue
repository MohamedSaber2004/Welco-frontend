<script setup lang="ts">
import { t } from '../../i18n'
defineProps<{ title: string; subtitle: string }>()
</script>

<template>
  <div class="auth-wrap">
    <div class="auth-card">
      <!-- Left Hero Column: Dark foundation with electric indigo glow -->
      <aside class="auth-brand" :aria-label="t('auth.brandOverview')">
        <div class="auth-brand__top">
          <div class="brand-badge mono">
            <span class="live-dot" aria-hidden="true"></span>
            <span>{{ t('auth.brandEst') }}</span>
          </div>
        </div>

        <div class="auth-brand__hero">
          <div class="brand-eyebrow mono">{{ t('auth.brandEyebrow') }}</div>
          <h2 class="brand-headline">
            {{ t('auth.brandTitle1') }} {{ t('auth.brandTitle2') }}
            <span class="brand-accent">{{ t('auth.brandTitleAccent') }}</span>
          </h2>
          <p class="brand-copy">
            {{ t('auth.brandCopy') }}
          </p>

          <!-- Instrument Spec Badge -->
          <div class="brand-spec-box mono">
            <div class="spec-row">
              <span class="spec-k">METALLURGY:</span>
              <strong class="spec-v">AISI 420 Martensitic Steel</strong>
            </div>
            <div class="spec-row">
              <span class="spec-k">STANDARDS:</span>
              <strong class="spec-v">ISO 13485:2016 · CE MDR</strong>
            </div>
            <div class="spec-row">
              <span class="spec-k">AUTOCLAVE:</span>
              <strong class="spec-v">134°C (273°F) Validated</strong>
            </div>
          </div>

          <ul class="brand-perks">
            <li class="perk-item">
              <span class="material-symbols-outlined perk-icon">verified</span>
              <span>{{ t('auth.brandBullet1') }}</span>
            </li>
            <li class="perk-item">
              <span class="material-symbols-outlined perk-icon">precision_manufacturing</span>
              <span>{{ t('auth.brandBullet2') }}</span>
            </li>
            <li class="perk-item">
              <span class="material-symbols-outlined perk-icon">shield</span>
              <span>{{ t('auth.brandBullet3') }}</span>
            </li>
          </ul>
        </div>

        <div class="auth-brand__foot mono">
          <span>{{ t('auth.brandBadgeIso') }}</span>
          <span class="foot-sep">•</span>
          <span>{{ t('auth.brandBadgeCe') }}</span>
          <span class="foot-sep">•</span>
          <span>{{ t('auth.brandBadgeCountries') }}</span>
        </div>
      </aside>

      <!-- Right Form Column: Clean white surface -->
      <main class="auth-form-wrap">
        <div class="auth-form__identity">
          <div class="auth-logo-box">
            <img src="/logo.jpeg" alt="Welco — Surgical Instruments" class="auth-form__logo" width="180" height="72" loading="eager" />
          </div>
          <div class="auth-brand-text">
            <span class="auth-form__brand">Welco<span class="auth-form__brand-accent">Surgical</span></span>
            <span class="auth-form__brand-sub mono">{{ t('auth.formBrandSub') }}</span>
          </div>
        </div>
        <header class="auth-form__head">
          <div class="auth-chip mono">{{ t('auth.shellBadge') }}</div>
          <h1 class="auth-title">{{ title }}</h1>
          <p class="auth-subtitle">{{ subtitle }}</p>
        </header>

        <div class="auth-form__body">
          <slot />
        </div>

        <footer class="auth-form__foot mono">
          <span>{{ t('auth.shellFormFoot') }}</span>
        </footer>
      </main>
    </div>
  </div>
</template>

<style scoped>
.auth-wrap {
  min-height: calc(100vh - var(--wl-header-height, 56px));
  background: var(--wl-paper);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--wl-page-padding-top) var(--wl-gutter) var(--wl-page-padding-bottom);
  padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left));
  padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right));
  position: relative;
}

.auth-card {
  width: 100%;
  max-width: 960px;
  display: grid;
  grid-template-columns: 420px 1fr;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-xl);
  box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

/* Left Hero */
.auth-brand {
  background: var(--wl-ink-strong);
  color: #FFFFFF;
  padding: 2.75rem 2.25rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
}

.auth-brand::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 3px;
  background: linear-gradient(90deg, #4F46E5, #6366F1, #818CF8);
}

.auth-brand::after {
  content: '';
  position: absolute;
  top: -50%;
  inset-inline-end: -30%;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(79, 70, 229, 0.15) 0%, transparent 70%);
  pointer-events: none;
}

.auth-brand__top { margin-bottom: 2rem; position: relative; z-index: 1; }

.brand-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  font-weight: 700;
  color: #A5B4FC;
  background: rgba(79, 70, 229, 0.15);
  border: 1px solid rgba(79, 70, 229, 0.3);
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-full);
  letter-spacing: 0.06em;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10B981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
  display: inline-block;
}

.brand-eyebrow {
  font-size: 10px;
  color: #818CF8;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 0.65rem;
  position: relative;
  z-index: 1;
}

.brand-headline {
  font-family: var(--wl-font-display);
  font-size: 1.85rem;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.025em;
  color: #FFFFFF;
  margin: 0 0 1rem;
  position: relative;
  z-index: 1;
}

.brand-accent {
  display: block;
  color: #818CF8;
}

.brand-copy {
  font-size: 13.5px;
  color: #94A3B8;
  line-height: 1.6;
  margin: 0 0 1.75rem;
  position: relative;
  z-index: 1;
}

.brand-spec-box {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-bottom: 1.75rem;
  position: relative;
  z-index: 1;
}
.brand-spec-box::after {
  content: 'SIALKOT — TUTTLINGEN — LOT-TRACEABLE';
  display: block;
  margin-top: 0.55rem;
  padding-top: 0.55rem;
  border-top: 1px dashed rgba(255,255,255,0.12);
  font-size: 8.5px;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.45);
  text-align: center;
}

.spec-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

.spec-k { color: #64748B; font-weight: 600; }
.spec-v { color: #E2E8F0; font-weight: 700; }

.brand-perks {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  position: relative;
  z-index: 1;
}

.perk-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 12.5px;
  color: #CBD5E1;
}

.perk-icon {
  font-size: 18px;
  color: #10B981;
  flex-shrink: 0;
}

.auth-brand__foot {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 10px;
  color: #64748B;
  margin-top: 2rem;
  flex-wrap: wrap;
  position: relative;
  z-index: 1;
}

.foot-sep { color: rgba(255, 255, 255, 0.15); }

/* Right Form */
.auth-form-wrap {
  padding: 2.5rem 2.75rem 3rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: var(--wl-surface);
}
.auth-form__identity {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1.25rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--wl-border);
}
.auth-logo-box {
  flex: 0 0 52%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  min-height: 72px;
}
.auth-form__logo {
  width: 100%;
  height: auto;
  max-height: 56px;
  object-fit: contain;
  border-radius: 6px;
}
.auth-brand-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.auth-form__brand {
  font-family: var(--wl-font-display);
  font-weight: 800;
  font-size: 16px;
  color: var(--wl-ink-strong);
  letter-spacing: -0.02em;
  line-height: 1;
}
.auth-form__brand-accent {
  font-weight: 500;
  color: var(--wl-muted);
  margin-inline-start: 0.2rem;
}
.auth-form__brand-sub {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--wl-muted);
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.auth-form__head { margin-bottom: 2rem; }

.auth-chip {
  display: inline-block;
  font-size: 9.5px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(79, 70, 229, 0.2);
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-xs);
  letter-spacing: 0.08em;
  margin-bottom: 0.65rem;
}

.auth-title {
  font-family: var(--wl-font-display);
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  line-height: 1.15;
  margin: 0 0 0.45rem;
}

.auth-subtitle {
  font-size: 14px;
  color: var(--wl-ink-soft);
  margin: 0;
  line-height: 1.5;
}

.auth-form__body { flex: 1; }

.auth-form__foot {
  margin-top: 2.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--wl-border);
  text-align: center;
  font-size: 10.5px;
  color: var(--wl-muted);
  letter-spacing: 0.04em;
}

@media (max-width: 860px) {
  .auth-card { grid-template-columns: 1fr; }
  .auth-brand { padding: 2rem 1.5rem; }
  .auth-form-wrap { padding: 2rem 1.5rem; }
}

@media (max-width: 480px) {
  .auth-brand { padding: 1.5rem 1rem; }
  .auth-form-wrap { padding: 1.5rem 1rem; }
}
</style>
