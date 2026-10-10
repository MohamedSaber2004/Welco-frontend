<script setup lang="ts">
import BaseButton from './BaseButton.vue'

defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'gold' | 'success' | 'link'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  block?: boolean
  icon?: string
  iconPosition?: 'start' | 'end'
}>()
</script>

<template>
  <BaseButton
    :variant="variant"
    :size="size"
    :loading="loading"
    :disabled="disabled"
    :type="type"
    :block="block"
    :icon="icon"
    :icon-position="iconPosition"
    v-bind="$attrs"
  >
    <slot />
  </BaseButton>
</template>
