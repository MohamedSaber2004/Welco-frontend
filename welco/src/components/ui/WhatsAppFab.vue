<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../../i18n'

const props = withDefaults(defineProps<{ phone?: string; message?: string; sku?: string; bottomOffset?: string }>(), {
  phone: '',
  message: '',
  sku: '',
  bottomOffset: '',
})

const digits = computed(() => (props.phone ? props.phone.replace(/\D/g, '') : ''))

const waUrl = computed(() => {
  if (!digits.value) return ''
  const baseMsg = props.message || t('common.whatsAppDefaultMsg' as never) || 'Hello Welco team — I need assistance with surgical instruments.'
  const skuPart = props.sku ? ` (SKU ${props.sku})` : ''
  const text = `${baseMsg}${skuPart}`
  const encoded = encodeURIComponent(text)
  return `https://wa.me/${digits.value}?text=${encoded}`
})

const ariaLabel = computed(() => t('common.whatsAppInquiry' as never) || 'WhatsApp Inquiry')

const fabStyle = computed(() =>
  props.bottomOffset ? { bottom: props.bottomOffset } : {},
)
</script>

<template>
  <a v-if="digits && waUrl" :href="waUrl" target="_blank" rel="noopener noreferrer" class="wa-fab" :aria-label="ariaLabel" :style="fabStyle">
    <span class="wa-fab__icon" aria-hidden="true">
      <!-- WhatsApp speech bubble -->
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.8 13.4L3 21l4.7-1.2A9 9 0 1 0 12 3Z" fill="currentColor" opacity="0.95"/><path d="M16.6 14.3c-.2-.1-1.2-.6-1.4-.7-.2 0-.3 0-.5.2-.1.2-.5.7-.6.8-.1.2-.2.2-.4.1-.2-.1-.8-.3-1.5-.9-.6-.5-1-1.1-1.1-1.3-.1-.2 0-.3.1-.4l.4-.5c.1-.1.1-.2.2-.4 0-.1 0-.3 0-.4 0-.1-.5-1.1-.7-1.5-.2-.4-.3-.3-.5-.3h-.4c-.1 0-.4.1-.5.3-.2.2-.6.6-.6 1.5 0 .9.6 1.7.7 1.8.1.2 1.2 1.9 3 2.6.4.2.7.3 1 .4.4.1.8.1 1.1.1.3 0 1-.4 1.1-.8.1-.4.1-.8.1-.8 0-.1-.2-.2-.4-.3Z" fill="#fff"/></svg>
    </span>
    <span class="wa-fab__label mono">{{ t('common.callUs') }}</span>
  </a>
</template>

<style scoped>
.wa-fab {
  position: fixed;
  bottom: 24px;
  inset-inline-end: 20px;
  z-index: 99;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #25D366;
  color: #ffffff;
  padding: 8px 14px 8px 8px;
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(37, 211, 102, 0.35), 0 2px 8px rgba(0,0,0,0.12);
  text-decoration: none;
  transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
  margin-bottom: env(safe-area-inset-bottom, 0);
}
.wa-fab:hover {
  transform: translateY(-2px);
  background: #20BA5A;
  box-shadow: 0 12px 30px rgba(37, 211, 102, 0.45);
}
.wa-fab__icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255,255,255,.2);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.wa-fab__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: #ffffff;
}

@media (max-width: 768px) {
  .wa-fab {
    bottom: calc(72px + env(safe-area-inset-bottom, 0px)) !important;
    inset-inline-end: 14px !important;
    padding: 0 !important;
    width: 44px !important;
    height: 44px !important;
    border-radius: 50% !important;
    justify-content: center !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22) !important;
  }
  .wa-fab__label {
    display: none !important;
  }
  .wa-fab__icon {
    width: 100% !important;
    height: 100% !important;
    background: transparent !important;
    border: none !important;
  }
}
</style>
