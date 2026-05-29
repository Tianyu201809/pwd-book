import { clipboard, ipcMain, shell } from 'electron'
import { IPC } from '../../shared/types'
import type {
  ExportPayload,
  PasswordEntryInput,
  SecuritySettings,
  VaultSetupPayload,
  VaultUnlockPayload,
  EmailBackupSettingsUpdate,
  EmailBackupSendPayload,
} from '../../shared/types'
import { appError, ErrorCode } from '../../shared/errors'
import { initDatabase } from '../db/database'
import {
  createEntry,
  deleteEntry,
  getVaultStatus,
  importEntries,
  listEntries,
  lockVault,
  resetVault,
  setupVault,
  toggleFavorite,
  touchEntry,
  unlockVault,
  updateEntry,
} from '../services/vaultService'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  reorderCategories,
  getSidebarCategoryOrder,
  reorderSidebarCategories,
} from '../services/categoryService'
import {
  createRecoveryKey,
  clearRecoveryKeyData,
  getRecoveryStatus,
  resetMasterPasswordWithRecovery,
  verifyRecoveryKey,
  regenerateRecoveryKey,
} from '../services/recoveryService'
import type { CategoryInput, RecoveryResetPayload } from '../../shared/types'
import { getSecuritySettings, updateSecuritySettings } from '../services/settingsService'
import {
  getEmailBackupSettings,
  sendBackupNow,
  testEmailConnection,
  updateEmailBackupSettings,
} from '../services/emailBackupService'
import {
  checkScheduledBackupDue,
  resetScheduledBackupNotification,
  startBackupScheduler,
} from '../services/backupScheduler'
import { isUnlocked } from '../services/sessionService'

let clipboardTimer: NodeJS.Timeout | null = null

function ensureUnlocked(): void {
  if (!isUnlocked()) {
    throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)
  }
}

function wrap<T>(handler: () => T): T {
  try {
    return handler()
  } catch (error) {
    const message = error instanceof Error ? error.message : ErrorCode.OPERATION_FAILED
    throw new Error(message)
  }
}

