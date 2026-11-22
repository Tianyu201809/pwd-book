import type { PasswordEntry, VaultCategory } from './types'

export function selectEntriesForExport(
  entries: PasswordEntry[],
  entryIds?: readonly string[],
): PasswordEntry[] {
  if (entryIds === undefined) return entries
  const selectedIds = new Set(entryIds)
  return entries.filter((entry) => selectedIds.has(entry.id))
}

export type CategoryEntrySelectionState = 'none' | 'partial' | 'all'

export function getCategoryEntrySelectionState(
  entries: PasswordEntry[],
  selectedEntryIds: readonly string[],
  categoryId: string,
): CategoryEntrySelectionState {
  const categoryEntries = entries.filter((entry) => entry.categoryId === categoryId)
  if (categoryEntries.length === 0) return 'none'

  const selectedIds = new Set(selectedEntryIds)
  const selectedCount = categoryEntries.filter((entry) => selectedIds.has(entry.id)).length
  if (selectedCount === 0) return 'none'
  return selectedCount === categoryEntries.length ? 'all' : 'partial'
}

export function toggleCategoryEntrySelection(
  entries: PasswordEntry[],
  selectedEntryIds: readonly string[],
  categoryId: string,
): string[] {
  const categoryEntryIds = entries
    .filter((entry) => entry.categoryId === categoryId)
    .map((entry) => entry.id)
  if (categoryEntryIds.length === 0) return [...selectedEntryIds]

  const selectedIds = new Set(selectedEntryIds)
  const categoryIsFullySelected = categoryEntryIds.every((id) => selectedIds.has(id))
  if (categoryIsFullySelected) {
    const categoryIds = new Set(categoryEntryIds)
    return selectedEntryIds.filter((id) => !categoryIds.has(id))
  }

  const nextSelection = [...selectedEntryIds]
  for (const id of categoryEntryIds) {
    if (!selectedIds.has(id)) {
      selectedIds.add(id)
      nextSelection.push(id)
    }
  }
  return nextSelection
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
