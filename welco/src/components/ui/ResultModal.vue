<script setup lang="ts">
import { modalService } from '../../di/container'

const close = () => modalService.close()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modalService.visible.value" class="modal-overlay" @click.self="close">
        <div class="modal" role="dialog" aria-modal="true">
          <div :class="['modal__icon', `modal__icon--${modalService.data.value?.type}`]">
            <span v-if="modalService.data.value?.type === 'success'">✓</span>
            <span v-else-if="modalService.data.value?.type === 'error'">×</span>
            <span v-else>!</span>
          </div>
          <p class="modal__msg">{{ modalService.data.value?.message }}</p>
          <button class="modal__close" @click="close">OK</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: grid;
  place-items: center;
  background: rgba(11, 28, 44, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 1rem;
}

.modal {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--wl-radius-xl);
  padding: 1.75rem;
  max-width: 420px;
  width: 100%;
  text-align: center;
  box-shadow: var(--wl-shadow-lg);
  position: relative;
}

.modal::before {
  content: '';
  position: absolute;
  top: -1px; inset-inline: 8px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--wl-line-strong), transparent);
  opacity: 0.6;
  pointer-events: none;
}

.modal__icon {
  width: 48px;
  height: 48px;
  border-radius: var(--wl-radius-md);
  display: grid;
  place-items: center;
  margin: 0 auto 1rem;
  font-size: 1.4rem;
  font-weight: 800;
  border: 1px solid var(--wl-border);
}

.modal__icon--success {
  background: var(--wl-success-soft);
  color: var(--wl-success);
}

.modal__icon--error {
  background: var(--wl-danger-soft);
  color: var(--wl-danger);
}

.modal__icon--info {
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
}

.modal__msg {
  color: var(--wl-ink);
  margin-bottom: 1.25rem;
  line-height: 1.5;
}

.modal__close {
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  border-radius: var(--wl-radius-full);
  padding: 0.62rem 1.5rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--wl-primary-shadow);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
