<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { attachmentService } from '../../di/container'
import { t } from '../../i18n'
import { resolveFileUrl } from '../../utils/file-url'
import {
  ALLOWED_EXTENSIONS,
  MEDIA_MAX_SIZE_KB,
  guessMediaTypeFromFile,
  type MediaType,
} from '../../domain/models/attachment'

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    place?: number
    fileType?: number
    uploadType?: string | number
    accept?: string
    ratio?: string
    label?: string
    hint?: string
    disabled?: boolean
  }>(),
  {
    modelValue: null,
    place: 1,
    fileType: undefined,
    uploadType: undefined,
    accept: undefined,
    ratio: '1 / 1',
    label: undefined,
    hint: undefined,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  uploaded: [storedName: string]
  removed: []
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const progress = ref(0)
const error = ref('')
const showInlinePdf = ref(false)

const effectiveFileType = computed<number | undefined>(() => {
  if (props.fileType !== undefined) return props.fileType
  if (typeof props.uploadType === 'number') return props.uploadType
  if (typeof props.uploadType === 'string') {
    const ut = props.uploadType.toLowerCase().trim()
    if (ut === 'image' || ut === 'img') return 0
    if (ut === 'video') return 1
    if (ut === 'audio') return 2
    if (ut === 'document' || ut === 'file' || ut === 'doc' || ut === 'pdf') return 3
  }
  return undefined
})

const fileExtension = computed(() => {
  if (!props.modelValue) return ''
  const str = String(props.modelValue)
  const qIdx = str.indexOf('?')
  const noQuery = qIdx >= 0 ? str.slice(0, qIdx) : str
  const hIdx = noQuery.indexOf('#')
  const clean = hIdx >= 0 ? noQuery.slice(0, hIdx) : noQuery
  const dotIdx = clean.lastIndexOf('.')
  return dotIdx >= 0 ? clean.slice(dotIdx).toLowerCase() : ''
})

const isPdf = computed(() => {
  return fileExtension.value === '.pdf'
})

const isImage = computed(() => {
  if (isPdf.value) return false
  const ext = fileExtension.value
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.avif'].includes(ext)) {
    return true
  }
  if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.zip', '.rar', '.csv'].includes(ext)) {
    return false
  }
  if (effectiveFileType.value === 0) return true
  if (effectiveFileType.value !== undefined && effectiveFileType.value !== 0) return false
  return true
})

const previewUrl = computed(() => (props.modelValue ? resolveFileUrl(props.modelValue) : null))

const hasMediaType = computed(() => typeof effectiveFileType.value === 'number')

watch(
  () => attachmentService.progress.value,
  (v) => {
    if (uploading.value) progress.value = v
  },
)

function validate(file: File): string | null {
  const mt = effectiveFileType.value ?? guessMediaTypeFromFile(file)
  if (effectiveFileType.value !== undefined) {
    const allowed = ALLOWED_EXTENSIONS[mt as MediaType]
    if (allowed) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      if (!allowed.includes(ext)) return t('attachment.unsupportedType')
    }
    const maxKb = MEDIA_MAX_SIZE_KB[mt as MediaType]
    if (maxKb && file.size > maxKb * 1024) return t('attachment.fileTooLarge')
  }
  return null
}

async function handleFile(file: File) {
  error.value = ''
  const invalid = validate(file)
  if (invalid) {
    error.value = invalid
    return
  }
  uploading.value = true
  progress.value = 0
  const mt = effectiveFileType.value ?? guessMediaTypeFromFile(file)
  const res = await attachmentService.upload({ file, place: props.place, fileType: mt })
  uploading.value = false
  if (res.ok) {
    const name = res.data
    emit('update:modelValue', name)
    emit('uploaded', name)
  } else {
    error.value = t('attachment.uploadFailed')
  }
}

function onInput(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void handleFile(file)
  input.value = ''
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
  if (file) void handleFile(file)
}

function remove() {
  showInlinePdf.value = false
  emit('update:modelValue', null)
  emit('removed')
}

function triggerPick() {
  fileInput.value?.click()
}

const showDrop = computed(() => !hasMediaType.value || effectiveFileType.value === 0)
</script>

