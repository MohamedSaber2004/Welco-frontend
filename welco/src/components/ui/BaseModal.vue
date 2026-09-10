<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { t } from '../../i18n'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    maxWidth?: string
  }>(),
  {
    maxWidth: '520px',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

const handleClose = () => {
  emit('update:modelValue', false)
  emit('close')
}

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.modelValue) {
    handleClose()
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  },
)

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-backdrop" @click.self="handleClose">
        <div class="modal-container" :style="{ maxWidth }" role="dialog" aria-modal="true">
          <div class="modal-card">
            <div v-if="title || $slots.header" class="modal-header">
              <slot name="header">
                <h3 class="modal-title">{{ title }}</h3>
              </slot>
              <button class="modal-close" :aria-label="t('common.close')" @click="handleClose">
                ✕
              </button>
            </div>

            <div class="modal-body">
              <slot />
            </div>

            <div v-if="$slots.footer" class="modal-footer">
              <slot name="footer" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 10, 25, 0.6);
  backdrop-filter: blur(12px) saturate(1.2);
  -webkit-backdrop-filter: blur(12px) saturate(1.2);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--wl-gutter, var(--space-4));
  z-index: 999;
}
:root.dark .modal-backdrop,
:root[data-theme='dark'] .modal-backdrop {
  background: rgba(0, 0, 0, 0.72);
}

.modal-container {
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-card {
  background-color: var(--wl-surface);
  background-image: var(--wl-gradient-modal, var(--wl-gradient-card));
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
}
.modal-header {
  padding: 1.1rem var(--wl-modal-padding, var(--space-6));
  border-bottom: 1px solid var(--wl-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--wl-surface-soft);
  background-image: var(--wl-gradient-toolbar);
}

.modal-title {
  font-family: var(--wl-font-display);
  font-size: 1.18rem;
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  letter-spacing: -0.02em;
}

.modal-close {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-full);
  font-size: 13px;
  color: var(--wl-muted);
  cursor: pointer;
  transition: all 0.2s var(--wl-ease-spring);
}
.modal-close:hover {
  color: var(--wl-ink-strong);
  border-color: var(--wl-border-strong);
  background: var(--wl-surface-soft);
  transform: rotate(90deg);
}

.modal-body {
  padding: var(--wl-modal-padding, var(--space-6));
  overflow-y: auto;
}

.modal-footer {
  padding: 1rem var(--wl-modal-padding, var(--space-6));
  border-top: 1px solid var(--wl-border);
  background: var(--wl-surface-soft);
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .modal-backdrop {
    padding: var(--space-2);
  }
  .modal-card {
    border-radius: var(--radius-lg);
    max-height: 94vh;
  }
}

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal-container,
.modal-fade-leave-to .modal-container {
  transform: scale(0.95) translateY(8px);
}
</style>
