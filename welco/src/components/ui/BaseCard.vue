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
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--radius-md, 12px);
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-base, 200ms) var(--ease-out, ease-out);
  overflow: hidden;
  position: relative;
}

.card--hover:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--brand, #6366F1);
  transform: translateY(-2px);
}

.card--pad-none .card__body { padding: 0; }
.card--pad-sm .card__body { padding: var(--space-4, 1rem); }
.card--pad-md .card__body { padding: var(--space-6, 1.5rem); }
.card--pad-lg .card__body { padding: var(--space-8, 2rem); }

.card__header {
  padding: var(--space-4, 1rem) var(--space-6, 1.5rem);
  border-bottom: 1px solid var(--border, #E5E7EB);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4, 1rem);
  background: var(--bg-surface, #ffffff);
}

.card__footer {
  padding: var(--space-4, 1rem) var(--space-6, 1.5rem);
  border-top: 1px solid var(--border, #E5E7EB);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4, 1rem);
  background: var(--bg-subtle, #F9FAFB);
}
</style>
