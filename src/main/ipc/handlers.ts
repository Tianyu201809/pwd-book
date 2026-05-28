import { clipboard, ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import type {
  ExportPayload,
  PasswordEntryInput,
  SecuritySettings,
  VaultSetupPayload,
  VaultUnlockPayload,
} from '../../shared/types'
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
} from '../services/categoryService'
import type { CategoryInput } from '../../shared/types'
import { getSecuritySettings, updateSecuritySettings } from '../services/settingsService'
import { isUnlocked } from '../services/sessionService'

let clipboardTimer: NodeJS.Timeout | null = null

function ensureUnlocked(): void {
  if (!isUnlocked()) {
    throw new Error('请先解锁保险库')
  }
}

function wrap<T>(handler: () => T): T {
  try {
    return handler()
  } catch (error) {
    const message = error instanceof Error ? error.message : '操作失败'
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
      return getVaultStatus()
    }),
  )

  ipcMain.handle(IPC.vaultLock, () =>
    wrap(() => {
      lockVault()
      return getVaultStatus()
    }),
  )

  ipcMain.handle(IPC.vaultReset, async () => {
    try {
      resetVault()
      await initDatabase()
      return getVaultStatus()
    } catch (error) {
      const message = error instanceof Error ? error.message : '操作失败'
      throw new Error(message)
    }
  })

  ipcMain.handle(IPC.entriesList, () =>
    wrap(() => {
      ensureUnlocked()
      return listEntries()
    }),
  )

  ipcMain.handle(IPC.entriesCreate, (_event, input: PasswordEntryInput) =>
    wrap(() => {
      ensureUnlocked()
      if (!input.title?.trim()) throw new Error('标题不能为空')
      if (!input.password) throw new Error('密码不能为空')
      return createEntry(input)
    }),
  )

  ipcMain.handle(
    IPC.entriesUpdate,
    (_event, payload: { id: string; input: PasswordEntryInput }) =>
      wrap(() => {
        ensureUnlocked()
        if (!payload.input.title?.trim()) throw new Error('标题不能为空')
        if (!payload.input.password) throw new Error('密码不能为空')
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
}
