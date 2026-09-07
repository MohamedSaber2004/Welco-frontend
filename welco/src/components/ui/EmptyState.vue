<script setup lang="ts">
import BaseButton from './BaseButton.vue'

withDefaults(
  defineProps<{
    title?: string
    description?: string
    icon?: string
    actionText?: string
    fill?: boolean
    compact?: boolean
    code?: string
    status?: string
    variant?: 'default' | 'search' | 'catalog' | 'neutral'
  }>(),
  {
    icon: 'inventory_2',
    fill: false,
    compact: false,
    code: undefined,
    status: undefined,
    variant: 'default',
  },
)

defineEmits<{ action: [] }>()
</script>

<template>
  <div class="empty" :class="{ 'empty--fill': fill, 'empty--compact': compact, [`empty--${variant}`]: true }">
    <!-- subtle blueprint grid -->
    <div class="empty__grid" aria-hidden="true"></div>

    <div class="empty__inner">
      <div v-if="code" class="empty__code mono">
        <span class="empty__code-dot" aria-hidden="true"></span>
        <span>{{ code }}</span>
        <span class="empty__code-line" aria-hidden="true"></span>
      </div>

      <div class="empty__halo" aria-hidden="true">
        <div class="empty__icon">
          <span class="material-symbols-outlined icon--directional"><slot name="icon">{{ icon }}</slot></span>
        </div>
        <span class="empty__halo-ring empty__halo-ring--1"></span>
        <span class="empty__halo-ring empty__halo-ring--2"></span>
      </div>

      <h3 v-if="title" class="empty__title">{{ title }}</h3>
      <p v-if="description" class="empty__desc">{{ description }}</p>

      <div v-if="$slots.default || actionText" class="empty__actions">
        <slot>
          <BaseButton v-if="actionText" variant="primary" size="md" @click="$emit('action')">
            {{ actionText }}
          </BaseButton>
        </slot>
      </div>

      <div v-if="status" class="empty__foot mono">
        <span class="empty__foot-dot" aria-hidden="true"></span>
        <span>{{ status }}</span>
      </div>
    </div>

    <!-- caliper ticks -->
    <div class="empty__ticks" aria-hidden="true">
      <span v-for="i in 18" :key="i" class="empty__tick" :class="{ 'empty__tick--major': i % 6 === 0 }"></span>
    </div>
  </div>
</template>

<style scoped>
.empty {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: clamp(2.2rem, 5vw, 3.2rem) clamp(1.25rem, 4vw, 2.5rem) clamp(1.8rem, 3vw, 2.2rem);
  background: linear-gradient(180deg, var(--wl-surface) 0%, #F8FBFA 100%);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-xl);
  box-shadow: var(--wl-shadow-card);
  overflow: hidden;
  isolation: isolate;
  min-height: 260px;
}
:root[data-theme='dark'] .empty { background: linear-gradient(180deg, var(--wl-surface) 0%, #0F1F1E 100%); }

.empty__grid {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(203,213,216,0.32) 1px, transparent 1px),
    linear-gradient(90deg, rgba(203,213,216,0.32) 1px, transparent 1px);
  background-size: 22px 22px;
  opacity: 0.14;
  mask: radial-gradient(680px 320px at 50% 38%, black 38%, transparent 82%);
  pointer-events: none;
}
:root[data-theme='dark'] .empty__grid { opacity: 0.07; }

.empty--fill { flex: 1; min-height: 320px; }
.empty--compact { padding: 1.8rem 1.25rem 1.5rem; min-height: 180px; }
.empty--compact .empty__halo { width: 72px; height: 72px; margin-bottom: 1rem; }
.empty--compact .empty__icon { width: 46px; height: 46px; }
.empty--compact .empty__icon .material-symbols-outlined { font-size: 22px; }
.empty--compact .empty__title { font-size: 1rem; }
.empty--compact .empty__desc { font-size: 0.84rem; }

.empty__inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 440px;
  width: 100%;
}

.empty__code {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--wl-muted);
  margin-bottom: 1.1rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-full);
  padding: 0.28rem 0.7rem;
}
.empty__code-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--wl-teal); box-shadow: 0 0 0 3px rgba(14,113,105,0.14); }
.empty__code-line { width: 14px; height: 1px; background: var(--wl-line-strong); margin-inline-start: 0.2rem; }

/* — halo icon — */
.empty__halo {
  position: relative;
  width: 84px;
  height: 84px;
  display: grid;
  place-items: center;
  margin-bottom: 1.25rem;
}
.empty__icon {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-lg);
  color: var(--wl-teal);
  font-size: 1.5rem;
  box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.7);
  position: relative;
  z-index: 2;
}
.empty__icon .material-symbols-outlined { font-size: 26px; font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 28; }
.empty__halo-ring {
  position: absolute;
  inset: 0;
  border-radius: var(--wl-radius-lg);
  border: 1px solid rgba(14,113,105,0.10);
  pointer-events: none;
}
.empty__halo-ring--1 { inset: 6px; border-color: rgba(14,113,105,0.07); }
.empty__halo-ring--2 { inset: -6px; border-radius: 20px; border-style: dashed; border-color: rgba(203,213,216,0.55); opacity: 0.7; }

.empty__title {
  font-family: var(--wl-font-display);
  font-size: 1.18rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--wl-ink-strong);
  margin: 0 0 0.5rem;
  line-height: 1.3;
}
.empty__desc {
  color: var(--wl-ink-soft);
  font-size: 0.92rem;
  line-height: 1.6;
  margin: 0 0 1.35rem;
  max-width: 36ch;
  text-wrap: balance;
}

.empty__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.empty__foot {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 1.4rem;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--wl-muted-soft);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-full);
  padding: 0.32rem 0.65rem;
}
.empty__foot-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-amber);
  box-shadow: 0 0 0 3px var(--wl-amber-soft);
}

.empty__ticks {
  position: absolute;
  bottom: 0;
  inset-inline: 0;
  display: flex;
  gap: 6px;
  align-items: flex-end;
  justify-content: center;
  padding: 0.65rem 1rem 0.75rem;
  border-top: 1px solid var(--wl-line);
  background: linear-gradient(180deg, rgba(238,242,243,0.7), var(--wl-surface-soft));
  z-index: 1;
}
.empty__tick { width: 1px; height: 5px; background: var(--wl-line-strong); opacity: 0.5; }
.empty__tick--major { height: 9px; background: var(--wl-ink-strong); opacity: 0.16; }

@media (prefers-reduced-motion: no-preference) {
  .empty__halo { animation: haloIn 520ms var(--wl-ease-spring) both; }
  .empty__inner > *:not(.empty__halo) { animation: riseIn 420ms var(--wl-ease-spring) both; }
  .empty__inner > *:nth-child(2) { animation-delay: 80ms; }
  .empty__inner > *:nth-child(3) { animation-delay: 120ms; }
  .empty__inner > *:nth-child(4) { animation-delay: 160ms; }
  @keyframes haloIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
  @keyframes riseIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
}
</style>
