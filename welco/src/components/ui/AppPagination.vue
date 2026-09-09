<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../../i18n'

interface Props {
  page?: number
  modelValue?: number
  totalPages: number
  totalItems?: number
  pageSize?: number
  siblingCount?: number
  showInfo?: boolean
  showPageNumbers?: boolean
  variant?: 'default' | 'table' | 'compact'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  page: 1,
  modelValue: undefined,
  totalPages: 1,
  totalItems: undefined,
  pageSize: 10,
  siblingCount: 1,
  showInfo: undefined,
  showPageNumbers: true,
  variant: 'default',
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:page', value: number): void
  (e: 'update:modelValue', value: number): void
  (e: 'change', value: number): void
}>()

const currentPage = computed(() => {
  if (typeof props.modelValue === 'number') return props.modelValue
  return props.page || 1
})

const hasInfo = computed(() => {
  if (typeof props.showInfo === 'boolean') return props.showInfo
  return typeof props.totalItems === 'number' || props.variant === 'table'
})

const itemRange = computed(() => {
  if (typeof props.totalItems !== 'number') return null
  const start = (currentPage.value - 1) * props.pageSize + 1
  const end = Math.min(currentPage.value * props.pageSize, props.totalItems)
  return { start: Math.max(1, start), end, total: props.totalItems }
})

const paginationRange = computed(() => {
  const total = Math.max(1, props.totalPages)
  const current = Math.min(Math.max(1, currentPage.value), total)
  const siblings = props.siblingCount

  const totalNumbers = siblings * 2 + 5

  if (total <= totalNumbers) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const leftSiblingIndex = Math.max(current - siblings, 1)
  const rightSiblingIndex = Math.min(current + siblings, total)

  const shouldShowLeftDots = leftSiblingIndex > 2
  const shouldShowRightDots = rightSiblingIndex < total - 2

  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftItemCount = 3 + 2 * siblings
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1)
    return [...leftRange, '...', total]
  }

  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightItemCount = 3 + 2 * siblings
    const rightRange = Array.from({ length: rightItemCount }, (_, i) => total - rightItemCount + i + 1)
    return [1, '...', ...rightRange]
  }

  if (shouldShowLeftDots && shouldShowRightDots) {
    const middleRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i
    )
    return [1, '...', ...middleRange, '...', total]
  }

  return Array.from({ length: total }, (_, i) => i + 1)
})

const goTo = (p: number | string) => {
  if (typeof p !== 'number') return
  if (p < 1 || p > props.totalPages || p === currentPage.value || props.disabled) return
  emit('update:page', p)
  emit('update:modelValue', p)
  emit('change', p)
}
</script>

