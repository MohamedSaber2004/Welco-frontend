<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    hint?: string
    trend?: string
    /** Trend direction: 'positive' | 'negative' | 'neutral'. If omitted, auto-detected from `+` or `-` in `trend`. */
    trendDirection?: 'positive' | 'negative' | 'neutral'
    /** Visual tone tint applied to background/icon. Defaults to 'slate'. */
    tone?: 'brand' | 'indigo' | 'emerald' | 'teal' | 'cyan' | 'amber' | 'gold' | 'orange' | 'rose' | 'slate' | 'violet' | 'obsidian'
    /** If provided, renders as router-link. */
    to?: string
    /** Optional numeric series for an integrated mini area sparkline chart. Min 2 points. */
    sparkline?: number[]
    /** Render as compact icon-only tile for dense summary rails (e.g. territory/zones). */
    iconOnly?: boolean
  }>(),
  {
    hint: undefined,
    trend: undefined,
    trendDirection: undefined,
    tone: 'slate',
    to: undefined,
    sparkline: undefined,
    iconOnly: false,
  },
)

const isPositive = computed(() => {
  if (props.trendDirection) return props.trendDirection === 'positive'
  return Boolean(props.trend && props.trend.trim().startsWith('+'))
})

const isNegative = computed(() => {
  if (props.trendDirection) return props.trendDirection === 'negative'
  return Boolean(props.trend && props.trend.trim().startsWith('-'))
})

/**
 * Generate smooth SVG path (cubic bezier) + filled area coordinates
 * scaled to 88x32 viewBox for high-density rendering.
 */
