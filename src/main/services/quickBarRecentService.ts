import { getSetting, setSetting } from '../db/helpers'
import { getRecentOpenedEntries } from '../../shared/entrySearch'
import type { PasswordEntry } from '../../shared/types'

const QUICK_BAR_RECENT_KEY = 'quick_bar_recent_ids'
export const QUICK_BAR_RECENT_LIMIT = 5

function parseRecentIds(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return []
  }
}

export function getQuickBarRecentIds(): string[] {
  return parseRecentIds(getSetting(QUICK_BAR_RECENT_KEY))
}

function setQuickBarRecentIds(ids: string[]): void {
  setSetting(QUICK_BAR_RECENT_KEY, JSON.stringify(ids.slice(0, QUICK_BAR_RECENT_LIMIT)))
}

function hasQuickBarRecentStore(): boolean {
  const raw = getSetting(QUICK_BAR_RECENT_KEY)
  return raw != null && raw !== ''
}

function seedQuickBarRecentIfEmpty(entries: PasswordEntry[]): string[] {
  if (hasQuickBarRecentStore()) {
    return getQuickBarRecentIds()
  }

  const seeded = getRecentOpenedEntries(entries, QUICK_BAR_RECENT_LIMIT).map((entry) => entry.id)
  setQuickBarRecentIds(seeded)
  return seeded
}

function pruneRecentIds(ids: string[], entries: PasswordEntry[]): string[] {
  const validIds = new Set(entries.map((entry) => entry.id))
  const pruned = ids.filter((id) => validIds.has(id))
  if (pruned.length !== ids.length) setQuickBarRecentIds(pruned)
  return pruned
}

export function resolveQuickBarRecentEntries(entries: PasswordEntry[]): PasswordEntry[] {
  const ids = pruneRecentIds(seedQuickBarRecentIfEmpty(entries), entries)
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  return ids
    .map((id) => byId.get(id))
    .filter((entry): entry is PasswordEntry => entry != null)
}

export function recordQuickBarRecentEntry(entryId: string): void {
  const next = [entryId, ...getQuickBarRecentIds().filter((id) => id !== entryId)].slice(
    0,
    QUICK_BAR_RECENT_LIMIT,
  )
  setQuickBarRecentIds(next)
}

export function removeQuickBarRecentEntry(entryId: string): void {
  setQuickBarRecentIds(getQuickBarRecentIds().filter((id) => id !== entryId))
}
