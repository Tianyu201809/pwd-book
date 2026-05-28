import { ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import type {
  CategoryInput,
  ExportPayload,
  PasswordEntry,
  PasswordEntryInput,
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
    const message = error instanceof Error ? error.message : '请求失败'
    throw new Error(message)
  }
}

export const electronAPI = {
  minimize: (): void => ipcRenderer.send('window-minimize'),
  maximize: (): void => ipcRenderer.send('window-maximize'),
  close: (): void => ipcRenderer.send('window-close'),
  setNativeTheme: (mode: ThemeNativeMode): void => ipcRenderer.send('theme-set-native', mode),

  getVaultStatus: (): Promise<VaultStatus> => invoke(IPC.vaultStatus),
  setupVault: (payload: VaultSetupPayload): Promise<VaultStatus> => invoke(IPC.vaultSetup, payload),
  unlockVault: (payload: VaultUnlockPayload): Promise<VaultStatus> => invoke(IPC.vaultUnlock, payload),
  lockVault: (): Promise<VaultStatus> => invoke(IPC.vaultLock),
  resetVault: (): Promise<VaultStatus> => invoke(IPC.vaultReset),

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

  getSettings: (): Promise<SecuritySettings> => invoke(IPC.settingsGet),
  updateSettings: (partial: Partial<SecuritySettings>): Promise<SecuritySettings> =>
    invoke(IPC.settingsUpdate, partial),

  copySecret: (text: string, clearAfterMs?: number): Promise<void> =>
    invoke(IPC.clipboardCopy, { text, clearAfterMs }),

  exportData: (): Promise<ExportPayload> => invoke(IPC.dataExport),
  importData: (entries: PasswordEntryInput[]): Promise<number> => invoke(IPC.dataImport, entries),
}
