import { ipcRenderer } from 'electron'
import { ERR_PREFIX } from '../shared/errors'
import { IPC, IPC_EVENTS } from '../shared/types'

const QUICKBAR_CHANNELS = {
  hide: 'quickbar:hide',
  show: 'quickbar:show',
  showMain: 'quickbar:show-main',
  resize: 'quickbar:resize',
} as const
import type {
  CategoryInput,
  ExportPayload,
  VaultImportPayload,
  ImportPreviewRequest,
  ImportPreviewResult,
  ImportCommitRequest,
  PasswordEntry,
  PasswordEntryInput,
  RecoveryCreateResult,
  RecoveryResetPayload,
  RecoveryVerifyResult,
  SecuritySettings,
  VaultCategory,
  VaultTag,
  TagInput,
  VaultSetupPayload,
  VaultStatus,
  VaultUnlockPayload,
  EmailBackupSettings,
  EmailBackupSettingsUpdate,
  EmailBackupSendPayload,
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
  isScreenshotMode: (): boolean => process.env.PWD_BOOK_SCREENSHOT === '1',
  minimize: (): void => ipcRenderer.send('window-minimize'),
  maximize: (): void => ipcRenderer.send('window-maximize'),
  close: (): void => ipcRenderer.send('window-close'),
  onClosePrompt: (handler: () => void): (() => void) => {
    const listener = (): void => handler()
    ipcRenderer.on('window:prompt-close', listener)
    return () => ipcRenderer.removeListener('window:prompt-close', listener)
  },
  onAlreadyRunning: (handler: () => void): (() => void) => {
    const listener = (): void => handler()
    ipcRenderer.on('app:already-running', listener)
    return () => ipcRenderer.removeListener('app:already-running', listener)
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
  listQuickBarRecent: (): Promise<PasswordEntry[]> => invoke(IPC.quickBarListRecent),
  removeQuickBarRecent: (id: string): Promise<PasswordEntry[]> =>
    invoke(IPC.quickBarRemoveRecent, id),

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

  listTags: (): Promise<VaultTag[]> => invoke(IPC.tagsList),
  createTag: (input: TagInput): Promise<VaultTag> => invoke(IPC.tagsCreate, input),
  updateTag: (oldName: string, input: TagInput): Promise<VaultTag> =>
    invoke(IPC.tagsUpdate, { oldName, input }),
  deleteTag: (name: string): Promise<void> => invoke(IPC.tagsDelete, name),

  getSettings: (): Promise<SecuritySettings> => invoke(IPC.settingsGet),
  updateSettings: (partial: Partial<SecuritySettings>): Promise<SecuritySettings> =>
    invoke(IPC.settingsUpdate, partial),

  copySecret: (text: string, clearAfterMs?: number): Promise<void> =>
    invoke(IPC.clipboardCopy, { text, clearAfterMs }),

  openExternal: (url: string): Promise<void> => invoke(IPC.shellOpenExternal, url),
  openLocalProgram: (programPath: string): Promise<void> =>
    invoke(IPC.shellOpenLocalProgram, programPath),

  exportData: (): Promise<ExportPayload> => invoke(IPC.dataExport),
  exportDataAsExcel: (): Promise<Uint8Array> => invoke(IPC.dataExportExcel),
  exportDataAsCsv: (formatId: string): Promise<string> => invoke(IPC.dataExportCsv, formatId),
  importData: (payload: VaultImportPayload): Promise<number> => invoke(IPC.dataImport, payload),
  previewImport: (request: ImportPreviewRequest): Promise<ImportPreviewResult> =>
    invoke(IPC.dataImportPreview, request),
  commitImport: (request: ImportCommitRequest): Promise<number> =>
    invoke(IPC.dataImportCommit, request),

  getEmailBackupSettings: (): Promise<EmailBackupSettings> => invoke(IPC.emailBackupGet),
  updateEmailBackupSettings: (partial: EmailBackupSettingsUpdate): Promise<EmailBackupSettings> =>
    invoke(IPC.emailBackupUpdate, partial),
  testEmailBackupConnection: (): Promise<void> => invoke(IPC.emailBackupTest),
  sendEmailBackup: (payload: EmailBackupSendPayload): Promise<EmailBackupSettings> =>
    invoke(IPC.emailBackupSend, payload),
  onScheduledBackupDue: (handler: () => void): (() => void) => {
    const listener = (): void => handler()
    ipcRenderer.on(IPC_EVENTS.scheduledBackupDue, listener)
    return () => ipcRenderer.removeListener(IPC_EVENTS.scheduledBackupDue, listener)
  },

  hideQuickBar: (): void => ipcRenderer.send(QUICKBAR_CHANNELS.hide),
  showQuickBar: (): void => ipcRenderer.send(QUICKBAR_CHANNELS.show),
  quickBarShowMain: (): void => ipcRenderer.send(QUICKBAR_CHANNELS.showMain),
  resizeQuickBar: (height: number): void => ipcRenderer.send(QUICKBAR_CHANNELS.resize, height),
  onQuickBarShown: (handler: () => void): (() => void) => {
    const listener = (): void => handler()
    ipcRenderer.on(IPC_EVENTS.quickBarShown, listener)
    return () => ipcRenderer.removeListener(IPC_EVENTS.quickBarShown, listener)
  },
  notifyThemeChanged: (): void => ipcRenderer.send('theme:notify-change'),
  onThemeChanged: (handler: () => void): (() => void) => {
    const listener = (): void => handler()
    ipcRenderer.on(IPC_EVENTS.themeChanged, listener)
    return () => ipcRenderer.removeListener(IPC_EVENTS.themeChanged, listener)
  },
  setQuickBarBackground: (color: string): void =>
    ipcRenderer.send('quickbar:set-background', color),
}
