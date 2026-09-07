import { ref, watch } from 'vue'
import { authService } from '../di/container'

export type Theme = 'light' | 'dark'

/**
 * Dark mode is an authenticated-users-only feature.
 * Guests are always pinned to the light (white) theme: stored/OS dark
 * preferences are ignored until login, and the toggle is hidden.
 */

const STORAGE_KEY = 'welco-theme'

const prefersDark = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

const readStoredTheme = (): Theme => {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return prefersDark() ? 'dark' : 'light'
}

const THEME_COLOR: Record<Theme, string> = { light: '#F8FAFC', dark: '#09090B' }

const applyTheme = (next: Theme) => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = next
  if (next === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  document.documentElement.style.colorScheme = next
  // Sync <meta name="theme-color"> for mobile browser chrome
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null
  if (meta) meta.content = THEME_COLOR[next]
}

export const theme = ref<Theme>(authService.isAuthenticated ? readStoredTheme() : 'light')

applyTheme(theme.value)

// Follow OS preference when the user hasn't chosen explicitly —
// authenticated users only; guests stay on light.
if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = (e: MediaQueryListEvent) => {
    if (!authService.isAuthenticated) return
    const next: Theme = e.matches ? 'dark' : 'light'
    theme.value = next
    document.documentElement.classList.add('theme-transition')
    applyTheme(next)
    setTimeout(() => document.documentElement.classList.remove('theme-transition'), 320)
  }
  // Safari <14 fallback
  if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onChange)
  else (mql as unknown as { addListener: (cb: (e: MediaQueryListEvent) => void) => void }).addListener(onChange)
}

/**
 * Keep the theme in sync with auth state (call once at boot):
 * - logout/expiry -> force light (stored preference is kept for next login)
 * - login -> restore the user's stored/OS preference
 */
export const applyAuthGatedTheme = () => {
  const sync = () => {
    if (!authService.isAuthenticated) {
      if (theme.value !== 'light') {
        theme.value = 'light'
        applyTheme('light')
      }
    } else if (theme.value !== readStoredTheme()) {
      theme.value = readStoredTheme()
      applyTheme(theme.value)
    }
  }
  sync()
  watch(() => authService.user.value, sync)
}

let transitionTimer: ReturnType<typeof setTimeout> | null = null

export const toggleTheme = () => {
  // Guests are pinned to light — no path may enable dark for them.
  if (!authService.isAuthenticated) {
    if (theme.value !== 'light') {
      theme.value = 'light'
      applyTheme('light')
    }
    return
  }
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  localStorage.setItem(STORAGE_KEY, theme.value)
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('theme-transition')
    if (transitionTimer) clearTimeout(transitionTimer)
    transitionTimer = setTimeout(() => {
      document.documentElement.classList.remove('theme-transition')
    }, 320)
  }
  applyTheme(theme.value)
}
