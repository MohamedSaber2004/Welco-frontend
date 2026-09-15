<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { t } from '../../i18n'

/* ── Props ───────────────────────────────────────────────
 * New unified API  → state / loadingDelay / emptyVariant / errorRecoverable / onRetry / icon
 * Legacy API       → loading / error / empty / data / minHeight / emptyTitle / ...
 * The new `state` prop wins when provided; otherwise the legacy
 * boolean flags are evaluated for backward compatibility.
 */
const props = withDefaults(
  defineProps<{
    /* new unified API */
    state?: 'loading' | 'empty' | 'error' | 'success'
    loadingDelay?: number
    emptyVariant?: 'first-use' | 'no-results' | 'cleared' | 'default' | 'search' | 'catalog' | 'neutral'
    errorRecoverable?: boolean
    onRetry?: () => void
    icon?: string

    /* empty state extras */
    title?: string
    description?: string
    actionText?: string
    emptyCode?: string
    emptyStatus?: string
    fill?: boolean
    compact?: boolean

    /* error state extras */
    errorTitle?: string
    errorMessage?: string
    retryText?: string
    errorCode?: string

    /* success state extras */
    successTitle?: string
    successMessage?: string

    /* skeleton / loading props */
    skeletonType?: 'text' | 'card' | 'circle' | 'table-row' | 'custom'
      | 'product-card' | 'catalog-grid' | 'category-grid' | 'stats-grid'
      | 'table' | 'pdp' | 'list' | 'form' | 'location-grid' | 'hero' | 'pills'
    skeletonLines?: number
    skeletonCount?: number
    skeletonWidth?: string
    skeletonHeight?: string
    skeletonGap?: string

    /* legacy API (backward-compat) */
    loading?: boolean
    error?: string | null
    empty?: boolean
    data?: unknown
    minHeight?: string
    emptyTitle?: string
    emptyDescription?: string
    emptyIcon?: string
    emptyVariantLegacy?: 'default' | 'search' | 'catalog' | 'neutral'
  }>(),
  {
    state: undefined,
    loadingDelay: 200,
    emptyVariant: 'first-use',
    errorRecoverable: true,
    icon: 'inventory_2',
    title: undefined,
    description: undefined,
    actionText: undefined,
    emptyCode: undefined,
    emptyStatus: undefined,
    fill: false,
    compact: false,
    errorTitle: 'Something went wrong',
    errorMessage: 'Unable to load data. Please check your connection and try again.',
    retryText: 'Retry',
    errorCode: undefined,
    successTitle: undefined,
    successMessage: undefined,
    skeletonType: 'text',
    skeletonLines: 1,
    skeletonCount: 6,
    skeletonWidth: undefined,
    skeletonHeight: undefined,
    skeletonGap: undefined,
    loading: false,
    error: null,
    empty: false,
    data: undefined,
    minHeight: undefined,
    emptyTitle: undefined,
    emptyDescription: undefined,
    emptyIcon: 'inventory_2',
    emptyVariantLegacy: 'default',
  },
)

defineEmits<{
  action: []
  retry: []
}>()

/* ── Derived state (backward-compat) ──────────────────── */
const isNullishEmpty = computed(() => {
  if (props.data === undefined) return false
  if (props.data === null) return true
  if (Array.isArray(props.data)) return props.data.length === 0
  if (typeof props.data === 'object' && props.data !== null) {
    return Object.keys(props.data as object).length === 0
  }
  return !props.data
})

const legacyEmpty = computed(() => props.empty || isNullishEmpty.value)

const resolvedState = computed<'loading' | 'empty' | 'error' | 'success'>(() => {
  if (props.state) return props.state
  if (props.loading) return 'loading'
  if (props.error) return 'error'
  if (legacyEmpty.value) return 'empty'
  return 'success'
})

const resolvedEmptyVariant = computed<'first-use' | 'no-results' | 'cleared'>(() => {
  const raw = props.emptyVariant
  if (raw === 'no-results' || raw === 'cleared') return raw
  if (raw === 'search') return 'no-results'
  return 'first-use' // covers 'first-use', 'default', 'catalog', 'neutral', and undefined
})

/* ── Loading delay ─────────────────────────────────────── */
const showLoading = ref(false)
const loadingTimer = ref<ReturnType<typeof setTimeout> | null>(null)

