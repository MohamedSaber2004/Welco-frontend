import { ref, watch } from 'vue'
import { authService } from '../di/container'
import { ThemeMode } from '../domain/models/user'

export type Theme = 'dark'

/**
 * Theme rules (DARK ONLY — white mode removed):
 * - The entire site renders the rich charcoal dark theme for everyone.
 * - `theme` is kept as a ref for backward-compat with existing imports.
 * - `toggleTheme` is a no-op that always re-applies dark (so legacy
 *   call sites don't break if missed during cleanup).
 * - Stored `welco-theme` values are normalized to dark on boot.
 * - Authenticated users persist `User.ThemeMode.Dark` to the backend.
 */

const STORAGE_KEY = 'welco-theme'

const applyTheme = () => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = 'dark'
  document.documentElement.classList.add('dark')
  document.documentElement.style.colorScheme = 'dark'
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null
  if (meta) meta.content = '#1E1F22'
}

export const theme = ref<Theme>('dark')

applyTheme()
try {
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, 'dark')
} catch { /* ignore */ }

/** Push Dark mode to the backend profile (fire-and-forget; local wins on failure). */
const persistModeToBackend = () => {
  if (!authService.isAuthenticated) return
  const user = authService.user.value
  if (user) user.themeMode = ThemeMode.Dark
  void authService.updateProfile({ themeMode: ThemeMode.Dark }, { silent: true }).catch(() => {})
}

/**
 * Keep the theme forced to dark across auth changes (call once at boot):
 * - guest -> dark
 * - login/restored session -> dark (+ persist Dark to backend)
 */
export const applyAuthGatedTheme = () => {
  const sync = () => {
    if (theme.value !== 'dark') theme.value = 'dark'
    applyTheme()
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, 'dark')
    } catch { /* ignore */ }
  }
  sync()
  watch(() => authService.user.value, () => {
    sync()
    persistModeToBackend()
  })
}

/** Legacy no-op — white mode removed. Always stays dark. */
export const toggleTheme = () => {
  theme.value = 'dark'
  applyTheme()
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, 'dark')
  } catch { /* ignore */ }
  persistModeToBackend()
}
