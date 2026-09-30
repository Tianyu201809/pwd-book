import type { PasswordEntry, VaultCategory } from './types'

export function selectEntriesForExport(
  entries: PasswordEntry[],
  entryIds?: readonly string[],
): PasswordEntry[] {
  if (entryIds === undefined) return entries
  const selectedIds = new Set(entryIds)
  return entries.filter((entry) => selectedIds.has(entry.id))
}

export function selectCategoriesForExport(
  categories: VaultCategory[],
  entries: PasswordEntry[],
  subset: boolean,
): VaultCategory[] {
  if (!subset) return categories

  const entryCounts = new Map<string, number>()
  for (const entry of entries) {
    entryCounts.set(entry.categoryId, (entryCounts.get(entry.categoryId) ?? 0) + 1)
  }

  return categories
    .filter((category) => entryCounts.has(category.id))
    .map((category) => ({ ...category, entryCount: entryCounts.get(category.id) ?? 0 }))
}
