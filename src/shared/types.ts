export type FilterCategory = 'all' | 'favorite' | string

export type AppScreen = 'lock' | 'vault' | 'settings'

export type SettingsTab = 'security' | 'appearance' | 'data' | 'about'

export interface VaultCategory {
  id: string
  name: string
  icon: string
  sortOrder: number
  createdAt: number
  entryCount?: number
}

export interface CategoryInput {
  name: string
  icon?: string
}

export interface PasswordEntry {
  id: string
  title: string
  url: string
  username: string
  password: string
  note: string
  tags: string[]
  categoryId: string
  categoryName: string
  isFavorite: boolean
  lastUsedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface PasswordEntryInput {
  title: string
  url?: string
  username?: string
  password: string
  note?: string
  tags?: string[]
  categoryId?: string
  isFavorite?: boolean
}

export interface SecuritySettings {
  autoLockMinutes: number
  clipboardClearEnabled: boolean
  clipboardClearSeconds: number
}

export interface VaultStatus {
  initialized: boolean
  unlocked: boolean
}

export interface VaultSetupPayload {
  masterPassword: string
  confirmPassword: string
}

export interface VaultUnlockPayload {
  masterPassword: string
}

export interface ApiResult<T = void> {
  ok: boolean
  data?: T
  error?: string
}

export interface ExportPayload {
  exportedAt: string
  categories: VaultCategory[]
  entries: PasswordEntry[]
}

export const IPC = {
  vaultStatus: 'vault:status',
  vaultSetup: 'vault:setup',
  vaultUnlock: 'vault:unlock',
  vaultLock: 'vault:lock',
  vaultReset: 'vault:reset',
  entriesList: 'entries:list',
  entriesCreate: 'entries:create',
  entriesUpdate: 'entries:update',
  entriesDelete: 'entries:delete',
  entriesToggleFavorite: 'entries:toggle-favorite',
  entriesTouch: 'entries:touch',
  categoriesList: 'categories:list',
  categoriesCreate: 'categories:create',
  categoriesUpdate: 'categories:update',
  categoriesDelete: 'categories:delete',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  clipboardCopy: 'clipboard:copy-secret',
  dataExport: 'data:export',
  dataImport: 'data:import',
} as const

export const RESERVED_CATEGORY_NAMES = ['全部', '收藏', 'all', 'favorite'] as const
