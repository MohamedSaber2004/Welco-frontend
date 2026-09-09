<script setup lang="ts">
  import { computed } from 'vue'
  import { t } from '../../i18n'

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
    if (props.type === 'catalog-grid') return props.count ?? 6
    if (props.type === 'category-grid') return props.count ?? 8
    if (props.type === 'stats-grid') return props.count ?? 4
    if (props.type === 'location-grid') return props.count ?? 3
    if (props.type === 'pills') return props.count ?? 6
    return props.count ?? 1
  })

  const delay = (i: number) => ({ '--delay': `${(i * 70)}ms` } as Record<string, string>)</script>
<template>
  <div class="skeleton-root"
       role="status"
       aria-live="polite"
       aria-busy="true"
       :aria-label="t('common.loading')">
    <template v-if="type === 'text'">
      <div class="skeleton-wrapper">
        <div v-for="i in lines"
             :key="i"
             class="sk sk--text"
             :style="{
              width: i === lines && lines >
           1 ? '65%' : width || '100%',
          height: height || '14px',
          ...delay(i),
          }"
           />
         </div>
     </template>
     <template v-else-if="type === 'card'">
       <div class="sk sk--card" :style="{ width, height: height || '180px', ...delay(1) }" />
     </template>
     <template v-else-if="type === 'circle'">
       <div class="sk sk--circle" :style="{ width: width || '44px', height: height || width || '44px', ...delay(1) }" />
     </template>
     <template v-else-if="type === 'table-row'">
       <div class="skeleton-wrapper"><div v-for="i in lines" :key="i" class="sk sk--row" :style="delay(i)" /></div>
     </template>
     <template v-else-if="type === 'custom'">
       <div class="sk" :style="{ width, height, ...delay(1) }" />
     </template>
     <template v-else-if="type === 'product-card'">
       <div class="sk-card" :style="delay(1)"><div class="sk-card__media sk" :style="delay(1)"><div class="sk-card__media-badge sk" style="width:56px;height:16px;border-radius:999px;position:absolute;top:10px;inset-inline-start:10px" /><div class="sk-card__media-badge sk" style="width:62px;height:18px;border-radius:999px;position:absolute;top:10px;inset-inline-end:10px" /></div><div class="sk-card__body"><div class="sk sk--text" style="width:42%;height:10px" :style="delay(2)" /><div class="sk sk--text" style="width:96%;height:14px" :style="delay(3)" /><div class="sk sk--text" style="width:78%;height:14px" :style="delay(4)" /><div class="sk sk--text" style="width:52%;height:10px;margin-top:2px" :style="delay(5)" /><div class="sk-card__foot"><div style="display:flex;flex-direction:column;gap:6px;flex:1"><div class="sk" style="width:84px;height:16px;border-radius:6px" :style="delay(6)" /><div class="sk" style="width:110px;height:10px;border-radius:6px" :style="delay(7)" /></div><div class="sk" style="width:44px;height:16px;border-radius:999px" :style="delay(8)" /></div><div class="sk-card__actions"><div class="sk" style="height:34px;flex:1;border-radius:10px" :style="delay(9)" /><div class="sk" style="height:34px;flex:1;border-radius:10px" :style="delay(10)" /></div></div></div>
     </template>
     <template v-else-if="type === 'catalog-grid'">
       <div class="sk-grid sk-grid--catalog" :style="{ gap: gap || '1.5rem' }"><div v-for="i in gridCount" :key="i" class="sk-card" :style="delay(i)"><div class="sk-card__media sk" :style="delay(i)"><div class="sk sk--badge sk--badge-left" :style="delay(i)" /><div class="sk sk--badge sk--badge-right" :style="delay(i+1)" /></div><div class="sk-card__body"><div class="sk sk--eyebrow" :style="delay(i+1)" /><div class="sk sk--title" :style="delay(i+2)" /><div class="sk sk--title sk--title-short" :style="delay(i+3)" /><div class="sk sk--caption" :style="delay(i+4)" /><div class="sk-card__foot"><div style="display:flex;flex-direction:column;gap:6px"><div class="sk sk--price" :style="delay(i+5)" /><div class="sk sk--caption-sm" :style="delay(i+6)" /></div><div class="sk sk--rating" :style="delay(i+7)" /></div><div class="sk-card__actions"><div class="sk sk--btn" :style="delay(i+8)" /><div class="sk sk--btn sk--btn-primary" :style="delay(i+9)" /></div></div></div></div>
     </template>
     <template v-else-if="type === 'category-grid'">
       <div class="sk-grid sk-grid--category" :style="{ gap: gap || '1rem' }"><div v-for="i in gridCount" :key="i" class="sk-cat" :style="delay(i)"><div class="sk sk-cat__media" :style="delay(i)" /><div class="sk-cat__body"><div class="sk" style="width:72%;height:13px;border-radius:6px;margin:0 auto" :style="delay(i+2)" /><div class="sk" style="width:46%;height:9px;border-radius:999px;margin:6px auto 0" :style="delay(i+3)" /></div></div></div>
     </template>
     <template v-else-if="type === 'stats-grid'">
       <div class="sk-grid sk-grid--stats" :style="{ gap: gap || '1rem' }"><div v-for="i in gridCount" :key="i" class="sk-stat" :style="delay(i)"><div class="sk sk-stat__icon" :style="delay(i)" /><div class="sk-stat__body"><div class="sk" style="width:68%;height:10px;border-radius:6px" :style="delay(i+1)" /><div class="sk" style="width:44%;height:20px;border-radius:6px;margin-top:8px" :style="delay(i+2)" /><div class="sk" style="width:56%;height:9px;border-radius:6px;margin-top:8px" :style="delay(i+3)" /></div></div></div>
     </template>
     <template v-else-if="type === 'location-grid'">
       <div class="sk-grid sk-grid--location" :style="{ gap: gap || '1rem' }"><div v-for="i in gridCount" :key="i" class="sk-loc" :style="delay(i)"><div class="sk-loc__head"><div class="sk" style="width:38%;height:16px;border-radius:6px" :style="delay(i)" /><div class="sk" style="width:22px;height:18px;border-radius:999px" :style="delay(i+1)" /></div><div class="sk" style="width:46%;height:10px;border-radius:6px" :style="delay(i+1)" /><div class="sk-loc__list"><div v-for="r in 5" :key="r" class="sk sk--loc-row" :style="delay(i+r)" /></div></div></div>
     </template>
     <template v-else-if="type === 'pdp'">
       <div class="sk-pdp"><div class="sk-pdp__gallery sk" :style="delay(1)"><div class="sk sk--badge sk--badge-left" style="position:absolute;top:16px;inset-inline-start:16px;width:68px;height:20px;border-radius:4px" /><div class="sk" style="position:absolute;top:16px;inset-inline-end:16px;width:52px;height:20px;border-radius:999px" :style="delay(2)" /><div class="sk-pdp__placeholder"><div class="sk" style="width:120px;height:120px;border-radius:14px;opacity:.6" :style="delay(2)" /></div><div class="sk-pdp__foot"><div class="sk" style="width:34%;height:10px;border-radius:6px" :style="delay(3)" /><div class="sk" style="width:26%;height:10px;border-radius:6px" :style="delay(4)" /></div></div><div class="sk-pdp__order"><div style="display:flex;flex-direction:column;gap:10px"><div class="sk" style="width:28%;height:11px;border-radius:6px" :style="delay(1)" /><div class="sk" style="width:88%;height:26px;border-radius:8px" :style="delay(2)" /><div class="sk" style="width:96%;height:26px;border-radius:8px" :style="delay(3)" /><div class="sk" style="width:64%;height:12px;border-radius:6px" :style="delay(4)" /></div><div class="sk sk-pdp__price-card" :style="delay(3)"><div style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;flex-direction:column;gap:8px"><div class="sk" style="width:92px;height:24px;border-radius:6px" :style="delay(5)" /><div class="sk" style="width:140px;height:11px;border-radius:6px" :style="delay(6)" /></div><div class="sk" style="width:96px;height:22px;border-radius:999px" :style="delay(6)" /></div><div style="display:flex;gap:12px;margin-top:16px"><div class="sk" style="width:108px;height:44px;border-radius:10px" :style="delay(7)" /><div class="sk" style="height:44px;flex:1;border-radius:10px" :style="delay(8)" /></div><div style="display:flex;gap:10px;margin-top:12px"><div class="sk" style="height:38px;flex:1;border-radius:10px" :style="delay(9)" /><div class="sk" style="height:38px;width:128px;border-radius:10px" :style="delay(10)" /></div></div></div></div>
     </template>
     <template v-else-if="type === 'table'">
       <div class="sk-table" :style="delay(1)"><div class="sk-table__head"><div v-for="i in 5" :key="i" class="sk" style="height:12px;border-radius:6px" :style="delay(i)" /></div><div v-for="r in (count ?? 5)" :key="r" class="sk-table__row" :style="delay(r)"><div class="sk sk-table__cell sk-table__cell--avatar" :style="delay(r)" /><div style="flex:1;display:flex;flex-direction:column;gap:6px"><div class="sk" style="width:58%;height:12px;border-radius:6px" :style="delay(r+1)" /><div class="sk" style="width:38%;height:10px;border-radius:6px" :style="delay(r+2)" /></div><div class="sk" style="width:84px;height:20px;border-radius:999px" :style="delay(r+1)" /><div class="sk" style="width:72px;height:12px;border-radius:6px" :style="delay(r+2)" /><div style="display:flex;gap:8px"><div class="sk" style="width:64px;height:30px;border-radius:8px" :style="delay(r+3)" /><div class="sk" style="width:64px;height:30px;border-radius:8px" :style="delay(r+4)" /></div></div></div>
     </template>
     <template v-else-if="type === 'list'">
       <div class="skeleton-wrapper" :style="{ gap: gap || '10px' }"><div v-for="i in (count ?? 4)" :key="i" class="sk-list" :style="delay(i)"><div class="sk sk-list__avatar" :style="delay(i)" /><div style="flex:1;display:flex;flex-direction:column;gap:7px"><div class="sk" style="width:46%;height:13px;border-radius:6px" :style="delay(i+1)" /><div class="sk" style="width:72%;height:11px;border-radius:6px" :style="delay(i+2)" /></div><div class="sk" style="width:64px;height:22px;border-radius:999px" :style="delay(i+2)" /></div></div>
     </template>
     <template v-else-if="type === 'form'">
       <div class="sk-form" :style="{ gap: gap || '14px' }"><div v-for="i in (count ?? 4)" :key="i" style="display:flex;flex-direction:column;gap:7px" :style="delay(i)"><div class="sk" style="width:28%;height:10px;border-radius:6px" :style="delay(i)" /><div class="sk" style="width:100%;height:42px;border-radius:10px" :style="delay(i+1)" /></div><div style="display:flex;gap:10px;margin-top:6px"><div class="sk" style="height:40px;flex:1;border-radius:999px" :style="delay(6)" /><div class="sk" style="height:40px;flex:1;border-radius:999px" :style="delay(7)" /></div></div>
     </template>
     <template v-else-if="type === 'pills'">
        <div class="sk-pills" :style="{ gap: gap || '0.5rem' }">
          <div v-for="i in gridCount" :key="i" class="sk sk--pill" :style="delay(i)" />
        </div>
     </template>
     <template v-else-if="type === 'hero'">
      <div class="sk-hero" :style="delay(1)"><div style="flex:1;display:flex;flex-direction:column;gap:14px"><div class="sk" style="width:32%;height:12px;border-radius:999px" :style="delay(1)" /><div class="sk" style="width:84%;height:32px;border-radius:10px" :style="delay(2)" /><div class="sk" style="width:76%;height:32px;border-radius:10px" :style="delay(3)" /><div class="sk" style="width:92%;height:14px;border-radius:6px" :style="delay(4)" /><div class="sk" style="width:88%;height:14px;border-radius:6px" :style="delay(5)" /><div style="display:flex;gap:12px;margin-top:8px"><div class="sk" style="width:128px;height:42px;border-radius:999px" :style="delay(6)" /><div class="sk" style="width:128px;height:42px;border-radius:999px" :style="delay(7)" /></div></div><div class="sk sk-hero__art" :style="delay(4)" /></div>
    </template>
  </div>
