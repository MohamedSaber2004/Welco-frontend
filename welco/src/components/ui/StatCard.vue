<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    hint?: string
    to?: string
    trend?: string
    trendUp?: boolean
    sparkline?: number[]
    tone?: 'teal' | 'indigo' | 'amber' | 'emerald' | 'rose' | 'obsidian' | 'slate'
  }>(),
  {
    hint: undefined,
    to: undefined,
    trend: undefined,
    trendUp: undefined,
    sparkline: undefined,
    tone: 'indigo',
  },
)

const isPositive = computed(() => {
  if (props.trendUp !== undefined) return props.trendUp
  if (!props.trend) return true
  return props.trend.startsWith('+') || props.trend.includes('✓')
})

const isNegative = computed(() => {
  if (props.trendUp !== undefined) return !props.trendUp
  if (!props.trend) return false
  return props.trend.startsWith('-')
})

// Generate SVG smooth area curve path for the sparkline
const sparkPath = computed(() => {
  const data = props.sparkline && props.sparkline.length >= 2 ? props.sparkline : []
  if (data.length < 2) return { line: '', area: '' }
  const width = 88
  const height = 32
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points: [number, number][] = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - 4 - ((v - min) / range) * (height - 8)
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
  if (props.tone === 'emerald' || (props.trend && isPositive.value)) return '#3ed7b4'
  if (props.tone === 'rose' || (props.trend && isNegative.value)) return '#f26d6d'
  if (props.tone === 'amber') return '#f8c15d'
  return '#69a9ff'
})
</script>

<template>
  <component
    :is="to ? 'router-link' : 'div'"
    :to="to ?? undefined"
    class="stat-card"
    :class="[`stat-card--${tone}`, { 'is-interactive': Boolean(to) }]"
  >
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

      <!-- Integrated Mini Sparkline Area Chart (only when real sparkline data provided) -->
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
  </component>
</template>

<style scoped>
.stat-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1.15rem 1.25rem;
  background: var(--wl-gradient-card, var(--wl-surface));
  border: 1px solid var(--wl-border);
  border-radius: 12px;
  box-shadow: var(--wl-shadow-card);
  text-decoration: none;
  color: inherit;
  position: relative;
  overflow: hidden;
  transition: border-color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;
}

/* Precision Hairline Laser Accent (Signature) */
.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--wl-primary), transparent);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.stat-card.is-interactive:hover {
  border-color: rgba(var(--wl-primary-rgb), 0.28);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.stat-card.is-interactive:hover::before {
  opacity: 1;
}

.stat-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.stat-card__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--wl-muted);
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
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1;
  padding: 0.2rem 0.48rem;
  border-radius: 9999px;
  font-variant-numeric: tabular-nums;
  border: 1px solid transparent;
}

.trend--positive {
  background: var(--wl-success-soft);
  color: var(--wl-success);
  border-color: rgba(16, 185, 129, 0.18);
}

.trend--negative {
  background: var(--wl-danger-soft);
  color: var(--wl-danger);
  border-color: rgba(244, 63, 94, 0.18);
}

.trend--neutral {
  background: var(--wl-surface-soft);
  color: var(--wl-muted);
  border-color: var(--wl-border);
}

.trend__icon {
  font-size: 10px;
  font-weight: 700;
}

.stat-card__icon-wrap {
  display: grid;
  place-items: center;
  color: var(--wl-muted);
  font-size: 18px;
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
  font-family: var(--wl-font-display);
  font-size: 1.65rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.05;
  color: var(--wl-ink-strong);
}

.stat-card__hint {
  font-size: 0.75rem;
  color: var(--wl-muted);
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

/* Tone customizations — yellow-degree value with shadow for dashboard metrics */
.stat-card--emerald .stat-card__value { color: var(--wl-success); }
.stat-card--rose .stat-card__value { color: var(--wl-danger); }
.stat-card--amber .stat-card__value {
  color: var(--wl-gold-text);
  text-shadow: var(--wl-gold-text-shadow);
}
.stat-card--gold .stat-card__value {
  color: var(--wl-gold-text);
  text-shadow: var(--wl-gold-text-shadow);
}
.stat-card--gold {
  border-color: rgba(255, 209, 102, 0.35) !important;
  box-shadow: var(--wl-gold-glow-soft), var(--wl-shadow-card) !important;
}
.stat-card--indigo .stat-card__value { color: var(--wl-ink-strong); }
</style>
