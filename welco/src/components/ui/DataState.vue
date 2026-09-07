<script setup lang="ts">
  import { computed } from 'vue'
  import SkeletonLoader from './SkeletonLoader.vue'
  import ErrorState from './ErrorState.vue'
  import EmptyState from './EmptyState.vue'

  const props = withDefaults(
    defineProps<{
      loading?: boolean
      error?: string | null
      empty?: boolean
      skeletonType?: 'text' | 'card' | 'circle' | 'table-row' | 'custom'
      | 'product-card' | 'catalog-grid' | 'category-grid' | 'stats-grid'
      | 'table' | 'pdp' | 'list' | 'form' | 'location-grid' | 'hero' | 'pills'
      skeletonLines?: number
      skeletonCount?: number
      skeletonHeight?: string
      skeletonGap?: string
      minHeight?: string
      emptyTitle?: string
      emptyDescription?: string
      emptyIcon?: string
      emptyVariant?: 'default' | 'search' | 'catalog' | 'neutral'
      actionText?: string
      errorTitle?: string
      retryText?: string
      data?: unknown
    }>(),
    {
      loading: false,
      error: null,
      empty: false,
      skeletonType: 'card',
      skeletonLines: 4,
      skeletonCount: undefined,
      skeletonHeight: undefined,
      skeletonGap: undefined,
      minHeight: undefined,
      emptyTitle: undefined,
      emptyDescription: undefined,
      emptyIcon: 'inventory_2',
      emptyVariant: 'default',
      actionText: undefined,
      errorTitle: undefined,
      retryText: undefined,
      data: undefined,
    },
  )

  defineEmits<{
    action: []
    retry: []
  }>()

  const isNullishEmpty = computed(() => {
    if (props.data === undefined) return false
    if (props.data === null) return true
    if (Array.isArray(props.data)) return props.data.length === 0
    if (typeof props.data === 'object' && props.data !== null) {
      return Object.keys(props.data as object).length === 0
    }
    return !props.data
  })

  const showEmpty = computed(() => props.empty || isNullishEmpty.value)</script>
<template>
  <div class="data-state"
       :style="minHeight ? { minHeight } : undefined"
       :aria-busy="loading ? 'true' : 'false'">
    <Transition name="state" mode="out-in">
      <slot v-if="loading" key="loading" name="skeleton">
        <SkeletonLoader :type="skeletonType"
                        :lines="skeletonLines"
                        :count="skeletonCount"
                        :height="skeletonHeight"
                        :gap="skeletonGap" />
      </slot><ErrorState v-else-if="error"
                         key="error"
                         :title="errorTitle"
                         :message="error"
                         :retry-text="retryText"
                         @retry="$emit('retry')" /><EmptyState v-else-if="showEmpty"
                                                               key="empty"
                                                               :title="emptyTitle"
                                                               :description="emptyDescription"
                                                               :icon="emptyIcon"
                                                               :variant="emptyVariant"
                                                               :action-text="actionText"
                                                               @action="$emit('action')"><slot name="empty" /></EmptyState><div v-else key="content" class="data-state__content"><slot /></div>
    </Transition>
  </div>
</template>
<style scoped>
  .data-state {
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  .data-state__content {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .state-enter-active,
  .state-leave-active {
    transition: opacity 0.24s ease, transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .state-enter-from,
  .state-leave-to {
    opacity: 0;
    transform: translateY(6px);
  }

  @media (prefers-reduced-motion: reduce) {
    .state-enter-active,
    .state-leave-active {
      transition: opacity 0.1s;
    }

    .state-enter-from,
    .state-leave-to {
      transform: none;
    }
  }
</style>