watch(
  () => resolvedState.value,
  (newState) => {
    if (loadingTimer.value) {
      clearTimeout(loadingTimer.value)
      loadingTimer.value = null
    }
    if (newState === 'loading') {
      showLoading.value = false
      loadingTimer.value = setTimeout(() => {
        showLoading.value = true
      }, props.loadingDelay)
    } else {
      showLoading.value = true
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (loadingTimer.value) clearTimeout(loadingTimer.value)
})

/* ── Empty-state copy helpers ─────────────────────────── */
const emptyCopy = computed(() => {
  if (props.title) return { title: props.title, description: props.description }
  switch (resolvedEmptyVariant.value) {
    case 'no-results':
      return { title: 'No results', description: 'No items match your search.' }
    case 'cleared':
      return { title: 'All caught up', description: undefined }
    case 'first-use':
    default:
      return { title: 'No items yet', description: 'Add your first to start tracking.' }
  }
})

const emptyTitle = computed(() => emptyCopy.value.title)
const emptyDescription = computed(() => emptyCopy.value.description)

/* ── Error-state copy helpers ─────────────────────────── */
const errorTitle = computed(() => props.errorTitle || 'Something went wrong')
const errorMessage = computed(() => props.errorMessage || 'Unable to load data. Please check your connection and try again.')

/* ── Success-state copy helpers ───────────────────────── */
const successTitle = computed(() => props.successTitle || 'Success')
const successMessage = computed(() => props.successMessage || 'Operation completed successfully.')

/* ── Skeleton helpers ─────────────────────────────────── */
const gridCount = computed(() => {
  const t = props.skeletonType
  if (t === 'catalog-grid') return props.skeletonCount ?? 6
  if (t === 'category-grid') return props.skeletonCount ?? 8
  if (t === 'stats-grid') return props.skeletonCount ?? 4
  if (t === 'location-grid') return props.skeletonCount ?? 3
  if (t === 'pills') return props.skeletonCount ?? 6
  return props.skeletonCount ?? 1
})

const delay = (i: number) => ({ '--delay': `${i * 70}ms` } as Record<string, string>)
</script>

<template>
  <div
    class="data-state"
    role="status"
    aria-live="polite"
    :aria-label="resolvedState === 'loading' ? t('common.loading') : undefined"
    :style="minHeight ? { minHeight } : undefined"
    :aria-busy="resolvedState === 'loading' ? 'true' : 'false'"
  >
    <!-- ══ Loading ══════════════════════════════════════════ -->
    <div v-if="resolvedState === 'loading' && showLoading" class="data-state__loading" role="status" aria-live="polite">
      <slot name="loading">
        <template v-if="skeletonType === 'text'">
          <div class="skeleton-wrapper">
            <div v-for="i in skeletonLines" :key="i" class="sk sk--text"
              :style="{
                width: i === skeletonLines && skeletonLines > 1 ? '65%' : skeletonWidth || '100%',
                height: skeletonHeight || '14px',
                ...delay(i),
              }" />
          </div>
        </template>
        <template v-else-if="skeletonType === 'card'">
          <div class="sk sk--card" :style="{ width: skeletonWidth, height: skeletonHeight || '180px', ...delay(1) }" />
        </template>
        <template v-else-if="skeletonType === 'circle'">
          <div class="sk sk--circle" :style="{ width: skeletonWidth || '44px', height: skeletonHeight || skeletonWidth || '44px', ...delay(1) }" />
        </template>
        <template v-else-if="skeletonType === 'table-row'">
          <div class="skeleton-wrapper"><div v-for="i in skeletonLines" :key="i" class="sk sk--row" :style="delay(i)" /></div>
        </template>
        <template v-else-if="skeletonType === 'custom'">
          <div class="sk" :style="{ width: skeletonWidth, height: skeletonHeight, ...delay(1) }" />
        </template>
        <template v-else-if="skeletonType === 'product-card'">
          <div class="sk-card" :style="delay(1)"><div class="sk-card__media sk" :style="delay(1)"><div class="sk-card__media-badge sk" style="width:56px;height:16px;border-radius:var(--radius-pill);position:absolute;top:10px;inset-inline-start:10px" /><div class="sk-card__media-badge sk" style="width:62px;height:18px;border-radius:var(--radius-pill);position:absolute;top:10px;inset-inline-end:10px" /></div><div class="sk-card__body"><div class="sk sk--text" style="width:42%;height:10px" :style="delay(2)" /><div class="sk sk--text" style="width:96%;height:14px" :style="delay(3)" /><div class="sk sk--text" style="width:78%;height:14px" :style="delay(4)" /><div class="sk sk--text" style="width:52%;height:10px;margin-top:2px" :style="delay(5)" /><div class="sk-card__foot"><div style="display:flex;flex-direction:column;gap:6px;flex:1"><div class="sk" style="width:84px;height:16px;border-radius:var(--radius-sm)" :style="delay(6)" /><div class="sk" style="width:110px;height:10px;border-radius:var(--radius-sm)" :style="delay(7)" /></div><div class="sk" style="width:44px;height:16px;border-radius:var(--radius-pill)" :style="delay(8)" /></div><div class="sk-card__actions"><div class="sk" style="height:34px;flex:1;border-radius:var(--radius-md)" :style="delay(9)" /><div class="sk" style="height:34px;flex:1;border-radius:var(--radius-md)" :style="delay(10)" /></div></div></div>
        </template>
        <template v-else-if="skeletonType === 'catalog-grid'">
          <div class="sk-grid sk-grid--catalog" :style="{ gap: skeletonGap || '1.5rem' }"><div v-for="i in gridCount" :key="i" class="sk-card" :style="delay(i)"><div class="sk-card__media sk" :style="delay(i)"><div class="sk sk--badge sk--badge-left" :style="delay(i)" /><div class="sk sk--badge sk--badge-right" :style="delay(i+1)" /></div><div class="sk-card__body"><div class="sk sk--eyebrow" :style="delay(i+1)" /><div class="sk sk--title" :style="delay(i+2)" /><div class="sk sk--title sk--title-short" :style="delay(i+3)" /><div class="sk sk--caption" :style="delay(i+4)" /><div class="sk-card__foot"><div style="display:flex;flex-direction:column;gap:6px"><div class="sk sk--price" :style="delay(i+5)" /><div class="sk sk--caption-sm" :style="delay(i+6)" /></div><div class="sk sk--rating" :style="delay(i+7)" /></div><div class="sk-card__actions"><div class="sk sk--btn" :style="delay(i+8)" /><div class="sk sk--btn sk--btn-primary" :style="delay(i+9)" /></div></div></div></div>
        </template>
        <template v-else-if="skeletonType === 'category-grid'">
          <div class="sk-grid sk-grid--category" :style="{ gap: skeletonGap || '1rem' }"><div v-for="i in gridCount" :key="i" class="sk-cat" :style="delay(i)"><div class="sk sk-cat__media" :style="delay(i)" /><div class="sk-cat__body"><div class="sk" style="width:72%;height:13px;border-radius:var(--radius-sm);margin:0 auto" :style="delay(i+2)" /><div class="sk" style="width:46%;height:9px;border-radius:var(--radius-pill);margin:6px auto 0" :style="delay(i+3)" /></div></div></div>
        </template>
        <template v-else-if="skeletonType === 'stats-grid'">
          <div class="sk-grid sk-grid--stats" :style="{ gap: skeletonGap || '1rem' }"><div v-for="i in gridCount" :key="i" class="sk-stat" :style="delay(i)"><div class="sk sk-stat__icon" :style="delay(i)" /><div class="sk-stat__body"><div class="sk" style="width:68%;height:10px;border-radius:var(--radius-sm)" :style="delay(i+1)" /><div class="sk" style="width:44%;height:20px;border-radius:var(--radius-sm);margin-top:8px" :style="delay(i+2)" /><div class="sk" style="width:56%;height:9px;border-radius:var(--radius-sm);margin-top:8px" :style="delay(i+3)" /></div></div></div>
        </template>
        <template v-else-if="skeletonType === 'location-grid'">
          <div class="sk-grid sk-grid--location" :style="{ gap: skeletonGap || '1rem' }"><div v-for="i in gridCount" :key="i" class="sk-loc" :style="delay(i)"><div class="sk-loc__head"><div class="sk" style="width:38%;height:16px;border-radius:var(--radius-sm)" :style="delay(i)" /><div class="sk" style="width:22px;height:18px;border-radius:var(--radius-pill)" :style="delay(i+1)" /></div><div class="sk" style="width:46%;height:10px;border-radius:var(--radius-sm)" :style="delay(i+1)" /><div class="sk-loc__list"><div v-for="r in 5" :key="r" class="sk sk--loc-row" :style="delay(i+r)" /></div></div></div>
        </template>
        <template v-else-if="skeletonType === 'pdp'">
          <div class="sk-pdp"><div class="sk-pdp__gallery sk" :style="delay(1)"><div class="sk sk--badge sk--badge-left" style="position:absolute;top:16px;inset-inline-start:16px;width:68px;height:20px;border-radius:var(--radius-sm)" /><div class="sk" style="position:absolute;top:16px;inset-inline-end:16px;width:52px;height:20px;border-radius:var(--radius-pill)" :style="delay(2)" /><div class="sk-pdp__placeholder"><div class="sk" style="width:120px;height:120px;border-radius:var(--radius-md);opacity:.6" :style="delay(2)" /></div><div class="sk-pdp__foot"><div class="sk" style="width:34%;height:10px;border-radius:var(--radius-sm)" :style="delay(3)" /><div class="sk" style="width:26%;height:10px;border-radius:var(--radius-sm)" :style="delay(4)" /></div></div><div class="sk-pdp__order"><div style="display:flex;flex-direction:column;gap:10px"><div class="sk" style="width:28%;height:11px;border-radius:var(--radius-sm)" :style="delay(1)" /><div class="sk" style="width:88%;height:26px;border-radius:var(--radius-md)" :style="delay(2)" /><div class="sk" style="width:96%;height:26px;border-radius:var(--radius-md)" :style="delay(3)" /><div class="sk" style="width:64%;height:12px;border-radius:var(--radius-sm)" :style="delay(4)" /></div><div class="sk sk-pdp__price-card" :style="delay(3)"><div style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;flex-direction:column;gap:8px"><div class="sk" style="width:92px;height:24px;border-radius:var(--radius-sm)" :style="delay(5)" /><div class="sk" style="width:140px;height:11px;border-radius:var(--radius-sm)" :style="delay(6)" /></div><div class="sk" style="width:96px;height:22px;border-radius:var(--radius-pill)" :style="delay(6)" /></div><div style="display:flex;gap:12px;margin-top:16px"><div class="sk" style="width:108px;height:44px;border-radius:var(--radius-md)" :style="delay(7)" /><div class="sk" style="height:44px;flex:1;border-radius:var(--radius-md)" :style="delay(8)" /></div><div style="display:flex;gap:10px;margin-top:12px"><div class="sk" style="height:38px;flex:1;border-radius:var(--radius-pill)" :style="delay(9)" /><div class="sk" style="height:38px;width:128px;border-radius:var(--radius-pill)" :style="delay(10)" /></div></div></div></div>
        </template>
        <template v-else-if="skeletonType === 'table'">
          <div class="sk-table" :style="delay(1)"><div class="sk-table__head"><div v-for="i in 5" :key="i" class="sk" style="height:12px;border-radius:var(--radius-sm)" :style="delay(i)" /></div><div v-for="r in (skeletonCount ?? 5)" :key="r" class="sk-table__row" :style="delay(r)"><div class="sk sk-table__cell sk-table__cell--avatar" :style="delay(r)" /><div style="flex:1;display:flex;flex-direction:column;gap:6px"><div class="sk" style="width:58%;height:12px;border-radius:var(--radius-sm)" :style="delay(r+1)" /><div class="sk" style="width:38%;height:10px;border-radius:var(--radius-sm)" :style="delay(r+2)" /></div><div class="sk" style="width:84px;height:20px;border-radius:var(--radius-pill)" :style="delay(r+1)" /><div class="sk" style="width:72px;height:12px;border-radius:var(--radius-sm)" :style="delay(r+2)" /><div style="display:flex;gap:8px"><div class="sk" style="width:64px;height:30px;border-radius:var(--radius-md)" :style="delay(r+3)" /><div class="sk" style="width:64px;height:30px;border-radius:var(--radius-md)" :style="delay(r+4)" /></div></div></div>
        </template>
        <template v-else-if="skeletonType === 'list'">
          <div class="skeleton-wrapper" :style="{ gap: skeletonGap || '10px' }"><div v-for="i in (skeletonCount ?? 4)" :key="i" class="sk-list" :style="delay(i)"><div class="sk sk-list__avatar" :style="delay(i)" /><div style="flex:1;display:flex;flex-direction:column;gap:7px"><div class="sk" style="width:46%;height:13px;border-radius:var(--radius-sm)" :style="delay(i+1)" /><div class="sk" style="width:72%;height:11px;border-radius:var(--radius-sm)" :style="delay(i+2)" /></div><div class="sk" style="width:64px;height:22px;border-radius:var(--radius-pill)" :style="delay(i+2)" /></div></div>
        </template>
        <template v-else-if="skeletonType === 'form'">
          <div class="sk-form" :style="{ gap: skeletonGap || '14px' }"><div v-for="i in (skeletonCount ?? 4)" :key="i" style="display:flex;flex-direction:column;gap:7px" :style="delay(i)"><div class="sk" style="width:28%;height:10px;border-radius:var(--radius-sm)" :style="delay(i)" /><div class="sk" style="width:100%;height:42px;border-radius:var(--radius-md)" :style="delay(i+1)" /></div><div style="display:flex;gap:10px;margin-top:6px"><div class="sk" style="height:40px;flex:1;border-radius:var(--radius-pill)" :style="delay(6)" /><div class="sk" style="height:40px;flex:1;border-radius:var(--radius-pill)" :style="delay(7)" /></div></div>
        </template>
        <template v-else-if="skeletonType === 'pills'">
          <div class="sk-pills" :style="{ gap: skeletonGap || '0.5rem' }">
            <div v-for="i in gridCount" :key="i" class="sk sk--pill" :style="delay(i)" />
          </div>
        </template>
        <template v-else-if="skeletonType === 'hero'">
          <div class="sk-hero" :style="delay(1)"><div style="flex:1;display:flex;flex-direction:column;gap:14px"><div class="sk" style="width:32%;height:12px;border-radius:var(--radius-pill)" :style="delay(1)" /><div class="sk" style="width:84%;height:32px;border-radius:var(--radius-md)" :style="delay(2)" /><div class="sk" style="width:76%;height:32px;border-radius:var(--radius-md)" :style="delay(3)" /><div class="sk" style="width:92%;height:14px;border-radius:var(--radius-sm)" :style="delay(4)" /><div class="sk" style="width:88%;height:14px;border-radius:var(--radius-sm)" :style="delay(5)" /><div style="display:flex;gap:12px;margin-top:8px"><div class="sk" style="width:128px;height:42px;border-radius:var(--radius-pill)" :style="delay(6)" /><div class="sk" style="width:128px;height:42px;border-radius:var(--radius-pill)" :style="delay(7)" /></div></div><div class="sk sk-hero__art" :style="delay(4)" /></div>
        </template>
      </slot>
    </div>

    <!-- ══ Empty ════════════════════════════════════════════ -->
    <div v-else-if="resolvedState === 'empty'" class="data-state__empty" :class="{ 'data-state__empty--fill': fill, 'data-state__empty--compact': compact }">
      <div class="data-state__empty__grid" aria-hidden="true"></div>
      <div class="data-state__empty__inner">
        <slot name="empty-icon">
          <div class="empty__halo" aria-hidden="true">
            <div class="empty__icon">
              <span class="material-symbols-outlined icon--directional">{{ icon }}</span>
            </div>
            <span class="empty__halo-ring empty__halo-ring--1"></span>
            <span class="empty__halo-ring empty__halo-ring--2"></span>
          </div>
        </slot>

        <div v-if="emptyCode" class="empty__code mono">
          <span class="empty__code-dot" aria-hidden="true"></span>
          <span>{{ emptyCode }}</span>
          <span class="empty__code-line" aria-hidden="true"></span>
        </div>

        <h3 v-if="emptyTitle" class="empty__title">{{ emptyTitle }}</h3>
        <p v-if="emptyDescription" class="empty__desc">{{ emptyDescription }}</p>

        <div v-if="$slots.default || actionText" class="empty__actions">
          <slot>
            <BaseButton v-if="actionText" variant="primary" size="md" @click="$emit('action')">
              {{ actionText }}
            </BaseButton>
          </slot>
        </div>

        <div v-if="emptyStatus" class="empty__foot mono">
          <span class="empty__foot-dot" aria-hidden="true"></span>
          <span>{{ emptyStatus }}</span>
        </div>
      </div>

      <div class="empty__ticks" aria-hidden="true">
        <span v-for="i in 18" :key="i" class="empty__tick" :class="{ 'empty__tick--major': i % 6 === 0 }"></span>
      </div>
    </div>

    <!-- ══ Error ═════════════════════════════════════════════ -->
    <div v-else-if="resolvedState === 'error'" class="data-state__error">
      <span class="tray__corner tray__corner--tl" aria-hidden="true" />
      <span class="tray__corner tray__corner--tr" aria-hidden="true" />
      <span class="tray__corner tray__corner--bl" aria-hidden="true" />
      <span class="tray__corner tray__corner--br" aria-hidden="true" />
      <span class="tray__tick" aria-hidden="true" />

      <div class="tray__inner">
        <div v-if="errorCode" class="tray__head mono">
          <span>{{ errorCode }}</span>
        </div>

        <div class="tray__mount">
          <slot name="error-icon">
            <div class="tray__icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 4 20 20H4L12 4Z" />
                <line x1="12" y1="10" x2="12" y2="14" />
                <circle cx="12" cy="16.6" r="0.2" fill="currentColor" />
              </svg>
            </div>
          </slot>
          <span class="tray__mount-tick" aria-hidden="true" />
        </div>

        <h3 class="tray__title">{{ errorTitle }}</h3>
        <p class="tray__desc">{{ errorMessage }}</p>

        <div v-if="errorRecoverable" class="tray__actions">
          <BaseButton variant="danger" @click="$emit('retry')">
            ↻ {{ retryText }}
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- ══ Success ═══════════════════════════════════════════ -->
    <div v-else-if="resolvedState === 'success'" class="data-state__success">
      <div class="data-state__success__icon" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--wl-success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <h3 v-if="successTitle" class="data-state__success__title">{{ successTitle }}</h3>
      <p v-if="successMessage" class="data-state__success__desc">{{ successMessage }}</p>
      <slot />
    </div>

    <!-- ══ Default / custom content ════════════════════════ -->
    <slot v-else />
  </div>
