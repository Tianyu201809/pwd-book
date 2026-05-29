import { ipcRenderer } from 'electron'
import { ERR_PREFIX } from '../shared/errors'
import { IPC } from '../shared/types'
import type {
  CategoryInput,
  ExportPayload,
  PasswordEntry,
  PasswordEntryInput,
  RecoveryCreateResult,
  RecoveryResetPayload,
  RecoveryVerifyResult,
  SecuritySettings,
  VaultCategory,
  VaultSetupPayload,
  VaultStatus,
  VaultUnlockPayload,
} from '../shared/types'

export type ThemeNativeMode = 'dark' | 'light' | 'system'

async function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  try {
    return await ipcRenderer.invoke(channel, payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : `${ERR_PREFIX}REQUEST_FAILED`
    const nested = message.match(/:\s*Error:\s*(.+)$/)
    const stripped =
      nested?.[1]?.trim() ??
      message.replace(/^Error invoking remote method '[^']+':\s*/i, '').trim()
    if (stripped.startsWith(ERR_PREFIX)) {
      throw new Error(stripped)
    }
    throw new Error(`${ERR_PREFIX}REQUEST_FAILED`)
  }
}

export const electronAPI = {
  minimize: (): void => ipcRenderer.send('window-minimize'),
  maximize: (): void => ipcRenderer.send('window-maximize'),
  close: (): void => ipcRenderer.send('window-close'),
  onClosePrompt: (handler: () => void): (() => void) => {
    const listener = (): void => handler()
    ipcRenderer.on('window:prompt-close', listener)
    return () => ipcRenderer.removeListener('window:prompt-close', listener)
  },
  setNativeTheme: (mode: ThemeNativeMode): void => ipcRenderer.send('theme-set-native', mode),

  getVaultStatus: (): Promise<VaultStatus> => invoke(IPC.vaultStatus),
  setupVault: (payload: VaultSetupPayload): Promise<VaultStatus> => invoke(IPC.vaultSetup, payload),
  unlockVault: (payload: VaultUnlockPayload): Promise<VaultStatus> => invoke(IPC.vaultUnlock, payload),
  lockVault: (): Promise<VaultStatus> => invoke(IPC.vaultLock),
  resetVault: (): Promise<VaultStatus> => invoke(IPC.vaultReset),

  getRecoveryStatus: (): Promise<{ configured: boolean }> => invoke(IPC.recoveryStatus),
  verifyRecoveryKey: (recoveryKey: string): Promise<RecoveryVerifyResult> =>
    invoke(IPC.recoveryVerify, recoveryKey),
  createRecoveryKey: (): Promise<RecoveryCreateResult> => invoke(IPC.recoveryCreate),
  resetMasterPasswordWithRecovery: (payload: RecoveryResetPayload): Promise<VaultStatus> =>
    invoke(IPC.recoveryResetMaster, payload),
  clearRecoveryKey: (): Promise<VaultStatus> => invoke(IPC.recoveryClear),
  regenerateRecoveryKey: (masterPassword: string): Promise<RecoveryCreateResult> =>
    invoke(IPC.recoveryRegenerate, masterPassword),

  listEntries: (): Promise<PasswordEntry[]> => invoke(IPC.entriesList),
  createEntry: (input: PasswordEntryInput): Promise<PasswordEntry> => invoke(IPC.entriesCreate, input),
  updateEntry: (id: string, input: PasswordEntryInput): Promise<PasswordEntry> =>
    invoke(IPC.entriesUpdate, { id, input }),
  deleteEntry: (id: string): Promise<void> => invoke(IPC.entriesDelete, id),
  toggleFavorite: (id: string): Promise<PasswordEntry> => invoke(IPC.entriesToggleFavorite, id),
  touchEntry: (id: string): Promise<void> => invoke(IPC.entriesTouch, id),

  listCategories: (): Promise<VaultCategory[]> => invoke(IPC.categoriesList),
  createCategory: (input: CategoryInput): Promise<VaultCategory> =>
    invoke(IPC.categoriesCreate, input),
  updateCategory: (id: string, input: CategoryInput): Promise<VaultCategory> =>
    invoke(IPC.categoriesUpdate, { id, input }),
  deleteCategory: (id: string): Promise<void> => invoke(IPC.categoriesDelete, id),
  reorderCategories: (categoryIds: string[]): Promise<VaultCategory[]> =>
    invoke(IPC.categoriesReorder, categoryIds),
  getSidebarCategoryOrder: (): Promise<string[]> => invoke(IPC.categoriesSidebarOrder),
  reorderSidebarCategories: (order: string[]): Promise<VaultCategory[]> =>
    invoke(IPC.categoriesReorderSidebar, order),

  getSettings: (): Promise<SecuritySettings> => invoke(IPC.settingsGet),
  updateSettings: (partial: Partial<SecuritySettings>): Promise<SecuritySettings> =>
    invoke(IPC.settingsUpdate, partial),

  copySecret: (text: string, clearAfterMs?: number): Promise<void> =>
    invoke(IPC.clipboardCopy, { text, clearAfterMs }),

  openExternal: (url: string): Promise<void> => invoke(IPC.shellOpenExternal, url),

  exportData: (): Promise<ExportPayload> => invoke(IPC.dataExport),
  importData: (entries: PasswordEntryInput[]): Promise<number> => invoke(IPC.dataImport, entries),
}
