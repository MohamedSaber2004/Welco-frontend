<script setup lang="ts">
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t } from '../../i18n'

const toasts = toastService.toasts
</script>

<template>
  <div class="toast-stack" aria-live="polite" aria-atomic="true">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', `toast--${toast.type}`]"
        role="status"
      >
        <span class="toast__msg">{{ toast.message }}</span>
        <button
          v-if="toast.action"
          class="toast__action"
          @click="toast.action.onClick"
        >
          {{ toast.action.label }}
        </button>
        <button class="toast__close" :aria-label="t('common.dismiss')" @click="toastService.dismiss(toast.id)">
          ×
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  top: calc(var(--wl-header-height, 56px) + 1rem);
  inset-inline-end: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 420px;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.8rem 0.9rem 0.8rem 1rem;
  border-radius: var(--wl-radius-md);
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  box-shadow: var(--wl-shadow);
  font-size: 0.92rem;
  color: var(--wl-ink);
  border-inline-start: 2px solid var(--wl-line-strong);
  position: relative;
  overflow: hidden;
}

.toast::after {
  content: '';
  position: absolute;
  inset-inline-end: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--wl-line);
  opacity: 0.6;
}

.toast--success {
  border-inline-start-color: var(--wl-success);
  background: var(--wl-surface);
  border-color: var(--wl-border);
}
.toast--success::after { background: var(--wl-success); opacity: 1; }

.toast--error {
  border-inline-start-color: var(--wl-danger);
  background: var(--wl-surface);
  border-color: var(--wl-border);
}
.toast--error::after { background: var(--wl-danger); opacity: 1; }

.toast__msg {
  flex: 1;
}

.toast__action {
  font-weight: 700;
  color: var(--wl-primary);
  background: none;
  border: none;
  cursor: pointer;
}

.toast__close {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  color: var(--wl-muted);
  line-height: 1;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
