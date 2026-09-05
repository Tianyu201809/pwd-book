export type FilterCategory = 'all' | 'favorite' | string

export type AppScreen =
  | 'lock'
  | 'vault'
  | 'settings'
  | 'email-backup'
  | 'sync'
  | 'wifi-sync'
  | 'folder-sync'
  | 'password-gen'
  | 'password-health'
  | 'trash'

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

export type SettingsTab =
  | 'security'
  | 'clipboard'
  | 'browser'
  | 'quickbar'
  | 'trash'
  | 'appearance'
  | 'data'
  | 'about'

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

export interface EntryAttachmentMeta {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  createdAt: number
}

export interface EntryAttachment extends EntryAttachmentMeta {
  entryId: string
}

export interface EntryCustomField {
  name: string
  value: string
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
  /** TOTP 密钥（Base32），空字符串表示未配置 */
  totpSecret: string
  customFields: EntryCustomField[]
  attachmentCount: number
  lastUsedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface TrashedEntry extends PasswordEntry {
  deletedAt: number
  expiresAt: number
  daysRemaining: number
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
  totpSecret?: string
  customFields?: EntryCustomField[]
  /** PwdBook JSON 导入时保留原条目 ID，用于关联附件 */
  id?: string
}

/** 跟随系统锁屏时存入 auto_lock_minutes 的哨兵值 */
export const AUTO_LOCK_FOLLOW_SYSTEM = -1

export interface SecuritySettings {
  /** 空闲锁定分钟数；{@link AUTO_LOCK_FOLLOW_SYSTEM} 表示跟随系统锁屏 */
  autoLockMinutes: number
  clipboardClearEnabled: boolean
  /** 剪切板历史捕获与轮询开关 */
  clipboardEnabled: boolean
  /** 新剪切板记录的默认自动清理周期，单位为秒；0 表示永久 */
  clipboardDefaultExpiry: 30 | 300 | 900 | 1800 | 0
  /** 是否在应用重启后保留剪切板历史 */
  clipboardPersistence: boolean
  /** 剪切板历史总条数上限；固定项优先保留 */
  clipboardHistoryLimit: 20 | 50 | 100 | 200
  clipboardClearSeconds: number
  closeWindowAction: CloseWindowAction
  /** 悬浮快捷搜索条 */
  quickBarEnabled: boolean
  /** Electron globalShortcut 加速器，如 Alt+Shift+P */
  quickBarAccelerator: string
  /**
   * 快捷条「最近打开」与搜索结果一次展示条数。
   * 范围 5–20，默认 5。
   */
  quickBarRecentLimit: number
  /** 全局快捷键唤起主窗口 */
  mainWindowShortcutEnabled: boolean
  /** Electron globalShortcut 加速器，如 Alt+Shift+M */
  mainWindowShortcutAccelerator: string
  /** 浏览器扩展自动填充（本机 Native Messaging，无出站网络） */
  browserFillEnabled: boolean
  /** 回收站条目保留天数，过期后彻底删除 */
  trashRetentionDays: number
  /** 系统登录后自动启动应用 */
  launchAtLoginEnabled: boolean
}

export interface VaultStatus {
  initialized: boolean
  unlocked: boolean
  recoveryConfigured: boolean
  entryCount: number
  trashCount: number
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

export interface ExportAttachment {
  id: string
  entryId: string
  filename: string
  mimeType: string
  sizeBytes: number
  createdAt: number
  updatedAt: number
  /** Base64 编码的原始文件字节（导出为明文 JSON 时内嵌） */
  dataBase64: string
}

export const EXPORT_PAYLOAD_VERSION = 2

export interface ExportPayload {
  version?: number
  exportedAt: string
  categories: VaultCategory[]
  entries: PasswordEntry[]
  attachments?: ExportAttachment[]
}

export interface VaultImportPayload {
  categories?: VaultCategory[]
  entries: PasswordEntryInput[]
  attachments?: ExportAttachment[]
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
  /** PwdBook JSON 备份中的附件（提交导入时使用） */
  attachments?: ExportAttachment[]
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
  attachments?: ExportAttachment[]
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
  trashList: 'trash:list',
  trashRestore: 'trash:restore',
  trashRestoreAll: 'trash:restore-all',
  trashDeletePermanent: 'trash:delete-permanent',
  trashEmpty: 'trash:empty',
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
  settingsSetUiLocale: 'settings:set-ui-locale',
  clipboardCopy: 'clipboard:copy-secret',
  clipboardRead: 'clipboard:read-system',
  clipboardReadContent: 'clipboard:read-content',
  clipboardWriteImage: 'clipboard:write-image',
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
  browserBridgeStatus: 'browser:bridge-status',
  browserBridgeRegenerateToken: 'browser:bridge-regenerate-token',
  browserNativeHostInfo: 'browser:native-host-info',
  browserRegisterNativeHost: 'browser:register-native-host',
  shellOpenExtensionsPage: 'shell:open-extensions-page',
  shellOpenExtensionDir: 'shell:open-extension-dir',
  syncStatus: 'sync:status',
  syncExportBundle: 'sync:export-bundle',
  syncImportBundle: 'sync:import-bundle',
  wifiSyncGetSettings: 'wifi-sync:get-settings',
  wifiSyncUpdateSettings: 'wifi-sync:update-settings',
  wifiSyncStartServer: 'wifi-sync:start-server',
  wifiSyncStopServer: 'wifi-sync:stop-server',
  wifiSyncServerStatus: 'wifi-sync:server-status',
  wifiSyncPairingInfo: 'wifi-sync:pairing-info',
  wifiSyncRegenerateAccessPassword: 'wifi-sync:regenerate-access-password',
  wifiSyncGetVerificationCode: 'wifi-sync:get-verification-code',
  wifiSyncDiscover: 'wifi-sync:discover',
  wifiSyncPullMerge: 'wifi-sync:pull-merge',
  wifiSyncPullMergeQr: 'wifi-sync:pull-merge-qr',
  folderSyncGetSettings: 'folder-sync:get-settings',
  folderSyncUpdateSettings: 'folder-sync:update-settings',
  folderSyncStatus: 'folder-sync:status',
  folderSyncPickDirectory: 'folder-sync:pick-directory',
  folderSyncConnect: 'folder-sync:connect',
  folderSyncDisconnect: 'folder-sync:disconnect',
  folderSyncSyncNow: 'folder-sync:sync-now',
  detailWindowOpen: 'detail-window:open',
  detailWindowClose: 'detail-window:close',
  detailWindowReady: 'detail-window:ready',
  detailWindowSelectEntry: 'detail-window:select-entry',
  detailWindowToggleAlwaysOnTop: 'detail-window:toggle-always-on-top',
  detailWindowGetAlwaysOnTop: 'detail-window:get-always-on-top',
  windowGetAlwaysOnTop: 'window:get-always-on-top',
  windowToggleAlwaysOnTop: 'window:toggle-always-on-top',
  windowGetMaximized: 'window:get-maximized',
  launchAtLoginAvailable: 'launch-at-login:available',
  vaultDataNotifyChanged: 'vault-data:notify-changed',
  attachmentsList: 'attachments:list',
  attachmentsAdd: 'attachments:add',
  attachmentsDelete: 'attachments:delete',
  attachmentsOpen: 'attachments:open',
  attachmentsSaveAs: 'attachments:save-as',
} as const

export const IPC_EVENTS = {
  scheduledBackupDue: 'email-backup:scheduled-due',
  quickBarShown: 'quickbar:shown',
  themeChanged: 'theme:changed',
  systemLockScreen: 'session:system-lock',
  detailWindowSelectEntry: 'detail-window:select-entry',
  detailWindowOpened: 'detail-window:opened',
  detailWindowClosed: 'detail-window:closed',
  vaultDataChanged: 'vault-data:changed',
  windowMaximizeChanged: 'window:maximize-changed',
  trayOpenSettings: 'tray:open-settings',
  quickBarFocusEntry: 'quickbar:focus-entry',
  clipboardWindowShown: 'clipboard-window:shown',
  clipboardWindowDisabled: 'clipboard-window:disabled',
} as const

export const RESERVED_CATEGORY_NAMES = [
  '全部',
  '收藏',
  'all',
  'favorite',
  'All',
  'Favorite',
] as const
