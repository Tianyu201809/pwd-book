import { i18n } from '@/i18n'
import type {
  CategoryInput,
  ExportPayload,
  PasswordEntry,
  PasswordEntryInput,
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
  toggleFavorite: (id: string): Promise<PasswordEntry> => getApi().toggleFavorite(id),
  touchEntry: (id: string): Promise<void> => getApi().touchEntry(id),

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

  copySecret: (text: string, clearAfterMs?: number): Promise<void> =>
    getApi().copySecret(text, clearAfterMs),

  openExternal: (url: string): Promise<void> => getApi().openExternal(url),

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
}
