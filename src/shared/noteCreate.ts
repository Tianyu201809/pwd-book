import type { NoteFilter } from './types'

const LIST_FILTERS = new Set<NoteFilter>(['all', 'favorite', 'trash'])

/** 工具栏 @click 会把 DOM 事件作为第一个参数传入；只有字符串才是便签本 ID。 */
export function resolveCreateNoteBookId(bookId: unknown, filter: NoteFilter): string | undefined {
  if (typeof bookId === 'string' && bookId.length > 0) return bookId
  return LIST_FILTERS.has(filter) ? undefined : filter
}

export function resolveFilterAfterCreate(bookId: unknown, filter: NoteFilter): NoteFilter {
  if (typeof bookId === 'string' && bookId.length > 0) return bookId
  if (filter === 'trash' || filter === 'favorite') return 'all'
  return filter
}
