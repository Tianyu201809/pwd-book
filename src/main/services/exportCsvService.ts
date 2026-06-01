import { appError, ErrorCode } from '../../shared/errors'
import { entriesToCsv } from '../../shared/exportParsers'
import { getExportFormat, type ExportFormatId } from '../../shared/exportFormats'
import { isUnlocked } from './sessionService'
import { listEntries } from './vaultService'

export function buildExportCsv(formatId: ExportFormatId): string {
  if (!isUnlocked()) throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)
  if (!getExportFormat(formatId)) throw appError(ErrorCode.OPERATION_FAILED)
  return entriesToCsv(formatId, listEntries())
}
