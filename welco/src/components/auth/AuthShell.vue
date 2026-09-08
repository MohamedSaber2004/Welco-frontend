<script setup lang="ts">
import { t } from '../../i18n'
defineProps<{ title: string; subtitle: string }>()
</script>

<template>
  <div class="auth-wrap">
    <div class="auth-card">
      <aside class="auth-brand">
        <figure class="brand-logo-panel">
          <img src="/logo.jpeg" alt="Welco" class="brand-logo" width="320" height="180" loading="eager" />
        </figure>
      </aside>

      <main class="auth-form-wrap">
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

/* Left logo panel */
.auth-brand {
  background: var(--wl-ink-strong);
  color: #FFFFFF;
  padding: 2.75rem 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
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

.brand-logo-panel {
  margin: 0;
  position: relative;
  z-index: 1;
  background: #FFFFFF;
  border-radius: var(--radius-lg);
  padding: 2rem 2.25rem;
  width: 100%;
  max-width: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.12),
    0 0 60px rgba(79, 70, 229, 0.35),
    0 20px 45px -12px rgba(0, 0, 0, 0.5);
}

.brand-logo {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 4px;
}

/* Right Form */
.auth-form-wrap {
  padding: 2.5rem 2.75rem 3rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: var(--wl-surface);
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
  .brand-logo-panel { max-width: 260px; padding: 1.5rem 1.75rem; }
  .auth-form-wrap { padding: 2rem 1.5rem; }
}

@media (max-width: 480px) {
  .auth-brand { padding: 1.5rem 1rem; }
  .brand-logo-panel { max-width: 220px; padding: 1.25rem 1.5rem; }
  .auth-form-wrap { padding: 1.5rem 1rem; }
}
</style>
