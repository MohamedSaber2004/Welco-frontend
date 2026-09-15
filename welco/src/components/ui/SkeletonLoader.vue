<script setup lang="ts">
import { computed } from 'vue'
import DataState from './DataState.vue'

const props = withDefaults(
  defineProps<{
    type?: 'text' | 'card' | 'circle' | 'table-row' | 'custom'
      | 'product-card' | 'catalog-grid' | 'category-grid' | 'stats-grid'
      | 'table' | 'pdp' | 'list' | 'form' | 'location-grid' | 'hero' | 'pills'
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

const gridCount = computed(() => {
  const t = props.type
  if (t === 'catalog-grid') return props.count ?? 6
  if (t === 'category-grid') return props.count ?? 8
  if (t === 'stats-grid') return props.count ?? 4
  if (t === 'location-grid') return props.count ?? 3
  if (t === 'pills') return props.count ?? 6
  return props.count ?? 1
})
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
