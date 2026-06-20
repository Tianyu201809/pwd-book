import { appError, ErrorCode } from '../../shared/errors'
import { getDatabase, persistDatabase } from '../db/database'
import {
  countTrashedEntries,
  readActiveEntryRow,
  readAttachmentCountsByEntry,
  readEntryRow,
  readTrashedEntryRows,
} from '../db/helpers'
import type { TrashedEntry } from '../../shared/types'
import { getSecuritySettings } from './settingsService'
import { rowToEntry } from './entryMapper'
import { deleteAttachmentsForEntries } from './attachmentService'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function getTrashRetentionDays(): number {
  return getSecuritySettings().trashRetentionDays
}

export function getTrashCount(): number {
  return countTrashedEntries()
}

function computeTrashMeta(deletedAt: number, retentionDays: number, now = Date.now()): {
  expiresAt: number
  daysRemaining: number
} {
  const expiresAt = deletedAt + retentionDays * MS_PER_DAY
  const daysRemaining = Math.max(0, Math.ceil((expiresAt - now) / MS_PER_DAY))
  return { expiresAt, daysRemaining }
}

export function purgeExpiredTrash(now = Date.now()): number {
  const retentionDays = getTrashRetentionDays()
  const cutoff = now - retentionDays * MS_PER_DAY
  const trashed = readTrashedEntryRows().filter((row) => row.deleted_at != null && row.deleted_at < cutoff)
  const entryIds = trashed.map((row) => row.id)
  const db = getDatabase()
  db.run('DELETE FROM password_entries WHERE deleted_at IS NOT NULL AND deleted_at < ?', [cutoff])
  const purged = db.getRowsModified()
  if (purged > 0) {
    deleteAttachmentsForEntries(entryIds)
    persistDatabase()
  }
  return purged
}

function rowToTrashedEntry(
  row: ReturnType<typeof readTrashedEntryRows>[number],
  retentionDays: number,
  attachmentCounts: Map<string, number>,
  now = Date.now(),
): TrashedEntry {
  const deletedAt = row.deleted_at!
  const { expiresAt, daysRemaining } = computeTrashMeta(deletedAt, retentionDays, now)
  return {
    ...rowToEntry(row, attachmentCounts.get(row.id) ?? 0),
    deletedAt,
    expiresAt,
    daysRemaining,
  }
}

export function listTrashedEntries(): TrashedEntry[] {
  purgeExpiredTrash()
  const retentionDays = getTrashRetentionDays()
  const now = Date.now()
  const attachmentCounts = readAttachmentCountsByEntry()
  return readTrashedEntryRows().map((row) =>
    rowToTrashedEntry(row, retentionDays, attachmentCounts, now),
  )
}

export function restoreTrashEntry(id: string): void {
  const row = readEntryRow(id)
  if (!row || row.deleted_at == null) {
    throw appError(ErrorCode.ENTRY_NOT_FOUND)
  }
  const now = Date.now()
  const db = getDatabase()
  db.run('UPDATE password_entries SET deleted_at = NULL, updated_at = ? WHERE id = ?', [now, id])
  persistDatabase()
}

export function restoreAllTrashEntries(): number {
  purgeExpiredTrash()
  const db = getDatabase()
  const now = Date.now()
  db.run(
    'UPDATE password_entries SET deleted_at = NULL, updated_at = ? WHERE deleted_at IS NOT NULL',
    [now],
  )
  const restored = db.getRowsModified()
  if (restored > 0) persistDatabase()
  return restored
}

export function permanentlyDeleteTrashEntry(id: string): void {
  const row = readEntryRow(id)
  if (!row || row.deleted_at == null) {
    throw appError(ErrorCode.ENTRY_NOT_FOUND)
  }
  deleteAttachmentsForEntries([id])
  const db = getDatabase()
  db.run('DELETE FROM password_entries WHERE id = ? AND deleted_at IS NOT NULL', [id])
  persistDatabase()
}

export function emptyTrash(): number {
  const trashed = readTrashedEntryRows()
  const entryIds = trashed.map((row) => row.id)
  deleteAttachmentsForEntries(entryIds)
  const db = getDatabase()
  db.run('DELETE FROM password_entries WHERE deleted_at IS NOT NULL')
  const deleted = db.getRowsModified()
  if (deleted > 0) persistDatabase()
  return deleted
}

export function moveEntryToTrash(id: string): void {
  const row = readActiveEntryRow(id)
  if (!row) throw appError(ErrorCode.ENTRY_NOT_FOUND)
  const now = Date.now()
  const db = getDatabase()
  db.run('UPDATE password_entries SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id])
  persistDatabase()
}
