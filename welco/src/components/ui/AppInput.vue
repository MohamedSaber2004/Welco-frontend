<script setup lang="ts">
import BaseInput from './BaseInput.vue'

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
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'clear'): void
}>()
</script>

<template>
  <BaseInput
    :model-value="modelValue"
    :label="label"
    :placeholder="placeholder"
    :type="type"
    :loading="loading"
    :error="error"
    :required="required"
    :disabled="disabled"
    :autocomplete="autocomplete"
    :inputmode="inputmode"
    :size="size"
    :icon="icon"
    :clearable="clearable"
    :id="id"
    v-bind="$attrs"
    @update:model-value="$emit('update:modelValue', $event)"
    @clear="$emit('clear')"
  >
    <template v-if="$slots.prefix" #prefix>
      <slot name="prefix" />
    </template>
    <template v-if="$slots.suffix" #suffix>
      <slot name="suffix" />
    </template>
  </BaseInput>
</template>
