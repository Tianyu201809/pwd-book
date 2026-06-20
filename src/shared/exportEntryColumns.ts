import { serializeCustomFields } from './customFields'
import type { PasswordEntry } from './types'

export const PWD_BOOK_ENTRY_HEADERS = [
  '标题',
  '网址',
  '本地程序路径',
  '用户名',
  '密码',
  '备注',
  '标签',
  '分类',
  '收藏',
  '创建时间',
  '更新时间',
  '自定义字段',
] as const

export const PWD_BOOK_CATEGORY_HEADERS = ['ID', '名称', '图标', '排序', '条目数'] as const

export function formatExportTimestamp(ms: number | null): string {
  if (ms == null) return ''
  return new Date(ms).toISOString()
}

export function entryToPwdBookRow(entry: PasswordEntry): string[] {
  return [
    entry.title,
    entry.url,
    entry.localProgramPath ?? '',
    entry.username,
    entry.password,
    entry.note,
    entry.tags.join(', '),
    entry.categoryName,
    entry.isFavorite ? '是' : '否',
    formatExportTimestamp(entry.createdAt),
    formatExportTimestamp(entry.updatedAt),
    serializeCustomFields(entry.customFields),
  ]
}
