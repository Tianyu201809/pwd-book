import { ref, computed } from 'vue'
import { translateAccentLabel, translateModeLabel } from '@/i18n'
import type {
  ThemeAccent,
  ThemeAccentOption,
  ThemeModeOption,
  ThemeModePref,
  ResolvedThemeMode,
} from '@/types'

const STORAGE_MODE = 'pwdbook-theme-mode'
const STORAGE_ACCENT = 'pwdbook-theme-accent'

const ACCENT_IDS: ThemeAccent[] = [
  'brass',
  'teal',
  'indigo',
  'rose',
  'emerald',
  'violet',
  'amber',
  'ocean',
]

const ACCENT_COLORS: Record<ThemeAccent, string> = {
  brass: '#c9a227',
  teal: '#14b8a6',
  indigo: '#6366f1',
  rose: '#f43f5e',
  emerald: '#10b981',
  violet: '#8b5cf6',
  amber: '#f59e0b',
  ocean: '#0ea5e9',
}

const MODE_IDS: ThemeModePref[] = ['light', 'dark', 'system']

export const ACCENT_OPTIONS: ThemeAccentOption[] = ACCENT_IDS.map((id) => ({
  id,
  label: translateAccentLabel(id),
  color: ACCENT_COLORS[id],
}))

export const MODE_OPTIONS: ThemeModeOption[] = MODE_IDS.map((id) => ({
  id,
  label: translateModeLabel(id),
}))

function readStorage(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function resolveMode(mode: ThemeModePref): ResolvedThemeMode {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode === 'light' ? 'light' : 'dark'
}

function applyTheme(modePref: ThemeModePref, nextAccent: ThemeAccent): ResolvedThemeMode {
  const resolved = resolveMode(modePref)
  const root = document.documentElement
  root.setAttribute('data-mode', resolved)
  root.setAttribute('data-accent', nextAccent)
  root.setAttribute('data-mode-pref', modePref)
  window.electronAPI?.setNativeTheme(modePref)
  return resolved
}

const modePref = ref<ThemeModePref>(readStorage(STORAGE_MODE, 'dark') as ThemeModePref)
const accent = ref<ThemeAccent>(readStorage(STORAGE_ACCENT, 'brass') as ThemeAccent)
const resolvedMode = ref<ResolvedThemeMode>(resolveMode(modePref.value))

const accentOptions = computed<ThemeAccentOption[]>(() =>
  ACCENT_IDS.map((id) => ({
    id,
    label: translateAccentLabel(id),
    color: ACCENT_COLORS[id],
  })),
)

const modeOptions = computed<ThemeModeOption[]>(() =>
  MODE_IDS.map((id) => ({
    id,
    label: translateModeLabel(id),
  })),
)

const currentAccent = computed(
  () => accentOptions.value.find((item) => item.id === accent.value) ?? accentOptions.value[0],
)

import { i18n } from '@/i18n'

const currentModeLabel = computed(() => {
  const meta = modeOptions.value.find((item) => item.id === modePref.value)
  if (!meta) return modePref.value
  if (modePref.value === 'system') {
    const resolved =
      resolvedMode.value === 'dark'
        ? translateModeLabel('dark')
        : translateModeLabel('light')
    return i18n.global.t('appearance.modeCurrent', {
      mode: translateModeLabel('system'),
      resolved,
    })
  }
  return meta.label
})

function setMode(mode: ThemeModePref): void {
  modePref.value = mode
  localStorage.setItem(STORAGE_MODE, mode)
  resolvedMode.value = applyTheme(mode, accent.value)
}

function setAccent(next: ThemeAccent): void {
  accent.value = next
  localStorage.setItem(STORAGE_ACCENT, next)
  resolvedMode.value = applyTheme(modePref.value, next)
}

export function initTheme(): void {
  resolvedMode.value = applyTheme(modePref.value, accent.value)
}

let mediaQuery: MediaQueryList | null = null

function onSystemThemeChange(): void {
  if (modePref.value === 'system') {
    resolvedMode.value = applyTheme('system', accent.value)
  }
}

export function bindSystemThemeListener(): void {
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', onSystemThemeChange)
}

export function unbindSystemThemeListener(): void {
  mediaQuery?.removeEventListener('change', onSystemThemeChange)
}

export function useTheme() {
  return {
    modePref,
    accent,
    resolvedMode,
    currentAccent,
    currentModeLabel,
    accentOptions,
    modeOptions,
    setMode,
    setAccent,
  }
}
