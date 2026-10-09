<script setup lang="ts">
import { t } from '../../i18n'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    label?: string
  }>(),
  { min: 1, max: 99999, label: undefined },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function step(delta: number) {
  const next = props.modelValue + delta
  if (next < props.min || next > props.max) return
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="qty" :aria-label="label || t('common.quantity')">
    <button
      type="button"
      class="qty__btn qty__btn--minus"
      :disabled="modelValue <= min"
      :aria-label="label ? `${label} ${t('common.decreaseQuantity')}` : t('common.decreaseQuantity')"
      @click="step(-1)"
    >
      <span class="material-symbols-outlined text-[15px]">remove</span>
    </button>
    <span class="qty__val mono">{{ modelValue }}</span>
    <button
      type="button"
      class="qty__btn qty__btn--plus"
      :disabled="modelValue >= max"
      :aria-label="label ? `${label} ${t('common.increaseQuantity')}` : t('common.increaseQuantity')"
      @click="step(1)"
    >
      <span class="material-symbols-outlined text-[15px]">add</span>
    </button>
  </div>
</template>

<style scoped>
.qty {
  display: inline-flex;
  align-items: center;
  height: 38px;
  background: var(--bg-surface, #ffffff);
  border: 1px solid var(--border, #d9e2ec);
  border-radius: var(--radius-md, 6px);
  overflow: hidden;
  box-shadow: var(--shadow-xs);
  transition: border-color var(--duration-fast, 150ms) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
}

.qty:focus-within {
  border-color: var(--color-focus, #0ea5e9);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
}

.qty:hover:not(:focus-within) {
  border-color: var(--border-strong, #c2c7cd);
}

.qty__btn {
  width: 36px;
  height: 100%;
  border: none;
  background: var(--bg-subtle, #edf4ff);
  color: var(--fg-heading, #102a43);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all var(--duration-fast, 150ms) var(--ease-out);
  user-select: none;
}

.qty__btn:hover:not(:disabled) {
  background: var(--color-primary-light, #e3efff);
  color: var(--color-primary, #0f3d56);
}

.qty__btn:active:not(:disabled) {
  transform: scale(0.95);
}

.qty__btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
  color: var(--wl-muted);
}

.qty__val {
  min-width: 44px;
  padding: 0 0.4rem;
  height: 100%;
  display: grid;
  place-items: center;
  text-align: center;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--wl-ink-strong);
  background: var(--wl-surface);
  border-inline-start: 1px solid var(--wl-border);
  border-inline-end: 1px solid var(--wl-border);
  letter-spacing: -0.01em;
}
</style>
