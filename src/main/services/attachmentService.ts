import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { encryptBuffer, decryptBuffer } from '../crypto/vaultCrypto'
import { getDatabase, persistDatabase } from '../db/database'
import {
  countAttachmentsForEntry,
  getSetting,
  readActiveEntryRow,
  readAttachmentRow,
  readAttachmentRowsForEntry,
  readAllAttachmentRows,
  setSetting,
  type AttachmentRow,
} from '../db/helpers'
import { getSessionKey, isUnlocked } from './sessionService'
import type { EntryAttachmentMeta } from '../../shared/types'
import { SYNC_ATTACHMENT_FILE_EXT } from '../../shared/syncTypes'
import { appError, ErrorCode } from '../../shared/errors'

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
export const MAX_ATTACHMENTS_PER_ENTRY = 10
export const ATTACHMENT_FILE_EXT = '.enc'
export const ATTACHMENT_DELETION_TOMBSTONES_KEY = 'attachment_deletion_tombstones'
export { SYNC_ATTACHMENT_FILE_EXT }

function assertUnlocked(): void {
  if (!isUnlocked()) throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)
}

export function getAttachmentsDir(): string {
  return path.join(app.getPath('userData'), 'attachments')
}

export function getAttachmentFilePath(attachmentId: string): string {
  return path.join(getAttachmentsDir(), `${attachmentId}${ATTACHMENT_FILE_EXT}`)
}

export function getSyncAttachmentFilePath(dir: string, attachmentId: string): string {
  return path.join(dir, 'attachments', `${attachmentId}${SYNC_ATTACHMENT_FILE_EXT}`)
}

function rowToMeta(row: AttachmentRow): EntryAttachmentMeta {
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  }
}

function readAttachmentDeletionTombstoneMap(): Record<string, number> {
  const raw = getSetting(ATTACHMENT_DELETION_TOMBSTONES_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, number>
  } catch {
    return {}
  }
}

export function readAttachmentDeletionTombstones(): { id: string; deletedAt: number }[] {
  return Object.entries(readAttachmentDeletionTombstoneMap()).map(([id, deletedAt]) => ({
    id,
    deletedAt,
  }))
}

export function replaceAttachmentDeletionTombstones(
  tombstones: { id: string; deletedAt: number }[],
): void {
  if (tombstones.length === 0) {
    setSetting(ATTACHMENT_DELETION_TOMBSTONES_KEY, '')
    return
  }
  const map: Record<string, number> = {}
  for (const tombstone of tombstones) {
    map[tombstone.id] = tombstone.deletedAt
  }
  setSetting(ATTACHMENT_DELETION_TOMBSTONES_KEY, JSON.stringify(map))
}

export function recordAttachmentDeletion(attachmentId: string): void {
  const tombstones = readAttachmentDeletionTombstoneMap()
  tombstones[attachmentId] = Date.now()
  setSetting(ATTACHMENT_DELETION_TOMBSTONES_KEY, JSON.stringify(tombstones))
}

function recordAttachmentDeletions(attachmentIds: string[]): void {
  if (attachmentIds.length === 0) return
  const tombstones = readAttachmentDeletionTombstoneMap()
  const now = Date.now()
  for (const attachmentId of attachmentIds) {
    tombstones[attachmentId] = now
  }
  setSetting(ATTACHMENT_DELETION_TOMBSTONES_KEY, JSON.stringify(tombstones))
}

function guessMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.zip': 'application/zip',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  return map[ext] ?? 'application/octet-stream'
}

export function listAttachments(entryId: string): EntryAttachmentMeta[] {
  assertUnlocked()
  return readAttachmentRowsForEntry(entryId).map(rowToMeta)
}

export function listAllAttachmentRows(): AttachmentRow[] {
  assertUnlocked()
  return readAllAttachmentRows()
}

export function getAttachmentCount(entryId: string): number {
  return countAttachmentsForEntry(entryId)
}

export function readAttachmentBuffer(attachmentId: string): Buffer {
  assertUnlocked()
  const row = readAttachmentRow(attachmentId)
  if (!row) throw appError(ErrorCode.ATTACHMENT_NOT_FOUND)

  const filePath = getAttachmentFilePath(attachmentId)
  if (!fs.existsSync(filePath)) throw appError(ErrorCode.ATTACHMENT_NOT_FOUND)

  try {
    const encrypted = fs.readFileSync(filePath, 'utf8')
    return decryptBuffer(encrypted, getSessionKey())
  } catch {
    throw appError(ErrorCode.ATTACHMENT_READ_FAILED)
  }
}

export function writeEncryptedAttachmentFile(attachmentId: string, data: Buffer): void {
  const dir = getAttachmentsDir()
  fs.mkdirSync(dir, { recursive: true })
  const encrypted = encryptBuffer(data, getSessionKey())
  fs.writeFileSync(getAttachmentFilePath(attachmentId), encrypted)
}

