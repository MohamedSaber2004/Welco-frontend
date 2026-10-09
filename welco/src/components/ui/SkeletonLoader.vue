<script setup lang="ts">
import DataState from './DataState.vue'

withDefaults(
  defineProps<{
    type?: 'text' | 'card' | 'circle' | 'table-row' | 'custom'
      | 'product-card' | 'catalog-grid' | 'category-grid' | 'stats-grid'
      | 'table' | 'pdp' | 'list' | 'form' | 'location-grid' | 'hero' | 'pills'
      | 'provider-grid' | 'provider-cards' | 'cat-provider-grid' | 'provider-mini-grid' | 'store-hero' | 'store-rows'
      | 'ticket' | 'track' | 'cert-grid'
      | 'address-grid' | 'order-detail' | 'order-confirm' | 'help-grid' | 'profile' | 'about'
    lines?: number
    count?: number
    width?: string
    height?: string
    gap?: string
  }>(),
  {
    type: 'text',
    lines: 1,
    count: 6,
  },
)
</script>

<template>
  <DataState
    state="loading"
    :skeletonType="type"
    :skeletonLines="lines"
    :skeletonCount="count"
    :skeletonWidth="width"
    :skeletonHeight="height"
    :skeletonGap="gap"
  />
</template>