</template>
<style scoped>
  .skeleton-root {
    width: 100%;
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

  .skeleton-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
  }

  .sk {
    border-radius: var(--wl-radius);
    background: var(--skeleton-base);
    position: relative;
    overflow: hidden;
    border: 1px solid var(--wl-line);
    animation: sk-pulse 3.2s ease-in-out infinite;
    will-change: opacity;
  }

  .sk--text {
    border-radius: var(--radius-sm);
    margin-bottom: 0;
    height: 12px;
  }

  .sk--card {
    border-radius: var(--radius-lg);
    border: 1px solid var(--wl-line);
    min-height: 120px;
  }

  .sk--circle {
    border-radius: var(--radius-full);
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
      background: linear-gradient( 90deg, transparent 0%, transparent 40%, var(--skeleton-highlight) 50%, transparent 60%, transparent 100% );
      animation: sk-sweep 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      animation-delay: var(--delay, 0ms);
      will-change: transform;
    }

    @keyframes sk-sweep {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }

    @keyframes sk-pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.94;
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sk::after {
      display: none;
    }

    .sk {
      animation: none;
    }
  }

  .sk-card {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--wl-line);
    border-radius: var(--wl-radius-lg);
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
    border-radius: 999px;
  }

  .sk-card__body {
    padding: 1.05rem 1.05rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    flex: 1;
    background: var(--wl-surface);
  }

  .sk--eyebrow {
    width: 36%;
    height: 10px;
    border-radius: 6px;
  }

  .sk--title {
    width: 94%;
    height: 13px;
    border-radius: 6px;
  }

  .sk--title-short {
    width: 72%;
    height: 13px;
    border-radius: 6px;
  }

  .sk--caption {
    width: 52%;
    height: 10px;
    border-radius: 6px;
    opacity: .9;
  }

  .sk--caption-sm {
    width: 96px;
    height: 9px;
    border-radius: 6px;
  }

  .sk--price {
    width: 78px;
    height: 16px;
    border-radius: 6px;
  }

  .sk--rating {
    width: 42px;
    height: 16px;
    border-radius: 999px;
  }

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

  .sk--btn {
    flex: 1;
    height: 34px;
    border-radius: 10px;
  }

  .sk--btn-primary {
    background: var(--wl-primary-soft);
    border-color: rgba(var(--wl-primary-rgb), 0.12);
  }

  .sk--badge {
    width: 52px;
    height: 16px;
    border-radius: 999px;
    position: absolute;
    top: 10px;
  }

  .sk--badge-left {
    inset-inline-start: 10px;
  }

  .sk--badge-right {
    inset-inline-end: 10px;
  }

  .sk-grid {
    display: grid;
    width: 100%;
  }

  .sk-grid--catalog {
    grid-template-columns: repeat(3, 1fr);
  }

  .sk-grid--category {
    grid-template-columns: repeat(4, 1fr);
  }

  .sk-grid--stats {
    grid-template-columns: repeat(4, 1fr);
  }

  .sk-grid--location {
    grid-template-columns: repeat(3, 1fr);
    align-items: start;
  }

  @media (max-width: 1120px) {
    .sk-grid--catalog {
      grid-template-columns: repeat(2,1fr);
    }

    .sk-grid--category {
      grid-template-columns: repeat(3,1fr);
    }

    .sk-grid--stats {
      grid-template-columns: repeat(2,1fr);
    }
  }

  @media (max-width: 760px) {
    .sk-grid--catalog, .sk-grid--category, .sk-grid--stats, .sk-grid--location {
      grid-template-columns: 1fr;
    }
  }

  .sk-cat {
    background: var(--wl-surface);
    border: 1px solid var(--wl-line);
    border-radius: var(--wl-radius-lg);
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

  .sk-stat {
    display: flex;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--wl-surface);
    border: 1px solid var(--wl-line);
    border-radius: var(--wl-radius-lg);
    box-shadow: var(--wl-shadow-card);
  }

  .sk-stat__icon {
    width: 48px;
    height: 48px;
    border-radius: var(--wl-radius);
    flex-shrink: 0;
  }

  .sk-stat__body {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .sk-loc {
    background: var(--wl-surface);
    border: 1px solid var(--wl-line);
    border-radius: var(--wl-radius-lg);
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
    border-radius: 8px;
    border: 1px solid var(--wl-line);
  }

  .sk-pdp {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2.75rem;
    align-items: start;
    width: 100%;
  }

  .sk-pdp__gallery {
    min-height: 460px;
    border-radius: var(--wl-radius-xl);
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
    border-radius: var(--wl-radius-lg);
    padding: 1.35rem;
    box-shadow: var(--wl-shadow-card);
    height: auto;
    border-radius: 16px !important;
  }

  .sk-pdp__tabs {
    background: var(--wl-surface);
    border: 1px solid var(--wl-line);
    border-radius: var(--wl-radius-lg);
    overflow: hidden;
    height: auto;
    min-height: 160px;
  }

  @media (max-width: 980px) {
    .sk-pdp {
      grid-template-columns: 1fr;
      gap: 1.75rem;
    }

    .sk-pdp__gallery {
      min-height: 340px;
    }
  }

  .sk-table {
    background: var(--wl-surface);
    border: 1px solid var(--wl-line);
    border-radius: var(--wl-radius-lg);
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

  :root[data-theme='dark'] .sk-table__head, :root.dark .sk-table__head {
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

    .sk-table__row:last-child {
      border-bottom: none;
    }

  .sk-table__cell--avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  @media (max-width: 760px) {
    .sk-table__head, .sk-table__row {
      grid-template-columns: 1fr;
      gap: 0.6rem;
    }

    .sk-table__head {
      display: none;
    }

    .sk-table__row {
      display: flex;
      flex-wrap: wrap;
    }
  }

  .sk-list {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.85rem 1rem;
    border: 1px solid var(--wl-line);
    background: var(--wl-surface);
    border-radius: var(--wl-radius-lg);
    box-shadow: var(--wl-shadow-card);
  }

  .sk-list__avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .sk-form {
    display: flex;
    flex-direction: column;
    background: var(--wl-surface);
    border: 1px solid var(--wl-line);
    border-radius: var(--wl-radius-lg);
    padding: 1.5rem;
    box-shadow: var(--wl-shadow-card);
  }

  .sk-hero {
    display: grid;
    grid-template-columns: 1.18fr 0.92fr;
    gap: 3rem;
    align-items: center;
    padding: 1rem 0;
  }

  .sk-hero__art {
    height: 320px;
    border-radius: 20px;
    border: 1px solid var(--wl-line);
    background: var(--skeleton-base);
  }

  @media (max-width: 900px) {
    .sk-hero {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .sk-hero__art {
      height: 220px;
    }
  }

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
    border-radius: 999px;
    flex-shrink: 0;
  }
</style>
