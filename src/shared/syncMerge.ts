import type { SyncAttachmentMeta, SyncBundle, SyncConflict, SyncEntry } from './syncTypes'
import { SYNC_BUNDLE_FORMAT, SYNC_BUNDLE_VERSION } from './syncTypes'
import type { VaultCategory } from './types'

export function entryEffectiveTime(entry: SyncEntry): number {
  return Math.max(entry.updatedAt, entry.deletedAt ?? 0)
}

function entriesContentEqual(a: SyncEntry, b: SyncEntry): boolean {
  return (
    a.title === b.title &&
    a.url === b.url &&
    a.username === b.username &&
    a.password === b.password &&
    a.note === b.note &&
    a.categoryId === b.categoryId &&
    a.isFavorite === b.isFavorite &&
    a.displayIcon === b.displayIcon &&
    a.localProgramPath === b.localProgramPath &&
    a.totpSecret === b.totpSecret &&
    JSON.stringify(a.tags) === JSON.stringify(b.tags) &&
    a.deletedAt === b.deletedAt
  )
}

function mergeCategoryLists(local: VaultCategory[], remote: VaultCategory[]): VaultCategory[] {
  const byId = new Map<string, VaultCategory>()
  const byName = new Map<string, VaultCategory>()

  for (const category of local) {
    byId.set(category.id, category)
    byName.set(category.name.toLowerCase(), category)
  }

  for (const remoteCategory of remote) {
    const existingById = byId.get(remoteCategory.id)
    if (existingById) {
      if (remoteCategory.createdAt >= existingById.createdAt) {
        byId.set(remoteCategory.id, remoteCategory)
        byName.set(remoteCategory.name.toLowerCase(), remoteCategory)
      }
      continue
    }

    const existingByName = byName.get(remoteCategory.name.toLowerCase())
    if (existingByName) {
      continue
    }

    byId.set(remoteCategory.id, remoteCategory)
    byName.set(remoteCategory.name.toLowerCase(), remoteCategory)
  }

  return Array.from(byId.values()).sort((a, b) => a.sortOrder - b.sortOrder)
}

export function mergeSyncAttachments(
  local: SyncAttachmentMeta[],
  remote: SyncAttachmentMeta[],
  options?: {
    localDeletions?: { id: string; deletedAt: number }[]
    remoteDeletions?: { id: string; deletedAt: number }[]
  },
): { merged: SyncAttachmentMeta[]; mergedDeletions: { id: string; deletedAt: number }[] } {
  const localById = new Map(local.map((item) => [item.id, item]))
  const remoteById = new Map(remote.map((item) => [item.id, item]))
  const localDeletionById = new Map((options?.localDeletions ?? []).map((item) => [item.id, item.deletedAt]))
  const remoteDeletionById = new Map((options?.remoteDeletions ?? []).map((item) => [item.id, item.deletedAt]))
  const allIds = new Set([
    ...localById.keys(),
    ...remoteById.keys(),
    ...localDeletionById.keys(),
    ...remoteDeletionById.keys(),
  ])
  const merged: SyncAttachmentMeta[] = []
  const mergedDeletionById = new Map<string, number>()

  for (const id of allIds) {
    const localItem = localById.get(id)
    const remoteItem = remoteById.get(id)
    const localDeletedAt = localDeletionById.get(id)
    const remoteDeletedAt = remoteDeletionById.get(id)

    if (localDeletedAt !== undefined) {
      const remoteTime = remoteItem?.updatedAt ?? 0
      if (!remoteItem || localDeletedAt >= remoteTime) {
        mergedDeletionById.set(id, Math.max(mergedDeletionById.get(id) ?? 0, localDeletedAt))
        if (remoteDeletedAt !== undefined) {
          mergedDeletionById.set(id, Math.max(mergedDeletionById.get(id) ?? 0, remoteDeletedAt))
        }
        continue
      }
    }

    if (remoteDeletedAt !== undefined) {
      const localTime = localItem?.updatedAt ?? 0
      if (!localItem || remoteDeletedAt >= localTime) {
        mergedDeletionById.set(id, Math.max(mergedDeletionById.get(id) ?? 0, remoteDeletedAt))
        if (localDeletedAt !== undefined) {
          mergedDeletionById.set(id, Math.max(mergedDeletionById.get(id) ?? 0, localDeletedAt))
        }
        continue
      }
    }

    if (!localItem && remoteItem) {
      merged.push(remoteItem)
      continue
    }
    if (localItem && !remoteItem) {
      merged.push(localItem)
      continue
    }
    if (localItem && remoteItem) {
      merged.push(localItem.updatedAt >= remoteItem.updatedAt ? localItem : remoteItem)
    }
  }

  return {
    merged,
    mergedDeletions: [...mergedDeletionById.entries()].map(([id, deletedAt]) => ({ id, deletedAt })),
  }
}

export function mergeSyncBundles(
  local: SyncBundle,
  remote: SyncBundle,
): { merged: SyncBundle; conflicts: SyncConflict[] } {
  const localById = new Map(local.entries.map((entry) => [entry.id, entry]))
  const remoteById = new Map(remote.entries.map((entry) => [entry.id, entry]))
  const allIds = new Set([...localById.keys(), ...remoteById.keys()])
  const mergedEntries: SyncEntry[] = []
  const conflicts: SyncConflict[] = []

  for (const id of allIds) {
    const localEntry = localById.get(id)
    const remoteEntry = remoteById.get(id)

    if (!localEntry && remoteEntry) {
      mergedEntries.push(remoteEntry)
      continue
    }
    if (localEntry && !remoteEntry) {
      mergedEntries.push(localEntry)
      continue
    }
    if (!localEntry || !remoteEntry) continue

    const localTime = entryEffectiveTime(localEntry)
    const remoteTime = entryEffectiveTime(remoteEntry)

    if (localTime > remoteTime) {
      mergedEntries.push(localEntry)
    } else if (remoteTime > localTime) {
      mergedEntries.push(remoteEntry)
    } else if (entriesContentEqual(localEntry, remoteEntry)) {
      mergedEntries.push(localEntry)
    } else {
      conflicts.push({
        entryId: id,
        title: localEntry.title || remoteEntry.title,
        localUpdatedAt: localTime,
        remoteUpdatedAt: remoteTime,
      })
      mergedEntries.push(localEntry)
    }
  }

  const mergedCategories = mergeCategoryLists(local.categories, remote.categories)
  const mergedRevision = Math.max(local.revision, remote.revision) + 1
  const { merged: mergedAttachments, mergedDeletions } = mergeSyncAttachments(
    local.attachments ?? [],
    remote.attachments ?? [],
    {
      localDeletions: local.attachmentDeletions,
      remoteDeletions: remote.attachmentDeletions,
    },
  )

  const merged: SyncBundle = {
    format: SYNC_BUNDLE_FORMAT,
    version: SYNC_BUNDLE_VERSION,
    deviceId: local.deviceId,
    revision: mergedRevision,
    exportedAt: new Date().toISOString(),
    categories: mergedCategories,
    entries: mergedEntries,
    attachments: mergedAttachments,
    attachmentDeletions: mergedDeletions,
    settings: {
      trashRetentionDays:
        remote.settings?.trashRetentionDays ?? local.settings?.trashRetentionDays,
    },
  }

  return { merged, conflicts }
}
