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
  { variant: 'primary', size: 'md', loading: false, disabled: false, type: 'button', block: false },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="['btn', `btn--${variant}`, `btn--${size}`, { 'btn--block': block, 'is-loading': loading }]"
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
  gap: 0.55rem;
  border-radius: 10px;
  border: 1.5px solid transparent;
  font-family: var(--wl-font-body);
  font-weight: 700;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: all 0.18s var(--wl-ease-spring);
  white-space: nowrap;
  box-shadow: var(--shadow-xs);
  user-select: none;
}

.btn:active:not(:disabled) {
  transform: scale(0.985);
}

.btn:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}

.btn--block {
  width: 100%;
}

.btn--primary {
  background: var(--wl-primary);
  color: #ffffff;
  border-color: var(--wl-primary);
  box-shadow: 0 2px 8px -2px rgba(79, 70, 229, 0.3);
}
.btn--primary:hover:not(:disabled) {
  background: var(--wl-primary-hover);
  border-color: var(--wl-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px -2px rgba(79, 70, 229, 0.4);
}

.btn--secondary {
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  border-color: var(--wl-border);
}

.btn--secondary:hover:not(:disabled) {
  background: var(--wl-surface-soft);
  border-color: var(--wl-border-strong);
  transform: translateY(-1px);
}

.btn--outline {
  background: transparent;
  color: var(--wl-ink-strong);
  border-color: var(--wl-border);
}

.btn--outline:hover:not(:disabled) {
  background: var(--wl-primary-soft);
  border-color: var(--wl-primary);
  color: var(--wl-primary);
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
  background: #DC2626;
  color: #ffffff;
  border-color: #DC2626;
}

.btn--danger:hover:not(:disabled) {
  background: #B91C1C;
  border-color: #B91C1C;
  transform: translateY(-1px);
}

/* Control heights conforming to VIP ergonomic floor */
.btn--sm {
  height: 36px;
  padding: 0 0.85rem;
  font-size: 0.82rem;
  border-radius: 8px;
}

.btn--md {
  height: 44px;
  padding: 0 1.25rem;
  font-size: 0.88rem;
  border-radius: 10px;
}

.btn--lg {
  height: 50px;
  padding: 0 1.65rem;
  font-size: 0.95rem;
  border-radius: 12px;
}

.btn__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
