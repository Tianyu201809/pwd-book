import { appError, ErrorCode } from '../../shared/errors'
import { fingerprintFromInput, entryFingerprint } from '../../shared/importDedup'
import { parseImportContent } from '../../shared/importParsers'
import { getImportSource, isPwdbookNativeImport, type ImportSourceId } from '../../shared/importSources'
import type {
  ImportCommitRequest,
  ImportPreviewItem,
  ImportPreviewRequest,
  ImportPreviewResult,
  PasswordEntryInput,
} from '../../shared/types'
import { ensureCategoryByDisplayName } from './categoryService'
import { isUnlocked } from './sessionService'
import { createEntry, importFromExportPayload } from './vaultService'
import { readEntryRows } from '../db/helpers'

function assertUnlocked(): void {
  if (!isUnlocked()) throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)
}

function loadVaultFingerprints(): Map<string, string> {
  const map = new Map<string, string>()
  for (const row of readEntryRows()) {
    const fp = entryFingerprint(row.title, row.username, row.url)
    map.set(fp, row.title)
  }
  return map
}

function classifyRows(
  sourceId: ImportSourceId,
  rows: ReturnType<typeof parseImportContent>['rows'],
  sourceCategoryName: string,
): ImportPreviewResult {
  const vaultFp = loadVaultFingerprints()
  const seenInFile = new Map<string, number>()
  const ready: ImportPreviewItem[] = []
  const skipped: ImportPreviewItem[] = []
  const invalid: ImportPreviewItem[] = []

  const useSourceCategory = !isPwdbookNativeImport(sourceId)

  for (const parsed of rows) {
    const base = {
      row: parsed.row,
      title: parsed.entry?.title?.trim() ?? '',
      username: parsed.entry?.username?.trim() ?? '',
      url: parsed.entry?.url?.trim() ?? '',
    }

    if (!parsed.entry || parsed.invalidReason) {
      invalid.push({
        ...base,
        title: base.title || `行 ${parsed.row}`,
        status: 'invalid',
        reason: parsed.invalidReason ?? 'missing_title',
      })
      continue
    }

    const entry: PasswordEntryInput = useSourceCategory
      ? { ...parsed.entry, categoryId: undefined }
      : { ...parsed.entry }

    const fp = fingerprintFromInput(entry)

    if (vaultFp.has(fp)) {
      skipped.push({
        ...base,
        status: 'duplicate',
        reason: 'duplicate_vault',
        matchTitle: vaultFp.get(fp),
      })
      continue
    }

    if (seenInFile.has(fp)) {
      skipped.push({
        ...base,
        status: 'duplicate',
        reason: 'duplicate_file',
        matchTitle: entry.title,
      })
      continue
    }

    seenInFile.set(fp, parsed.row)
    ready.push({
      ...base,
      status: 'ready',
      entry,
    })
  }

  return {
    sourceId,
    sourceCategoryName,
    ready,
    skipped,
    invalid,
    totals: {
      parsed: rows.length,
      ready: ready.length,
      skipped: skipped.length,
      invalid: invalid.length,
    },
  }
}

export function previewImport(request: ImportPreviewRequest): ImportPreviewResult {
  assertUnlocked()
  const sourceId = request.sourceId as ImportSourceId
  const meta = getImportSource(sourceId)
  if (!meta) throw appError(ErrorCode.OPERATION_FAILED)

  const parsed = parseImportContent(sourceId, request.content)
  const result = classifyRows(sourceId, parsed.rows, meta.categoryName)
  if (parsed.categories) {
    result.categories = parsed.categories
  }
  return result
}

export function commitImport(request: ImportCommitRequest): number {
  assertUnlocked()
  const sourceId = request.sourceId as ImportSourceId
  const meta = getImportSource(sourceId)
  if (!meta) throw appError(ErrorCode.OPERATION_FAILED)

  const entries = request.entries.filter((e) => e.title?.trim() && e.password)

  if (isPwdbookNativeImport(sourceId)) {
    return importFromExportPayload({
      categories: request.categories ?? [],
      entries,
    })
  }

  const categoryId = ensureCategoryByDisplayName(meta.categoryName)
  let count = 0
  for (const entry of entries) {
    createEntry({ ...entry, categoryId })
    count += 1
  }
  return count
}
