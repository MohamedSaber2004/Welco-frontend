<script setup lang="ts">
import { useRouter } from 'vue-router'
import { t } from '../i18n'
import BackButton from '../components/ui/BackButton.vue'

const router = useRouter()
</script>

<template>
  <div class="not-found-page page-shell">
    <BackButton fallback="/" variant="minimal" class="mb-4" />

    <div class="not-found-card card">
      <div class="not-found-badge mono">
        <span class="material-symbols-outlined text-[18px]">travel_explore</span>
        <span>404 ERROR</span>
      </div>

      <div class="not-found-code mono">404</div>

      <h1 class="not-found-title">{{ t('common.pageNotFound') }}</h1>
      <p class="not-found-desc">{{ t('common.pageNotFoundDesc') }}</p>

      <div class="not-found-actions">
        <button
          type="button"
          class="btn btn-primary btn-lg"
          @click="router.push('/')"
        >
          <span class="material-symbols-outlined">home</span>
          <span>{{ t('nav.home') }}</span>
        </button>

        <button
          type="button"
          class="btn btn-secondary btn-lg"
          @click="router.push('/marketplace')"
        >
          <span class="material-symbols-outlined">explore</span>
          <span>{{ t('nav.marketplace') }}</span>
        </button>

        <button
          type="button"
          class="btn btn-ghost btn-lg"
          @click="router.push('/support')"
        >
          <span class="material-symbols-outlined">support_agent</span>
          <span>{{ t('nav.help') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found-page {
  min-height: 70vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: var(--space-8) var(--space-4);
}

.not-found-card {
  max-width: 640px;
  width: 100%;
  text-align: center;
  padding: var(--space-8) var(--space-6);
  border-radius: var(--radius-xl, 1.25rem);
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.not-found-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.85rem;
  border-radius: var(--radius-pill);
  background: rgba(217, 119, 6, 0.12);
  color: #d97706;
  font-size: var(--step--1);
  font-weight: 700;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-4);
}

.not-found-code {
  font-size: clamp(4.5rem, 12vw, 7.5rem);
  font-weight: 900;
  line-height: 1;
  background: var(--wl-gradient-gold, linear-gradient(135deg, #d4af37, #996515));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-bottom: var(--space-2);
  letter-spacing: -0.04em;
}

.not-found-title {
  font-size: clamp(1.4rem, 3vw, 1.85rem);
  font-weight: 700;
  color: var(--wl-ink);
  margin-bottom: var(--space-3);
}

.not-found-desc {
  font-size: var(--step-0);
  color: var(--wl-muted);
  max-width: 440px;
  margin: 0 auto var(--space-6);
  line-height: 1.6;
}

.not-found-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: center;
  width: 100%;
}
</style>
