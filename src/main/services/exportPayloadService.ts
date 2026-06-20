import { listCategories } from './categoryService'
import { listEntries } from './vaultService'
import { buildSyncAttachmentsFromDb } from './attachmentSyncService'
import { readAttachmentBuffer } from './attachmentService'
import {
  EXPORT_PAYLOAD_VERSION,
  type ExportAttachment,
  type ExportPayload,
} from '../../shared/types'

function buildExportAttachments(): ExportAttachment[] {
  const metas = buildSyncAttachmentsFromDb()
  return metas.map((meta) => {
    const data = readAttachmentBuffer(meta.id)
    return {
      id: meta.id,
      entryId: meta.entryId,
      filename: meta.filename,
      mimeType: meta.mimeType,
      sizeBytes: data.length,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      dataBase64: data.toString('base64'),
    }
  })
}

export function buildExportPayload(): ExportPayload {
  const attachments = buildExportAttachments()
  return {
    version: EXPORT_PAYLOAD_VERSION,
    exportedAt: new Date().toISOString(),
    categories: listCategories(),
    entries: listEntries(),
    ...(attachments.length > 0 ? { attachments } : {}),
  }
}
