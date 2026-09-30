import * as XLSX from 'xlsx'
import {
  entryToPwdBookRow,
  PWD_BOOK_CATEGORY_HEADERS,
  PWD_BOOK_ENTRY_HEADERS,
} from '../../shared/exportEntryColumns'
import { selectCategoriesForExport, selectEntriesForExport } from '../../shared/exportSelection'
import type { ExportPayload } from '../../shared/types'

export function buildExcelBuffer(payload: ExportPayload, entryIds?: string[]): Buffer {
  const entries = selectEntriesForExport(payload.entries, entryIds)
  const entryRows = entries.map(entryToPwdBookRow)

  const categories = selectCategoriesForExport(payload.categories, entries, entryIds !== undefined)
  const categoryRows = categories.map((cat) => [
    cat.id,
    cat.name,
    cat.icon,
    cat.sortOrder,
    cat.entryCount ?? 0,
  ])

  const workbook = XLSX.utils.book_new()
  const entriesSheet = XLSX.utils.aoa_to_sheet([
    PWD_BOOK_ENTRY_HEADERS as unknown as string[],
    ...entryRows,
  ])
  const categoriesSheet = XLSX.utils.aoa_to_sheet([
    PWD_BOOK_CATEGORY_HEADERS as unknown as string[],
    ...categoryRows,
  ])

  XLSX.utils.book_append_sheet(workbook, entriesSheet, '密码条目')
  XLSX.utils.book_append_sheet(workbook, categoriesSheet, '分类')

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
}
