export type FilterCategory = 'all' | 'favorite' | string

export type AppScreen = 'lock' | 'vault' | 'settings' | 'email-backup' | 'password-gen'

export type BackupFrequency = 'manual' | 'weekly' | 'monthly'

export type BackupStatus = 'success' | 'failed' | 'never'

export interface SmtpSettingsInput {
  host: string
  port: number
  secure: boolean
  username: string
  password?: string
}

export interface SmtpSettingsPublic {
  host: string
  port: number
  secure: boolean
  username: string
  hasPassword: boolean
}

export interface LastBackupInfo {
  at: number | null
  entryCount: number
  sizeBytes: number
  status: BackupStatus
}

export interface EmailBackupSettings {
  recipientEmail: string
  frequency: BackupFrequency
  smtp: SmtpSettingsPublic
  lastBackup: LastBackupInfo
}

export interface EmailBackupSettingsUpdate {
  recipientEmail?: string
  frequency?: BackupFrequency
  smtp?: SmtpSettingsInput
}

export interface EmailBackupSendPayload {
  masterPassword: string
}

export interface PasswordGenOptions {
  length: number
  upper: boolean
  lower: boolean
  numbers: boolean
  symbols: boolean
}

export interface PasswordStrengthResult {
  level: 0 | 1 | 2 | 3
  bars: number
}

export type SettingsTab = 'security' | 'appearance' | 'data' | 'about'

export type CloseWindowAction = 'ask' | 'tray' | 'quit'

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

export interface VaultTag {
  name: string
  entryCount: number
}

export interface TagInput {
  name: string
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
  displayIcon: string
  /** 可选：本地可执行程序路径，用于右键启动 */
  localProgramPath: string
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
  displayIcon?: string
  localProgramPath?: string
}

export interface SecuritySettings {
  autoLockMinutes: number
  clipboardClearEnabled: boolean
  clipboardClearSeconds: number
  closeWindowAction: CloseWindowAction
  /** 右键/菜单打开网址时是否在 URL 上附带 user、pwd 查询参数 */
  openUrlWithCredentials: boolean
  /** 悬浮快捷搜索条 */
  quickBarEnabled: boolean
  /** Electron globalShortcut 加速器，如 Alt+Shift+P */
  quickBarAccelerator: string
}

export interface VaultStatus {
  initialized: boolean
  unlocked: boolean
  recoveryConfigured: boolean
  entryCount: number
}

export interface RecoveryResetPayload {
  recoveryKey: string
  newMasterPassword: string
  confirmPassword: string
}

export interface RecoveryVerifyResult {
  valid: boolean
  configured: boolean
}

export interface RecoveryCreateResult {
  recoveryKey: string
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

export interface VaultImportPayload {
  categories?: VaultCategory[]
  entries: PasswordEntryInput[]
}

export type ImportPreviewItemStatus = 'ready' | 'duplicate' | 'invalid'

export interface ImportPreviewItem {
  row: number
  status: ImportPreviewItemStatus
  title: string
  username: string
  url: string
  /** 仅 status=ready 时存在 */
  entry?: PasswordEntryInput
  reason?: 'missing_title' | 'missing_password' | 'duplicate_vault' | 'duplicate_file'
  matchTitle?: string
}

export interface ImportPreviewResult {
  sourceId: string
  sourceCategoryName: string
  /** PwdBook JSON 备份中的分类（提交导入时使用） */
  categories?: VaultCategory[]
  ready: ImportPreviewItem[]
  skipped: ImportPreviewItem[]
  invalid: ImportPreviewItem[]
  totals: {
    parsed: number
    ready: number
    skipped: number
    invalid: number
  }
}

export interface ImportPreviewRequest {
  sourceId: string
  content: string
}

export interface ImportCommitRequest {
  sourceId: string
  entries: PasswordEntryInput[]
  categories?: VaultCategory[]
}

export const IPC = {
  vaultStatus: 'vault:status',
  vaultSetup: 'vault:setup',
  vaultUnlock: 'vault:unlock',
  vaultLock: 'vault:lock',
  vaultReset: 'vault:reset',
  recoveryStatus: 'recovery:status',
  recoveryVerify: 'recovery:verify',
  recoveryCreate: 'recovery:create',
  recoveryResetMaster: 'recovery:reset-master',
  recoveryClear: 'recovery:clear',
  recoveryRegenerate: 'recovery:regenerate',
  entriesList: 'entries:list',
  entriesCreate: 'entries:create',
  entriesUpdate: 'entries:update',
  entriesDelete: 'entries:delete',
  entriesToggleFavorite: 'entries:toggle-favorite',
  entriesTouch: 'entries:touch',
  quickBarListRecent: 'quickbar:list-recent',
  quickBarRemoveRecent: 'quickbar:remove-recent',
  categoriesList: 'categories:list',
  categoriesCreate: 'categories:create',
  categoriesUpdate: 'categories:update',
  categoriesDelete: 'categories:delete',
  categoriesReorder: 'categories:reorder',
  categoriesSidebarOrder: 'categories:sidebar-order',
  categoriesReorderSidebar: 'categories:reorder-sidebar',
  tagsList: 'tags:list',
  tagsCreate: 'tags:create',
  tagsUpdate: 'tags:update',
  tagsDelete: 'tags:delete',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  clipboardCopy: 'clipboard:copy-secret',
  shellOpenExternal: 'shell:open-external',
  shellOpenLocalProgram: 'shell:open-local-program',
  dataExport: 'data:export',
  dataExportExcel: 'data:export-excel',
  dataExportCsv: 'data:export-csv',
  dataImport: 'data:import',
  dataImportPreview: 'data:import-preview',
  dataImportCommit: 'data:import-commit',
  emailBackupGet: 'email-backup:get',
  emailBackupUpdate: 'email-backup:update',
  emailBackupTest: 'email-backup:test',
  emailBackupSend: 'email-backup:send',
} as const

export const IPC_EVENTS = {
  scheduledBackupDue: 'email-backup:scheduled-due',
  quickBarShown: 'quickbar:shown',
  themeChanged: 'theme:changed',
} as const

export const RESERVED_CATEGORY_NAMES = [
  '全部',
  '收藏',
  'all',
  'favorite',
  'All',
  'Favorite',
] as const