<template>
  <nav
    v-if="totalPages > 1 || hasInfo"
    class="custom-pagination"
    :class="[
      `custom-pagination--${variant}`,
      { 'custom-pagination--disabled': disabled }
    ]"
    role="navigation"
    :aria-label="t('common.pagination')"
  >
    <div v-if="hasInfo" class="pagination__info mono">
      <template v-if="itemRange">
        <span>{{ t('common.showing') }}</span>
        <strong class="mono-num">{{ itemRange.start }}–{{ itemRange.end }}</strong>
        <span>{{ t('common.of') }}</span>
        <strong class="mono-num">{{ itemRange.total }}</strong>
      </template>
      <template v-else>
        <span>{{ t('common.page', { current: currentPage, total: totalPages }) }}</span>
      </template>
    </div>

    <div v-if="totalPages > 1" class="pagination__controls">
      <button
        type="button"
        class="page-nav-btn page-nav-btn--prev"
        :disabled="currentPage <= 1 || disabled"
        :aria-disabled="currentPage <= 1 || disabled"
        :aria-label="t('common.prev')"
        @click="goTo(currentPage - 1)"
      >
        <span class="material-symbols-outlined icon--directional nav-icon" aria-hidden="true">chevron_left</span>
        <span class="nav-text">{{ t('common.prev') }}</span>
      </button>

      <div v-if="showPageNumbers" class="pagination__pages">
        <template v-for="(item, idx) in paginationRange" :key="idx">
          <span v-if="item === '...'" class="page-ellipsis mono" aria-hidden="true">…</span>
          <button
            v-else
            type="button"
            class="page-num-btn mono-num"
            :class="{ 'is-active': item === currentPage }"
            :aria-current="item === currentPage ? 'page' : undefined"
            :aria-label="t('common.pageNumber', { number: item })"
            :disabled="disabled"
            @click="goTo(item)"
          >
            {{ item }}
          </button>
        </template>
      </div>

      <div v-else class="page-indicator mono">
        <strong class="mono-num">{{ currentPage }}</strong>
        <span class="page-indicator__sep">/</span>
        <span class="mono-num">{{ totalPages }}</span>
      </div>

      <button
        type="button"
        class="page-nav-btn page-nav-btn--next"
        :disabled="currentPage >= totalPages || disabled"
        :aria-disabled="currentPage >= totalPages || disabled"
        :aria-label="t('common.next')"
        @click="goTo(currentPage + 1)"
      >
        <span class="nav-text">{{ t('common.next') }}</span>
        <span class="material-symbols-outlined icon--directional nav-icon" aria-hidden="true">chevron_right</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.custom-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 0.25rem 0.25rem;
  user-select: none;
  flex-wrap: wrap;
}

.custom-pagination:not(:has(.pagination__info)) {
  justify-content: center;
}

.custom-pagination--table {
  padding: 0.75rem 1.15rem;
  background: var(--wl-surface-soft);
  border-top: 1px solid var(--wl-border);
  border-radius: 0 0 12px 12px;
}

.custom-pagination--compact {
  padding: 0.5rem 0;
  gap: 0.5rem;
}

.custom-pagination--disabled {
  opacity: 0.55;
  pointer-events: none;
}

.pagination__info {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 12px;
  color: var(--wl-muted);
}

.pagination__info strong {
  color: var(--wl-ink-strong);
  font-weight: 600;
}

.pagination__controls {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.pagination__pages {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.page-nav-btn,
.page-num-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 8px;
  color: var(--wl-ink-soft);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.page-nav-btn {
  padding: 0 0.75rem;
  gap: 0.25rem;
}

.page-num-btn {
  min-width: 34px;
  padding: 0 0.5rem;
}

.page-nav-btn:hover:not(:disabled),
.page-num-btn:hover:not(:disabled):not(.is-active) {
  background: var(--wl-surface-soft);
  border-color: rgba(99, 102, 241, 0.35);
  color: var(--wl-ink-strong);
}

.page-num-btn.is-active {
  background: var(--wl-primary) !important;
  border-color: var(--wl-primary) !important;
  color: #ffffff !important;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(79, 70, 229, 0.28), 0 1px 2px rgba(79, 70, 229, 0.16);
}

.page-nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  border-color: var(--wl-border);
  background: var(--wl-surface);
  box-shadow: none;
}

.page-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  color: var(--wl-muted);
  font-size: 13px;
}

.page-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0 0.5rem;
  font-size: 12px;
  color: var(--wl-muted);
}

.page-indicator strong {
  color: var(--wl-ink-strong);
}

.nav-icon {
  font-size: 17px;
}

.nav-text {
  font-size: 12.5px;
  font-weight: 500;
}

@media (max-width: 640px) {
  .custom-pagination {
    justify-content: center;
    gap: 0.75rem;
  }
  .pagination__info {
    width: 100%;
    justify-content: center;
  }
  .page-nav-btn .nav-text {
    display: none;
  }
  .page-nav-btn {
    padding: 0 0.45rem;
  }
  .pagination__pages {
    gap: 0.15rem;
  }
  .page-num-btn {
    min-width: 30px;
    height: 30px;
    font-size: 12px;
  }
  .page-nav-btn {
    height: 30px;
  }
}
</style>
