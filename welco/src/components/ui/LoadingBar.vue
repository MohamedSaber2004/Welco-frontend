<script setup lang="ts">
import { requestTracker } from '../../application/request.tracker'
</script>

<template>
  <Transition name="loading-spinner">
    <div v-if="requestTracker.isLoading.value" class="loading-spinner" role="status" aria-live="polite" aria-label="Loading">
      <span class="loading-spinner__ring" aria-hidden="true" />
      <span class="loading-spinner__label">Loading</span>
    </div>
  </Transition>
</template>

<style scoped>
/* Floating status spinner for route and API transitions. */
.loading-spinner {
  position: fixed;
  top: max(1rem, env(safe-area-inset-top));
  inset-inline-end: max(1rem, env(safe-area-inset-right));
  z-index: 9999;
  display: inline-flex;
  align-items: center;
  gap: .65rem;
  min-height: 44px;
  padding: .55rem .8rem .55rem .6rem;
  border: 1px solid rgba(255,255,255,.42);
  border-radius: 999px;
  background: rgba(7, 31, 45, .88);
  color: #f7fffe;
  box-shadow: 0 12px 30px rgba(2, 25, 39, .24), 0 0 0 4px rgba(214,243,106,.12);
  backdrop-filter: blur(14px) saturate(1.2);
  pointer-events: none;
}
.loading-spinner__ring {
  width: 25px;
  height: 25px;
  border: 3px solid rgba(255,255,255,.26);
  border-top-color: #d6f36a;
  border-right-color: #2dd4bf;
  border-radius: 50%;
  animation: spinner-rotate .78s linear infinite;
}
.loading-spinner__label {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}
@keyframes spinner-rotate { to { transform: rotate(360deg); } }
.loading-spinner-enter-active, .loading-spinner-leave-active { transition: opacity .18s ease, transform .18s ease; }
.loading-spinner-enter-from, .loading-spinner-leave-to { opacity: 0; transform: translateY(-8px) scale(.96); }
@media (prefers-reduced-motion: reduce) { .loading-spinner__ring { animation: none; } }
@media (max-width: 520px) { .loading-spinner__label { display: none; } .loading-spinner { padding: .55rem; } }
</style>