<template>
  <div class="fup" :class="{ 'fup--disabled': disabled }">
    <span v-if="label" class="fup__label">
      {{ label }}
      <span v-if="hint" class="fup__hint">{{ hint }}</span>
    </span>

    <div class="fup__body">
      <!-- Existing image preview -->
      <div v-if="previewUrl && isImage" class="fup__preview" :style="{ aspectRatio: ratio }">
        <img :src="previewUrl" :alt="label ?? t('attachment.preview')" class="fup__img" />
        <div class="fup__overlay">
          <a
            :href="previewUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="fup__action fup__action--view"
            :title="t('attachment.preview')"
          >
            <span class="material-symbols-outlined">open_in_new</span>
            <span>{{ t('attachment.preview') }}</span>
          </a>
          <button type="button" class="fup__action fup__action--danger" :disabled="uploading || disabled" @click="remove">
            <span class="material-symbols-outlined">delete</span> {{ t('attachment.remove') }}
          </button>
        </div>
      </div>

      <!-- Document / PDF / Non-image file card -->
      <div v-else-if="modelValue && !isImage" class="fup__file-card">
        <div class="fup__file-top">
          <div class="fup__file-icon-wrap" :class="{ 'fup__file-icon-wrap--pdf': isPdf }">
            <span class="material-symbols-outlined">{{ isPdf ? 'picture_as_pdf' : 'description' }}</span>
          </div>

          <div class="fup__file-meta">
            <a
              v-if="previewUrl"
              :href="previewUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="fup__filename fup__filename--link mono"
              :title="t('attachment.preview')"
            >
              {{ modelValue }}
            </a>
            <span v-else class="mono fup__filename">{{ modelValue }}</span>

            <div class="fup__tags-row">
              <span class="fup__type-tag mono" :class="{ 'fup__type-tag--pdf': isPdf }">
                {{ isPdf ? 'PDF DOCUMENT' : (fileExtension ? fileExtension.replace('.', '').toUpperCase() : 'DOCUMENT') }}
              </span>
              <span v-if="previewUrl" class="fup__url-preview mono" :title="previewUrl">
                {{ previewUrl }}
              </span>
            </div>
          </div>

          <div class="fup__file-actions">
            <a
              v-if="previewUrl"
              :href="previewUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="fup__btn-open mono"
              :title="t('attachment.preview')"
            >
              <span class="material-symbols-outlined">open_in_new</span>
              <span>{{ t('attachment.preview') }}</span>
            </a>
            <button
              v-if="isPdf && previewUrl"
              type="button"
              class="fup__btn-inline-toggle mono"
              :title="showInlinePdf ? t('common.collapse') : t('common.expand')"
              @click="showInlinePdf = !showInlinePdf"
            >
              <span class="material-symbols-outlined">{{ showInlinePdf ? 'expand_less' : 'visibility' }}</span>
              <span>{{ showInlinePdf ? t('common.collapse') : t('common.expand') }}</span>
            </button>
            <button
              type="button"
              class="fup__x"
              :disabled="uploading || disabled"
              :aria-label="t('attachment.remove')"
              :title="t('attachment.remove')"
              @click="remove"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- Optional collapsible inline PDF viewer -->
        <div v-if="showInlinePdf && isPdf && previewUrl" class="fup__inline-viewer">
          <iframe
            :src="previewUrl"
            class="fup__pdf-iframe"
            :title="t('attachment.preview')"
          />
        </div>
      </div>

      <!-- Upload / replace drop zone -->
      <div
        v-else
        class="fup__drop"
        :style="{ aspectRatio: ratio }"
        :class="{ 'fup__drop--busy': uploading }"
        role="button"
        tabindex="0"
        :aria-disabled="disabled || uploading"
        @click="!uploading && !disabled && triggerPick()"
        @keydown.enter="!uploading && !disabled && triggerPick()"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        <template v-if="uploading">
          <span class="material-symbols-outlined fup__icon">upload</span>
          <div class="fup__progress">
            <div class="fup__bar" :style="{ width: `${Math.round(progress * 100)}%` }" />
          </div>
          <span class="fup__meta mono">{{ t('attachment.uploading') }} · {{ Math.round(progress * 100) }}%</span>
        </template>
        <template v-else>
          <span class="material-symbols-outlined fup__icon">add_photo_alternate</span>
          <span class="fup__meta mono">{{ modelValue ? t('attachment.replace') : hasMediaType ? t('attachment.uploadFile') : t('attachment.upload') }}</span>
          <span v-if="showDrop" class="fup__hint-mono mono">{{ t('attachment.dropHint') }}</span>
        </template>
      </div>

      <input
        ref="fileInput"
        class="fup__input"
        type="file"
        :accept="accept"
        :disabled="disabled || uploading"
        hidden
        @change="onInput"
      />
    </div>

    <p v-if="error" class="fup__error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.fup { display: flex; flex-direction: column; gap: 0.5rem; }
.fup--disabled { opacity: 0.6; pointer-events: none; }
.fup__label { font-size: 0.8rem; font-weight: 700; color: var(--text-primary); letter-spacing: 0.005em; display: flex; align-items: baseline; gap: 0.5rem; }
.fup__hint { font-size: 0.72rem; font-weight: 500; color: var(--wl-muted); }

.fup__body { position: relative; }