</template>

<style scoped>
/* ── Loading skeleton ─────────────────────────────────── */
.data-state__loading {
  width: 100%;
}

.skeleton-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

.sk {
  border-radius: var(--radius-sm);
  background: var(--skeleton-base);
  position: relative;
  overflow: hidden;
  border: 1px solid var(--wl-line);
  animation: sk-pulse 3.2s ease-in-out infinite;
  will-change: opacity;
}

.sk--text {
  margin-bottom: 0;
  height: 12px;
}

.sk--card {
  border-radius: var(--radius-md);
  border: 1px solid var(--wl-line);
  min-height: 120px;
}

.sk--circle {
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}

.sk--row {
  height: 44px;
  border-radius: var(--radius-md);
  border: 1px solid var(--wl-line);
}

@media (prefers-reduced-motion: no-preference) {
  .sk::after {
    content: '';
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, transparent 0%, transparent 40%, var(--skeleton-highlight) 50%, transparent 60%, transparent 100%);
    animation: sk-sweep 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    animation-delay: var(--delay, 0ms);
    will-change: transform;
  }

  @keyframes sk-sweep {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  @keyframes sk-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.94; }
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk::after { display: none; }
  .sk { animation: none; }
}

.skeleton-root {
  --skeleton-base: var(--wl-surface-soft);
  --skeleton-highlight: rgba(255,255,255,0.58);
  --skeleton-pulse-from: var(--wl-surface-soft);
  --skeleton-pulse-to: #E6EEEE;
}

