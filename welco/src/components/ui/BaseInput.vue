<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../../i18n'

const props = withDefaults(
  defineProps<{
    modelValue: string | number
    label?: string
    placeholder?: string
    type?: string
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
  <div class="field" :class="{ 'has-error': Boolean(error), 'is-disabled': disabled }">
    <label v-if="label" :for="id" class="field__label">
      <span>{{ label }}</span>
      <span v-if="required" class="field__req" aria-hidden="true">*</span>
    </label>

    <div class="field-control" :class="[sizeClass, { 'has-prefix': icon || $slots.prefix, 'has-suffix': clearable || $slots.suffix }]">
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
        class="field__input"
        @input="onInput"
      />

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
  gap: 0.45rem;
  text-align: start;
  width: 100%;
}

.field__label {
  font-family: var(--wl-font-body);
  font-size: 12px;
  font-weight: 600;
  color: var(--wl-ink-soft);
  letter-spacing: 0.015em;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.field__req {
  color: var(--wl-danger);
  font-weight: 700;
}

.field-control {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  box-shadow: var(--shadow-xs);
  transition: border-color 0.22s var(--wl-ease-spring),
              box-shadow 0.22s var(--wl-ease-spring),
              background-color 0.2s ease,
              transform 0.15s ease;
  overflow: hidden;
}

.field-control:hover:not(.is-disabled) {
  border-color: var(--wl-border-strong);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
}

.field-control:focus-within {
  border-color: var(--wl-teal);
  box-shadow: var(--wl-focus-ring);
  transform: translateY(-0.5px);
  background: var(--wl-surface);
}

.field-control--sm {
  min-height: 36px;
  height: 36px;
  border-radius: 8px;
}

.field-control--md {
  min-height: 40px;
  height: 40px;
  border-radius: 10px;
}

.field-control--lg {
  min-height: 52px;
  height: 52px;
  border-radius: 12px;
}

.field__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  background: transparent;
  padding: 0 0.85rem;
  color: var(--wl-ink-strong);
  font-family: var(--wl-font-body);
  font-size: 13.5px;
  font-weight: 500;
  letter-spacing: -0.01em;
  outline: none;
  box-shadow: none !important;
  text-align: start;
}

.field-control--sm .field__input {
  font-size: 13px;
  padding: 0 0.75rem;
}

.field-control--lg .field__input {
  font-size: 15.5px;
  padding: 0 1.25rem;
}

.field-control.has-prefix .field__input {
  padding-inline-start: 0.5rem;
}

.field-control.has-suffix .field__input {
  padding-inline-end: 0.5rem;
}

.field__input::placeholder {
  color: var(--wl-muted);
  font-weight: 400;
  opacity: 0.85;
  text-align: start;
}

.field-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--wl-muted);
  flex-shrink: 0;
  transition: color 0.18s ease;
}

.field-control:focus-within .field-icon {
  color: var(--wl-teal);
}

.field-icon--prefix {
  padding-inline-start: 0.9rem;
}

.field-icon--suffix {
  padding-inline-end: 0.9rem;
}

.field-clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--wl-muted);
  cursor: pointer;
  margin-inline-end: 0.5rem;
  transition: all 0.15s ease;
}

.field-clear-btn:hover {
  background: var(--wl-surface-soft);
  color: var(--wl-ink-strong);
}

.has-error .field-control {
  border-color: var(--wl-danger) !important;
  box-shadow: var(--wl-focus-ring-danger) !important;
  background: var(--wl-surface);
}

.is-disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.is-disabled .field-control {
  background: var(--wl-surface-soft);
  pointer-events: none;
}

.field__error {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--wl-danger);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.error-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--wl-danger);
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