function copySecret(text: string, clearAfterMs: number): void {
  clipboard.writeText(text)
  if (clipboardTimer) {
    clearTimeout(clipboardTimer)
  }
  if (clearAfterMs > 0) {
    clipboardTimer = setTimeout(() => {
      if (clipboard.readText() === text) {
        clipboard.clear()
      }
    }, clearAfterMs)
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.vaultStatus, () => getVaultStatus())

  ipcMain.handle(IPC.vaultSetup, (_event, payload: VaultSetupPayload) =>
    wrap(() => {
      setupVault(payload.masterPassword, payload.confirmPassword)
      return getVaultStatus()
    }),
  )

  ipcMain.handle(IPC.vaultUnlock, (_event, payload: VaultUnlockPayload) =>
    wrap(() => {
      unlockVault(payload.masterPassword)
      resetScheduledBackupNotification()
      checkScheduledBackupDue(true)
      return getVaultStatus()
    }),
  )

  ipcMain.handle(IPC.vaultLock, () =>
    wrap(() => {
      lockVault()
      resetScheduledBackupNotification()
      return getVaultStatus()
    }),
  )

  ipcMain.handle(IPC.vaultReset, async () => {
    try {
      resetVault()
      await initDatabase()
      return getVaultStatus()
    } catch (error) {
      const message = error instanceof Error ? error.message : ErrorCode.OPERATION_FAILED
      throw new Error(message)
    }
  })

  ipcMain.handle(IPC.recoveryStatus, () => wrap(() => getRecoveryStatus()))

  ipcMain.handle(IPC.recoveryVerify, (_event, recoveryKey: string) =>
    wrap(() => {
      const configured = getRecoveryStatus().configured
      if (!configured) {
        return { valid: false, configured: false }
      }
      try {
        return { valid: verifyRecoveryKey(recoveryKey), configured: true }
      } catch {
        return { valid: false, configured: true }
      }
    }),
  )

  ipcMain.handle(IPC.recoveryCreate, () =>
    wrap(() => {
      ensureUnlocked()
      return createRecoveryKey()
    }),
  )

  ipcMain.handle(IPC.recoveryResetMaster, (_event, payload: RecoveryResetPayload) =>
    wrap(() => {
      resetMasterPasswordWithRecovery(
        payload.recoveryKey,
        payload.newMasterPassword,
        payload.confirmPassword,
      )
      return getVaultStatus()
    }),
  )

  ipcMain.handle(IPC.recoveryClear, () =>
    wrap(() => {
      ensureUnlocked()
      clearRecoveryKeyData()
      return getVaultStatus()
    }),
  )

  ipcMain.handle(IPC.recoveryRegenerate, (_event, masterPassword: string) =>
    wrap(() => {
      ensureUnlocked()
      return regenerateRecoveryKey(masterPassword)
    }),
  )

  ipcMain.handle(IPC.entriesList, () =>
    wrap(() => {
      ensureUnlocked()
      return listEntries()
    }),
  )

  ipcMain.handle(IPC.entriesCreate, (_event, input: PasswordEntryInput) =>
    wrap(() => {
      ensureUnlocked()
      if (!input.title?.trim()) throw appError(ErrorCode.TITLE_REQUIRED)
      if (!input.password) throw appError(ErrorCode.PASSWORD_REQUIRED)
      return createEntry(input)
    }),
  )

  ipcMain.handle(
    IPC.entriesUpdate,
    (_event, payload: { id: string; input: PasswordEntryInput }) =>
      wrap(() => {
        ensureUnlocked()
        if (!payload.input.title?.trim()) throw appError(ErrorCode.TITLE_REQUIRED)
        if (!payload.input.password) throw appError(ErrorCode.PASSWORD_REQUIRED)
        return updateEntry(payload.id, payload.input)
      }),
  )

  ipcMain.handle(IPC.entriesDelete, (_event, id: string) =>
    wrap(() => {
      ensureUnlocked()
      deleteEntry(id)
    }),
  )

  ipcMain.handle(IPC.entriesToggleFavorite, (_event, id: string) =>
    wrap(() => {
      ensureUnlocked()
      return toggleFavorite(id)
    }),
  )

  ipcMain.handle(IPC.entriesTouch, (_event, id: string) =>
    wrap(() => {
      ensureUnlocked()
      touchEntry(id)
    }),
  )

  ipcMain.handle(IPC.categoriesList, () =>
    wrap(() => {
      ensureUnlocked()
      return listCategories()
    }),
  )

  ipcMain.handle(IPC.categoriesCreate, (_event, input: CategoryInput) =>
    wrap(() => {
      ensureUnlocked()
      return createCategory(input)
    }),
  )

  ipcMain.handle(
    IPC.categoriesUpdate,
    (_event, payload: { id: string; input: CategoryInput }) =>
      wrap(() => {
        ensureUnlocked()
        return updateCategory(payload.id, payload.input)
      }),
  )

  ipcMain.handle(IPC.categoriesDelete, (_event, id: string) =>
    wrap(() => {
      ensureUnlocked()
      deleteCategory(id)
    }),
  )

  ipcMain.handle(IPC.categoriesReorder, (_event, categoryIds: string[]) =>
    wrap(() => {
      ensureUnlocked()
      return reorderCategories(categoryIds)
    }),
  )

  ipcMain.handle(IPC.categoriesSidebarOrder, () =>
    wrap(() => getSidebarCategoryOrder()),
  )

  ipcMain.handle(IPC.categoriesReorderSidebar, (_event, order: string[]) =>
    wrap(() => {
      ensureUnlocked()
      return reorderSidebarCategories(order)
    }),
  )

  ipcMain.handle(IPC.settingsGet, () => getSecuritySettings())

  ipcMain.handle(IPC.settingsUpdate, (_event, partial: Partial<SecuritySettings>) =>
    updateSecuritySettings(partial),
  )

  ipcMain.handle(IPC.clipboardCopy, (_event, payload: { text: string; clearAfterMs?: number }) =>
    wrap(() => {
      const settings = getSecuritySettings()
      const clearAfterMs =
        payload.clearAfterMs ??
        (settings.clipboardClearEnabled ? settings.clipboardClearSeconds * 1000 : 0)
      copySecret(payload.text, clearAfterMs)
    }),
  )

  ipcMain.handle(IPC.shellOpenExternal, async (_event, url: string) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw appError(ErrorCode.INVALID_EXTERNAL_URL)
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw appError(ErrorCode.INVALID_EXTERNAL_URL)
    }
    await shell.openExternal(url)
  })

  ipcMain.handle(IPC.dataExport, () =>
    wrap(() => {
      ensureUnlocked()
      const payload: ExportPayload = {
        exportedAt: new Date().toISOString(),
        categories: listCategories(),
        entries: listEntries(),
      }
      return payload
    }),
  )

  ipcMain.handle(IPC.dataImport, (_event, entries: PasswordEntryInput[]) =>
    wrap(() => {
      ensureUnlocked()
      return importEntries(entries)
    }),
  )

  ipcMain.handle(IPC.emailBackupGet, () =>
    wrap(() => {
      ensureUnlocked()
      return getEmailBackupSettings()
    }),
  )

  ipcMain.handle(IPC.emailBackupUpdate, (_event, partial: EmailBackupSettingsUpdate) =>
    wrap(() => {
      ensureUnlocked()
      return updateEmailBackupSettings(partial)
    }),
  )

  ipcMain.handle(IPC.emailBackupTest, async () => {
    try {
      ensureUnlocked()
      await testEmailConnection()
    } catch (error) {
      const message = error instanceof Error ? error.message : ErrorCode.OPERATION_FAILED
      throw new Error(message)
    }
  })

  ipcMain.handle(IPC.emailBackupSend, async (_event, payload: EmailBackupSendPayload) => {
    try {
      ensureUnlocked()
      return await sendBackupNow(payload.masterPassword)
    } catch (error) {
      const message = error instanceof Error ? error.message : ErrorCode.OPERATION_FAILED
      throw new Error(message)
    }
  })

  startBackupScheduler()
}