.fup__preview { position: relative; border: 1px solid var(--wl-line); background: var(--wl-surface); overflow: hidden; border-radius: var(--wl-radius); }
.fup__img { width: 100%; height: 100%; object-fit: cover; display: block; }
.fup__overlay { position: absolute; inset: auto 0 0 0; display: flex; justify-content: flex-end; align-items: center; gap: 0.4rem; padding: 0.45rem 0.6rem; background: linear-gradient(transparent, rgba(11, 28, 44, 0.75)); opacity: 0; transition: opacity 0.15s; }
.fup__preview:hover .fup__overlay { opacity: 1; }
.fup__action { display: inline-flex; align-items: center; gap: 0.3rem; background: rgba(11, 28, 44, 0.85); color: #fff; border: 1px solid rgba(255, 255, 255, 0.25); padding: 0.35rem 0.7rem; font-size: 0.75rem; font-weight: 600; cursor: pointer; border-radius: 6px; text-decoration: none; transition: all 0.15s ease; }
.fup__action:hover { background: var(--wl-ink-strong); color: #fff; border-color: rgba(255, 255, 255, 0.5); }
:root[data-theme='dark'] .fup__action:hover, :root.dark .fup__action:hover { background: #4E5058; color: #fff; }
.fup__action--view { background: rgba(14, 165, 233, 0.85); }
.fup__action--view:hover { background: #0284c7; }
.fup__action--danger:hover { background: #dc2626; }
.fup__action .material-symbols-outlined { font-size: 15px; }

/* Document & PDF Card */
.fup__file-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--wl-border);
  background: var(--wl-surface);
  border-radius: 10px;
  color: var(--wl-ink-strong);
  box-shadow: var(--shadow-xs);
  overflow: hidden;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.fup__file-card:hover {
  border-color: var(--wl-border-strong);
  box-shadow: var(--shadow-sm);
}
.fup__file-top {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
}
.fup__file-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: rgba(15, 118, 110, 0.1);
  color: var(--wl-teal);
  flex-shrink: 0;
}
.fup__file-icon-wrap--pdf {
  background: rgba(225, 29, 72, 0.1);
  color: #e11d48;
}
.fup__file-icon-wrap .material-symbols-outlined {
  font-size: 22px;
}
.fup__file-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.fup__filename {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--wl-ink-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fup__filename--link {
  color: var(--wl-teal);
  text-decoration: none;
}
.fup__filename--link:hover {
  text-decoration: underline;
}
.fup__tags-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  overflow: hidden;
}
.fup__type-tag {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: rgba(15, 118, 110, 0.08);
  color: var(--wl-teal);
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.fup__type-tag--pdf {
  background: rgba(225, 29, 72, 0.1);
  color: #e11d48;
}
.fup__url-preview {
  font-size: 0.68rem;
  color: var(--wl-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fup__file-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}
.fup__btn-open,
.fup__btn-inline-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  color: var(--wl-ink-strong);
  padding: 0.35rem 0.6rem;
  font-size: 0.73rem;
  font-weight: 600;
  border-radius: 6px;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s ease;
}
.fup__btn-open:hover,
.fup__btn-inline-toggle:hover {
  background: var(--wl-teal);
  color: #fff;
  border-color: var(--wl-teal);
}
.fup__btn-open .material-symbols-outlined,
.fup__btn-inline-toggle .material-symbols-outlined {
  font-size: 15px;
}
.fup__x {
  background: none;
  border: none;
  color: var(--wl-muted);
  cursor: pointer;
  font-size: 0.95rem;
  padding: 0.3rem 0.45rem;
  border-radius: 4px;
  transition: all 0.15s ease;
}
.fup__x:hover {
  color: var(--wl-danger);
  background: var(--wl-danger-soft);
}

.fup__inline-viewer {
  border-top: 1px solid var(--wl-border);
  background: var(--wl-surface-soft);
  padding: 0.5rem;
}
.fup__pdf-iframe {
  width: 100%;
  height: 320px;
  border: 1px solid var(--wl-border);
  border-radius: 6px;
  background: var(--wl-surface);
}

.fup__drop {
  border: 1.5px dashed var(--wl-border-strong);
  background: var(--wl-surface-soft);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  cursor: pointer;
  transition: border-color 0.22s var(--wl-ease-spring),
              background-color 0.22s var(--wl-ease-spring),
              box-shadow 0.22s var(--wl-ease-spring),
              transform 0.18s ease;
  border-radius: 12px;
  min-height: 100px;
  padding: 1rem;
}
.fup__drop:hover:not(.fup__drop--busy) {
  border-color: var(--wl-teal);
  background: rgba(79, 70, 229, 0.04);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px -2px rgba(79, 70, 229, 0.12);
}
.fup__drop:focus-visible {
  outline: 2px solid var(--wl-teal);
  outline-offset: 2px;
  box-shadow: var(--wl-focus-ring);
}
.fup__drop--busy { cursor: wait; }
.fup__icon {
  font-size: 28px;
  color: var(--wl-teal);
  transition: transform 0.2s var(--wl-ease-spring);
}
.fup__drop:hover:not(.fup__drop--busy) .fup__icon {
  transform: scale(1.12) translateY(-2px);
}
.fup__meta { font-size: 0.76rem; font-weight: 600; color: var(--wl-ink-strong); }
.fup__hint-mono { font-size: 0.68rem; color: var(--wl-muted); }
.fup__progress { width: 70%; height: 6px; background: var(--wl-line); border-radius: 999px; overflow: hidden; }
.fup__bar { height: 100%; background: var(--wl-teal); transition: width 0.15s ease; }

.fup__error { font-size: 0.78rem; font-weight: 600; color: var(--wl-danger); margin: 0; }
</style>
