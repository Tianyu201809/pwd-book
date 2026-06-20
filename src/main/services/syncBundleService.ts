import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { decryptSyncBundle, encryptSyncBundle } from '../crypto/syncBundleCrypto'
import type { EntryRow } from '../db/helpers'
import { getSetting, readEntryRow, readTrashedEntryRows, setSetting } from '../db/helpers'
import { rowToEntry } from './entryMapper'
import { listCategories } from './categoryService'
import { readActiveEntryRows } from '../db/helpers'
import { getSecuritySettings } from './settingsService'
import { getSyncTransportKey, isUnlocked } from './sessionService'
import type { SyncBundle, SyncEntry, SyncStatus } from '../../shared/syncTypes'
import { SYNC_BUNDLE_FILENAME, SYNC_BUNDLE_FORMAT, SYNC_BUNDLE_VERSION } from '../../shared/syncTypes'
import { appError, ErrorCode } from '../../shared/errors'
import { buildSyncAttachmentsFromDb } from './attachmentSyncService'

const DEVICE_ID_KEY = 'sync_device_id'
const REVISION_KEY = 'sync_revision'
const LAST_SYNCED_AT_KEY = 'sync_last_synced_at'
const LAST_SYNC_ERROR_KEY = 'sync_last_sync_error'

function assertUnlocked(): void {
  if (!isUnlocked()) throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)
}

export function getOrCreateDeviceId(): string {
  const existing = getSetting(DEVICE_ID_KEY)
  if (existing) return existing
  const id = randomUUID()
  setSetting(DEVICE_ID_KEY, id)
  return id
}

export function getSyncRevision(): number {
  const raw = getSetting(REVISION_KEY)
  if (!raw) return 0
  const value = Number(raw)
  return Number.isFinite(value) ? value : 0
}

export function setSyncRevision(revision: number): void {
  setSetting(REVISION_KEY, String(revision))
}

export function bumpSyncRevision(): number {
  const next = getSyncRevision() + 1
  setSyncRevision(next)
  return next
}

export function getSyncStatus(): SyncStatus {
  const lastSyncedRaw = getSetting(LAST_SYNCED_AT_KEY)
  const lastSyncedAt = lastSyncedRaw ? Number(lastSyncedRaw) : null
  return {
    deviceId: getOrCreateDeviceId(),
    revision: getSyncRevision(),
    lastSyncedAt: lastSyncedAt && Number.isFinite(lastSyncedAt) ? lastSyncedAt : null,
    lastSyncError: getSetting(LAST_SYNC_ERROR_KEY),
  }
}

export function recordSyncSuccess(revision: number): void {
  setSyncRevision(revision)
  setSetting(LAST_SYNCED_AT_KEY, String(Date.now()))
  setSetting(LAST_SYNC_ERROR_KEY, '')
}

export function recordSyncError(message: string): void {
  setSetting(LAST_SYNC_ERROR_KEY, message)
}

function rowToSyncEntry(row: EntryRow): SyncEntry {
  const entry = rowToEntry(row)
  return {
    id: entry.id,
    title: entry.title,
    url: entry.url,
    username: entry.username,
    password: entry.password,
    note: entry.note,
    tags: entry.tags,
    categoryId: entry.categoryId,
    isFavorite: entry.isFavorite,
    displayIcon: entry.displayIcon,
    localProgramPath: entry.localProgramPath,
    totpSecret: entry.totpSecret,
    lastUsedAt: entry.lastUsedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    deletedAt: row.deleted_at,
  }
}

export function buildSyncBundle(revision?: number): SyncBundle {
  assertUnlocked()
  const activeRows = readActiveEntryRows()
  const trashedRows = readTrashedEntryRows()
  const entries = [...activeRows, ...trashedRows].map(rowToSyncEntry)

  return {
    format: SYNC_BUNDLE_FORMAT,
    version: SYNC_BUNDLE_VERSION,
    deviceId: getOrCreateDeviceId(),
    revision: revision ?? getSyncRevision(),
    exportedAt: new Date().toISOString(),
    categories: listCategories(),
    entries,
    attachments: buildSyncAttachmentsFromDb(),
    settings: {
      trashRetentionDays: getSecuritySettings().trashRetentionDays,
    },
  }
}

export function encryptBundleForTransport(bundle: SyncBundle, masterPasswordOrKey?: string | Buffer): Buffer {
  const key = masterPasswordOrKey ?? getSyncTransportKey()
  return encryptSyncBundle(bundle, key)
}

export function decryptBundleFromTransport(payload: Buffer, masterPasswordOrKey: string | Buffer): SyncBundle {
  return decryptSyncBundle(payload, masterPasswordOrKey)
}

export function getSyncServerDir(): string {
  return path.join(app.getPath('userData'), 'sync-server')
}

export function getSyncBundlePath(): string {
  return path.join(getSyncServerDir(), SYNC_BUNDLE_FILENAME)
}

export function writeEncryptedBundleToServer(payload: Buffer): void {
  const dir = getSyncServerDir()
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getSyncBundlePath(), payload)
}

export function readEncryptedBundleFromServer(): Buffer | null {
  const bundlePath = getSyncBundlePath()
  if (!fs.existsSync(bundlePath)) return null
  return fs.readFileSync(bundlePath)
}

export function publishEncryptedBundle(masterPasswordOrKey?: string | Buffer, revision?: number): {
  buffer: Buffer
  revision: number
  sizeBytes: number
} {
  const bundle = buildSyncBundle(revision ?? bumpSyncRevision())
  const buffer = encryptBundleForTransport(bundle, masterPasswordOrKey)
  writeEncryptedBundleToServer(buffer)
  return {
    buffer,
    revision: bundle.revision,
    sizeBytes: buffer.length,
  }
}

export function loadRemoteEncryptedBundle(buffer: Buffer, masterPassword: string): SyncBundle {
  return decryptBundleFromTransport(buffer, masterPassword)
}

export function entryRowExists(id: string): boolean {
  return readEntryRow(id) != null
}
