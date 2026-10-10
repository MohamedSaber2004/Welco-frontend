<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../../i18n'

const props = withDefaults(
  defineProps<{
    modelValue: string | number
    label?: string
    placeholder?: string
    type?: string
    loading?: boolean
    error?: string
    required?: boolean
    disabled?: boolean
    autocomplete?: string
    inputmode?: string
    size?: 'sm' | 'md' | 'lg'
    icon?: string
    clearable?: boolean
    id?: string
  }>(),
  {
    modelValue: '',
    label: undefined,
    placeholder: undefined,
    type: 'text',
    error: undefined,
    loading: false,
    required: false,
    disabled: false,
    autocomplete: undefined,
    inputmode: undefined,
    size: 'md',
    icon: undefined,
    clearable: false,
    id: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  clear: []
}>()

const onInput = (e: Event) => {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

const onClear = () => {
  emit('update:modelValue', '')
  emit('clear')
}

const sizeClass = computed(() => `field-control--${props.size}`)
</script>

<template>
  <div class="field" :class="{ 'has-error': Boolean(error), 'is-disabled': disabled, 'is-loading': loading }">
    <label v-if="label" :for="id" class="field__label">
      <span>{{ label }}</span>
      <span v-if="required" class="field__req" aria-hidden="true">*</span>
    </label>

    <div class="field-control" :class="[sizeClass, { 'has-prefix': icon || $slots.prefix, 'has-suffix': clearable || $slots.suffix || loading }]">
      <span v-if="icon || $slots.prefix" class="field-icon field-icon--prefix">
        <slot name="prefix">
          <span class="material-symbols-outlined text-[18px]">{{ icon }}</span>
        </slot>
      </span>

      <input
        :id="id"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :autocomplete="autocomplete"
        :inputmode="inputmode as never"
        :aria-invalid="Boolean(error)"
        :aria-busy="loading ? 'true' : undefined"
        class="field__input"
        @input="onInput"
      />

      <span v-if="loading" class="field__spinner" aria-hidden="true" />

      <button
        v-if="clearable && modelValue"
        type="button"
        class="field-clear-btn"
        :aria-label="t('common.clearInput')"
        @click="onClear"
      >
        <span class="material-symbols-outlined text-[16px]">close</span>
      </button>

      <span v-if="$slots.suffix" class="field-icon field-icon--suffix">
        <slot name="suffix" />
      </span>
    </div>

    <transition name="field-fade">
      <span v-if="error" class="field__error" role="alert">
        <span class="error-dot" aria-hidden="true"></span>
        <span>{{ error }}</span>
      </span>
    </transition>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  text-align: start;
  width: 100%;
}

.field__label {
  font-family: var(--font-sans);
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--weight-medium, 500);
  color: var(--fg-heading, #102a43);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.field__req {
  color: var(--color-danger-500, #ef4444);
  font-weight: var(--weight-medium, 500);
}

.field-control {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  background: var(--bg-surface, #ffffff);
  border: 1px solid var(--border, #E5E7EB);
  border-radius: var(--radius-sm, 8px);
  box-shadow: none;
  transition: border-color var(--duration-fast, 150ms) var(--ease-out, ease-out),
              box-shadow var(--duration-fast, 150ms) var(--ease-out, ease-out),
              background var(--duration-fast, 150ms) var(--ease-out, ease-out);
  overflow: hidden;
}

.field-control:hover:not(.is-disabled) {
  border-color: var(--border-strong, #D1D5DB);
}

.field-control:focus-within {
  border-color: var(--brand, #6366F1);
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18) !important;
  background: var(--bg-surface, #ffffff);
}

.field-control--sm {
  min-height: 38px;
  height: 38px;
  border-radius: var(--radius-sm, 8px);
}

.field-control--md {
  min-height: 44px;
  height: 44px;
  border-radius: var(--radius-sm, 8px);
}

.field-control--lg {
  min-height: 48px;
  height: 48px;
  border-radius: var(--radius-md, 12px);
}

.field__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  background: transparent;
  padding: 0 var(--space-4, 1rem);
  color: var(--fg-body, #42474d);
  font-family: var(--font-body);
  font-size: var(--text-md, 0.875rem);
  font-weight: var(--weight-regular, 400);
  outline: none;
  box-shadow: none !important;
  text-align: start;
}

.field-control--sm .field__input {
  font-size: var(--text-sm, 0.75rem);
  padding: 0 var(--space-3, 0.75rem);
}

.field-control--lg .field__input {
  font-size: var(--text-base, 1rem);
  padding: 0 var(--space-4, 1rem);
}

.field-control.has-prefix .field__input {
  padding-inline-start: 0.5rem;
}

.field-control.has-suffix .field__input {
  padding-inline-end: 0.5rem;
}

.field__input::placeholder {
  color: var(--fg-placeholder, #7a90a8);
  font-weight: var(--weight-regular, 400);
  text-align: start;
}

.field-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-placeholder, #7a90a8);
  flex-shrink: 0;
  transition: color var(--duration-fast, 150ms) ease;
}

.field-control:focus-within .field-icon {
  color: var(--secondary, #00A389);
}

.field-icon--prefix {
  padding-inline-start: 0.85rem;
}

.field-icon--suffix {
  padding-inline-end: 0.85rem;
}

.field-clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--fg-muted, #7a90a8);
  cursor: pointer;
  margin-inline-end: 0.5rem;
  transition: all 0.15s ease;
}

.field-clear-btn:hover {
  background: var(--bg-subtle, #edf4ff);
  color: var(--fg-heading, #102a43);
}

.has-error .field-control {
  border-color: var(--color-danger, #ef4444) !important;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12) !important;
  background: var(--bg-surface, #ffffff);
}

.field-control.is-disabled {
  opacity: 0.55;
  background: var(--bg-subtle, #f8fafc);
  color: var(--fg-subtle, #72787d);
  cursor: not-allowed;
}

.is-loading .field-control {
  padding-inline-end: 2.5rem;
}

.field__spinner {
  position: absolute;
  inset-inline-end: 0.75rem;
  width: 16px;
  height: 16px;
  border: 2px solid var(--border, #d9e2ec);
  border-top-color: var(--secondary, #00A389);
  border-radius: var(--radius-pill, 9999px);
  animation: spin 0.7s linear infinite;
  pointer-events: none;
}

.field__error {
  font-size: var(--text-xs, 0.75rem);
  font-weight: var(--weight-medium, 500);
  color: var(--fg-danger, #ef4444);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
}

.error-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--fg-danger, #ef4444);
  flex-shrink: 0;
}

.field-fade-enter-active,
.field-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.field-fade-enter-from,
.field-fade-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}
</style>
