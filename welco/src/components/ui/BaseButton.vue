<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'gold' | 'success' | 'link'
    size?: 'sm' | 'md' | 'lg'
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    block?: boolean
    /** Material Symbols ligature rendered before the label. */
    icon?: string
    iconPosition?: 'start' | 'end'
  }>(),
  {
    variant: 'primary',
    size: 'md',
    loading: false,
    disabled: false,
    type: 'button',
    block: false,
    icon: undefined,
    iconPosition: 'start',
  },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : undefined"
    :class="['btn', `btn--${variant}`, `btn--${size}`, { 'btn--block': block, 'is-loading': loading }]"
  >
    <span v-if="loading" class="btn__spinner" aria-hidden="true" />
    <span
      v-else-if="icon && iconPosition === 'start'"
      class="material-symbols-outlined btn__icon"
      aria-hidden="true"
    >{{ icon }}</span>
    <slot />
    <span
      v-if="!loading && icon && iconPosition === 'end'"
      class="material-symbols-outlined btn__icon"
      aria-hidden="true"
    >{{ icon }}</span>
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-3, 0.65rem) var(--space-5, 1.15rem);
  border-radius: var(--radius-sm, 6px);
  border: 1px solid transparent;
  font-family: var(--font-body);
  font-size: var(--text-md, 0.8125rem);
  font-weight: var(--weight-medium, 500);
  line-height: 1;
  cursor: pointer;
  transition: all var(--duration-fast, 150ms) var(--ease-out, cubic-bezier(0, 0, 0.2, 1));
  white-space: nowrap;
  box-shadow: var(--shadow-xs);
  user-select: none;
  text-decoration: none;
  position: relative;
}

.btn:hover:not(:disabled) {
  text-decoration: none;
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.btn:active:not(:disabled) {
  transform: scale(0.98) translateY(0);
}

.btn__icon {
  font-size: 1.15em;
  line-height: 1;
  flex-shrink: 0;
}

.btn--primary:focus-visible,
.btn--secondary:focus-visible,
.btn--outline:focus-visible,
.btn--ghost:focus-visible,
.btn--link:focus-visible,
.btn--gold:focus-visible {
  outline: none;
  box-shadow: var(--ring-focus);
}

.btn--success:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px var(--color-success, #16A34A);
}

.btn--danger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px var(--color-danger-500, #EF4444);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
  transform: none;
}

.btn--block {
  width: 100%;
}

.btn--gold {
  background: var(--brand-soft);
  color: var(--brand);
  border-color: var(--brand-soft);
}
.btn--gold:hover:not(:disabled) {
  background: var(--color-brand-200);
  color: var(--brand-hover);
}

.btn--primary {
  background: var(--color-primary, #0F3D56);
  color: var(--fg-on-brand, #FFFFFF);
  border-color: var(--color-primary, #0F3D56);
  box-shadow: var(--shadow-brand);
}

.btn--primary:hover:not(:disabled) {
  background: var(--color-primary-deep, #001D32);
  color: var(--fg-on-brand, #FFFFFF);
  border-color: var(--color-primary-deep, #001D32);
  box-shadow: 0 4px 12px rgba(15, 61, 86, 0.25);
}

.btn--secondary {
  background: var(--color-steel-teal, #147D92);
  color: #FFFFFF;
  border-color: var(--color-steel-teal, #147D92);
  box-shadow: var(--shadow-xs);
}

.btn--secondary:hover:not(:disabled) {
  background: #0c6171;
  color: #FFFFFF;
  border-color: #0c6171;
  box-shadow: 0 4px 12px rgba(20, 125, 146, 0.25);
}

.btn--outline {
  background: transparent;
  color: var(--color-primary, #0F3D56);
  border-color: var(--color-primary, #0F3D56);
}

.btn--outline:hover:not(:disabled) {
  background: var(--color-primary-light, #E3EFFF);
  border-color: var(--color-primary-deep, #001D32);
  color: var(--color-primary-deep, #001D32);
}

.btn--ghost {
  background: transparent;
  color: var(--color-muted, #7A90A8);
  border-color: transparent;
  box-shadow: none;
}

.btn--ghost:hover:not(:disabled) {
  background: var(--color-surface-subtle, #F8FAFC);
  color: var(--color-heading, #102A43);
}

.btn--danger {
  background: var(--color-danger, #EF4444);
  color: #fff;
  border-color: var(--color-danger, #EF4444);
}

.btn--danger:hover:not(:disabled) {
  background: #DC2626;
  color: #fff;
  border-color: #DC2626;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
}

.btn--success {
  background: var(--color-success, #16A34A);
  color: #fff;
  border-color: var(--color-success, #16A34A);
}

.btn--success:hover:not(:disabled) {
  background: #15803D;
  color: #fff;
  border-color: #15803D;
  box-shadow: 0 4px 12px rgba(22, 163, 74, 0.25);
}

.btn--link {
  background: transparent;
  color: var(--color-steel-teal, #147D92);
  border-color: transparent;
  box-shadow: none;
  padding: 0;
  min-height: auto;
  height: auto;
  text-decoration: none;
}

.btn--link:hover:not(:disabled) {
  background: transparent;
  color: var(--color-primary, #0F3D56);
  text-decoration: underline;
  box-shadow: none;
  transform: none;
}

.btn--sm {
  min-height: 36px;
  height: 36px;
  padding: 0 var(--space-3, 0.75rem);
  font-size: var(--text-sm, 0.75rem);
  border-radius: var(--radius-sm, 4px);
}

.btn--md {
  min-height: 42px;
  height: 42px;
  padding: 0 var(--space-5, 1.15rem);
  font-size: var(--text-md, 0.8125rem);
  border-radius: var(--radius-md, 6px);
}

.btn--lg {
  min-height: 48px;
  height: 48px;
  padding: 0 var(--space-7, 1.5rem);
  font-size: var(--text-base, 0.875rem);
  border-radius: var(--radius-lg, 8px);
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
