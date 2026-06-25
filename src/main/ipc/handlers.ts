import { clipboard, dialog, ipcMain, shell } from 'electron'
import { rebuildTrayMenu } from '../tray'
import { setSetting } from '../db/helpers'
import { UI_LOCALE_SETTING_KEY, type TrayLocale } from '../../shared/trayLabels'
import { hideQuickBarOnLock, registerQuickBarShortcut } from '../quickBar'
import { hideDetailWindowOnLock } from '../detailWindow'
import { registerMainWindowShortcut } from '../mainWindowShortcut'
import { isLaunchAtLoginAvailable, syncLaunchAtLogin } from '../launchAtLogin'
import { IPC } from '../../shared/types'
import type {
  PasswordEntryInput,
  SecuritySettings,
  VaultSetupPayload,
  VaultUnlockPayload,
  VaultImportPayload,
  ImportPreviewRequest,
  ImportCommitRequest,
  EmailBackupSettingsUpdate,
  EmailBackupSendPayload,
} from '../../shared/types'
import { appError, ErrorCode } from '../../shared/errors'
import { initDatabase } from '../db/database'
import { commitImport, previewImport } from '../services/importService'
import { buildExportCsv } from '../services/exportCsvService'
import { openBrowserExtensionsPage } from '../services/browserLaunchService'
import { openLocalProgram } from '../services/localProgramService'
import {
  removeQuickBarRecentEntry,
  resolveQuickBarRecentEntries,
} from '../services/quickBarRecentService'
import type { CsvExportId } from '../../shared/exportFormats'
import {
  createEntry,
  deleteEntry,
  getVaultStatus,
  importFromExportPayload,
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
  emptyTrash,
  listTrashedEntries,
  permanentlyDeleteTrashEntry,
  purgeExpiredTrash,
  restoreAllTrashEntries,
  restoreTrashEntry,
} from '../services/trashService'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  reorderCategories,
  getSidebarCategoryOrder,
  reorderSidebarCategories,
} from '../services/categoryService'
import { createTag, deleteTag, listTags, updateTag } from '../services/tagService'
import {
  createRecoveryKey,
  clearRecoveryKeyData,
  getRecoveryStatus,
  resetMasterPasswordWithRecovery,
  verifyRecoveryKey,
  regenerateRecoveryKey,
} from '../services/recoveryService'
import type { CategoryInput, RecoveryResetPayload, TagInput } from '../../shared/types'
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
import { buildExportPayload } from '../services/exportPayloadService'
import { buildExcelBuffer } from '../services/exportExcelService'
import {
  getBrowserBridgeStatus,
  regenerateBrowserBridgeToken,
  syncBrowserBridge,
} from '../services/browserBridgeService'
import {
  getNativeHostRegistrationInfo,
  registerNativeHost,
} from '../services/nativeHostRegistryService'
import { getSyncStatus, publishEncryptedBundle } from '../services/syncBundleService'
import {
  discoverSyncServers,
  mergeFromEncryptedBuffer,
  pullMergeAndPush,
  pullMergeFromPairingQr,
} from '../services/syncClientService'
import {
  getWifiSyncPairingInfo,
  getWifiSyncServerStatus,
  getWifiSyncSettings,
  regenerateAccessPassword,
  restoreWifiSyncServerIfNeeded,
  startWifiSyncServer,
  stopWifiSyncServer,
  updateWifiSyncSettings,
} from '../services/wifiSyncService'
import { getClientVerificationCode } from '../services/syncClientService'
import type { WifiSyncClientPullPayload, WifiSyncSettings, FolderSyncSettings } from '../../shared/syncTypes'
import { deriveSyncTransportKey } from '../crypto/vaultCrypto'
import {
  connectFolderSync,
  disconnectFolderSync,
  getFolderSyncSettings,
  getFolderSyncStatus,
  restoreFolderSyncOnUnlock,
  syncFolderNow,
  updateFolderSyncSettings,
} from '../services/folderSyncService'
import {
  addAttachment,
  deleteAttachment,
  listAttachments,
  readAttachmentBuffer,
  writeDecryptedToTemp,
} from '../services/attachmentService'
import { readAttachmentRow } from '../db/helpers'
import fs from 'fs'

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
    throw new Error(message, { cause: error })
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
      purgeExpiredTrash()
      resetScheduledBackupNotification()
      checkScheduledBackupDue(true)
      void restoreWifiSyncServerIfNeeded()
      restoreFolderSyncOnUnlock()
      return getVaultStatus()
    }),
  )

  ipcMain.handle(IPC.vaultLock, () =>
    wrap(() => {
      lockVault()
      hideQuickBarOnLock()
      hideDetailWindowOnLock()
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
      throw new Error(message, { cause: error })
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

  ipcMain.handle(IPC.trashList, () =>
    wrap(() => {
      ensureUnlocked()
      return listTrashedEntries()
    }),
  )

  ipcMain.handle(IPC.trashRestore, (_event, id: string) =>
    wrap(() => {
      ensureUnlocked()
      restoreTrashEntry(id)
    }),
  )

  ipcMain.handle(IPC.trashRestoreAll, () =>
    wrap(() => {
      ensureUnlocked()
      return restoreAllTrashEntries()
    }),
  )

  ipcMain.handle(IPC.trashDeletePermanent, (_event, id: string) =>
    wrap(() => {
      ensureUnlocked()
      permanentlyDeleteTrashEntry(id)
    }),
  )

  ipcMain.handle(IPC.trashEmpty, () =>
    wrap(() => {
      ensureUnlocked()
      return emptyTrash()
    }),
  )

  ipcMain.handle(IPC.quickBarListRecent, () =>
    wrap(() => {
      ensureUnlocked()
      return resolveQuickBarRecentEntries(listEntries())
    }),
  )

  ipcMain.handle(IPC.quickBarRemoveRecent, (_event, id: string) =>
    wrap(() => {
      ensureUnlocked()
      removeQuickBarRecentEntry(id)
      return resolveQuickBarRecentEntries(listEntries())
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

  ipcMain.handle(IPC.tagsList, () =>
    wrap(() => {
      ensureUnlocked()
      return listTags()
    }),
  )

  ipcMain.handle(IPC.tagsCreate, (_event, input: TagInput) =>
    wrap(() => {
      ensureUnlocked()
      return createTag(input)
    }),
  )

  ipcMain.handle(
    IPC.tagsUpdate,
    (_event, payload: { oldName: string; input: TagInput }) =>
      wrap(() => {
        ensureUnlocked()
        return updateTag(payload.oldName, payload.input)
      }),
  )

  ipcMain.handle(IPC.tagsDelete, (_event, name: string) =>
    wrap(() => {
      ensureUnlocked()
      deleteTag(name)
    }),
  )

  ipcMain.handle(IPC.settingsGet, () => getSecuritySettings())

  ipcMain.handle(IPC.launchAtLoginAvailable, () => isLaunchAtLoginAvailable())

  ipcMain.handle(IPC.settingsUpdate, (_event, partial: Partial<SecuritySettings>) => {
    const next = updateSecuritySettings(partial)
    registerQuickBarShortcut()
    registerMainWindowShortcut()
    syncBrowserBridge()
    if (partial.launchAtLoginEnabled !== undefined) {
      syncLaunchAtLogin(next.launchAtLoginEnabled)
    }
    return next
  })

  ipcMain.handle(IPC.settingsSetUiLocale, (_event, locale: TrayLocale) => {
    const next = locale === 'en' ? 'en' : 'zh-CN'
    setSetting(UI_LOCALE_SETTING_KEY, next)
    rebuildTrayMenu()
    return next
  })

  ipcMain.handle(IPC.browserBridgeStatus, () => getBrowserBridgeStatus())

  ipcMain.handle(IPC.browserBridgeRegenerateToken, () =>
    wrap(() => {
      regenerateBrowserBridgeToken()
      return getBrowserBridgeStatus()
    }),
  )

  ipcMain.handle(IPC.browserNativeHostInfo, () => getNativeHostRegistrationInfo())

  ipcMain.handle(IPC.browserRegisterNativeHost, (_event, extensionId: string) =>
    wrap(() => registerNativeHost(extensionId)),
  )

  ipcMain.handle(IPC.shellOpenExtensionsPage, () => wrap(() => openBrowserExtensionsPage()))

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

  ipcMain.handle(IPC.shellOpenLocalProgram, async (_event, programPath: string) => {
    try {
      ensureUnlocked()
      await openLocalProgram(programPath)
    } catch (error) {
      const message = error instanceof Error ? error.message : ErrorCode.OPERATION_FAILED
      throw new Error(message, { cause: error })
    }
  })

  ipcMain.handle(IPC.dataExport, () =>
    wrap(() => {
      ensureUnlocked()
      return buildExportPayload()
    }),
  )

  ipcMain.handle(IPC.dataExportExcel, () =>
    wrap(() => {
      ensureUnlocked()
      const payload = buildExportPayload()
      return buildExcelBuffer(payload)
    }),
  )

  ipcMain.handle(IPC.dataExportCsv, (_event, formatId: CsvExportId) =>
    wrap(() => {
      ensureUnlocked()
      return buildExportCsv(formatId)
    }),
  )

  ipcMain.handle(IPC.dataImport, (_event, payload: VaultImportPayload) =>
    wrap(() => {
      ensureUnlocked()
      return importFromExportPayload(payload)
    }),
  )

  ipcMain.handle(IPC.dataImportPreview, (_event, request: ImportPreviewRequest) =>
    wrap(() => {
      ensureUnlocked()
      return previewImport(request)
    }),
  )

  ipcMain.handle(IPC.dataImportCommit, (_event, request: ImportCommitRequest) =>
    wrap(() => {
      ensureUnlocked()
      return commitImport(request)
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
      throw new Error(message, { cause: error })
    }
  })

  ipcMain.handle(IPC.emailBackupSend, async (_event, payload: EmailBackupSendPayload) => {
    try {
      ensureUnlocked()
      return await sendBackupNow(payload.masterPassword)
    } catch (error) {
      const message = error instanceof Error ? error.message : ErrorCode.OPERATION_FAILED
      throw new Error(message, { cause: error })
    }
  })

  ipcMain.handle(IPC.syncStatus, () =>
    wrap(() => {
      ensureUnlocked()
      return getSyncStatus()
    }),
  )

  ipcMain.handle(IPC.syncExportBundle, (_event, masterPassword: string) =>
    wrap(() => {
      ensureUnlocked()
      const transportKey = deriveSyncTransportKey(masterPassword)
      const result = publishEncryptedBundle(transportKey)
      return {
        buffer: Uint8Array.from(result.buffer),
        revision: result.revision,
        sizeBytes: result.sizeBytes,
      }
    }),
  )

  ipcMain.handle(
    IPC.syncImportBundle,
    (_event, payload: { masterPassword: string; buffer: Uint8Array }) =>
      wrap(() => {
        ensureUnlocked()
        const buffer = Buffer.from(payload.buffer)
        return mergeFromEncryptedBuffer(buffer, payload.masterPassword)
      }),
  )

  ipcMain.handle(IPC.wifiSyncGetSettings, () => wrap(() => getWifiSyncSettings()))

  ipcMain.handle(IPC.wifiSyncUpdateSettings, (_event, partial: Partial<WifiSyncSettings>) =>
    wrap(() => updateWifiSyncSettings(partial)),
  )

  ipcMain.handle(IPC.wifiSyncServerStatus, () => wrap(() => getWifiSyncServerStatus()))

  ipcMain.handle(IPC.wifiSyncPairingInfo, () =>
    wrap(() => {
      const status = getWifiSyncServerStatus()
      if (!status.running) {
        throw appError(ErrorCode.OPERATION_FAILED)
      }
      return getWifiSyncPairingInfo()
    }),
  )

  ipcMain.handle(IPC.wifiSyncRegenerateAccessPassword, () =>
    wrap(() => regenerateAccessPassword()),
  )

  ipcMain.handle(IPC.wifiSyncStartServer, async () => {
    try {
      ensureUnlocked()
      return await startWifiSyncServer()
    } catch (error) {
      const message = error instanceof Error ? error.message : ErrorCode.OPERATION_FAILED
      throw new Error(message, { cause: error })
    }
  })

  ipcMain.handle(IPC.wifiSyncStopServer, async () => {
    try {
      return await stopWifiSyncServer()
    } catch (error) {
      const message = error instanceof Error ? error.message : ErrorCode.OPERATION_FAILED
      throw new Error(message, { cause: error })
    }
  })

  ipcMain.handle(IPC.wifiSyncGetVerificationCode, (_event, fingerprint: string) =>
    wrap(() => getClientVerificationCode(fingerprint)),
  )

  ipcMain.handle(IPC.wifiSyncDiscover, async () => {
    try {
      return await discoverSyncServers()
    } catch (error) {
      const message = error instanceof Error ? error.message : ErrorCode.OPERATION_FAILED
      throw new Error(message, { cause: error })
    }
  })

  ipcMain.handle(IPC.wifiSyncPullMerge, async (_event, payload: WifiSyncClientPullPayload) => {
    try {
      ensureUnlocked()
      return await pullMergeAndPush(payload)
    } catch (error) {
      const message = error instanceof Error ? error.message : ErrorCode.OPERATION_FAILED
      throw new Error(message, { cause: error })
    }
  })

  ipcMain.handle(
    IPC.wifiSyncPullMergeQr,
    async (_event, payload: { qrPayload: string; masterPassword: string; deviceName?: string }) => {
      try {
        ensureUnlocked()
        return await pullMergeFromPairingQr(
          payload.qrPayload,
          payload.masterPassword,
          payload.deviceName,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : ErrorCode.OPERATION_FAILED
        throw new Error(message, { cause: error })
      }
    },
  )

  ipcMain.handle(IPC.folderSyncGetSettings, () => wrap(() => getFolderSyncSettings()))

  ipcMain.handle(IPC.folderSyncUpdateSettings, (_event, partial: Partial<FolderSyncSettings>) =>
    wrap(() => updateFolderSyncSettings(partial)),
  )

  ipcMain.handle(IPC.folderSyncStatus, () => wrap(() => getFolderSyncStatus()))

  ipcMain.handle(IPC.folderSyncPickDirectory, async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select sync folder',
      })
      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      return result.filePaths[0] ?? null
    } catch (error) {
      const message = error instanceof Error ? error.message : ErrorCode.OPERATION_FAILED
      throw new Error(message, { cause: error })
    }
  })

  ipcMain.handle(
    IPC.folderSyncConnect,
    (_event, payload: { folderPath: string; masterPassword: string }) =>
      wrap(() => {
        ensureUnlocked()
        return connectFolderSync(payload.folderPath, payload.masterPassword)
      }),
  )

  ipcMain.handle(IPC.folderSyncDisconnect, () => wrap(() => disconnectFolderSync()))

  ipcMain.handle(IPC.folderSyncSyncNow, (_event, masterPassword: string) =>
    wrap(() => {
      ensureUnlocked()
      return syncFolderNow(masterPassword)
    }),
  )

  ipcMain.handle(IPC.attachmentsList, (_event, entryId: string) =>
    wrap(() => {
      ensureUnlocked()
      return listAttachments(entryId)
    }),
  )

  ipcMain.handle(IPC.attachmentsAdd, async (_event, entryId: string) => {
    try {
      ensureUnlocked()
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        title: 'Select attachment',
      })
      if (result.canceled || result.filePaths.length === 0) return null
      const sourcePath = result.filePaths[0]
      if (!sourcePath) return null
      return addAttachment(entryId, sourcePath)
    } catch (error) {
      const message = error instanceof Error ? error.message : ErrorCode.OPERATION_FAILED
      throw new Error(message, { cause: error })
    }
  })

  ipcMain.handle(IPC.attachmentsDelete, (_event, attachmentId: string) =>
    wrap(() => {
      ensureUnlocked()
      deleteAttachment(attachmentId)
    }),
  )

  ipcMain.handle(IPC.attachmentsOpen, (_event, attachmentId: string) =>
    wrap(() => {
      ensureUnlocked()
      const filePath = writeDecryptedToTemp(attachmentId)
      const openError = shell.openPath(filePath)
      return openError
    }),
  )

  ipcMain.handle(IPC.attachmentsSaveAs, async (_event, attachmentId: string) => {
    try {
      ensureUnlocked()
      const row = readAttachmentRow(attachmentId)
      if (!row) throw appError(ErrorCode.ATTACHMENT_NOT_FOUND)
      const result = await dialog.showSaveDialog({
        defaultPath: row.filename,
      })
      if (result.canceled || !result.filePath) return false
      const data = readAttachmentBuffer(attachmentId)
      fs.writeFileSync(result.filePath, data)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : ErrorCode.OPERATION_FAILED
      throw new Error(message, { cause: error })
    }
  })

  startBackupScheduler()
}
