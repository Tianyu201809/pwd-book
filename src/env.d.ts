import type { ThemeNativeMode } from '@/services/vaultApi'
import type {
  CategoryInput,
  ExportPayload,
  PasswordEntry,
  PasswordEntryInput,
  TrashedEntry,
  RecoveryResetPayload,
  RecoveryVerifyResult,
  SecuritySettings,
  VaultCategory,
  VaultTag,
  TagInput,
  VaultSetupPayload,
  VaultStatus,
  VaultUnlockPayload,
  VaultImportPayload,
  ImportPreviewRequest,
  ImportPreviewResult,
  ImportCommitRequest,
  EmailBackupSettings,
  EmailBackupSettingsUpdate,
  EmailBackupSendPayload,
} from '@/shared/types'
import type {
  SyncMergeResult,
  SyncStatus,
  WifiSyncClientPullPayload,
  WifiSyncDiscoveredServer,
  WifiSyncPairingInfo,
  WifiSyncServerStatus,
  WifiSyncSettings,
} from '@/shared/syncTypes'
import type { BrowserBridgeStatus, NativeHostRegistrationInfo } from '@/shared/browserBridgeProtocol'

declare global {
  interface Window {
    electronAPI?: {
      isScreenshotMode?: () => boolean
      minimize: () => void
      maximize: () => void
      close: () => void
      onClosePrompt: (handler: () => void) => () => void
      onAlreadyRunning: (handler: () => void) => () => void
      setNativeTheme: (mode: ThemeNativeMode) => void
      getVaultStatus: () => Promise<VaultStatus>
      setupVault: (payload: VaultSetupPayload) => Promise<VaultStatus>
      unlockVault: (payload: VaultUnlockPayload) => Promise<VaultStatus>
      lockVault: () => Promise<VaultStatus>
      resetVault: () => Promise<VaultStatus>
      verifyRecoveryKey: (recoveryKey: string) => Promise<RecoveryVerifyResult>
      createRecoveryKey: () => Promise<{ recoveryKey: string }>
      resetMasterPasswordWithRecovery: (payload: RecoveryResetPayload) => Promise<VaultStatus>
      clearRecoveryKey: () => Promise<VaultStatus>
      regenerateRecoveryKey: (masterPassword: string) => Promise<{ recoveryKey: string }>
      listEntries: () => Promise<PasswordEntry[]>
      createEntry: (input: PasswordEntryInput) => Promise<PasswordEntry>
      updateEntry: (id: string, input: PasswordEntryInput) => Promise<PasswordEntry>
      deleteEntry: (id: string) => Promise<void>
      listTrashedEntries: () => Promise<TrashedEntry[]>
      restoreTrashEntry: (id: string) => Promise<void>
      restoreAllTrashEntries: () => Promise<number>
      permanentlyDeleteTrashEntry: (id: string) => Promise<void>
      emptyTrash: () => Promise<number>
      toggleFavorite: (id: string) => Promise<PasswordEntry>
      touchEntry: (id: string) => Promise<void>
      listQuickBarRecent: () => Promise<PasswordEntry[]>
      removeQuickBarRecent: (id: string) => Promise<PasswordEntry[]>
      listCategories: () => Promise<VaultCategory[]>
      createCategory: (input: CategoryInput) => Promise<VaultCategory>
      updateCategory: (id: string, input: CategoryInput) => Promise<VaultCategory>
      deleteCategory: (id: string) => Promise<void>
      reorderCategories: (categoryIds: string[]) => Promise<VaultCategory[]>
      getSidebarCategoryOrder: () => Promise<string[]>
      reorderSidebarCategories: (order: string[]) => Promise<VaultCategory[]>
      listTags: () => Promise<VaultTag[]>
      createTag: (input: TagInput) => Promise<VaultTag>
      updateTag: (oldName: string, input: TagInput) => Promise<VaultTag>
      deleteTag: (name: string) => Promise<void>
      getSettings: () => Promise<SecuritySettings>
      updateSettings: (partial: Partial<SecuritySettings>) => Promise<SecuritySettings>
      getBrowserBridgeStatus: () => Promise<BrowserBridgeStatus>
      regenerateBrowserBridgeToken: () => Promise<BrowserBridgeStatus>
      getNativeHostRegistrationInfo: () => Promise<NativeHostRegistrationInfo>
      registerNativeHost: (extensionId: string) => Promise<NativeHostRegistrationInfo>
      openExtensionsPage: () => Promise<void>
      copySecret: (text: string, clearAfterMs?: number) => Promise<void>
      openExternal: (url: string) => Promise<void>
      openLocalProgram: (programPath: string) => Promise<void>
      exportData: () => Promise<ExportPayload>
      exportDataAsExcel: () => Promise<Uint8Array>
      exportDataAsCsv: (formatId: string) => Promise<string>
      importData: (payload: VaultImportPayload) => Promise<number>
      previewImport: (request: ImportPreviewRequest) => Promise<ImportPreviewResult>
      commitImport: (request: ImportCommitRequest) => Promise<number>
      getEmailBackupSettings: () => Promise<EmailBackupSettings>
      updateEmailBackupSettings: (partial: EmailBackupSettingsUpdate) => Promise<EmailBackupSettings>
      testEmailBackupConnection: () => Promise<void>
      sendEmailBackup: (payload: EmailBackupSendPayload) => Promise<EmailBackupSettings>
      getSyncStatus: () => Promise<SyncStatus>
      exportSyncBundle: (
        masterPassword: string,
      ) => Promise<{ buffer: Uint8Array; revision: number; sizeBytes: number }>
      importSyncBundle: (payload: {
        masterPassword: string
        buffer: Uint8Array
      }) => Promise<SyncMergeResult>
      getWifiSyncSettings: () => Promise<WifiSyncSettings>
      updateWifiSyncSettings: (partial: Partial<WifiSyncSettings>) => Promise<WifiSyncSettings>
      getWifiSyncServerStatus: () => Promise<WifiSyncServerStatus>
      getWifiSyncPairingInfo: () => Promise<WifiSyncPairingInfo>
      regenerateWifiSyncAccessPassword: () => Promise<string>
      startWifiSyncServer: () => Promise<WifiSyncServerStatus>
      stopWifiSyncServer: () => Promise<WifiSyncServerStatus>
      discoverWifiSyncServers: () => Promise<WifiSyncDiscoveredServer[]>
      pullWifiSyncMerge: (payload: WifiSyncClientPullPayload) => Promise<SyncMergeResult>
      pullWifiSyncMergeQr: (payload: {
        qrPayload: string
        masterPassword: string
        deviceName?: string
      }) => Promise<SyncMergeResult>
      onScheduledBackupDue: (handler: () => void) => () => void
      onSystemLockScreen: (handler: () => void) => () => void
      hideQuickBar?: () => void
      showQuickBar?: () => void
      quickBarShowMain?: () => void
      resizeQuickBar?: (height: number) => void
      onQuickBarShown?: (handler: () => void) => () => void
      notifyThemeChanged?: () => void
      onThemeChanged?: (handler: () => void) => () => void
      setQuickBarBackground?: (color: string) => void
    }
    __PWD_BOOK_SCREENSHOT_READY__?: boolean
  }
}

export {}
