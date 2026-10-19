import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('App.vue script setup ordering and safety', () => {
  it('declares showFooter before watching it to avoid TDZ ReferenceError', () => {
    const filePath = resolve(process.cwd(), 'src/App.vue')
    const content = readFileSync(filePath, 'utf8')

    const showFooterDefIndex = content.indexOf('const showFooter = computed')
    const showFooterWatchIndex = content.indexOf('watch(showFooter') !== -1
      ? content.indexOf('watch(showFooter')
      : content.indexOf('watch(() => showFooter')

    expect(showFooterDefIndex).toBeGreaterThan(-1)
    expect(showFooterWatchIndex).toBeGreaterThan(-1)
    // showFooter must be initialized before being watched to avoid Temporal Dead Zone (TDZ)
    expect(showFooterDefIndex).toBeLessThan(showFooterWatchIndex)
  })

  it('safely handles optional support contact whatsAppNumber in WhatsAppFab', () => {
    const filePath = resolve(process.cwd(), 'src/App.vue')
    const content = readFileSync(filePath, 'utf8')

    // Should use optional chaining to prevent reading property of undefined/null
    expect(content).not.toMatch(/supportContact\.value\.whatsAppNumber/)
  })
})
