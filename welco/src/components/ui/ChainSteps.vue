<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    steps: string[]
    current: number
    compact?: boolean
  }>(),
  { compact: false },
)

const activeIndex = computed(() => Math.min(props.current, props.steps.length - 1))
</script>

<template>
  <div class="chain-steps" :class="{ 'chain-steps--compact': compact }" role="list" :aria-label="steps.join(' → ')">
    <template v-for="(step, i) in steps" :key="step">
      <div
        class="chain-steps__node"
        :class="{
          'is-active': i === activeIndex,
          'is-done': i < activeIndex,
          'is-pending': i > activeIndex,
        }"
        role="listitem"
      >
        <span class="chain-steps__ring" aria-hidden="true">
          <span v-if="i < activeIndex" class="chain-steps__check material-symbols-outlined">check</span>
        </span>
        <span class="chain-steps__label">{{ step }}</span>
      </div>
      <span v-if="i < steps.length - 1" class="chain-steps__link" :class="{ 'link--done': i < activeIndex }" aria-hidden="true"></span>
    </template>
  </div>
</template>

<style scoped>
.chain-steps {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0.6rem 0;
  width: 100%;
}

.chain-steps__node {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-body);
  font-size: var(--text-sm, 0.75rem);
  font-weight: var(--weight-medium, 500);
  color: var(--fg-muted, #7a90a8);
  white-space: nowrap;
}

.chain-steps__ring {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-pill, 9999px);
  border: 1.5px solid var(--border-strong, #c2c7cd);
  background: var(--bg-surface, #ffffff);
  position: relative;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  transition: all var(--duration-fast, 150ms) var(--ease-out, ease-out);
}

.chain-steps__check {
  font-size: 13px;
  color: #ffffff;
  font-weight: 700;
  line-height: 1;
}

/* Active Step */
.chain-steps__node.is-active {
  color: var(--fg-heading, #102a43);
  font-weight: var(--weight-semibold, 600);
}

.chain-steps__node.is-active .chain-steps__ring {
  border-color: var(--brand, #0f3d56);
  box-shadow: 0 0 0 3px rgba(15, 61, 86, 0.12);
}

.chain-steps__node.is-active .chain-steps__ring::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--brand, #0f3d56);
}

/* Completed Step */
.chain-steps__node.is-done {
  color: var(--color-success-600, #16a34a);
  font-weight: var(--weight-medium, 500);
}

.chain-steps__node.is-done .chain-steps__ring {
  border-color: var(--color-success-500, #16a34a);
  background: var(--color-success-500, #16a34a);
}

/* Connecting line */
.chain-steps__link {
  flex: 1;
  height: 2px;
  background: var(--border, #d9e2ec);
  margin: 0 0.75rem;
  min-width: 16px;
  transition: background var(--duration-fast, 150ms) var(--ease-out, ease-out);
}

.chain-steps__link.link--done {
  background: var(--color-success-500, #16a34a);
}

.chain-steps--compact .chain-steps__label {
  font-size: var(--text-xs, 0.6875rem);
}

.chain-steps--compact .chain-steps__node {
  gap: 0.35rem;
}
</style>
