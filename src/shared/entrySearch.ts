import type { PasswordEntry } from './types'

export function entryMatchesSearch(entry: PasswordEntry, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return false
  return (
    entry.title.toLowerCase().includes(q) ||
    entry.username.toLowerCase().includes(q) ||
    entry.url.toLowerCase().includes(q) ||
    entry.categoryName.toLowerCase().includes(q) ||
    entry.tags.some((tag) => tag.toLowerCase().includes(q))
  )
}

export function filterEntriesBySearch(
  entries: PasswordEntry[],
  query: string,
  limit = 12,
): PasswordEntry[] {
  const q = query.trim()
  if (!q) return []
  return entries.filter((entry) => entryMatchesSearch(entry, q)).slice(0, limit)
}

export function sortEntriesByRecent(entries: PasswordEntry[]): PasswordEntry[] {
  return [...entries].sort((a, b) => {
    const aTime = a.lastUsedAt ?? 0
    const bTime = b.lastUsedAt ?? 0
    if (aTime !== bTime) return bTime - aTime
    return b.updatedAt - a.updatedAt
  })
}
