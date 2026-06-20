export type ListSortOrder = 'recent' | 'title' | 'created'

export type {
  AppScreen,
  BackupFrequency,
  CategoryInput,
  EmailBackupSettings,
  EmailBackupSettingsUpdate,
  EntryAttachmentMeta,
  EntryCustomField,
  ExportPayload,
  VaultImportPayload,
  FilterCategory,
  PasswordEntry,
  PasswordEntryInput,
  PasswordGenOptions,
  SecuritySettings,
  RecoveryResetPayload,
  RecoveryVerifyResult,
  SettingsTab,
  VaultCategory,
  VaultTag,
  TagInput,
  TrashedEntry,
  VaultStatus,
} from '@/shared/types'

export type ThemeSkin = 'classic' | 'animalIsland'

export interface ThemeSkinOption {
  id: ThemeSkin
  label: string
}

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
