import { describe, expect, it } from 'vitest'
import {
  getCategoryEntrySelectionState,
  selectCategoriesForExport,
  selectEntriesForExport,
  toggleCategoryEntrySelection,
} from './exportSelection'
import type { PasswordEntry, VaultCategory } from './types'

function makeEntry(id: string, categoryId: string): PasswordEntry {
  return {
    id,
    title: id,
    url: '',
    username: '',
    password: 'secret',
    note: '',
    tags: [],
    categoryId,
    categoryName: categoryId,
    isFavorite: false,
    displayIcon: '',
    localProgramPath: '',
    totpSecret: '',
    customFields: [],
    attachmentCount: 0,
    lastUsedAt: null,
    createdAt: 1,
    updatedAt: 1,
  }
}

const categories: VaultCategory[] = [
  { id: 'work', name: 'Work', icon: 'Folder', sortOrder: 1, createdAt: 1, entryCount: 5 },
  { id: 'home', name: 'Home', icon: 'Home', sortOrder: 2, createdAt: 1, entryCount: 3 },
]

describe('export selection', () => {
  const entries = [makeEntry('one', 'work'), makeEntry('two', 'home'), makeEntry('three', 'work')]

  it('keeps all entries when no selection is supplied', () => {
    expect(selectEntriesForExport(entries)).toBe(entries)
  })

  it('filters entries by id while preserving vault order', () => {
    expect(selectEntriesForExport(entries, ['three', 'one', 'missing']).map((entry) => entry.id))
      .toEqual(['one', 'three'])
  })

  it('keeps only referenced categories and recalculates selected counts', () => {
    const selectedEntries = selectEntriesForExport(entries, ['one', 'three'])
    expect(selectCategoriesForExport(categories, selectedEntries, true)).toEqual([
      { ...categories[0], entryCount: 2 },
    ])
  })

  it('preserves full category metadata for full exports', () => {
    expect(selectCategoriesForExport(categories, entries, false)).toBe(categories)
  })

  it('reports whether none, some, or all category entries are selected', () => {
    expect(getCategoryEntrySelectionState(entries, [], 'work')).toBe('none')
    expect(getCategoryEntrySelectionState(entries, ['one'], 'work')).toBe('partial')
    expect(getCategoryEntrySelectionState(entries, ['one', 'three'], 'work')).toBe('all')
  })

  it('selects every entry in a category and preserves other selected entries', () => {
    expect(toggleCategoryEntrySelection(entries, ['one', 'two'], 'work')).toEqual([
      'one',
      'two',
      'three',
    ])
  })

  it('deselects only the target category entries', () => {
    expect(toggleCategoryEntrySelection(entries, ['one', 'two', 'three'], 'work')).toEqual([
      'two',
    ])
  })

  it('leaves the selection unchanged when a category has no entries', () => {
    expect(toggleCategoryEntrySelection(entries, ['two'], 'empty')).toEqual(['two'])
  })
})
