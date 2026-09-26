<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { t } from '../../i18n'
import BaseModal from './BaseModal.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    src: string | null
    alt?: string
    showZoom?: boolean
    showMinimize?: boolean
    showMaximize?: boolean
    showFullscreen?: boolean
    disabled?: boolean
  }>(),
  {
    src: null,
    alt: '',
    showZoom: true,
    showMinimize: false,
    showMaximize: false,
    showFullscreen: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
}>()

const imgZoom = ref(1)
const imgPanX = ref(0)
const imgPanY = ref(0)
const isDragging = ref(false)
const dragStart = ref<{ x: number; y: number }>({ x: 0, y: 0 })
const isFullscreen = ref(false)

function resetImageState() {
  imgZoom.value = 1
  imgPanX.value = 0
  imgPanY.value = 0
  isDragging.value = false
  isFullscreen.value = false
}

function closeLightbox() {
  resetImageState()
  emit('update:modelValue', false)
  emit('close')
}

function zoomIn() {
  imgZoom.value = Math.min(imgZoom.value + 0.25, 4)
}
function zoomOut() {
  imgZoom.value = Math.max(imgZoom.value - 0.25, 0.5)
}
function resetZoom() {
  imgZoom.value = 1
  imgPanX.value = 0
  imgPanY.value = 0
}

function onDragStart(e: MouseEvent | TouchEvent) {
  if (props.disabled) return
  const touch = 'touches' in e ? e.touches[0] : null
  const clientX = touch ? touch.clientX : ('clientX' in e ? e.clientX : 0)
  const clientY = touch ? touch.clientY : ('clientY' in e ? e.clientY : 0)
  isDragging.value = true
  dragStart.value = { x: clientX - imgPanX.value, y: clientY - imgPanY.value }
}
function onDragMove(e: MouseEvent | TouchEvent) {
  if (!isDragging.value || props.disabled) return
  const touch = 'touches' in e ? e.touches[0] : null
  const clientX = touch ? touch.clientX : ('clientX' in e ? e.clientX : 0)
  const clientY = touch ? touch.clientY : ('clientY' in e ? e.clientY : 0)
  imgPanX.value = clientX - dragStart.value.x
  imgPanY.value = clientY - dragStart.value.y
}
function onDragEnd() {
  isDragging.value = false
}

function onZoomWheel(e: WheelEvent) {
  if (props.disabled) return
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  imgZoom.value = Math.max(0.5, Math.min(imgZoom.value + delta, 4))
}

function toggleFullscreen() {
  const el = document.documentElement
  if (!isFullscreen.value) {
    if (el.requestFullscreen) {
      void el.requestFullscreen()
      isFullscreen.value = true
    }
  } else {
    if (document.exitFullscreen) {
      void document.exitFullscreen()
      isFullscreen.value = false
    }
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (!props.modelValue || props.disabled) return
  if (e.key === 'Escape') closeLightbox()
  if (e.key === '+' || e.key === '=') zoomIn()
  if (e.key === '-') zoomOut()
  if (e.key === '0') resetZoom()
  if (e.key === 'f' || e.key === 'F') toggleFullscreen()
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      document.addEventListener('keydown', handleKeyDown)
      resetImageState()
    } else {
      document.removeEventListener('keydown', handleKeyDown)
    }
  },
  { immediate: true },
)

const imgTransform = computed(
  () => `scale(${imgZoom.value}) translate(${imgPanX.value / imgZoom.value}px, ${imgPanY.value / imgZoom.value}px)`,
)
</script>

<template>
  <BaseModal :modelValue="modelValue" @close="closeLightbox" max-width="95vw">
    <div class="iv" role="dialog" aria-modal="true" aria-label="Image viewer">
      <!-- Close -->
      <button class="iv__close" type="button" :aria-label="t('common.close')" @click="closeLightbox">
        <span class="material-symbols-outlined">close</span>
      </button>

      <!-- Image -->
      <div class="iv__stage" @click.self="closeLightbox">
        <img
          v-if="src"
          :src="src"
          :alt="alt"
          class="iv__img"
          :style="{ transform: imgTransform, cursor: imgZoom > 1 ? 'grab' : 'default' }"
          @mousedown="onDragStart"
          @mousemove="onDragMove"
          @mouseup="onDragEnd"
          @mouseleave="onDragEnd"
          @wheel.prevent="onZoomWheel"
        />
      </div>

      <!-- Zoom controls -->
      <div v-if="showZoom && src" class="iv__controls">
        <button type="button" :aria-label="t('attachment.zoomIn')" @click.stop="zoomIn"><span class="material-symbols-outlined">zoom_in</span></button>
        <button type="button" :aria-label="t('attachment.zoomOut')" @click.stop="zoomOut"><span class="material-symbols-outlined">zoom_out</span></button>
        <button type="button" :aria-label="t('attachment.resetZoom')" @click.stop="resetZoom"><span class="material-symbols-outlined">center_focus_strong</span></button>
      </div>

      <!-- Minimize -->
      <button v-if="showMinimize" type="button" class="iv__ctrl iv__ctrl--min" :aria-label="t('common.minimize')" @click.stop="closeLightbox">
        <span class="material-symbols-outlined">remove</span>
      </button>

      <!-- Maximize -->
      <button v-if="showMaximize" type="button" class="iv__ctrl iv__ctrl--max" :aria-label="t('common.maximize')" @click.stop="zoomIn">
        <span class="material-symbols-outlined">open_in_full</span>
      </button>

      <!-- Fullscreen -->
      <button v-if="showFullscreen" type="button" class="iv__ctrl iv__ctrl--fs" :aria-label="isFullscreen ? t('common.exitFullscreen') : t('common.fullscreen')" @click.stop="toggleFullscreen">
        <span class="material-symbols-outlined">{{ isFullscreen ? 'fullscreen_exit' : 'fullscreen' }}</span>
      </button>
    </div>
  </BaseModal>
</template>

<style scoped>
.iv {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(10px);
}

.iv__stage {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.iv__img {
  max-width: 92vw;
  max-height: 88vh;
  border-radius: var(--wl-radius-lg, 12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  transition: transform 0.1s ease-out;
  user-select: none;
  -webkit-user-drag: none;
}

.iv__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 10;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  color: var(--wl-ink, #092f47);
  font-size: 1.4rem;
}
.iv__close:hover { background: rgba(255, 255, 255, 1); }

.iv__controls {
  position: absolute;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
  z-index: 10;
}

.iv__controls button,
.iv__ctrl {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  width: 2.8rem;
  height: 2.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  color: var(--wl-ink, #092f47);
  font-size: 1.2rem;
}
.iv__controls button:hover,
.iv__ctrl:hover { background: rgba(255, 255, 255, 1); }

.iv__ctrl {
  position: absolute;
  bottom: 1.5rem;
  background: rgba(255, 255, 255, 0.85);
}
.iv__ctrl--min { right: 1rem; }
.iv__ctrl--max { right: 4.5rem; }
.iv__ctrl--fs  { right: 8rem; }

@media (prefers-reduced-motion: reduce) {
  .iv__img { transition: none; }
}
</style>