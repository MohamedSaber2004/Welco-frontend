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
:root.dark .status-pill--emerald,
:root[data-theme='dark'] .status-pill--emerald {
  color: #57F287;
  background: rgba(87, 242, 135, 0.14);
  border-color: rgba(87, 242, 135, 0.25);
}

.status-pill--indigo {
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border-color: rgba(var(--wl-primary-rgb), 0.25);
}
:root.dark .status-pill--indigo,
:root[data-theme='dark'] .status-pill--indigo {
  color: #949CF7;
  background: rgba(88, 101, 242, 0.16);
  border-color: rgba(88, 101, 242, 0.3);
}

.status-pill--amber {
  color: var(--wl-warning);
  background: var(--wl-warning-soft);
  border-color: rgba(var(--wl-warning-rgb), 0.25);
}
:root.dark .status-pill--amber,
:root[data-theme='dark'] .status-pill--amber {
  color: #FEE75C;
  background: rgba(254, 231, 92, 0.14);
  border-color: rgba(254, 231, 92, 0.3);
}

.status-pill--rose {
  color: var(--wl-danger);
  background: var(--wl-danger-soft);
  border-color: rgba(var(--wl-danger-rgb), 0.25);
}
:root.dark .status-pill--rose,
:root[data-theme='dark'] .status-pill--rose {
  color: #ED4245;
  background: rgba(237, 66, 69, 0.14);
  border-color: rgba(237, 66, 69, 0.3);
}

.status-pill--slate {
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border-color: var(--wl-border);
}
:root.dark .status-pill--slate,
:root[data-theme='dark'] .status-pill--slate {
  color: #B5BAC1;
  background: #383A40;
  border-color: rgba(255, 255, 255, 0.08);
}
</style>
