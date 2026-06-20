import type { ExportAttachment, ExportPayload } from './types'

export function normalizeExportAttachment(raw: unknown): ExportAttachment | null {
  if (!raw || typeof raw !== 'object') return null

  const record = raw as Record<string, unknown>
  const entryId = String(record.entryId ?? record.entry_id ?? '').trim()
  const filename = String(record.filename ?? '').trim()
  const dataBase64 = String(record.dataBase64 ?? record.data_base64 ?? '').trim()
  const id = String(record.id ?? '').trim()

  if (!entryId || !filename || !dataBase64 || !id) return null

  return {
    id,
    entryId,
    filename,
    mimeType: String(record.mimeType ?? record.mime_type ?? 'application/octet-stream'),
    sizeBytes: Number(record.sizeBytes ?? record.size_bytes ?? 0) || 0,
    createdAt: Number(record.createdAt ?? record.created_at ?? Date.now()),
    updatedAt: Number(record.updatedAt ?? record.updated_at ?? Date.now()),
    dataBase64,
  }
}

export function parseExportAttachmentsFromPayload(parsed: ExportPayload): ExportAttachment[] {
  const attachments: ExportAttachment[] = []
  for (const raw of parsed.attachments ?? []) {
    const normalized = normalizeExportAttachment(raw)
    if (normalized) attachments.push(normalized)
  }
  return attachments
}
