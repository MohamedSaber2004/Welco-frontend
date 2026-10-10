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
  border-radius: var(--radius-sm, 8px);
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
  background: var(--brand-soft, #EEF2FF);
  color: var(--brand, #6366F1);
  border: 1px solid rgba(99, 102, 241, 0.2);
}
.btn--gold:hover:not(:disabled) {
  background: #E0E7FF;
  color: var(--brand-hover, #4F46E5);
  border-color: rgba(99, 102, 241, 0.35);
}

.btn--primary {
  background: var(--brand, #6366F1);
  color: #FFFFFF;
  border: 1px solid transparent;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
}

.btn--primary:hover:not(:disabled) {
  background: var(--brand-hover, #4F46E5);
  color: #FFFFFF;
  border-color: transparent;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
}

.btn--secondary {
  background: var(--secondary, #14B8A6);
  color: #FFFFFF;
  border: 1px solid transparent;
  box-shadow: 0 2px 6px rgba(20, 184, 166, 0.25);
}

.btn--secondary:hover:not(:disabled) {
  background: var(--secondary-hover, #0D9488);
  color: #FFFFFF;
  border-color: transparent;
  box-shadow: 0 4px 14px rgba(20, 184, 166, 0.35);
}

.btn--outline {
  background: var(--bg-surface, #FFFFFF);
  color: var(--fg-heading, #111827);
  border: 1px solid var(--border, #E5E7EB);
  box-shadow: var(--shadow-xs);
}

.btn--outline:hover:not(:disabled) {
  background: var(--brand-soft, #EEF2FF);
  border-color: var(--brand, #6366F1);
  color: var(--brand, #6366F1);
}

.btn--ghost {
  background: transparent;
  color: var(--fg-body, #4B5563);
  border-color: transparent;
  box-shadow: none;
}

.btn--ghost:hover:not(:disabled) {
  background: var(--bg-subtle, #F3F4F6);
  color: var(--brand, #6366F1);
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
  background: var(--color-success, #10B981);
  color: #fff;
  border-color: var(--color-success, #10B981);
}

.btn--success:hover:not(:disabled) {
  background: #059669;
  color: #fff;
  border-color: #059669;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
}

.btn--link {
  background: transparent;
  color: var(--brand, #6366F1);
  border-color: transparent;
  box-shadow: none;
  padding: 0;
  min-height: auto;
  height: auto;
  text-decoration: none;
}

.btn--link:hover:not(:disabled) {
  background: transparent;
  color: var(--brand-hover, #4F46E5);
  text-decoration: underline;
  box-shadow: none;
  transform: none;
}

.btn--sm {
  min-height: 36px;
  height: 36px;
  padding: 0 var(--space-3, 0.75rem);
  font-size: var(--text-sm, 0.75rem);
  border-radius: var(--radius-sm, 8px);
}

.btn--md {
  min-height: 42px;
  height: 42px;
  padding: 0 var(--space-5, 1.15rem);
  font-size: var(--text-md, 0.8125rem);
  border-radius: var(--radius-sm, 8px);
}

.btn--lg {
  min-height: 48px;
  height: 48px;
  padding: 0 var(--space-7, 1.5rem);
  font-size: var(--text-base, 0.875rem);
  border-radius: var(--radius-md, 12px);
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
