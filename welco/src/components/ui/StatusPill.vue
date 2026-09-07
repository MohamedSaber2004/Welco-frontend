<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: string
  label?: string
}>()

const TONE: Record<string, string> = {
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
  color: #059669;
  background: #ECFDF5;
  border-color: rgba(16, 185, 129, 0.2);
}
:root[data-theme='dark'] .status-pill--emerald {
  color: #34D399;
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.25);
}

.status-pill--indigo {
  color: #4F46E5;
  background: #EEF2FF;
  border-color: rgba(99, 102, 241, 0.2);
}
:root[data-theme='dark'] .status-pill--indigo {
  color: #A5B4FC;
  background: rgba(99, 102, 241, 0.14);
  border-color: rgba(99, 102, 241, 0.25);
}

.status-pill--amber {
  color: #D97706;
  background: #FFFBEB;
  border-color: rgba(245, 158, 11, 0.22);
}
:root[data-theme='dark'] .status-pill--amber {
  color: #FBBF24;
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.25);
}

.status-pill--rose {
  color: #E11D48;
  background: #FFF1F2;
  border-color: rgba(244, 63, 94, 0.2);
}
:root[data-theme='dark'] .status-pill--rose {
  color: #FDA4AF;
  background: rgba(244, 63, 94, 0.14);
  border-color: rgba(244, 63, 94, 0.25);
}

.status-pill--slate {
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border-color: var(--wl-border);
}
:root[data-theme='dark'] .status-pill--slate {
  color: #94A3B8;
  background: #1E293B;
  border-color: rgba(255, 255, 255, 0.08);
}
</style>