:root[data-theme='dark'] .skeleton-root {
  --skeleton-base: #1A2E44;
  --skeleton-highlight: rgba(255,255,255,0.14);
  --skeleton-pulse-from: #1A2E44;
  --skeleton-pulse-to: #223A55;
}

/* card */
.sk-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-md);
  background: var(--wl-surface);
  box-shadow: var(--wl-shadow-card);
  overflow: hidden;
}

.sk-card__media {
  height: 160px;
  position: relative;
  display: grid;
  place-items: center;
  border-bottom: 1px solid var(--wl-line);
  border-radius: 0;
  background: var(--skeleton-base);
}

.sk-card__media-badge {
  border-radius: var(--radius-pill);
}

.sk-card__body {
  padding: 1.05rem 1.05rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  flex: 1;
  background: var(--wl-surface);
}

.sk--eyebrow { width: 36%; height: 10px; border-radius: var(--radius-sm); }
.sk--title { width: 94%; height: 13px; border-radius: var(--radius-sm); }
.sk--title-short { width: 72%; height: 13px; border-radius: var(--radius-sm); }
.sk--caption { width: 52%; height: 10px; border-radius: var(--radius-sm); opacity: .9; }
.sk--caption-sm { width: 96px; height: 9px; border-radius: var(--radius-sm); }
.sk--price { width: 78px; height: 16px; border-radius: var(--radius-sm); }
.sk--rating { width: 42px; height: 16px; border-radius: var(--radius-pill); }

