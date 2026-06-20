import fs from 'fs'
import path from 'path'
import { getDatabase, persistDatabase } from '../db/database'
import { readAllAttachmentRows } from '../db/helpers'
import type { SyncAttachmentMeta, SyncBundle } from '../../shared/syncTypes'
import { mergeSyncAttachments } from '../../shared/syncMerge'
import {
  ATTACHMENT_FILE_EXT,
  SYNC_ATTACHMENT_FILE_EXT,
  deleteAttachmentFile,
  gcOrphanAttachmentFiles,
  getAttachmentFilePath,
  getAttachmentsDir,
  getSyncAttachmentFilePath,
  importAttachmentFromEncryptedFile,
  readAttachmentDeletionTombstones,
  replaceAttachmentDeletionTombstones,
  upsertAttachmentMetadata,
} from './attachmentService'

export function buildSyncAttachmentsFromDb(): SyncAttachmentMeta[] {
  return readAllAttachmentRows().map((row) => ({
    id: row.id,
    entryId: row.entry_id,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

function ensureRemoteAttachmentsDir(remoteDir: string): string {
  const dir = path.join(remoteDir, 'attachments')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function publishLocalAttachmentsToDir(remoteDir: string, attachmentIds: Iterable<string>): void {
  const remoteAttachmentsDir = ensureRemoteAttachmentsDir(remoteDir)
  for (const id of attachmentIds) {
    const localPath = getAttachmentFilePath(id)
    if (!fs.existsSync(localPath)) continue
    const remotePath = path.join(remoteAttachmentsDir, `${id}${SYNC_ATTACHMENT_FILE_EXT}`)
    fs.copyFileSync(localPath, remotePath)
  }
}

export function pullMissingAttachmentsFromDir(
  remoteDir: string,
  attachments: SyncAttachmentMeta[],
): void {
  const remoteAttachmentsDir = path.join(remoteDir, 'attachments')
  if (!fs.existsSync(remoteAttachmentsDir)) return

  for (const meta of attachments) {
    const localPath = getAttachmentFilePath(meta.id)
    const remotePath = getSyncAttachmentFilePath(remoteDir, meta.id)
    if (!fs.existsSync(remotePath)) continue

    const localExists = fs.existsSync(localPath)
    if (!localExists) {
      importAttachmentFromEncryptedFile(
        meta.entryId,
        meta.id,
        meta.filename,
        meta.mimeType,
        meta.sizeBytes,
        meta.createdAt,
        meta.updatedAt,
        remotePath,
      )
      continue
    }

    const localRow = readAllAttachmentRows().find((row) => row.id === meta.id)
    if (localRow && meta.updatedAt > localRow.updated_at) {
      importAttachmentFromEncryptedFile(
        meta.entryId,
        meta.id,
        meta.filename,
        meta.mimeType,
        meta.sizeBytes,
        meta.createdAt,
        meta.updatedAt,
        remotePath,
      )
    }
  }
  persistDatabase()
}

export function gcRemoteAttachmentFiles(remoteDir: string, validIds: Set<string>): void {
  const remoteAttachmentsDir = path.join(remoteDir, 'attachments')
  if (!fs.existsSync(remoteAttachmentsDir)) return
  for (const name of fs.readdirSync(remoteAttachmentsDir)) {
    if (!name.endsWith(SYNC_ATTACHMENT_FILE_EXT)) continue
    const id = name.slice(0, -SYNC_ATTACHMENT_FILE_EXT.length)
    if (!validIds.has(id)) {
      fs.unlinkSync(path.join(remoteAttachmentsDir, name))
    }
  }
}

export function applyMergedAttachments(merged: SyncBundle): void {
  const mergedAttachments = merged.attachments ?? []
  const localAttachments = buildSyncAttachmentsFromDb()
  const { merged: attachmentManifest, mergedDeletions } = mergeSyncAttachments(
    localAttachments,
    mergedAttachments,
    {
      localDeletions: readAttachmentDeletionTombstones(),
      remoteDeletions: merged.attachmentDeletions,
    },
  )

  const db = getDatabase()
  const mergedIds = new Set(attachmentManifest.map((item) => item.id))
  const localIds = new Set(localAttachments.map((item) => item.id))

  for (const meta of attachmentManifest) {
    upsertAttachmentMetadata(
      meta.entryId,
      meta.id,
      meta.filename,
      meta.mimeType,
      meta.sizeBytes,
      meta.createdAt,
      meta.updatedAt,
    )
  }

  for (const local of localAttachments) {
    if (!mergedIds.has(local.id)) {
      db.run('DELETE FROM entry_attachments WHERE id = ?', [local.id])
      deleteAttachmentFile(local.id)
    }
  }

  replaceAttachmentDeletionTombstones(mergedDeletions)
  persistDatabase()
  gcOrphanAttachmentFiles(mergedIds)

  for (const meta of attachmentManifest) {
    if (!localIds.has(meta.id) || !fs.existsSync(getAttachmentFilePath(meta.id))) {
      // file may be pulled separately
    }
  }
}

export function syncAttachmentFilesAfterMerge(merged: SyncBundle, remoteDir: string): void {
  const manifest = merged.attachments ?? []
  const validIds = new Set(manifest.map((item) => item.id))
  publishLocalAttachmentsToDir(remoteDir, validIds)
  pullMissingAttachmentsFromDir(remoteDir, manifest)
  gcRemoteAttachmentFiles(remoteDir, validIds)
}

export function syncAttachmentsAfterMerge(merged: SyncBundle, remoteDir: string): void {
  applyMergedAttachments(merged)
  syncAttachmentFilesAfterMerge(merged, remoteDir)
}

export function listLocalEncryptedAttachmentFiles(): { id: string; path: string }[] {
  const dir = getAttachmentsDir()
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(ATTACHMENT_FILE_EXT))
    .map((name) => ({
      id: name.slice(0, -ATTACHMENT_FILE_EXT.length),
      path: path.join(dir, name),
    }))
}
