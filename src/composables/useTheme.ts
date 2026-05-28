import { ref, computed } from 'vue'
import type {
  ThemeAccent,
  ThemeAccentOption,
  ThemeModeOption,
  ThemeModePref,
  ResolvedThemeMode,
} from '@/types'

const STORAGE_MODE = 'pwdbook-theme-mode'
const STORAGE_ACCENT = 'pwdbook-theme-accent'

export const ACCENT_OPTIONS: ThemeAccentOption[] = [
  { id: 'brass', label: '黄铜', color: '#c9a227' },
  { id: 'teal', label: '青绿', color: '#14b8a6' },
  { id: 'indigo', label: '靛蓝', color: '#6366f1' },
  { id: 'rose', label: '玫瑰', color: '#f43f5e' },
  { id: 'emerald', label: '翡翠', color: '#10b981' },
  { id: 'violet', label: '紫罗兰', color: '#8b5cf6' },
  { id: 'amber', label: '琥珀', color: '#f59e0b' },
  { id: 'ocean', label: '海洋', color: '#0ea5e9' },
]

export const MODE_OPTIONS: ThemeModeOption[] = [
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
  { id: 'system', label: '跟随系统' },
]

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

const currentAccent = computed(
  () => ACCENT_OPTIONS.find((item) => item.id === accent.value) ?? ACCENT_OPTIONS[0],
)

const currentModeLabel = computed(() => {
  const meta = MODE_OPTIONS.find((item) => item.id === modePref.value)
  if (!meta) return modePref.value
  if (modePref.value === 'system') {
    return `${meta.label}（当前 ${resolvedMode.value === 'dark' ? '深色' : '浅色'}）`
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
    accentOptions: ACCENT_OPTIONS,
    modeOptions: MODE_OPTIONS,
    setMode,
    setAccent,
  }
}
