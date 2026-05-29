import archiverImport from 'archiver'
import archiverZipEncrypted from 'archiver-zip-encrypted'
import { buildExcelBuffer } from './exportExcelService'
import type { ExportPayload } from '../../shared/types'

type ArchiverVending = typeof archiverImport & {
  registerFormat: (format: string, module: unknown) => void
  create: (
    format: string,
    options: Record<string, unknown>,
  ) => NodeJS.ReadWriteStream & {
    append: (source: string | Buffer, data: { name: string }) => void
    finalize: () => void
    on: (event: string, handler: (...args: unknown[]) => void) => void
  }
}

const archiver = archiverImport as ArchiverVending

let formatRegistered = false

function ensureZipEncryptedFormat(): void {
  if (formatRegistered) return
  archiver.registerFormat('zip-encrypted', archiverZipEncrypted)
  formatRegistered = true
}

export function createPasswordProtectedBackupZip(
  payload: ExportPayload,
  password: string,
): Promise<{ buffer: Buffer; sizeBytes: number }> {
  ensureZipEncryptedFormat()

  const json = JSON.stringify(payload, null, 2)
  const excelBuffer = buildExcelBuffer(payload)
  const date = payload.exportedAt.slice(0, 10)
  const jsonName = `pwdbook-backup-${date}.json`
  const excelName = `pwdbook-backup-${date}.xlsx`

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const archive = archiver.create('zip-encrypted', {
      zlib: { level: 9 },
      encryptionMethod: 'aes256',
      password,
    })

    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    archive.on('error', reject)
    archive.on('end', () => {
      const buffer = Buffer.concat(chunks)
      resolve({ buffer, sizeBytes: buffer.length })
    })

    archive.append(json, { name: jsonName })
    archive.append(excelBuffer, { name: excelName })
    void archive.finalize()
  })
}
