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
  EntryAttachmentMeta,
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
  FolderSyncSettings,
  FolderSyncStatus,
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
      setUiLocale: (locale: 'zh-CN' | 'en') => Promise<'zh-CN' | 'en'>
      getBrowserBridgeStatus: () => Promise<BrowserBridgeStatus>
      regenerateBrowserBridgeToken: () => Promise<BrowserBridgeStatus>
      getNativeHostRegistrationInfo: () => Promise<NativeHostRegistrationInfo>
      registerNativeHost: (extensionId: string) => Promise<NativeHostRegistrationInfo>
      openExtensionsPage: () => Promise<{ copiedUrl: string }>
      openExtensionDir: () => Promise<void>
      copySecret: (text: string, clearAfterMs?: number) => Promise<void>
      readClipboardText: () => Promise<string>
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
      getWifiSyncVerificationCode: (fingerprint: string) => Promise<string>
      discoverWifiSyncServers: () => Promise<WifiSyncDiscoveredServer[]>
      pullWifiSyncMerge: (payload: WifiSyncClientPullPayload) => Promise<SyncMergeResult>
      pullWifiSyncMergeQr: (payload: {
        qrPayload: string
        masterPassword: string
        deviceName?: string
      }) => Promise<SyncMergeResult>
      getFolderSyncSettings: () => Promise<FolderSyncSettings>
      updateFolderSyncSettings: (partial: Partial<FolderSyncSettings>) => Promise<FolderSyncSettings>
      getFolderSyncStatus: () => Promise<FolderSyncStatus>
      pickFolderSyncDirectory: () => Promise<string | null>
      connectFolderSync: (payload: {
        folderPath: string
        masterPassword: string
      }) => Promise<SyncMergeResult>
      disconnectFolderSync: () => Promise<FolderSyncSettings>
      syncFolderNow: (masterPassword: string) => Promise<SyncMergeResult>
      listAttachments: (entryId: string) => Promise<EntryAttachmentMeta[]>
      addAttachment: (entryId: string) => Promise<EntryAttachmentMeta | null>
      deleteAttachment: (attachmentId: string) => Promise<void>
      openAttachment: (attachmentId: string) => Promise<string>
      saveAttachmentAs: (attachmentId: string) => Promise<boolean>
      onScheduledBackupDue: (handler: () => void) => () => void
      onSystemLockScreen: (handler: () => void) => () => void
      hideQuickBar?: () => void
      showQuickBar?: () => void
      quickBarShowMain?: () => void
      quickBarFocusEntry?: (entryId: string) => void
      resizeQuickBar?: (height: number) => void
      onQuickBarShown?: (handler: () => void) => () => void
      onQuickBarFocusEntry?: (handler: (entryId: string) => void) => () => void
      notifyThemeChanged?: () => void
      onThemeChanged?: (handler: () => void) => () => void
      setQuickBarBackground?: (color: string) => void
      hideClipboardWindow?: () => void
      clipboardWindowShowMain?: () => void
      getClipboardWindowPinned?: () => Promise<boolean>
      toggleClipboardWindowPinned?: () => Promise<boolean>
      onClipboardWindowShown?: (handler: () => void) => () => void
      onClipboardWindowFocusMain?: (handler: () => void) => () => void
      openDetailWindow?: (entryId: string) => Promise<boolean>
      closeDetailWindow?: () => void
      notifyDetailWindowReady?: () => void
      detailWindowSelectEntry?: (entryId: string) => void
      notifyVaultDataChanged?: () => void
      onDetailWindowSelectEntry?: (handler: (entryId: string) => void) => () => void
      onDetailWindowOpened?: (handler: () => void) => () => void
      onDetailWindowClosed?: (handler: () => void) => () => void
      onVaultDataChanged?: (handler: () => void) => () => void
      getDetailWindowAlwaysOnTop?: () => Promise<boolean>
      toggleDetailWindowAlwaysOnTop?: () => Promise<boolean>
      getWindowAlwaysOnTop?: () => Promise<boolean>
      toggleWindowAlwaysOnTop?: () => Promise<boolean>
      getWindowMaximized?: () => Promise<boolean>
      isLaunchAtLoginAvailable?: () => Promise<boolean>
      onWindowMaximizeChanged?: (handler: (maximized: boolean) => void) => () => void
      onTrayOpenSettings?: (handler: () => void) => () => void
    }
    __PWD_BOOK_SCREENSHOT_READY__?: boolean
  }
}

export {}
