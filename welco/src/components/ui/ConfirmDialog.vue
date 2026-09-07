<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { t } from '../../i18n'
import { confirmService } from '../../infrastructure/feedback/confirm.service'
import BaseButton from './BaseButton.vue'

const visible = confirmService.visible
const opts = confirmService.options

const typeInput = ref('')
const canConfirm = computed(() => {
  const req = opts.value?.requireType
  if (!req) return true
  return typeInput.value.trim() === req
})

watch(visible, (v) => {
  if (v) typeInput.value = ''
})

const onKeyDown = (e: KeyboardEvent) => {
  if (!visible.value) return
  if (e.key === 'Escape') confirmService.dismiss()
  if (e.key === 'Enter' && canConfirm.value && e.metaKey) confirmService.accept()
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

const variantIcon = computed(() => {
  const v = opts.value?.variant ?? 'danger'
  const i = opts.value?.icon
  if (i) return i
  if (v === 'danger') return 'warning'
  if (v === 'warning') return 'warning'
  if (v === 'primary') return 'help'
  return 'info'
})

const variantClass = computed(() => `confirm__icon--${opts.value?.variant ?? 'danger'}`)
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div
        v-if="visible && opts"
        class="confirm-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="'confirm-title'"
        @click.self="confirmService.dismiss()"
      >
        <div class="confirm-card" :class="`confirm-card--${opts.variant ?? 'danger'}`">
          <!-- header accent -->
          <div class="confirm-accent" aria-hidden="true"></div>

          <button class="confirm-close" :aria-label="t('common.close')" @click="confirmService.dismiss()">✕</button>

          <div class="confirm-body">
            <div class="confirm-icon-wrap" :class="variantClass" aria-hidden="true">
              <span class="material-symbols-outlined">{{ variantIcon }}</span>
            </div>

            <div class="confirm-copy">
              <h3 id="confirm-title" class="confirm-title">{{ opts.title }}</h3>
              <p class="confirm-message">{{ opts.message }}</p>

              <div v-if="opts.requireType" class="confirm-verify">
                <p class="mono confirm-verify-hint">{{ t('common.typeToConfirm', { word: opts.requireType }) }}</p>
                <input
                  v-model="typeInput"
                  class="field__input confirm-verify-input"
                  :placeholder="opts.requireType"
                  autocomplete="off"
                  @keydown.enter.prevent="canConfirm && confirmService.accept()"
                />
              </div>
            </div>
          </div>

          <div class="confirm-actions">
            <BaseButton variant="ghost" @click="confirmService.dismiss()">
              {{ opts.cancelText }}
            </BaseButton>
            <BaseButton
              :variant="opts.variant === 'danger' ? 'danger' : 'primary'"
              :disabled="!canConfirm"
              @click="confirmService.accept()"
            >
              {{ opts.confirmText }}
            </BaseButton>
          </div>

          <!-- subtle caliper ticks footer -->
          <div class="confirm-ticks" aria-hidden="true">
            <span v-for="i in 14" :key="i" class="confirm-tick" :class="{ 'confirm-tick--major': i % 5 === 0 }"></span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(11, 29, 42, 0.52);
  backdrop-filter: blur(14px) saturate(1.15);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
  display: grid;
  place-items: center;
  padding: 1rem;
  z-index: 10000;
}
.confirm-card {
  width: 100%;
  max-width: 460px;
  background: var(--wl-surface);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-xl);
  box-shadow: 0 24px 64px rgba(11, 29, 42, 0.22), 0 8px 24px rgba(11, 29, 42, 0.14);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.confirm-accent {
  height: 3px;
  background: linear-gradient(90deg, var(--wl-teal), var(--wl-amber));
  opacity: 0.95;
}
.confirm-card--danger .confirm-accent { background: linear-gradient(90deg, #A63A2E, #D98E00); }
.confirm-card--warning .confirm-accent { background: linear-gradient(90deg, #9C5F26, #E8A317); }
.confirm-card--primary .confirm-accent { background: linear-gradient(90deg, var(--wl-teal), #7FCFC6); }

.confirm-close {
  position: absolute;
  top: 12px;
  inset-inline-end: 12px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-line);
  border-radius: var(--wl-radius-full);
  color: var(--wl-muted);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.18s var(--wl-ease-spring);
}
.confirm-close:hover { background: var(--wl-surface); color: var(--wl-ink-strong); border-color: var(--wl-line-strong); transform: rotate(90deg); }

.confirm-body {
  display: flex;
  gap: 1rem;
  padding: 1.5rem 1.5rem 1.1rem;
  align-items: flex-start;
}
.confirm-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: var(--wl-radius);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 1px solid transparent;
}
.confirm-icon-wrap .material-symbols-outlined { font-size: 22px; }
.confirm__icon--danger { background: var(--wl-danger-soft); color: var(--wl-danger); border-color: rgba(166,58,46,0.18); }
.confirm__icon--warning { background: var(--wl-warning-soft); color: var(--wl-amber-strong); border-color: rgba(156,95,38,0.16); }
.confirm__icon--primary { background: var(--wl-teal-soft); color: var(--wl-teal); border-color: rgba(14,113,105,0.14); }
.confirm__icon--neutral { background: var(--wl-surface-soft); color: var(--wl-ink-soft); border-color: var(--wl-line); }

.confirm-copy { flex: 1; min-width: 0; }
.confirm-title {
  font-family: var(--wl-font-display);
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.018em;
  color: var(--wl-ink-strong);
  line-height: 1.25;
  margin: 0 0 0.45rem;
}
.confirm-message {
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--wl-ink-soft);
  margin: 0;
  word-break: break-word;
}

.confirm-verify { margin-top: 1rem; }
.confirm-verify-hint { font-size: 11px; color: var(--wl-muted); margin-bottom: 0.45rem; }
.confirm-verify-hint strong { color: var(--wl-ink-strong); }
.confirm-verify-input { width: 100%; }

.confirm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  padding: 0 1.5rem 1.2rem;
}
.confirm-ticks {
  display: flex;
  gap: 6px;
  align-items: flex-end;
  justify-content: center;
  padding: 0.7rem 1rem 0.9rem;
  border-top: 1px solid var(--wl-line);
  background: linear-gradient(180deg, var(--wl-surface-soft), var(--wl-surface));
  opacity: 0.9;
}
.confirm-tick { width: 1px; height: 6px; background: var(--wl-line-strong); opacity: 0.45; }
.confirm-tick--major { height: 10px; background: var(--wl-ink-strong); opacity: 0.18; }

/* transition */
.confirm-fade-enter-active, .confirm-fade-leave-active { transition: opacity 0.22s var(--wl-ease-spring), transform 0.22s var(--wl-ease-spring); }
.confirm-fade-enter-from, .confirm-fade-leave-to { opacity: 0; }
.confirm-fade-enter-from .confirm-card, .confirm-fade-leave-to .confirm-card { transform: scale(0.96) translateY(8px); }

@media (max-width: 480px) {
  .confirm-body { flex-direction: column; align-items: center; text-align: center; }
  .confirm-actions { grid-template-columns: 1fr; }
}
</style>
