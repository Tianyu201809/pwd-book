import { encryptSecret } from '../crypto/vaultCrypto'
import { serializeCustomFields } from '../../shared/customFields'
import { getDatabase, persistDatabase } from '../db/database'
import { getSetting, readEntryRow, type EntryRow } from '../db/helpers'
import { ensureCategoriesFromImport, resolveCategoryId } from './categoryService'
import { mergeSyncBundles } from '../../shared/syncMerge'
import type { SyncBundle, SyncEntry, SyncMergeResult } from '../../shared/syncTypes'
import {
  buildSyncBundle,
  decryptBundleFromTransport,
  encryptBundleForTransport,
  getSyncRevision,
  recordSyncError,
  recordSyncSuccess,
  writeEncryptedBundleToServer,
} from './syncBundleService'
import { getSessionKey, isUnlocked } from './sessionService'
import { appError, ErrorCode } from '../../shared/errors'
import { removeQuickBarRecentEntry } from './quickBarRecentService'
import { applyMergedAttachments, syncAttachmentFilesAfterMerge } from './attachmentSyncService'
import { getSyncServerDir } from './syncBundleService'

function assertUnlocked(): void {
  if (!isUnlocked()) throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)
}

function resolveSyncCustomFields(entry: SyncEntry, existing: EntryRow | null): string {
  if (entry.customFields !== undefined) {
    return serializeCustomFields(entry.customFields)
  }
  if (existing) {
    return existing.custom_fields || '[]'
  }
  return '[]'
}

function upsertSyncEntry(entry: SyncEntry, categoryRemap: Map<string, string>): 'added' | 'updated' | 'removed' | 'unchanged' {
  const key = getSessionKey()
  const db = getDatabase()
  const existing = readEntryRow(entry.id)
  const mappedCategoryId = categoryRemap.get(entry.categoryId) ?? entry.categoryId

  if (!existing) {
    const totpSecret = entry.totpSecret?.trim() ?? ''
    db.run(
      `INSERT INTO password_entries
        (id, title, url, username, password_encrypted, note, category, tags, is_favorite, display_icon, local_program_path, totp_secret_encrypted, custom_fields, last_used_at, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.title.trim(),
        entry.url?.trim() ?? '',
        entry.username?.trim() ?? '',
        encryptSecret(entry.password, key),
        entry.note?.trim() ?? '',
        resolveCategoryId(mappedCategoryId),
        JSON.stringify(entry.tags ?? []),
        entry.isFavorite ? 1 : 0,
        entry.displayIcon?.trim() ?? '',
        entry.localProgramPath?.trim() ?? '',
        totpSecret ? encryptSecret(totpSecret, key) : '',
        resolveSyncCustomFields(entry, null),
        entry.lastUsedAt,
        entry.createdAt,
        entry.updatedAt,
        entry.deletedAt,
      ],
    )
    if (entry.deletedAt != null) {
      removeQuickBarRecentEntry(entry.id)
    }
    return 'added'
  }

  const nextDeletedAt = entry.deletedAt
  const wasActive = existing.deleted_at == null
  const willBeActive = nextDeletedAt == null

  const totpSecret = entry.totpSecret?.trim() ?? ''
  db.run(
    `UPDATE password_entries
     SET title = ?, url = ?, username = ?, password_encrypted = ?, note = ?, category = ?, tags = ?,
         is_favorite = ?, display_icon = ?, local_program_path = ?, totp_secret_encrypted = ?, custom_fields = ?,
         last_used_at = ?, created_at = ?, updated_at = ?, deleted_at = ?
     WHERE id = ?`,
    [
      entry.title.trim(),
      entry.url?.trim() ?? '',
      entry.username?.trim() ?? '',
      encryptSecret(entry.password, key),
      entry.note?.trim() ?? '',
      resolveCategoryId(mappedCategoryId),
      JSON.stringify(entry.tags ?? []),
      entry.isFavorite ? 1 : 0,
      entry.displayIcon?.trim() ?? '',
      entry.localProgramPath?.trim() ?? '',
      totpSecret ? encryptSecret(totpSecret, key) : '',
      resolveSyncCustomFields(entry, existing),
      entry.lastUsedAt,
      entry.createdAt,
      entry.updatedAt,
      nextDeletedAt,
      entry.id,
    ],
  )

  if (wasActive && !willBeActive) {
    removeQuickBarRecentEntry(entry.id)
  }

  if (!wasActive && willBeActive) {
    return 'updated'
  }
  if (wasActive && !willBeActive) {
    return 'removed'
  }
  return 'updated'
}

const FOLDER_SYNC_SETTINGS_KEY = 'folder_sync_settings'

function readFolderSyncPath(): string | null {
  const raw = getSetting(FOLDER_SYNC_SETTINGS_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { enabled?: boolean; folderPath?: string | null }
    if (!parsed.enabled || !parsed.folderPath) return null
    return parsed.folderPath
  } catch {
    return null
  }
}

function finalizeAttachmentFileSync(merged: SyncBundle): void {
  const folderPath = readFolderSyncPath()
  if (folderPath) {
    syncAttachmentFilesAfterMerge(merged, folderPath)
    return
  }
  syncAttachmentFilesAfterMerge(merged, getSyncServerDir())
}

function applyMergedBundle(merged: SyncBundle): Omit<SyncMergeResult, 'conflicts' | 'revision'> {
  const categoryRemap = ensureCategoriesFromImport(merged.categories)
  let added = 0
  let updated = 0
  let removed = 0

  for (const entry of merged.entries) {
    if (!entry.title?.trim() || !entry.password) continue
    const outcome = upsertSyncEntry(entry, categoryRemap)
    if (outcome === 'added') added += 1
    else if (outcome === 'updated') updated += 1
    else if (outcome === 'removed') removed += 1
  }

  persistDatabase()
  applyMergedAttachments(merged)
  finalizeAttachmentFileSync(merged)
  return { added, updated, removed }
}

export function mergeRemoteBundle(remote: SyncBundle): SyncMergeResult {
  assertUnlocked()
  const local = buildSyncBundle(getSyncRevision())
  const { merged, conflicts } = mergeSyncBundles(local, remote)
  const applied = applyMergedBundle(merged)
  recordSyncSuccess(merged.revision)

  return {
    ...applied,
    conflicts,
    revision: merged.revision,
  }
}

export function mergeEncryptedRemoteBundle(
  buffer: Buffer,
  masterPasswordOrKey: string | Buffer,
): SyncMergeResult {
  try {
    const remote = decryptBundleFromTransport(buffer, masterPasswordOrKey)
    return mergeRemoteBundle(remote)
  } catch (error) {
    const message = error instanceof Error ? error.message : ErrorCode.OPERATION_FAILED
    recordSyncError(message)
    throw error
  }
}

export function mergeAndPublish(
  remote: SyncBundle,
  masterPassword: string,
): SyncMergeResult & { encrypted: Buffer; sizeBytes: number } {
  const result = mergeRemoteBundle(remote)
  const bundle = buildSyncBundle(result.revision)
  const encrypted = encryptBundleForTransport(bundle, masterPassword)
  writeEncryptedBundleToServer(encrypted)
  syncAttachmentFilesAfterMerge(bundle, getSyncServerDir())
  return {
    ...result,
    encrypted,
    sizeBytes: encrypted.length,
  }
}
