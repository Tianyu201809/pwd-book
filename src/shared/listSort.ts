import type { ListSortDirection, ListSortOrder } from '@/types'

export interface ListSortableEntry {
  title: string
  createdAt: number
  updatedAt: number
  lastUsedAt: number | null
}

export function defaultListSortDirection(order: ListSortOrder): ListSortDirection {
  return order === 'title' ? 'asc' : 'desc'
}

export function sortEntriesForList<T extends ListSortableEntry>(
  list: readonly T[],
  order: ListSortOrder,
  direction: ListSortDirection,
  locale: string,
): T[] {
  const sign = direction === 'asc' ? 1 : -1
  const sorted = [...list]
  if (order === 'title') {
    return sorted.sort((a, b) => sign * a.title.localeCompare(b.title, locale))
  }
  if (order === 'created') {
    return sorted.sort((a, b) => sign * (a.createdAt - b.createdAt))
  }
  return sorted.sort((a, b) => {
    const aTime = a.lastUsedAt ?? 0
    const bTime = b.lastUsedAt ?? 0
    if (aTime !== bTime) return sign * (aTime - bTime)
    return sign * (a.updatedAt - b.updatedAt)
  })
}
