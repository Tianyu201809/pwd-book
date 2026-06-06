import { randomUUID } from 'crypto'
import {
  deriveSessionKey,
  deriveSyncTransportKey,
  encryptSecret,
  hashMasterPassword,
  verifyMasterPassword,
  createMasterSalt,
} from '../crypto/vaultCrypto'
import { resetDatabaseFile } from '../db/database'
import { getSetting, readActiveEntryRow, readActiveEntryRows, readEntryRow, setSetting } from '../db/helpers'
import { getSessionKey, isUnlocked, lockSession, unlockSession } from './sessionService'
import type { PasswordEntry, PasswordEntryInput, VaultStatus } from '../../shared/types'
import { appError, ErrorCode } from '../../shared/errors'
import { getDatabase, persistDatabase } from '../db/database'
import { ensureCategoriesFromImport, resolveCategoryId } from './categoryService'
import { rowToEntry } from './entryMapper'
import type { VaultImportPayload } from '../../shared/types'
import { getLockedEntryCount, isRecoveryKeyConfigured } from './recoveryService'
import { recordQuickBarRecentEntry, removeQuickBarRecentEntry } from './quickBarRecentService'
import { getTrashCount, moveEntryToTrash, purgeExpiredTrash } from './trashService'

const MASTER_SALT_KEY = 'master_salt'
const MASTER_HASH_KEY = 'master_hash'

export function getVaultStatus(): VaultStatus {
  return {
    initialized: Boolean(getSetting(MASTER_HASH_KEY)),
    unlocked: isUnlocked(),
    recoveryConfigured: isRecoveryKeyConfigured(),
    entryCount: getLockedEntryCount(),
    trashCount: getTrashCount(),
  }
}

export function setupVault(masterPassword: string, confirmPassword: string): void {
  if (masterPassword.length < 4) {
    throw appError(ErrorCode.MASTER_PASSWORD_TOO_SHORT)
  }
  if (masterPassword !== confirmPassword) {
    throw appError(ErrorCode.MASTER_PASSWORD_MISMATCH)
  }
  if (getSetting(MASTER_HASH_KEY)) {
    throw appError(ErrorCode.VAULT_ALREADY_INITIALIZED)
  }

  const salt = createMasterSalt()
  const hash = hashMasterPassword(masterPassword, salt)
  setSetting(MASTER_SALT_KEY, salt)
  setSetting(MASTER_HASH_KEY, hash)
  unlockSession(
    deriveSessionKey(masterPassword, salt),
    deriveSyncTransportKey(masterPassword),
  )
}

export function unlockVault(masterPassword: string): void {
  const salt = getSetting(MASTER_SALT_KEY)
  const hash = getSetting(MASTER_HASH_KEY)
  if (!salt || !hash) {
    throw appError(ErrorCode.MASTER_PASSWORD_NOT_CREATED)
  }
  if (!verifyMasterPassword(masterPassword, salt, hash)) {
    throw appError(ErrorCode.WRONG_MASTER_PASSWORD)
  }
  unlockSession(
    deriveSessionKey(masterPassword, salt),
    deriveSyncTransportKey(masterPassword),
  )
}

export function lockVault(): void {
  lockSession()
}

export function resetVault(): void {
  lockSession()
  resetDatabaseFile()
}

export function listEntries(): PasswordEntry[] {
  purgeExpiredTrash()
  return readActiveEntryRows().map(rowToEntry)
}

export function getEntryById(id: string): PasswordEntry | null {
  const row = readActiveEntryRow(id)
  if (!row) return null
  return rowToEntry(row)
}

export function createEntry(input: PasswordEntryInput): PasswordEntry {
  const key = getSessionKey()
  const now = Date.now()
  const id = randomUUID()
  const db = getDatabase()

  db.run(
    `INSERT INTO password_entries
      (id, title, url, username, password_encrypted, note, category, tags, is_favorite, display_icon, local_program_path, last_used_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.title.trim(),
      input.url?.trim() ?? '',
      input.username?.trim() ?? '',
      encryptSecret(input.password, key),
      input.note?.trim() ?? '',
      resolveCategoryId(input.categoryId),
      JSON.stringify(input.tags ?? []),
      input.isFavorite ? 1 : 0,
      input.displayIcon?.trim() ?? '',
      input.localProgramPath?.trim() ?? '',
      null,
      now,
      now,
    ],
  )
  persistDatabase()
  const row = readEntryRow(id)
  if (!row) throw appError(ErrorCode.ENTRY_CREATE_FAILED)
  return rowToEntry(row)
}

export function updateEntry(id: string, input: PasswordEntryInput): PasswordEntry {
  const key = getSessionKey()
  const db = getDatabase()
  const now = Date.now()
  const existing = readActiveEntryRow(id)
  if (!existing) throw appError(ErrorCode.ENTRY_NOT_FOUND)

  db.run(
    `UPDATE password_entries
     SET title = ?, url = ?, username = ?, password_encrypted = ?, note = ?, category = ?, tags = ?, is_favorite = ?, display_icon = ?, local_program_path = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.title.trim(),
      input.url?.trim() ?? '',
      input.username?.trim() ?? '',
      encryptSecret(input.password, key),
      input.note?.trim() ?? '',
      resolveCategoryId(input.categoryId ?? existing.category),
      JSON.stringify(input.tags ?? JSON.parse(existing.tags || '[]')),
      input.isFavorite ? 1 : 0,
      input.displayIcon?.trim() ?? existing.display_icon,
      input.localProgramPath?.trim() ?? existing.local_program_path,
      now,
      id,
    ],
  )
  persistDatabase()
  const row = readEntryRow(id)
  if (!row) throw appError(ErrorCode.ENTRY_UPDATE_FAILED)
  return rowToEntry(row)
}

export function deleteEntry(id: string): void {
  moveEntryToTrash(id)
  removeQuickBarRecentEntry(id)
}

export function toggleFavorite(id: string): PasswordEntry {
  const db = getDatabase()
  const row = readActiveEntryRow(id)
  if (!row) throw appError(ErrorCode.ENTRY_NOT_FOUND)
  const next = row.is_favorite === 1 ? 0 : 1
  db.run('UPDATE password_entries SET is_favorite = ?, updated_at = ? WHERE id = ?', [
    next,
    Date.now(),
    id,
  ])
  persistDatabase()
  const updated = readActiveEntryRow(id)
  if (!updated) throw appError(ErrorCode.FAVORITE_UPDATE_FAILED)
  return rowToEntry(updated)
}

export function touchEntry(id: string): void {
  if (!readActiveEntryRow(id)) throw appError(ErrorCode.ENTRY_NOT_FOUND)
  const db = getDatabase()
  const now = Date.now()
  db.run(
    'UPDATE password_entries SET last_used_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
    [now, now, id],
  )
  persistDatabase()
  recordQuickBarRecentEntry(id)
}

export function importFromExportPayload(payload: VaultImportPayload): number {
  const idRemap = ensureCategoriesFromImport(payload.categories ?? [])
  let count = 0

  payload.entries.forEach((entry) => {
    if (!entry.title?.trim() || !entry.password) return

    const importCategoryId = entry.categoryId?.trim()
    const mappedCategoryId = importCategoryId ? idRemap.get(importCategoryId) : undefined

    createEntry({
      ...entry,
      categoryId: mappedCategoryId ?? importCategoryId,
    })
    count += 1
  })

  return count
}

/** @deprecated Use importFromExportPayload */
export function importEntries(entries: PasswordEntryInput[]): number {
  return importFromExportPayload({ entries })
}
