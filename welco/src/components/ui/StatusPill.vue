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
  color: #047857;
  background: #D1FAE5;
  border-color: rgba(16, 185, 129, 0.3);
}

.status-pill--teal {
  color: #0F766E;
  background: #CCFBF1;
  border-color: rgba(20, 184, 166, 0.3);
}

.status-pill--indigo {
  color: #4338CA;
  background: #EEF2FF;
  border-color: rgba(99, 102, 241, 0.3);
}

.status-pill--amber {
  color: #B45309;
  background: #FEF3C7;
  border-color: rgba(245, 158, 11, 0.3);
}

.status-pill--rose {
  color: #B91C1C;
  background: #FEE2E2;
  border-color: rgba(239, 68, 68, 0.3);
}

.status-pill--slate {
  color: #4B5563;
  background: #F3F4F6;
  border-color: #E5E7EB;
}
</style>
