import { i18n } from '@/i18n'
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
  WifiSyncClientPullPayload,
  WifiSyncPairingInfo,
  WifiSyncServerStatus,
  WifiSyncSettings,
} from '@/shared/syncTypes'

function getApi() {
  if (!window.electronAPI) {
    throw new Error(i18n.global.t('errors.electron_api_unavailable'))
  }
  return window.electronAPI
}

export const vaultApi = {
  getVaultStatus: (): Promise<VaultStatus> => getApi().getVaultStatus(),
  setupVault: (payload: VaultSetupPayload): Promise<VaultStatus> => getApi().setupVault(payload),
  unlockVault: (payload: VaultUnlockPayload): Promise<VaultStatus> => getApi().unlockVault(payload),
  lockVault: (): Promise<VaultStatus> => getApi().lockVault(),
  resetVault: (): Promise<VaultStatus> => getApi().resetVault(),

  verifyRecoveryKey: (recoveryKey: string): Promise<RecoveryVerifyResult> =>
    getApi().verifyRecoveryKey(recoveryKey),
  createRecoveryKey: (): Promise<{ recoveryKey: string }> => getApi().createRecoveryKey(),
  resetMasterPasswordWithRecovery: (payload: RecoveryResetPayload): Promise<VaultStatus> =>
    getApi().resetMasterPasswordWithRecovery(payload),
  clearRecoveryKey: (): Promise<VaultStatus> => getApi().clearRecoveryKey(),
  regenerateRecoveryKey: (masterPassword: string): Promise<{ recoveryKey: string }> =>
    getApi().regenerateRecoveryKey(masterPassword),

  listEntries: (): Promise<PasswordEntry[]> => getApi().listEntries(),
  createEntry: (input: PasswordEntryInput): Promise<PasswordEntry> => getApi().createEntry(input),
  updateEntry: (id: string, input: PasswordEntryInput): Promise<PasswordEntry> =>
    getApi().updateEntry(id, input),
  deleteEntry: (id: string): Promise<void> => getApi().deleteEntry(id),
  listTrashedEntries: (): Promise<TrashedEntry[]> => getApi().listTrashedEntries(),
  restoreTrashEntry: (id: string): Promise<void> => getApi().restoreTrashEntry(id),
  restoreAllTrashEntries: (): Promise<number> => getApi().restoreAllTrashEntries(),
  permanentlyDeleteTrashEntry: (id: string): Promise<void> =>
    getApi().permanentlyDeleteTrashEntry(id),
  emptyTrash: (): Promise<number> => getApi().emptyTrash(),
  toggleFavorite: (id: string): Promise<PasswordEntry> => getApi().toggleFavorite(id),
  touchEntry: (id: string): Promise<void> => getApi().touchEntry(id),
  listQuickBarRecent: (): Promise<PasswordEntry[]> => getApi().listQuickBarRecent(),
  removeQuickBarRecent: (id: string): Promise<PasswordEntry[]> => getApi().removeQuickBarRecent(id),

  listCategories: (): Promise<VaultCategory[]> => getApi().listCategories(),
  createCategory: (input: CategoryInput): Promise<VaultCategory> => getApi().createCategory(input),
  updateCategory: (id: string, input: CategoryInput): Promise<VaultCategory> =>
    getApi().updateCategory(id, input),
  deleteCategory: (id: string): Promise<void> => getApi().deleteCategory(id),
  reorderCategories: (categoryIds: string[]): Promise<VaultCategory[]> =>
    getApi().reorderCategories(categoryIds),
  getSidebarCategoryOrder: (): Promise<string[]> => getApi().getSidebarCategoryOrder(),
  reorderSidebarCategories: (order: string[]): Promise<VaultCategory[]> =>
    getApi().reorderSidebarCategories(order),

  listTags: (): Promise<VaultTag[]> => getApi().listTags(),
  createTag: (input: TagInput): Promise<VaultTag> => getApi().createTag(input),
  updateTag: (oldName: string, input: TagInput): Promise<VaultTag> =>
    getApi().updateTag(oldName, input),
  deleteTag: (name: string): Promise<void> => getApi().deleteTag(name),

  getSettings: (): Promise<SecuritySettings> => getApi().getSettings(),
  updateSettings: (partial: Partial<SecuritySettings>): Promise<SecuritySettings> =>
    getApi().updateSettings(partial),
  setUiLocale: (locale: 'zh-CN' | 'en'): Promise<'zh-CN' | 'en'> => getApi().setUiLocale(locale),
  getBrowserBridgeStatus: () => getApi().getBrowserBridgeStatus(),
  regenerateBrowserBridgeToken: () => getApi().regenerateBrowserBridgeToken(),
  getNativeHostRegistrationInfo: () => getApi().getNativeHostRegistrationInfo(),
  registerNativeHost: (extensionId: string) => getApi().registerNativeHost(extensionId),
  openExtensionsPage: () => getApi().openExtensionsPage(),

  copySecret: (text: string, clearAfterMs?: number): Promise<void> =>
    getApi().copySecret(text, clearAfterMs),

  openExternal: (url: string): Promise<void> => getApi().openExternal(url),
  openLocalProgram: (programPath: string): Promise<void> => getApi().openLocalProgram(programPath),

  exportData: (): Promise<ExportPayload> => getApi().exportData(),
  exportDataAsExcel: (): Promise<Uint8Array> => getApi().exportDataAsExcel(),
  exportDataAsCsv: (formatId: string): Promise<string> => getApi().exportDataAsCsv(formatId),
  importData: (payload: VaultImportPayload): Promise<number> => getApi().importData(payload),
  previewImport: (request: ImportPreviewRequest): Promise<ImportPreviewResult> =>
    getApi().previewImport(request),
  commitImport: (request: ImportCommitRequest): Promise<number> => getApi().commitImport(request),

  getEmailBackupSettings: (): Promise<EmailBackupSettings> => getApi().getEmailBackupSettings(),
  updateEmailBackupSettings: (partial: EmailBackupSettingsUpdate): Promise<EmailBackupSettings> =>
    getApi().updateEmailBackupSettings(partial),
  testEmailBackupConnection: (): Promise<void> => getApi().testEmailBackupConnection(),
  sendEmailBackup: (payload: EmailBackupSendPayload): Promise<EmailBackupSettings> =>
    getApi().sendEmailBackup(payload),
  onScheduledBackupDue: (handler: () => void): (() => void) => getApi().onScheduledBackupDue(handler),
  onSystemLockScreen: (handler: () => void): (() => void) => getApi().onSystemLockScreen(handler),

  getSyncStatus: () => getApi().getSyncStatus(),
  exportSyncBundle: (masterPassword: string) => getApi().exportSyncBundle(masterPassword),
  importSyncBundle: (payload: {
    masterPassword: string
    buffer: Uint8Array
  }): Promise<SyncMergeResult> => getApi().importSyncBundle(payload),
  getWifiSyncSettings: (): Promise<WifiSyncSettings> => getApi().getWifiSyncSettings(),
  updateWifiSyncSettings: (partial: Partial<WifiSyncSettings>): Promise<WifiSyncSettings> =>
    getApi().updateWifiSyncSettings(partial),
  getWifiSyncServerStatus: (): Promise<WifiSyncServerStatus> =>
    getApi().getWifiSyncServerStatus(),
  getWifiSyncPairingInfo: (): Promise<WifiSyncPairingInfo> => getApi().getWifiSyncPairingInfo(),
  regenerateWifiSyncAccessPassword: (): Promise<string> =>
    getApi().regenerateWifiSyncAccessPassword(),
  startWifiSyncServer: (): Promise<WifiSyncServerStatus> => getApi().startWifiSyncServer(),
  stopWifiSyncServer: (): Promise<WifiSyncServerStatus> => getApi().stopWifiSyncServer(),
  getWifiSyncVerificationCode: (fingerprint: string): Promise<string> =>
    getApi().getWifiSyncVerificationCode(fingerprint),
  discoverWifiSyncServers: () => getApi().discoverWifiSyncServers(),
  pullWifiSyncMerge: (payload: WifiSyncClientPullPayload): Promise<SyncMergeResult> =>
    getApi().pullWifiSyncMerge(payload),
  pullWifiSyncMergeQr: (payload: {
    qrPayload: string
    masterPassword: string
    deviceName?: string
  }): Promise<SyncMergeResult> => getApi().pullWifiSyncMergeQr(payload),
}
