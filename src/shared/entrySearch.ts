import { textMatchesQuery } from './searchMatch'
import type { PasswordEntry } from './types'

export function entrySearchFields(entry: PasswordEntry): string[] {
  return [
    entry.title,
    entry.username,
    entry.url,
    entry.categoryName,
    ...entry.tags,
  ]
}

export function entryMatchesSearch(entry: PasswordEntry, query: string): boolean {
  const q = query.trim()
  if (!q) return false
  return entrySearchFields(entry).some((field) => textMatchesQuery(field, q))
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

export function getRecentOpenedEntries(entries: PasswordEntry[], limit = 5): PasswordEntry[] {
  return sortEntriesByRecent(entries)
    .filter((entry) => entry.lastUsedAt != null)
    .slice(0, limit)
}
