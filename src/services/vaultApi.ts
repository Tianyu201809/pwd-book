import type {
  CategoryInput,
  ExportPayload,
  PasswordEntry,
  PasswordEntryInput,
  RecoveryResetPayload,
  RecoveryVerifyResult,
  SecuritySettings,
  VaultCategory,
  VaultSetupPayload,
  VaultStatus,
  VaultUnlockPayload,
} from '@/shared/types'

function getApi() {
  if (!window.electronAPI) {
    throw new Error('Electron API 不可用')
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

  getSettings: (): Promise<SecuritySettings> => getApi().getSettings(),
  updateSettings: (partial: Partial<SecuritySettings>): Promise<SecuritySettings> =>
    getApi().updateSettings(partial),

  copySecret: (text: string, clearAfterMs?: number): Promise<void> =>
    getApi().copySecret(text, clearAfterMs),

  exportData: (): Promise<ExportPayload> => getApi().exportData(),
  importData: (entries: PasswordEntryInput[]): Promise<number> => getApi().importData(entries),
}
