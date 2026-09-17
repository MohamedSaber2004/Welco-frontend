import { ref } from 'vue'

export type Theme = 'light'

export const theme = ref<Theme>('light')

export const applyTheme = () => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = 'light'
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = 'light'
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null
  if (meta) meta.content = '#ffffff'
}

applyTheme()

export const applyAuthGatedTheme = () => {
  theme.value = 'light'
  applyTheme()
}
