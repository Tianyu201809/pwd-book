export type ListSortOrder = 'recent' | 'title' | 'created'

export type {
  AppScreen,
  CategoryInput,
  ExportPayload,
  FilterCategory,
  PasswordEntry,
  PasswordEntryInput,
  SecuritySettings,
  SettingsTab,
  VaultCategory,
  VaultStatus,
} from '@/shared/types'

export type ThemeAccent =
  | 'brass'
  | 'teal'
  | 'indigo'
  | 'rose'
  | 'emerald'
  | 'violet'
  | 'amber'
  | 'ocean'

export type ThemeModePref = 'light' | 'dark' | 'system'

export type ResolvedThemeMode = 'light' | 'dark'

export interface ThemeAccentOption {
  id: ThemeAccent
  label: string
  color: string
}

export interface ThemeModeOption {
  id: ThemeModePref
  label: string
}
