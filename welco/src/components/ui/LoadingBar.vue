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
  height: 3px;
  z-index: 9999;
  background: transparent;
  pointer-events: none;
}

.loading-bar__track {
  position: relative;
  width: 100%;
  height: 100%;
  background: rgba(20, 125, 146, 0.12);  /* brand ghost track */
  overflow: hidden;
}

.loading-bar__fill {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: 50%;
  /* Clinical Precision 3-stop gradient: Navy → Steel Teal → Surgical Cyan */
  background: linear-gradient(
    90deg,
    var(--color-primary-700, #0F3D56) 0%,
    var(--color-primary-500, #147D92) 50%,
    var(--color-primary-400, #28A7A1) 100%
  );
  border-radius: 0 2px 2px 0;
  will-change: transform;
  animation: lb-sweep 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
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
