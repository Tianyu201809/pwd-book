import fs from 'fs'
import path from 'path'
import { getSetting, setSetting } from '../db/helpers'
import type { FolderSyncSettings, FolderSyncStatus, SyncMergeResult } from '../../shared/syncTypes'
import { SYNC_BUNDLE_FILENAME } from '../../shared/syncTypes'
import {
  buildSyncBundle,
  encryptBundleForTransport,
  publishEncryptedBundle,
} from './syncBundleService'
import { mergeEncryptedRemoteBundle } from './syncMergeService'
import { deriveSyncTransportKey } from '../crypto/vaultCrypto'
import { getSyncTransportKey, isUnlocked } from './sessionService'
import { appError, ErrorCode } from '../../shared/errors'
import { syncAttachmentsAfterMerge } from './attachmentSyncService'

const SETTINGS_KEY = 'folder_sync_settings'

let publishTimer: NodeJS.Timeout | null = null
let lastPublishedAt: number | null = null
let lastPublishedRevision = 0

function defaultSettings(): FolderSyncSettings {
  return {
    enabled: false,
    folderPath: null,
    autoSync: true,
  }
}

function readSettings(): FolderSyncSettings {
  const raw = getSetting(SETTINGS_KEY)
  if (!raw) return defaultSettings()
  try {
    const parsed = JSON.parse(raw) as Partial<FolderSyncSettings>
    const defaults = defaultSettings()
    return {
      enabled: parsed.enabled ?? defaults.enabled,
      folderPath: parsed.folderPath ?? defaults.folderPath,
      autoSync: parsed.autoSync ?? defaults.autoSync,
    }
  } catch {
    return defaultSettings()
  }
}

function writeSettings(settings: FolderSyncSettings): void {
  setSetting(SETTINGS_KEY, JSON.stringify(settings))
}

function assertUnlocked(): void {
  if (!isUnlocked()) throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)
}

function assertConfigured(): string {
  const settings = readSettings()
  if (!settings.enabled || !settings.folderPath) {
    throw appError(ErrorCode.FOLDER_SYNC_NOT_CONFIGURED)
  }
  return settings.folderPath
}

function getBundlePath(folderPath: string): string {
  return path.join(folderPath, SYNC_BUNDLE_FILENAME)
}

function readRemoteBundle(folderPath: string): Buffer | null {
  const bundlePath = getBundlePath(folderPath)
  if (!fs.existsSync(bundlePath)) return null
  return fs.readFileSync(bundlePath)
}

function writeRemoteBundle(folderPath: string, buffer: Buffer): void {
  fs.mkdirSync(folderPath, { recursive: true })
  fs.writeFileSync(getBundlePath(folderPath), buffer)
}

function validateFolderPath(folderPath: string): void {
  const trimmed = folderPath.trim()
  if (!trimmed) throw appError(ErrorCode.FOLDER_SYNC_PATH_REQUIRED)
  try {
    fs.mkdirSync(trimmed, { recursive: true })
  } catch {
    throw appError(ErrorCode.FOLDER_SYNC_PATH_INVALID)
  }
}

function publishMergedToFolder(
  folderPath: string,
  transportKey: string | Buffer,
): SyncMergeResult {
  assertUnlocked()
  const remote = readRemoteBundle(folderPath)
  let result: SyncMergeResult

  if (remote) {
    result = mergeEncryptedRemoteBundle(remote, transportKey)
  } else {
    const published = publishEncryptedBundle(transportKey)
    result = {
      added: 0,
      updated: 0,
      removed: 0,
      conflicts: [],
      revision: published.revision,
    }
  }

  const bundle = buildSyncBundle(result.revision)
  const encrypted = encryptBundleForTransport(bundle, transportKey)
  writeRemoteBundle(folderPath, encrypted)
  syncAttachmentsAfterMerge(bundle, folderPath)
  lastPublishedAt = Date.now()
  lastPublishedRevision = result.revision
  return result
}

export function getFolderSyncSettings(): FolderSyncSettings {
  return readSettings()
}

export function updateFolderSyncSettings(partial: Partial<FolderSyncSettings>): FolderSyncSettings {
  const next = { ...readSettings(), ...partial }
  writeSettings(next)
  return next
}

export function getFolderSyncStatus(): FolderSyncStatus {
  const settings = readSettings()
  const folderPath = settings.folderPath
  let bundleExists = false
  let bundleSizeBytes = 0
  let bundleModifiedAt: number | null = null

  if (folderPath) {
    const bundlePath = getBundlePath(folderPath)
    if (fs.existsSync(bundlePath)) {
      bundleExists = true
      const stat = fs.statSync(bundlePath)
      bundleSizeBytes = stat.size
      bundleModifiedAt = stat.mtimeMs
    }
  }

  return {
    connected: settings.enabled && Boolean(folderPath),
    folderPath,
    autoSync: settings.autoSync,
    bundleExists,
    bundleSizeBytes,
    bundleModifiedAt,
    lastPublishedAt,
    lastPublishedRevision,
  }
}

export function connectFolderSync(folderPath: string, masterPassword: string): SyncMergeResult {
  assertUnlocked()
  validateFolderPath(folderPath)
  const transportKey = deriveSyncTransportKey(masterPassword)
  const result = publishMergedToFolder(folderPath, transportKey)
  updateFolderSyncSettings({
    enabled: true,
    folderPath,
    autoSync: true,
  })
  return result
}

export function disconnectFolderSync(): FolderSyncSettings {
  if (publishTimer) {
    clearTimeout(publishTimer)
    publishTimer = null
  }
  lastPublishedAt = null
  lastPublishedRevision = 0
  return updateFolderSyncSettings({
    enabled: false,
    folderPath: null,
  })
}

export function syncFolderNow(masterPassword: string): SyncMergeResult {
  const folderPath = assertConfigured()
  const transportKey = deriveSyncTransportKey(masterPassword)
  return publishMergedToFolder(folderPath, transportKey)
}

function syncFolderFromSession(): SyncMergeResult | null {
  const settings = readSettings()
  if (!settings.enabled || !settings.folderPath || !isUnlocked()) return null
  try {
    return publishMergedToFolder(settings.folderPath, getSyncTransportKey())
  } catch {
    return null
  }
}

function schedulePublish(): void {
  if (publishTimer) clearTimeout(publishTimer)
  publishTimer = setTimeout(() => {
    publishTimer = null
    syncFolderFromSession()
  }, 3000)
}

export function notifyVaultChangedForFolderSync(): void {
  const settings = readSettings()
  if (!settings.enabled || !settings.folderPath || !settings.autoSync) return
  schedulePublish()
}

export function restoreFolderSyncOnUnlock(): void {
  const settings = readSettings()
  if (!settings.enabled || !settings.folderPath || !isUnlocked()) return
  syncFolderFromSession()
}
