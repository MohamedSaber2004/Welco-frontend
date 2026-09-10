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
  Quoted: 'indigo',
  Ordered: 'slate',
  Approved: 'emerald',
  Declined: 'rose',
  Expired: 'slate',
  Cancelled: 'rose',
  Confirmed: 'indigo',
  Shipped: 'slate',
  Delivered: 'emerald',
  Paid: 'emerald',
  Active: 'emerald',
  Inactive: 'slate',
}

const tone = computed(() => TONE[props.status] ?? 'slate')
</script>

<template>
  <span class="status-pill" :class="`status-pill--${tone}`">
    <span class="status-pill__dot" aria-hidden="true"></span>
    <span class="status-pill__text">{{ label ?? status }}</span>
  </span>
</template>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--wl-font-mono);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.22rem 0.62rem;
  border-radius: 9999px;
  border: 1px solid transparent;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.status-pill__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.status-pill--emerald {
  color: var(--wl-success);
  background: var(--wl-success-soft);
  border-color: rgba(var(--wl-success-rgb), 0.25);
}


.status-pill--indigo {
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border-color: rgba(var(--wl-primary-rgb), 0.25);
}


.status-pill--amber {
  color: var(--wl-warning);
  background: var(--wl-warning-soft);
  border-color: rgba(var(--wl-warning-rgb), 0.25);
}


.status-pill--rose {
  color: var(--wl-danger);
  background: var(--wl-danger-soft);
  border-color: rgba(var(--wl-danger-rgb), 0.25);
}


.status-pill--slate {
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border-color: var(--wl-border);
}

</style>