.sk-card__foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: auto;
  padding-top: 0.6rem;
  gap: 1rem;
}

.sk-card__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.6rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--wl-line);
}

.sk--btn { flex: 1; height: 34px; border-radius: var(--radius-md); }
.sk--btn-primary {
  background: var(--wl-primary-soft);
  border-color: rgba(var(--wl-primary-rgb), 0.12);
}

.sk--badge { width: 52px; height: 16px; border-radius: var(--radius-pill); position: absolute; top: 10px; }
.sk--badge-left { inset-inline-start: 10px; }
.sk--badge-right { inset-inline-end: 10px; }

/* grids */
.sk-grid { display: grid; width: 100%; }
.sk-grid--catalog { grid-template-columns: repeat(3, 1fr); }
.sk-grid--category { grid-template-columns: repeat(4, 1fr); }
.sk-grid--stats { grid-template-columns: repeat(4, 1fr); }
.sk-grid--location { grid-template-columns: repeat(3, 1fr); align-items: start; }

@media (max-width: 1120px) {
  .sk-grid--catalog { grid-template-columns: repeat(2, 1fr); }
  .sk-grid--category { grid-template-columns: repeat(3, 1fr); }
  .sk-grid--stats { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 760px) {
  .sk-grid--catalog, .sk-grid--category, .sk-grid--stats, .sk-grid--location { grid-template-columns: 1fr; }
}

/* category */
.sk-cat {
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--wl-shadow-card);
}