export function addAttachment(entryId: string, sourcePath: string): EntryAttachmentMeta {
  assertUnlocked()
  if (!readActiveEntryRow(entryId)) throw appError(ErrorCode.ENTRY_NOT_FOUND)

  const count = countAttachmentsForEntry(entryId)
  if (count >= MAX_ATTACHMENTS_PER_ENTRY) {
    throw appError(ErrorCode.ATTACHMENT_LIMIT_REACHED, { limit: MAX_ATTACHMENTS_PER_ENTRY })
  }

  let data: Buffer
  try {
    data = fs.readFileSync(sourcePath)
  } catch {
    throw appError(ErrorCode.ATTACHMENT_READ_FAILED)
  }

  if (data.length === 0) throw appError(ErrorCode.ATTACHMENT_READ_FAILED)
  if (data.length > MAX_ATTACHMENT_BYTES) {
    throw appError(ErrorCode.ATTACHMENT_TOO_LARGE, { maxMb: 5 })
  }

  const id = randomUUID()
  const filename = path.basename(sourcePath)
  const mimeType = guessMimeType(filename)
  const now = Date.now()

  writeEncryptedAttachmentFile(id, data)

  const db = getDatabase()
  db.run(
    `INSERT INTO entry_attachments
      (id, entry_id, filename, mime_type, size_bytes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, entryId, filename, mimeType, data.length, now, now],
  )
  persistDatabase()

  const row = readAttachmentRow(id)
  if (!row) throw appError(ErrorCode.OPERATION_FAILED)
  return rowToMeta(row)
}

export function deleteAttachmentFile(attachmentId: string): void {
  const filePath = getAttachmentFilePath(attachmentId)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

export function deleteAttachment(attachmentId: string): void {
  assertUnlocked()
  const row = readAttachmentRow(attachmentId)
  if (!row) throw appError(ErrorCode.ATTACHMENT_NOT_FOUND)

  recordAttachmentDeletion(attachmentId)

  const db = getDatabase()
  db.run('DELETE FROM entry_attachments WHERE id = ?', [attachmentId])
  deleteAttachmentFile(attachmentId)
  persistDatabase()
}

export function deleteAttachmentsForEntry(entryId: string): void {
  const rows = readAttachmentRowsForEntry(entryId)
  if (rows.length === 0) return

  recordAttachmentDeletions(rows.map((row) => row.id))

  const db = getDatabase()
  db.run('DELETE FROM entry_attachments WHERE entry_id = ?', [entryId])
  rows.forEach((row) => deleteAttachmentFile(row.id))
  persistDatabase()
}

export function deleteAttachmentsForEntries(entryIds: string[]): void {
  if (entryIds.length === 0) return
  const attachmentIds: string[] = []
  entryIds.forEach((entryId) => {
    const rows = readAttachmentRowsForEntry(entryId)
    rows.forEach((row) => {
      attachmentIds.push(row.id)
      deleteAttachmentFile(row.id)
    })
  })
  recordAttachmentDeletions(attachmentIds)
  const db = getDatabase()
  const placeholders = entryIds.map(() => '?').join(', ')
  db.run(`DELETE FROM entry_attachments WHERE entry_id IN (${placeholders})`, entryIds)
  persistDatabase()
}

export function writeDecryptedToTemp(attachmentId: string): string {
  assertUnlocked()
  const row = readAttachmentRow(attachmentId)
  if (!row) throw appError(ErrorCode.ATTACHMENT_NOT_FOUND)

  const data = readAttachmentBuffer(attachmentId)
  const tempDir = path.join(app.getPath('temp'), 'pwdbook-attachments', randomUUID())
  fs.mkdirSync(tempDir, { recursive: true })
  const outPath = path.join(tempDir, row.filename)
  fs.writeFileSync(outPath, data)
  return outPath
}

export function importAttachmentFromEncryptedFile(
  entryId: string,
  attachmentId: string,
  filename: string,
  mimeType: string,
  sizeBytes: number,
  createdAt: number,
  updatedAt: number,
  encryptedFilePath: string,
): void {
  assertUnlocked()
  const existing = readAttachmentRow(attachmentId)
  const db = getDatabase()
  const dest = getAttachmentFilePath(attachmentId)
  fs.mkdirSync(getAttachmentsDir(), { recursive: true })
  fs.copyFileSync(encryptedFilePath, dest)

  if (existing) {
    db.run(
      `UPDATE entry_attachments
       SET entry_id = ?, filename = ?, mime_type = ?, size_bytes = ?, created_at = ?, updated_at = ?
       WHERE id = ?`,
      [entryId, filename, mimeType, sizeBytes, createdAt, updatedAt, attachmentId],
    )
  } else {
    db.run(
      `INSERT INTO entry_attachments
        (id, entry_id, filename, mime_type, size_bytes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [attachmentId, entryId, filename, mimeType, sizeBytes, createdAt, updatedAt],
    )
  }
}

export function upsertAttachmentMetadata(
  entryId: string,
  attachmentId: string,
  filename: string,
  mimeType: string,
  sizeBytes: number,
  createdAt: number,
  updatedAt: number,
): void {
  const existing = readAttachmentRow(attachmentId)
  const db = getDatabase()
  if (existing) {
    db.run(
      `UPDATE entry_attachments
       SET entry_id = ?, filename = ?, mime_type = ?, size_bytes = ?, created_at = ?, updated_at = ?
       WHERE id = ?`,
      [entryId, filename, mimeType, sizeBytes, createdAt, updatedAt, attachmentId],
    )
  } else {
    db.run(
      `INSERT INTO entry_attachments
        (id, entry_id, filename, mime_type, size_bytes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [attachmentId, entryId, filename, mimeType, sizeBytes, createdAt, updatedAt],
    )
  }
}

export function gcOrphanAttachmentFiles(validIds: Set<string>): void {
  const dir = getAttachmentsDir()
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(ATTACHMENT_FILE_EXT)) continue
    const id = name.slice(0, -ATTACHMENT_FILE_EXT.length)
    if (!validIds.has(id)) {
      fs.unlinkSync(path.join(dir, name))
    }
  }
}
