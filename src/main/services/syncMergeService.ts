import { encryptSecret } from '../crypto/vaultCrypto'
import { getDatabase, persistDatabase } from '../db/database'
import { readEntryRow } from '../db/helpers'
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

function assertUnlocked(): void {
  if (!isUnlocked()) throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)
}

function upsertSyncEntry(entry: SyncEntry, categoryRemap: Map<string, string>): 'added' | 'updated' | 'removed' | 'unchanged' {
  const key = getSessionKey()
  const db = getDatabase()
  const existing = readEntryRow(entry.id)
  const mappedCategoryId = categoryRemap.get(entry.categoryId) ?? entry.categoryId

  if (!existing) {
    db.run(
      `INSERT INTO password_entries
        (id, title, url, username, password_encrypted, note, category, tags, is_favorite, display_icon, local_program_path, last_used_at, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  db.run(
    `UPDATE password_entries
     SET title = ?, url = ?, username = ?, password_encrypted = ?, note = ?, category = ?, tags = ?,
         is_favorite = ?, display_icon = ?, local_program_path = ?, last_used_at = ?, created_at = ?,
         updated_at = ?, deleted_at = ?
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

export function mergeEncryptedRemoteBundle(buffer: Buffer, masterPassword: string): SyncMergeResult {
  try {
    const remote = decryptBundleFromTransport(buffer, masterPassword)
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
  return {
    ...result,
    encrypted,
    sizeBytes: encrypted.length,
  }
}