.sk-cat__media {
  height: 172px;
  border-radius: 0;
  border: none;
  border-bottom: 1px solid var(--wl-line);
  background: var(--skeleton-base);
}

.sk-cat__body {
  padding: 0.95rem 0.9rem 1.05rem;
  background: var(--wl-surface);
}

/* stats */
.sk-stat {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-md);
  box-shadow: var(--wl-shadow-card);
}

.sk-stat__icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.sk-stat__body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* location */
.sk-loc {
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-md);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: var(--wl-shadow-card);
  min-height: 440px;
}

.sk-loc__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--wl-line);
}

.sk-loc__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.sk--loc-row {
  height: 42px;
  border-radius: var(--radius-md);
  border: 1px solid var(--wl-line);
}

/* pdp */
.sk-pdp {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.75rem;
  align-items: start;
  width: 100%;
}

.sk-pdp__gallery {
  min-height: 460px;
  border-radius: var(--radius-md);
  border: 1px solid var(--wl-line);
  background: var(--skeleton-base);
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  box-shadow: var(--wl-shadow-card);
}

.sk-pdp__placeholder {
  width: 100%;
  height: 100%;
  min-height: 420px;
  display: grid;
  place-items: center;
}

.sk-pdp__foot {
  position: absolute;
  bottom: 0;
  inset-inline: 0;
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--wl-line);
  background: var(--wl-paper);
}

.sk-pdp__order {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sk-pdp__price-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-md);
  padding: 1.35rem;
  box-shadow: var(--wl-shadow-card);
  height: auto;
}

.sk-pdp__tabs {
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-md);
  overflow: hidden;
  height: auto;
  min-height: 160px;
}

@media (max-width: 980px) {
  .sk-pdp {
    grid-template-columns: 1fr;
    gap: 1.75rem;
  }
  .sk-pdp__gallery { min-height: 340px; }
}

/* table */
.sk-table {
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--wl-shadow-card);
}

.sk-table__head {
  display: grid;
  grid-template-columns: 1.2fr 2fr 120px 120px 160px;
  gap: 1rem;
  padding: 0.85rem 1rem;
  background: var(--wl-ink-strong);
  align-items: center;
}

:root[data-theme='dark'] .sk-table__head,
:root.dark .sk-table__head {
  background: #111214;
}

.sk-table__head .sk {
  background: rgba(255,255,255,0.12);
  border: none;
}

:root[data-theme='dark'] .sk-table__head .sk {
  background: rgba(255,255,255,0.08);
}

