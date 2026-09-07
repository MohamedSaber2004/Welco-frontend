<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    block?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    loading: false,
    disabled: false,
    type: 'button',
    block: false,
  },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="['btn', `btn--${variant}`, `btn--${size}`, { 'btn--block': block }]"
  >
    <span v-if="loading" class="btn__spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-radius: 8px;
  border: 1px solid transparent;
  font-family: var(--wl-font-body);
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  box-shadow: var(--shadow-xs);
}

.btn:focus-visible {
  outline: 2px solid var(--wl-teal);
  outline-offset: 2px;
  box-shadow: var(--wl-teal-ring);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.btn--block {
  width: 100%;
}

.btn--primary {
  background: var(--wl-teal);
  color: #ffffff;
  border-color: var(--wl-teal);
  box-shadow: 0 1px 2px rgba(79, 70, 229, 0.15);
}

.btn--primary:hover:not(:disabled) {
  background: var(--wl-teal-hover);
  border-color: var(--wl-teal-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn--primary:active:not(:disabled) {
  transform: translateY(0);
}

.btn--secondary {
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  border-color: var(--wl-border);
  box-shadow: var(--shadow-xs);
}

.btn--secondary:hover:not(:disabled) {
  background: var(--wl-surface-soft);
  border-color: var(--wl-border-strong);
  transform: translateY(-1px);
}

.btn--outline {
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  border-color: var(--wl-border);
}

.btn--outline:hover:not(:disabled) {
  background: var(--wl-teal-soft);
  border-color: var(--wl-teal);
  color: var(--wl-teal);
  transform: translateY(-1px);
}

.btn--ghost {
  background: transparent;
  color: var(--wl-ink-soft);
  border-color: transparent;
  box-shadow: none;
}

.btn--ghost:hover:not(:disabled) {
  background: var(--wl-surface-soft);
  color: var(--wl-ink-strong);
}

.btn--danger {
  background: var(--wl-danger);
  color: #ffffff;
  border-color: var(--wl-danger);
  box-shadow: 0 2px 8px rgba(244, 63, 94, 0.2);
}

.btn--danger:hover:not(:disabled) {
  filter: brightness(0.95);
  transform: translateY(-1px);
}

.btn--sm {
  padding: 0.4rem 0.85rem;
  font-size: 0.8rem;
  border-radius: 6px;
}

.btn--md {
  padding: 0.6rem 1.15rem;
  font-size: 0.88rem;
  border-radius: 8px;
}

.btn--lg {
  padding: 0.75rem 1.45rem;
  font-size: 0.94rem;
  border-radius: 10px;
}

.btn__spinner {
  width: 15px;
  height: 15px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
