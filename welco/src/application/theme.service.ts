import { ref, watch } from 'vue'
import { authService } from '../di/container'
import { ThemeMode, normalizeThemeMode } from '../domain/models/user'

export type Theme = 'light' | 'dark'

/**
 * Theme rules:
 * - Default mode is WHITE (light) for everyone — no OS sniffing.
 * - Dark mode is an authenticated-users-only feature; guests stay white.
 * - Per-user mode persists to the backend (`User.ThemeMode`: 1 = White,
 *   2 = Dark). localStorage is the offline fallback and wins only when the
 *   backend has no value yet. Until the backend exposes the column,
 *   everything runs on localStorage alone.
 */

const STORAGE_KEY = 'welco-theme'

const themeFromMode = (mode: ThemeMode | null | undefined): Theme =>
  mode === ThemeMode.Dark ? 'dark' : 'light'

const modeFromTheme = (theme: Theme): ThemeMode =>
  theme === 'dark' ? ThemeMode.Dark : ThemeMode.White

const readStoredTheme = (): Theme => {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'dark' ? 'dark' : 'light'
}

/** Effective theme for the current session: server value first, then stored, else white. */
const resolveSessionTheme = (): Theme => {
  const user = authService.user.value
  if (!user) return 'light'
  if (user.themeMode === ThemeMode.White || user.themeMode === ThemeMode.Dark) {
    return themeFromMode(user.themeMode)
  }
  return readStoredTheme()
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

export const theme = ref<Theme>(resolveSessionTheme())

applyTheme(theme.value)

/** Push the mode to the backend profile (fire-and-forget; local wins on failure). */
const persistModeToBackend = (next: Theme) => {
  if (!authService.isAuthenticated) return
  const user = authService.user.value
  const mode = modeFromTheme(next)
  if (user) user.themeMode = mode
  void authService
    .updateProfile({ themeMode: mode }, { silent: true })
    .then((res) => {
      // If the backend echoes the saved mode, converge to it (covers any
      // server-side coercion). updateUserFromProfile already applied it to
      // the session user, so this only corrects drift.
      if (res.ok && res.profile) {
        const raw = res.profile as unknown as Record<string, unknown>
        const serverMode = normalizeThemeMode(raw.themeMode ?? raw.ThemeMode)
        if (serverMode) {
          const normalized = themeFromMode(serverMode)
          if (normalized !== theme.value && authService.isAuthenticated) {
            theme.value = normalized
            localStorage.setItem(STORAGE_KEY, normalized)
            applyTheme(normalized)
          }
        }
      }
    })
    .catch(() => {})
}

/**
 * Keep the theme in sync with auth state (call once at boot):
 * - guest -> white
 * - login/restored session -> backend ThemeMode, else stored choice, else white
 */
export const applyAuthGatedTheme = () => {
  const sync = () => {
    const next = resolveSessionTheme()
    if (theme.value !== next) {
      theme.value = next
      applyTheme(next)
    }
  }
  sync()
  watch(() => authService.user.value, sync)
}

let transitionTimer: ReturnType<typeof setTimeout> | null = null

export const toggleTheme = () => {
  // Guests are pinned to white — no path may enable dark for them.
  if (!authService.isAuthenticated) {
    if (theme.value !== 'light') {
      theme.value = 'light'
      applyTheme('light')
    }
    return
  }
  const next: Theme = theme.value === 'light' ? 'dark' : 'light'
  theme.value = next
  localStorage.setItem(STORAGE_KEY, next)
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('theme-transition')
    if (transitionTimer) clearTimeout(transitionTimer)
    transitionTimer = setTimeout(() => {
      document.documentElement.classList.remove('theme-transition')
    }, 320)
  }
  applyTheme(next)
  persistModeToBackend(next)
}
