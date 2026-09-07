<script setup lang="ts">
withDefaults(
  defineProps<{
    hoverable?: boolean
    padding?: 'none' | 'sm' | 'md' | 'lg'
  }>(),
  {
    hoverable: false,
    padding: 'md',
  },
)
</script>

<template>
  <div :class="['card', `card--pad-${padding}`, { 'card--hover': hoverable }]">
    <div v-if="$slots.header" class="card__header">
      <slot name="header" />
    </div>
    <div class="card__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="card__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--wl-shadow-card);
  transition: border-color var(--wl-transition), box-shadow var(--wl-transition), transform 0.15s ease;
  overflow: hidden;
  position: relative;
}
.card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.55);
  pointer-events: none;
}
.card::before {
  content: '';
  position: absolute;
  inset-inline: 0;
  top: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
}
.card--hover:hover::before { opacity: 1; }
.card--hover:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: rgba(79,70,229,0.22);
}
.card--pad-none .card__body { padding: 0; }
.card--pad-sm .card__body { padding: var(--space-4); }
.card--pad-md .card__body { padding: var(--space-6); }
.card--pad-lg .card__body { padding: var(--space-8); }
.card__header {
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--wl-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(180deg, rgba(255,255,255,0.6), transparent);
}
.card__footer {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--wl-border);
  background: var(--wl-surface-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
