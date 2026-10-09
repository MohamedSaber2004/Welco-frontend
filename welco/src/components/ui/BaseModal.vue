<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { t } from '../../i18n'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    maxWidth?: string
    size?: ModalSize
  }>(),
  {
    maxWidth: '',
    size: 'md',
  },
)

const sizeMap: Record<ModalSize, string> = {
  sm: '440px',
  md: '560px',
  lg: '840px',
  xl: '1020px',
  '2xl': '1200px',
  full: '95vw',
}

const effectiveMaxWidth = computed(() => {
  if (props.maxWidth) return props.maxWidth
  return sizeMap[props.size || 'md'] || '560px'
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

const modalContainer = ref<HTMLElement | null>(null)

const getFocusable = () => {
  if (!modalContainer.value) return []
  return Array.from(
    modalContainer.value.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled'))
}

const handleClose = () => {
  emit('update:modelValue', false)
  emit('close')
}

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.modelValue) {
    handleClose()
    return
  }
  if (e.key === 'Tab' && props.modelValue) {
    const focusable = getFocusable()
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    if (e.shiftKey) {
      if (document.activeElement === first || !modalContainer.value?.contains(document.activeElement)) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last || !modalContainer.value?.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      }
    }
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

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)
  if (props.modelValue) {
    await nextTick()
    const focusable = getFocusable()
    const first = focusable[0]
    if (first) {
      first.focus()
    } else if (modalContainer.value) {
      modalContainer.value.focus()
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-backdrop" @click.self="handleClose">
        <div class="modal-container" :style="{ maxWidth: effectiveMaxWidth }" ref="modalContainer" role="dialog" aria-modal="true" tabindex="-1">
          <div class="modal-card">
            <div v-if="title || $slots.header" class="modal-header">
              <slot name="header">
                <h3 class="modal-title">{{ title }}</h3>
              </slot>
              <button class="modal-close" :aria-label="t('common.close')" @click="handleClose">
                <span class="material-symbols-outlined text-[18px]">close</span>
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
  background: var(--bg-overlay, rgba(16, 42, 67, 0.45));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4, 16px);
  z-index: var(--z-overlay, 1000);
}

.modal-container {
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  margin: auto;
}

.modal-card {
  background: var(--bg-surface, #ffffff);
  border: 1px solid var(--border, #d9e2ec);
  border-radius: var(--radius-xl, 12px);
  box-shadow: var(--shadow-lg, 0 12px 32px rgba(16, 42, 67, 0.10));
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
  z-index: var(--z-modal, 1050);
}

.modal-header {
  padding: var(--space-4, 1rem) var(--space-6, 1.5rem);
  border-bottom: 1px solid var(--border, #d9e2ec);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4, 1rem);
  background: var(--bg-surface, #ffffff);
}

.modal-title {
  font-family: var(--font-display);
  font-size: var(--text-lg, 1.125rem);
  font-weight: var(--weight-semibold, 600);
  color: var(--fg-heading, #102a43);
  margin: 0;
  letter-spacing: var(--tracking-tight, -0.02em);
}

.modal-close {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  background: transparent;
  border: 0;
  border-radius: var(--radius-pill, 9999px);
  color: var(--fg-muted, #7a90a8);
  cursor: pointer;
  transition: all var(--duration-fast, 150ms) var(--ease-out, ease-out);
}

.modal-close:hover {
  color: var(--fg-heading, #102a43);
  background: var(--bg-subtle, #edf4ff);
}

.modal-body {
  padding: var(--space-6, 1.5rem);
  overflow-y: auto;
  color: var(--fg-body, #42474d);
}

.modal-footer {
  padding: var(--space-4, 1rem) var(--space-6, 1.5rem);
  border-top: 1px solid var(--border, #d9e2ec);
  display: flex;
  gap: var(--space-3, 0.75rem);
  justify-content: flex-end;
  background: var(--bg-subtle, #f8fafc);
}

@media (max-width: 640px) {
  .modal-backdrop {
    padding: var(--space-2, 0.5rem);
  }
  .modal-card {
    border-radius: var(--radius-lg, 8px);
    max-height: 94vh;
  }
}

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all var(--duration-base, 180ms) var(--ease-out, ease-out);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal-container,
.modal-fade-leave-to .modal-container {
  transform: scale(0.96) translateY(6px);
}
</style>
