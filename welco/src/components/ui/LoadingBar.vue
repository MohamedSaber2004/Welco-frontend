<script setup lang="ts">
import { requestTracker } from '../../application/request.tracker'
</script>

<template>
  <Transition name="loading-bar">
    <div v-if="requestTracker.isLoading.value" class="loading-bar" aria-hidden="true">
      <div class="loading-bar__track">
        <div class="loading-bar__fill" />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ── Top loading bar — Clinical Precision brand gradient ── */
.loading-bar {
  position: fixed;
  top: 0;
  inset-inline: 0;
  height: 5px;
  z-index: 9999;
  filter: drop-shadow(0 2px 8px rgba(11, 127, 134, .35));
  background: transparent;
  pointer-events: none;
}

.loading-bar__track {
  position: relative;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, rgba(11, 127, 134, .08), rgba(214, 243, 106, .22), rgba(11, 127, 134, .08));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.35);
  overflow: hidden;
}

.loading-bar__fill {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: 34%;
  background: linear-gradient(90deg, #07545f 0%, #0b7f86 48%, #d6f36a 100%);
  border-radius: 999px;
  box-shadow: 0 0 12px rgba(214, 243, 106, .7), 0 0 4px rgba(11, 127, 134, .8);
  will-change: transform;
  animation: lb-sweep 1.15s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes lb-sweep {
  0%   { transform: translateX(-130%); opacity: 0.7; }
  50%  { opacity: 1; }
  100% { transform: translateX(280%); opacity: 0.7; }
}

/* Fade the bar in/out on mount/unmount */
.loading-bar-enter-active { transition: opacity 0.15s ease; }
.loading-bar-leave-active { transition: opacity 0.3s ease; }
.loading-bar-enter-from,
.loading-bar-leave-to   { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .loading-bar__fill { animation: none; width: 100%; opacity: 0.6; }
}
</style>
