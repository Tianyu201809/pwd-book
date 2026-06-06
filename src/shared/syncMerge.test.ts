import { describe, expect, it } from 'vitest'
import { entryEffectiveTime, mergeSyncBundles } from './syncMerge'
import type { SyncBundle, SyncEntry } from './syncTypes'
import { SYNC_BUNDLE_FORMAT, SYNC_BUNDLE_VERSION } from './syncTypes'

function makeEntry(overrides: Partial<SyncEntry> & { id: string }): SyncEntry {
  return {
    id: overrides.id,
    title: overrides.title ?? 'Title',
    url: overrides.url ?? '',
    username: overrides.username ?? 'user',
    password: overrides.password ?? 'secret',
    note: overrides.note ?? '',
    tags: overrides.tags ?? [],
    categoryId: overrides.categoryId ?? 'cat-work',
    isFavorite: overrides.isFavorite ?? false,
    displayIcon: overrides.displayIcon ?? '',
    localProgramPath: overrides.localProgramPath ?? '',
    lastUsedAt: overrides.lastUsedAt ?? null,
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 1000,
    deletedAt: overrides.deletedAt ?? null,
  }
}

function makeBundle(
  deviceId: string,
  revision: number,
  entries: SyncEntry[],
  categories = [
    {
      id: 'cat-work',
      name: '工作',
      icon: 'Briefcase',
      sortOrder: 1,
      createdAt: 1000,
    },
  ],
): SyncBundle {
  return {
    format: SYNC_BUNDLE_FORMAT,
    version: SYNC_BUNDLE_VERSION,
    deviceId,
    revision,
    exportedAt: new Date(revision * 1000).toISOString(),
    categories,
    entries,
  }
}

describe('entryEffectiveTime', () => {
  it('uses deletedAt when later than updatedAt', () => {
    const entry = makeEntry({ id: '1', updatedAt: 1000, deletedAt: 2000 })
    expect(entryEffectiveTime(entry)).toBe(2000)
  })
})

describe('mergeSyncBundles', () => {
  it('keeps newer entry when both sides edited same id', () => {
    const local = makeBundle('local', 1, [
      makeEntry({ id: 'e1', title: 'Local', updatedAt: 2000 }),
    ])
    const remote = makeBundle('remote', 2, [
      makeEntry({ id: 'e1', title: 'Remote', updatedAt: 3000 }),
    ])

    const { merged } = mergeSyncBundles(local, remote)
    expect(merged.entries).toHaveLength(1)
    expect(merged.entries[0]?.title).toBe('Remote')
    expect(merged.revision).toBe(3)
  })

  it('prefers delete when delete timestamp is newer', () => {
    const local = makeBundle('local', 1, [
      makeEntry({ id: 'e1', title: 'Active', updatedAt: 5000, deletedAt: null }),
    ])
    const remote = makeBundle('remote', 2, [
      makeEntry({ id: 'e1', title: 'Active', updatedAt: 4000, deletedAt: 6000 }),
    ])

    const { merged } = mergeSyncBundles(local, remote)
    expect(merged.entries[0]?.deletedAt).toBe(6000)
  })

  it('merges entries unique to each side', () => {
    const local = makeBundle('local', 1, [makeEntry({ id: 'e1' })])
    const remote = makeBundle('remote', 2, [makeEntry({ id: 'e2' })])

    const { merged } = mergeSyncBundles(local, remote)
    expect(merged.entries.map((entry) => entry.id).sort()).toEqual(['e1', 'e2'])
  })

  it('records conflict when timestamps tie but content differs', () => {
    const local = makeBundle('local', 1, [
      makeEntry({ id: 'e1', title: 'Local', updatedAt: 2000 }),
    ])
    const remote = makeBundle('remote', 2, [
      makeEntry({ id: 'e1', title: 'Remote', updatedAt: 2000 }),
    ])

    const { merged, conflicts } = mergeSyncBundles(local, remote)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]?.entryId).toBe('e1')
    expect(merged.entries[0]?.title).toBe('Local')
  })

  it('skips remote category when name already exists with different id', () => {
    const local = makeBundle('local', 1, [], [
      {
        id: 'cat-work',
        name: '工作',
        icon: 'Briefcase',
        sortOrder: 1,
        createdAt: 1000,
      },
    ])
    const remote = makeBundle('remote', 2, [], [
      {
        id: 'cat-remote-work',
        name: '工作',
        icon: 'Folder',
        sortOrder: 2,
        createdAt: 2000,
      },
    ])

    const { merged } = mergeSyncBundles(local, remote)
    expect(merged.categories).toHaveLength(1)
    expect(merged.categories[0]?.id).toBe('cat-work')
  })

  it('restores entry when remote undelete is newer than local delete', () => {
    const local = makeBundle('local', 1, [
      makeEntry({ id: 'e1', title: 'Deleted', updatedAt: 5000, deletedAt: 6000 }),
    ])
    const remote = makeBundle('remote', 2, [
      makeEntry({ id: 'e1', title: 'Restored', updatedAt: 7000, deletedAt: null }),
    ])

    const { merged } = mergeSyncBundles(local, remote)
    expect(merged.entries[0]?.deletedAt).toBeNull()
    expect(merged.entries[0]?.title).toBe('Restored')
  })

  it('unions categories by id and name', () => {
    const local = makeBundle('local', 1, [], [
      {
        id: 'cat-a',
        name: 'A',
        icon: 'Folder',
        sortOrder: 1,
        createdAt: 1000,
      },
    ])
    const remote = makeBundle('remote', 2, [], [
      {
        id: 'cat-b',
        name: 'B',
        icon: 'Tag',
        sortOrder: 2,
        createdAt: 2000,
      },
    ])

    const { merged } = mergeSyncBundles(local, remote)
    expect(merged.categories.map((category) => category.id).sort()).toEqual(['cat-a', 'cat-b'])
  })
})