.sk-table__row {
  display: grid;
  grid-template-columns: 1.2fr 2fr 120px 120px 160px;
  gap: 1rem;
  padding: 0.95rem 1rem;
  border-bottom: 1px solid var(--wl-line);
  align-items: center;
}

.sk-table__row:last-child { border-bottom: none; }

.sk-table__cell--avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}

@media (max-width: 760px) {
  .sk-table__head, .sk-table__row {
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }
  .sk-table__head { display: none; }
  .sk-table__row { display: flex; flex-wrap: wrap; }
}

/* list */
.sk-list {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--wl-line);
  background: var(--wl-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--wl-shadow-card);
}

.sk-list__avatar {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}

/* form */
.sk-form {
  display: flex;
  flex-direction: column;
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  box-shadow: var(--wl-shadow-card);
}

/* hero */
.sk-hero {
  display: grid;
  grid-template-columns: 1.18fr 0.92fr;
  gap: 3rem;
  align-items: center;
  padding: 1rem 0;
}

.sk-hero__art {
  height: 320px;
  border-radius: var(--radius-md);
  border: 1px solid var(--wl-line);
  background: var(--skeleton-base);
}

@media (max-width: 900px) {
  .sk-hero {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  .sk-hero__art { height: 220px; }
}

/* pills */
.sk-pills {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.25rem 0;
  width: 100%;
}

.sk--pill {
  height: 34px;
  width: 110px;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}

/* ── Empty state ──────────────────────────────────────── */
.data-state__empty {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: clamp(2.2rem, 5vw, 3.2rem) clamp(1.25rem, 4vw, 2.5rem) clamp(1.8rem, 3vw, 2.2rem);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  box-shadow: var(--wl-shadow-card);
  overflow: hidden;
  isolation: isolate;
  min-height: 260px;
}

.data-state__empty__grid {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(203,213,216,0.32) 1px, transparent 1px),
    linear-gradient(90deg, rgba(203,213,216,0.32) 1px, transparent 1px);
  background-size: 22px 22px;
  opacity: 0.14;
  mask: radial-gradient(680px 320px at 50% 38%, black 38%, transparent 82%);
  pointer-events: none;
}

:root[data-theme='dark'] .data-state__empty__grid { opacity: 0.05; }

.data-state__empty--fill { flex: 1; min-height: 320px; }
.data-state__empty--compact { padding: 1.8rem 1.25rem 1.5rem; min-height: 180px; }
.data-state__empty--compact .empty__halo { width: 72px; height: 72px; margin-bottom: 1rem; }
.data-state__empty--compact .empty__icon { width: 46px; height: 46px; }
.data-state__empty--compact .empty__icon .material-symbols-outlined { font-size: 22px; }
.data-state__empty--compact .empty__title { font-size: 1rem; }
.data-state__empty--compact .empty__desc { font-size: 0.84rem; }

.data-state__empty__inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 440px;
  width: 100%;
}

.empty__code {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--wl-muted);
  margin-bottom: 1.1rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-pill);
  padding: 0.28rem 0.7rem;
}

.empty__code-dot { width: 6px; height: 6px; border-radius: var(--radius-pill); background: var(--wl-primary); box-shadow: 0 0 0 3px var(--wl-primary-soft); }
.empty__code-line { width: 14px; height: 1px; background: var(--wl-line-strong); margin-inline-start: 0.2rem; }

/* halo */
.empty__halo {
  position: relative;
  width: 84px;
  height: 84px;
  display: grid;
  place-items: center;
  margin-bottom: 1.25rem;
}

.empty__icon {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  color: var(--wl-primary);
  font-size: 1.5rem;
  box-shadow: var(--wl-shadow-card);
  position: relative;
  z-index: 2;
}

.empty__icon .material-symbols-outlined { font-size: 26px; font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 28; }

.empty__halo-ring {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-md);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.12);
  pointer-events: none;
}

.empty__halo-ring--1 { inset: 6px; border-color: rgba(var(--wl-primary-rgb), 0.08); }
.empty__halo-ring--2 { inset: -6px; border-radius: 20px; border-style: dashed; border-color: var(--wl-border-strong); opacity: 0.7; }

.empty__title {
  font-family: var(--wl-font-display);
  font-size: 1.18rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--wl-ink-strong);
  margin: 0 0 0.5rem;
  line-height: 1.3;
}

.empty__desc {
  color: var(--wl-ink-soft);
  font-size: 0.92rem;
  line-height: 1.6;
  margin: 0 0 1.35rem;
  max-width: 36ch;
  text-wrap: balance;
}

.empty__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.empty__foot {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 1.4rem;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-pill);
  padding: 0.32rem 0.65rem;
}

.empty__foot-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--wl-accent);
  box-shadow: 0 0 0 3px var(--wl-accent-soft);
}

.empty__ticks {
  position: absolute;
  bottom: 0;
  inset-inline: 0;
  display: flex;
  gap: 6px;
  align-items: flex-end;
  justify-content: center;
  padding: 0.65rem 1rem 0.75rem;
  border-top: 1px solid var(--wl-line);
  background: linear-gradient(180deg, transparent, var(--wl-surface-soft));
  z-index: 1;
}

