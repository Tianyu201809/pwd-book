import { appError, ErrorCode } from '../../shared/errors'
import { buildCsvForDestination } from '../../shared/exportParsers'
import { getExportDestination, type CsvExportId } from '../../shared/exportFormats'
import { isUnlocked } from './sessionService'
import { listEntries } from './vaultService'

export function buildExportCsv(formatId: CsvExportId): string {
  if (!isUnlocked()) throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)
  if (!getExportDestination(formatId)) throw appError(ErrorCode.OPERATION_FAILED)
  return buildCsvForDestination(formatId, listEntries())
}
