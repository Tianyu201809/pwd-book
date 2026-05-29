import { ref, computed } from 'vue'
import { translateAccentLabel, translateModeLabel } from '@/i18n'
import type {
  ThemeAccent,
  ThemeAccentOption,
  ThemeModeOption,
  ThemeModePref,
  ResolvedThemeMode,
  ThemeSkin,
  ThemeSkinOption,
} from '@/types'

const STORAGE_MODE = 'pwdbook-theme-mode'
const STORAGE_ACCENT = 'pwdbook-theme-accent'
const STORAGE_SKIN = 'pwdbook-theme-skin'
const STORAGE_CLASSIC_MODE = 'pwdbook-classic-mode-backup'

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
const SKIN_IDS: ThemeSkin[] = ['classic', 'animalIsland']

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

function applyTheme(
  modePref: ThemeModePref,
  nextAccent: ThemeAccent,
  nextSkin: ThemeSkin,
): ResolvedThemeMode {
  const resolved =
    nextSkin === 'animalIsland' ? 'light' : resolveMode(modePref)
  const root = document.documentElement
  root.setAttribute('data-mode', resolved)
  root.setAttribute('data-accent', nextAccent)
  root.setAttribute('data-mode-pref', modePref)
  root.setAttribute('data-skin', nextSkin)
  if (nextSkin === 'classic') {
    window.electronAPI?.setNativeTheme(modePref)
  } else {
    window.electronAPI?.setNativeTheme('light')
  }
  return resolved
}

const modePref = ref<ThemeModePref>(readStorage(STORAGE_MODE, 'dark') as ThemeModePref)
const accent = ref<ThemeAccent>(readStorage(STORAGE_ACCENT, 'brass') as ThemeAccent)
const skin = ref<ThemeSkin>(
  (readStorage(STORAGE_SKIN, 'classic') as ThemeSkin) === 'animalIsland'
    ? 'animalIsland'
    : 'classic',
)
const resolvedMode = ref<ResolvedThemeMode>(resolveMode(modePref.value))

const isAnimalIsland = computed(() => skin.value === 'animalIsland')
const isClassic = computed(() => skin.value === 'classic')

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

import { i18n } from '@/i18n'

const skinOptions = computed<ThemeSkinOption[]>(() =>
  SKIN_IDS.map((id) => ({
    id,
    label:
      id === 'classic'
        ? i18n.global.t('appearance.skinClassic')
        : i18n.global.t('appearance.skinAnimalIsland'),
  })),
)

const currentAccent = computed(
  () => accentOptions.value.find((item) => item.id === accent.value) ?? accentOptions.value[0],
)

const currentSkin = computed(
  () => skinOptions.value.find((item) => item.id === skin.value) ?? skinOptions.value[0],
)

const currentModeLabel = computed(() => {
  if (isAnimalIsland.value) {
    return i18n.global.t('appearance.skinAnimalIslandMode')
  }
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
  if (skin.value === 'animalIsland') return
  modePref.value = mode
  localStorage.setItem(STORAGE_MODE, mode)
  resolvedMode.value = applyTheme(mode, accent.value, skin.value)
}

function setAccent(next: ThemeAccent): void {
  if (skin.value === 'animalIsland') return
  accent.value = next
  localStorage.setItem(STORAGE_ACCENT, next)
  resolvedMode.value = applyTheme(modePref.value, next, skin.value)
}

function setSkin(next: ThemeSkin): void {
  if (next === skin.value) return
  if (next === 'animalIsland') {
    localStorage.setItem(STORAGE_CLASSIC_MODE, modePref.value)
    skin.value = next
    localStorage.setItem(STORAGE_SKIN, next)
    resolvedMode.value = applyTheme(modePref.value, accent.value, next)
    return
  }
  skin.value = next
  localStorage.setItem(STORAGE_SKIN, next)
  const restored = readStorage(STORAGE_CLASSIC_MODE, modePref.value) as ThemeModePref
  if (MODE_IDS.includes(restored)) {
    modePref.value = restored
    localStorage.setItem(STORAGE_MODE, restored)
  }
  resolvedMode.value = applyTheme(modePref.value, accent.value, next)
}

export function initTheme(): void {
  resolvedMode.value = applyTheme(modePref.value, accent.value, skin.value)
}

let mediaQuery: MediaQueryList | null = null

function onSystemThemeChange(): void {
  if (modePref.value === 'system' && skin.value === 'classic') {
    resolvedMode.value = applyTheme('system', accent.value, skin.value)
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
    skin,
    resolvedMode,
    isAnimalIsland,
    isClassic,
    currentAccent,
    currentSkin,
    currentModeLabel,
    accentOptions,
    modeOptions,
    skinOptions,
    setMode,
    setAccent,
    setSkin,
  }
}
