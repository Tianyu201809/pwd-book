import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PasswordEntry } from '@/types'

vi.mock('@/services/vaultApi', () => ({
  vaultApi: {
    listAttachments: vi.fn(async () => []),
    getSidebarCategoryOrder: vi.fn(async () => []),
    updateEntry: vi.fn(),
    listEntries: vi.fn(async () => []),
    listCategories: vi.fn(async () => []),
    listTags: vi.fn(async () => []),
  },
}))

function entry(id: string, tags: string[]): PasswordEntry {
  return {
    id,
    title: id,
    username: '',
    password: '',
    url: '',
    note: '',
    tags,
    categoryId: 'other',
    isFavorite: false,
    categoryName: 'Other',
    displayIcon: '',
    localProgramPath: '',
    totpSecret: '',
    customFields: [],
    attachmentCount: 0,
    createdAt: 1,
    updatedAt: 1,
    lastUsedAt: null,
  }
}

describe('tag filter selection', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })
    vi.stubGlobal('window', { electronAPI: {} })
  })

  it('does not select an entry or open its detail when a tag is toggled', async () => {
    const { useAppState } = await import('./useAppState')
    const state = useAppState()
    state.entries.value = [entry('jenkins', ['众趣']), entry('align', ['点位配准'])]
    state.selectedCategory.value = 'all'
    state.searchQuery.value = ''
    state.clearTagFilters()
    state.selectedEntryId.value = null
    state.isCreating.value = false
    state.setDetailCollapsed(true)

    state.toggleTagFilter('点位配准')

    expect(state.selectedTagFilters.value).toEqual(['点位配准'])
    expect(state.selectedEntryId.value).toBeNull()
    expect(state.detailCollapsed.value).toBe(true)
  })

  it('clears a selection that the new tag filter hides', async () => {
    const { useAppState } = await import('./useAppState')
    const state = useAppState()
    state.entries.value = [entry('jenkins', ['众趣']), entry('align', ['点位配准'])]
    state.selectedCategory.value = 'all'
    state.searchQuery.value = ''
    state.selectedTagFilters.value = []
    state.selectedEntryId.value = 'jenkins'

    state.toggleTagFilter('点位配准')

    expect(state.selectedEntryId.value).toBeNull()
  })

  it('keeps the current entry when it still matches the tag', async () => {
    const { useAppState } = await import('./useAppState')
    const state = useAppState()
    state.entries.value = [entry('jenkins', ['众趣', '点位配准']), entry('align', ['点位配准'])]
    state.selectedCategory.value = 'all'
    state.searchQuery.value = ''
    state.selectedTagFilters.value = []
    state.selectedEntryId.value = 'jenkins'

    state.toggleTagFilter('点位配准')

    expect(state.selectedEntryId.value).toBe('jenkins')
  })
})
