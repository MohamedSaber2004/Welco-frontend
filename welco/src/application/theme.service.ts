import { ref, watch } from 'vue'
import { authService } from '../di/container'
import { ThemeMode } from '../domain/models/user'

export type Theme = 'dark'

/**
 * Theme rules (NAVY CLASSIC ONLY — light mode removed):
 * - The entire site renders the classic navy control-panel theme for everyone.
 * - `theme` is kept as a ref for backward-compat with existing imports.
 * - `toggleTheme` is a no-op that always re-applies the classic theme (so
 *   legacy call sites don't break if missed during cleanup).
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
  if (meta) meta.content = '#061328'
}

export const theme = ref<Theme>('dark')

applyTheme()
try {
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, 'dark')
} catch { /* ignore */ }

/**
 * Push Dark mode to the backend profile (fire-and-forget; local wins on failure).
 * Guarded + once-per-session: skips when the server already reports Dark.
 * Without this, the user watcher below re-fires on every updateProfile
 * response (which replaces the user object), causing an infinite
 * PUT /auth/profile storm that keeps the global loading bar spinning.
 */
let persistAttempted = false
const persistModeToBackend = () => {
  if (!authService.isAuthenticated || persistAttempted) return
  const user = authService.user.value
  if (!user || user.themeMode === ThemeMode.Dark) return
  persistAttempted = true
  user.themeMode = ThemeMode.Dark
  void authService.updateProfile({ themeMode: ThemeMode.Dark }, { silent: true }).catch(() => {})
}

/**
 * Keep the theme forced to navy classic across auth changes (call once at boot):
 * - guest -> classic
 * - login/restored session -> classic (+ persist Dark to backend)
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
  watch(() => authService.user.value, (user) => {
    sync()
    if (!user) persistAttempted = false
    else persistModeToBackend()
  })
}

/** Legacy no-op — light mode removed. Always stays navy classic. */
export const toggleTheme = () => {
  theme.value = 'dark'
  applyTheme()
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, 'dark')
  } catch { /* ignore */ }
  persistModeToBackend()
}
