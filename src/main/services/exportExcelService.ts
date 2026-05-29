import * as XLSX from 'xlsx'
import type { ExportPayload } from '../../shared/types'

const ENTRY_HEADERS = [
  '标题',
  '网址',
  '用户名',
  '密码',
  '备注',
  '标签',
  '分类',
  '收藏',
  '创建时间',
  '更新时间',
] as const

const CATEGORY_HEADERS = ['ID', '名称', '图标', '排序', '条目数'] as const

function formatTimestamp(ms: number | null): string {
  if (ms == null) return ''
  return new Date(ms).toISOString()
}

export function buildExcelBuffer(payload: ExportPayload): Buffer {
  const entryRows = payload.entries.map((entry) => [
    entry.title,
    entry.url,
    entry.username,
    entry.password,
    entry.note,
    entry.tags.join(', '),
    entry.categoryName,
    entry.isFavorite ? '是' : '否',
    formatTimestamp(entry.createdAt),
    formatTimestamp(entry.updatedAt),
  ])

  const categoryRows = payload.categories.map((cat) => [
    cat.id,
    cat.name,
    cat.icon,
    cat.sortOrder,
    cat.entryCount ?? 0,
  ])

  const workbook = XLSX.utils.book_new()
  const entriesSheet = XLSX.utils.aoa_to_sheet([ENTRY_HEADERS as unknown as string[], ...entryRows])
  const categoriesSheet = XLSX.utils.aoa_to_sheet([
    CATEGORY_HEADERS as unknown as string[],
    ...categoryRows,
  ])

  XLSX.utils.book_append_sheet(workbook, entriesSheet, '密码条目')
  XLSX.utils.book_append_sheet(workbook, categoriesSheet, '分类')

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
}