const sparkPath = computed(() => {
  if (!props.sparkline || props.sparkline.length < 2) return { line: '', area: '' }
  const data = props.sparkline
  const width = 88
  const height = 32
  const padX = 2
  const padY = 3
  const chartW = width - padX * 2
  const chartH = height - padY * 2

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max === min ? 1 : max - min

  const points: [number, number][] = data.map((v, i) => {
    const x = padX + (i / (data.length - 1)) * chartW
    const y = height - padY - ((v - min) / range) * chartH
    return [x, y]
  })

  const pStart = points[0]!
  let line = `M ${pStart[0].toFixed(1)} ${pStart[1].toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = (i === 0 ? points[0] : points[i - 1])!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const p3 = (i + 2 >= points.length ? points[points.length - 1] : points[i + 2])!

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6

    line += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }

  const area = `${line} L ${width} ${height} L 0 ${height} Z`
  return { line, area }
})

const strokeColor = computed(() => {
  if (props.tone === 'emerald' || (props.trend && isPositive.value)) return 'var(--color-success, #059669)'
  if (props.tone === 'rose' || (props.trend && isNegative.value)) return 'var(--color-danger, #e11d48)'
  if (props.tone === 'amber' || props.tone === 'orange' || props.tone === 'gold') return 'var(--color-warning, #d97706)'
  if (props.tone === 'teal') return 'var(--color-steel-teal, #00a389)'
  if (props.tone === 'cyan') return 'var(--color-surgical-cyan, #0ea5e9)'
  return 'var(--color-primary, #071520)'
})
</script>

<template>
  <component
    :is="to ? 'router-link' : 'div'"
    :to="to ?? undefined"
    class="stat-card"
    :class="[`stat-card--${tone}`, { 'is-interactive': Boolean(to), 'is-icon-only': iconOnly }]"
    :aria-label="label"
  >
    <div v-if="iconOnly" class="stat-card__compact">
      <div v-if="$slots.icon" class="stat-card__icon-wrap">
        <slot name="icon" />
      </div>
      <div class="stat-card__compact-info">
        <span class="stat-card__label mono">{{ label }}</span>
        <div class="stat-card__value mono-num">{{ value }}</div>
      </div>
    </div>

    <template v-else>
      <div class="stat-card__header">
        <span class="stat-card__label mono">{{ label }}</span>
        <div class="stat-card__top-right">
          <span
            v-if="trend"
            class="stat-card__trend mono"
            :class="{
              'trend--positive': isPositive,
              'trend--negative': isNegative,
              'trend--neutral': !isPositive && !isNegative,
            }"
          >
            <span class="trend__icon" aria-hidden="true">{{ isPositive ? '↑' : isNegative ? '↓' : '•' }}</span>
            {{ trend }}
          </span>
          <div v-if="$slots.icon" class="stat-card__icon-wrap">
            <slot name="icon" />
          </div>
        </div>
      </div>

      <div class="stat-card__main">
        <div class="stat-card__content">
          <div class="stat-card__value mono-num">{{ value }}</div>
          <div v-if="hint" class="stat-card__hint">{{ hint }}</div>
        </div>

        <!-- Integrated Mini Sparkline Area Chart -->
        <div v-if="sparkline && sparkline.length >= 2" class="stat-card__spark-box" aria-hidden="true">
          <svg class="spark-svg" viewBox="0 0 88 32" fill="none" preserveAspectRatio="none">
            <defs>
              <linearGradient :id="`spark-grad-${label.replace(/[^a-zA-Z0-9]/g, '-')}`" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="strokeColor" stop-opacity="0.25" />
                <stop offset="100%" :stop-color="strokeColor" stop-opacity="0.0" />
              </linearGradient>
            </defs>
            <path :d="sparkPath.area" :fill="`url(#spark-grad-${label.replace(/[^a-zA-Z0-9]/g, '-')})`" />
            <path :d="sparkPath.line" :stroke="strokeColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
      </div>
    </template>
  </component>
</template>

<style scoped>
.stat-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-4, 1rem);
  padding: var(--space-5, 1.25rem) var(--space-4, 1rem);
  background: var(--bg-surface, #ffffff);
  border: 1px solid var(--border, #d9e2ec);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--shadow-xs, 0 1px 2px rgba(0, 0, 0, 0.04));
  text-decoration: none;
  color: inherit;
  position: relative;
  overflow: hidden;
  transition: all var(--duration-base, 200ms) var(--ease-out, ease-out);
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--stat-fg, var(--brand, #0f3d56));
  opacity: 0.9;
}

.stat-card.is-interactive:hover {
  border-color: rgba(0, 163, 137, 0.4);
  transform: translateY(-2px);
  box-shadow: var(--shadow-tray-hover, 0 10px 24px -4px rgba(7, 21, 32, 0.08));
}

.stat-card.is-icon-only {
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  min-height: 72px;
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  gap: var(--space-3, 0.75rem);
  box-shadow: var(--shadow-sm);
  background: var(--bg-surface, #ffffff);
  border: 1px solid var(--border, #d9e2ec);
}

.stat-card__compact {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  width: 100%;
  min-width: 0;
}

.stat-card__compact-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  flex: 1;
}

.stat-card__compact-info .stat-card__label {
  font-size: 11px;
  font-weight: var(--weight-semibold, 600);
  color: var(--fg-muted, #7a90a8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.stat-card__compact-info .stat-card__value {
  font-size: 1.35rem;
  font-weight: var(--weight-bold, 700);
  line-height: 1.15;
  color: var(--fg-heading, #102a43);
}

.stat-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.stat-card__label {
  font-size: var(--text-sm, 0.75rem);
  font-weight: var(--weight-medium, 500);
  color: var(--fg-body, #42474d);
}

.stat-card__top-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stat-card__trend {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: var(--text-xs, 0.6875rem);
  font-weight: var(--weight-medium, 500);
  line-height: 1;
  padding: 0.2rem 0.48rem;
  border-radius: var(--radius-pill, 9999px);
  font-variant-numeric: tabular-nums;
  border: 1px solid transparent;
}

.trend--positive {
  background: var(--color-success-50, #f0fdf4);
  color: var(--fg-success, #16a34a);
  border-color: rgba(22, 163, 74, 0.2);
}

.trend--negative {
  background: var(--color-danger-50, #fef2f2);
  color: var(--fg-danger, #ef4444);
  border-color: rgba(239, 68, 68, 0.2);
}

.trend--neutral {
  background: var(--bg-subtle, #edf4ff);
  color: var(--fg-muted, #7a90a8);
  border-color: var(--border, #d9e2ec);
}

.trend__icon {
  font-size: 10px;
  font-weight: 700;
}

.stat-card__icon-wrap {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md, 6px);
  background: var(--stat-bg, var(--brand-soft, #e3efff));
  color: var(--stat-fg, var(--brand, #0f3d56));
  font-size: 18px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.stat-card__main {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.stat-card__content {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.stat-card__value {
  font-family: var(--font-display, var(--font-sans));
  font-size: clamp(1.5rem, 2.2vw, 1.875rem);
  font-weight: 700;
  letter-spacing: var(--tracking-tight, -0.02em);
  line-height: var(--leading-tight, 1.2);
  color: var(--fg-heading, #102a43);
  font-variant-numeric: tabular-nums;
}

.stat-card__hint {
  font-size: var(--text-sm, 0.75rem);
  color: var(--fg-muted, #7a90a8);
}

.stat-card__spark-box {
  width: 88px;
  height: 32px;
  flex-shrink: 0;
  opacity: 0.85;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.stat-card:hover .stat-card__spark-box {
  opacity: 1;
  transform: scale(1.03);
}

.spark-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

/* Tone accents */
.stat-card--rose { --stat-bg: var(--color-danger-50, #fef2f2); --stat-fg: var(--color-danger-500, #ef4444); }
.stat-card--orange, .stat-card--amber, .stat-card--gold { --stat-bg: var(--color-warning-50, #fffbeb); --stat-fg: var(--color-warning-500, #d97706); }
.stat-card--emerald { --stat-bg: var(--color-success-50, #f0fdf4); --stat-fg: var(--color-success-500, #16a34a); }
.stat-card--teal { --stat-bg: var(--color-brand-ice, #edf4ff); --stat-fg: var(--color-steel-teal, #147d92); }
.stat-card--cyan { --stat-bg: #e6faf8; --stat-fg: var(--color-surgical-cyan, #28a7a1); }
.stat-card--violet { --stat-bg: #edf4ff; --stat-fg: #147d92; }
.stat-card--indigo, .stat-card--brand { --stat-bg: var(--brand-soft, #e3efff); --stat-fg: var(--brand, #0f3d56); }
.stat-card--slate, .stat-card--obsidian { --stat-bg: var(--bg-subtle, #edf4ff); --stat-fg: var(--fg-muted, #7a90a8); }
</style>
