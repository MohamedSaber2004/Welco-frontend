<script setup lang="ts">
import { requestTracker } from '../../application/request.tracker'
</script>

<template>
  <div v-if="requestTracker.isLoading.value" class="loading-bar" aria-hidden="true">
    <div class="loading-bar__progress" />
  </div>
</template>

<style scoped>
.loading-bar {
  position: fixed;
  top: 0;
  inset-inline: 0;
  height: 3px;
  z-index: 9999;
  background: transparent;
  overflow: hidden;
}

.loading-bar__progress {
  height: 100%;
  width: 40%;
  background: var(--wl-primary);
  animation: loading 1.2s ease-in-out infinite;
}

@keyframes loading {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(350%);
  }
}
</style>
