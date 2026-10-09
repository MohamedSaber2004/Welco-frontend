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
  display: flex;
  flex-direction: column;
  background: var(--bg-surface, #ffffff);
  border: 1px solid var(--border, #d9e2ec);
  border-radius: 10px;
  box-shadow: var(--shadow-xs, 0 1px 2px rgba(16, 42, 67, 0.04));
  transition: all var(--duration-base, 200ms) var(--ease-out, ease-out);
  overflow: hidden;
  position: relative;
}

.card--hover:hover {
  box-shadow: var(--shadow-md, 0 4px 12px rgba(15, 61, 86, 0.08));
  border-color: var(--brand, #0f3d56);
  transform: translateY(-2px);
}

.card--pad-none .card__body { padding: 0; }
.card--pad-sm .card__body { padding: var(--space-4, 1rem); }
.card--pad-md .card__body { padding: var(--space-6, 1.5rem); }
.card--pad-lg .card__body { padding: var(--space-8, 2rem); }

.card__header {
  padding: var(--space-4, 1rem) var(--space-6, 1.5rem);
  border-bottom: 1px solid var(--border, #d9e2ec);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4, 1rem);
  background: var(--bg-surface, #ffffff);
}

.card__footer {
  padding: var(--space-4, 1rem) var(--space-6, 1.5rem);
  border-top: 1px solid var(--border, #d9e2ec);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4, 1rem);
  background: var(--bg-subtle, #edf4ff);
}
</style>
