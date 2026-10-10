<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: string
  label?: string
}>()

const TONE: Record<string, string> = {
  Success: 'emerald',
  Failed: 'rose',
  Partial: 'amber',
  Pending: 'amber',
  Draft: 'slate',
  Sent: 'indigo',
  Quoted: 'teal',
  Ordered: 'slate',
  Approved: 'emerald',
  Declined: 'rose',
  Expired: 'slate',
  Cancelled: 'rose',
  Confirmed: 'indigo',
  Shipped: 'teal',
  Delivered: 'emerald',
  Paid: 'emerald',
  Active: 'emerald',
  Inactive: 'slate',
  'In Progress': 'teal',
}

const tone = computed(() => TONE[props.status] ?? 'slate')
const isPulsing = computed(() => ['Pending', 'Draft', 'Partial', 'In Progress'].includes(props.status))
</script>

<template>
  <span class="status-pill" :class="[`status-pill--${tone}`, { 'is-pulsing': isPulsing }]">
    <span class="status-pill__dot" :class="{ 'status-pill__dot--pulse': isPulsing }" aria-hidden="true"></span>
    <span class="status-pill__text">{{ label ?? status }}</span>
  </span>
</template>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs, 0.6875rem);
  font-weight: var(--weight-semibold, 600);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.4;
  padding: 3px 10px;
  border-radius: var(--radius-pill, 9999px);
  border: 1px solid transparent;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  transition: all var(--duration-fast, 150ms) var(--ease-out, ease-out);
}

.status-pill__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
  display: inline-block;
}

.status-pill__dot--pulse {
  animation: status-dot-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes status-dot-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.3;
    transform: scale(1.4);
  }
}

.status-pill--emerald {
  color: var(--color-success-600, #15803d);
  background: var(--color-success-50, #f0fdf4);
  border-color: rgba(22, 163, 74, 0.25);
}

.status-pill--teal {
  color: #007D69;
  background: var(--brand-soft, #E8F8F5);
  border-color: rgba(0, 163, 137, 0.28);
}

.status-pill--indigo {
  color: var(--brand, #071520);
  background: #EBF1F6;
  border-color: rgba(7, 21, 32, 0.2);
}

.status-pill--amber {
  color: var(--color-warning-600, #b45309);
  background: var(--color-warning-50, #fffbeb);
  border-color: rgba(217, 119, 6, 0.25);
}

.status-pill--rose {
  color: var(--color-danger, #E11D48);
  background: var(--color-danger-50, #fef2f2);
  border-color: rgba(225, 29, 72, 0.25);
}

.status-pill--slate {
  color: var(--fg-muted, #5A7184);
  background: var(--bg-subtle, #EBF1F6);
  border-color: var(--border, #D8E2EC);
}
</style>
