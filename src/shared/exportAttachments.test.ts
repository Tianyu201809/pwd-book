import { describe, expect, it } from 'vitest'
import { normalizeExportAttachment, parseExportAttachmentsFromPayload } from './exportAttachments'
import { parsePwdbookJson } from './importNormalize'
import type { ExportPayload } from './types'

describe('exportAttachments', () => {
  it('normalizes attachment records from export payload', () => {
    const payload: ExportPayload = {
      exportedAt: '2026-01-01T00:00:00.000Z',
      categories: [],
      entries: [],
      attachments: [
        {
          id: 'att-1',
          entryId: 'entry-1',
          filename: 'note.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4,
          createdAt: 1,
          updatedAt: 2,
          dataBase64: 'dGVzdA==',
        },
      ],
    }

    expect(parseExportAttachmentsFromPayload(payload)).toHaveLength(1)
    expect(normalizeExportAttachment(payload.attachments![0])).toMatchObject({
      id: 'att-1',
      entryId: 'entry-1',
      filename: 'note.pdf',
      dataBase64: 'dGVzdA==',
    })
  })

  it('parses attachments from pwdbook json content', () => {
    const content = JSON.stringify({
      exportedAt: '2026-01-01T00:00:00.000Z',
      categories: [],
      entries: [
        {
          id: 'entry-1',
          title: 'Site',
          password: 'secret',
        },
      ],
      attachments: [
        {
          id: 'att-1',
          entryId: 'entry-1',
          filename: 'scan.png',
          mimeType: 'image/png',
          sizeBytes: 8,
          createdAt: 10,
          updatedAt: 10,
          dataBase64: 'aW1hZ2U=',
        },
      ],
    })

    const parsed = parsePwdbookJson(content)
    expect(parsed.entries[0]?.id).toBe('entry-1')
    expect(parsed.attachments).toHaveLength(1)
    expect(parsed.attachments[0]?.filename).toBe('scan.png')
  })
})
