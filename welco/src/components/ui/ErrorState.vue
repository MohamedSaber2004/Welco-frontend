<script setup lang="ts">
import BaseButton from './BaseButton.vue'

withDefaults(
  defineProps<{
    title?: string
    message?: string
    retryText?: string
    /** optional tray serial label — only rendered when a real value is provided */
    code?: string
  }>(),
  {
    title: 'Something went wrong',
    message: 'Unable to load data. Please check your connection and try again.',
    retryText: 'Retry',
    code: undefined,
  },
)

defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="tray tray--error">
    <span class="tray__corner tray__corner--tl" aria-hidden="true" />
    <span class="tray__corner tray__corner--tr" aria-hidden="true" />
    <span class="tray__corner tray__corner--bl" aria-hidden="true" />
    <span class="tray__corner tray__corner--br" aria-hidden="true" />
    <span class="tray__tick" aria-hidden="true" />

    <div class="tray__inner">
      <div v-if="code" class="tray__head mono">
        <span>{{ code }}</span>
      </div>

      <div class="tray__mount">
        <div class="tray__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 4 20 20H4L12 4Z" />
            <line x1="12" y1="10" x2="12" y2="14" />
            <circle cx="12" cy="16.6" r="0.2" fill="currentColor" />
          </svg>
        </div>
        <span class="tray__mount-tick" aria-hidden="true" />
      </div>

      <h3 class="tray__title">{{ title }}</h3>
      <p class="tray__desc">{{ message }}</p>

      <div class="tray__actions">
        <BaseButton variant="danger" @click="$emit('retry')">
          ↻ {{ retryText }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tray {
  --tick: 12px;
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: clamp(2rem, 4vw, 3rem) clamp(1.25rem, 3vw, 2.5rem) 2rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-danger);
  border-radius: var(--wl-radius-lg);
  box-shadow: var(--wl-shadow-sm);
  isolation: isolate;
}

.tray__corner {
  position: absolute;
  width: var(--tick);
  height: var(--tick);
  border: 0 solid var(--wl-danger);
  z-index: 1;
}
.tray__corner--tl { top: 0; inset-inline-start: 0; border-top-width: 2px; border-inline-start-width: 2px; }
.tray__corner--tr { top: 0; inset-inline-end: 0; border-top-width: 2px; border-inline-end-width: 2px; }
.tray__corner--bl { bottom: 0; inset-inline-start: 0; border-bottom-width: 2px; border-inline-start-width: 2px; }
.tray__corner--br { bottom: 0; inset-inline-end: 0; border-bottom-width: 2px; border-inline-end-width: 2px; }

.tray__tick {
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 10px;
  background: var(--wl-danger);
  z-index: 1;
}

.tray__inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 420px;
}

.tray__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--wl-muted);
  margin-bottom: 1.4rem;
}
.tray__head::before,
.tray__head::after {
  content: '';
  width: 24px;
  height: 1px;
  background: var(--wl-line);
}

.tray__mount { position: relative; margin-bottom: 1.4rem; }
.tray__icon {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  background: var(--wl-surface);
  border: 1px solid var(--wl-danger);
  border-radius: var(--wl-radius);
  color: var(--wl-danger);
  box-shadow: inset 0 0 0 4px var(--wl-surface), var(--shadow-sm);
}
.tray__mount-tick {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 1px;
  height: 9px;
  background: var(--wl-danger);
  opacity: 0.8;
}

.tray__title {
  font-family: var(--wl-font-display);
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--wl-ink-strong);
  margin-bottom: 0.5rem;
}

.tray__desc {
  color: var(--wl-ink-soft);
  font-size: 0.9rem;
  line-height: 1.55;
  margin-bottom: 1.4rem;
}

.tray__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.tray__foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  margin-top: 1.6rem;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--wl-muted-soft);
}
.tray__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-danger);
  box-shadow: 0 0 0 3px var(--wl-danger-soft);
}

@media (prefers-reduced-motion: no-preference) {
  .tray__corner,
  .tray__tick,
  .tray__mount-tick {
    animation: inkIn 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .tray__corner--tl { animation-delay: 60ms; }
  .tray__corner--tr { animation-delay: 100ms; }
  .tray__corner--bl { animation-delay: 140ms; }
  .tray__corner--br { animation-delay: 180ms; }
  .tray__inner { animation: riseIn 320ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both; }
  @keyframes inkIn { from { opacity: 0; } to { opacity: 0.95; } }
  @keyframes riseIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
}
@media (prefers-reduced-motion: reduce) {
  .tray__corner,
  .tray__tick,
  .tray__mount-tick,
  .tray__inner { animation: none !important; }
}
</style>