.empty__tick { width: 1px; height: 5px; background: var(--wl-line-strong); opacity: 0.5; }
.empty__tick--major { height: 9px; background: var(--wl-ink-strong); opacity: 0.16; }

/* ── Error state (tray) ───────────────────────────────── */
.data-state__error {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: clamp(2rem, 4vw, 3rem) clamp(1.25rem, 3vw, 2.5rem) 2rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-danger);
  border-radius: var(--radius-md);
  box-shadow: var(--wl-shadow-card);
  isolation: isolate;
}

.tray__corner {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 0 solid var(--wl-danger);
  z-index: 1;
}

.tray__corner--tl { top: 0; inset-inline-start: 0; border-top-width: 2px; border-inline-start-width: 2px; }
.tray__corner--tr { top: 0; inset-inline-end: 0; border-top-width: 2px; border-inline-end-width: 2px; }
.tray__corner--bl { bottom: 0; inset-inline-start: 0; border-bottom-width: 2px; border-inline-start-width: 2px; }
.tray__corner--br { bottom: 0; inset-inline-end: 0; border-bottom-width: 2px; border-inline-end-width: 2px; }

.tray__tick {
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 10px;
  background: var(--wl-danger);
  z-index: 1;
}

.tray__inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 420px;
}

.tray__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--wl-muted);
  margin-bottom: 1.4rem;
}

.tray__head::before,
.tray__head::after {
  content: '';
  width: 24px;
  height: 1px;
  background: var(--wl-line);
}

.tray__mount { position: relative; margin-bottom: 1.4rem; }

.tray__icon {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  background: var(--wl-surface);
  border: 1px solid var(--wl-danger);
  border-radius: var(--radius-md);
  color: var(--wl-danger);
  box-shadow: inset 0 0 0 4px var(--wl-surface), var(--wl-shadow-card);
}

.tray__mount-tick {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 1px;
  height: 9px;
  background: var(--wl-danger);
  opacity: 0.8;
}

.tray__title {
  font-family: var(--wl-font-display);
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--wl-ink-strong);
  margin-bottom: 0.5rem;
}

.tray__desc {
  color: var(--wl-ink-soft);
  font-size: 0.9rem;
  line-height: 1.55;
  margin-bottom: 1.4rem;
}

.tray__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.tray__foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  margin-top: 1.6rem;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--wl-muted);
}

.tray__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--wl-danger);
  box-shadow: 0 0 0 3px var(--wl-danger-soft);
}

/* ── Success state ────────────────────────────────────── */
.data-state__success {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: clamp(2rem, 4vw, 3rem) clamp(1.25rem, 3vw, 2.5rem) 2rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-success);
  border-radius: var(--radius-md);
  box-shadow: var(--wl-shadow-card);
  isolation: isolate;
  min-height: 200px;
}

.data-state__success__icon {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-pill);
  background: var(--wl-success-soft);
  border: 1px solid var(--wl-success);
  margin-bottom: 1.25rem;
}

.data-state__success__title {
  font-family: var(--wl-font-display);
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--wl-ink-strong);
  margin-bottom: 0.5rem;
}

.data-state__success__desc {
  color: var(--wl-ink-soft);
  font-size: 0.9rem;
  line-height: 1.55;
  max-width: 36ch;
}

/* ── Entrance animations ──────────────────────────────── */
@media (prefers-reduced-motion: no-preference) {
  .data-state__empty .empty__halo { animation: haloIn 520ms var(--wl-ease-spring) both; }
  .data-state__empty .data-state__empty__inner > *:not(.empty__halo) { animation: riseIn 420ms var(--wl-ease-spring) both; }
  .data-state__empty .data-state__empty__inner > *:nth-child(2) { animation-delay: 80ms; }
  .data-state__empty .data-state__empty__inner > *:nth-child(3) { animation-delay: 120ms; }
  .data-state__empty .data-state__empty__inner > *:nth-child(4) { animation-delay: 160ms; }

  .data-state__error .tray__corner,
  .data-state__error .tray__tick,
  .data-state__error .tray__mount-tick {
    animation: inkIn 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .data-state__error .tray__corner--tl { animation-delay: 60ms; }
  .data-state__error .tray__corner--tr { animation-delay: 100ms; }
  .data-state__error .tray__corner--bl { animation-delay: 140ms; }
  .data-state__error .tray__corner--br { animation-delay: 180ms; }
  .data-state__error .tray__inner { animation: riseIn 320ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both; }

  .data-state__success { animation: riseIn 420ms var(--wl-ease-spring) both; }
}

@keyframes haloIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
@keyframes riseIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes inkIn { from { opacity: 0; } to { opacity: 0.95; } }

@media (prefers-reduced-motion: reduce) {
  .data-state__empty .empty__halo,
  .data-state__empty .data-state__empty__inner > *:not(.empty__halo),
  .data-state__error .tray__corner,
  .data-state__error .tray__tick,
  .data-state__error .tray__mount-tick,
  .data-state__error .tray__inner,
  .data-state__success {
    animation: none !important;
  }
}
</style>
