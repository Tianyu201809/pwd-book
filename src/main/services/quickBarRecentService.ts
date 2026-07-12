import { getSetting, setSetting } from '../db/helpers'
import { getRecentOpenedEntries } from '../../shared/entrySearch'
import {
  clampQuickBarRecentLimit,
  QUICK_BAR_RECENT_LIMIT_DEFAULT,
} from '../../shared/quickBarLimits'
import type { PasswordEntry } from '../../shared/types'

const QUICK_BAR_RECENT_KEY = 'quick_bar_recent_ids'
const QUICK_BAR_RECENT_LIMIT_KEY = 'quick_bar_recent_limit'

/** @deprecated 使用 getQuickBarRecentLimit()；保留导出供文档/旧引用兼容 */
export const QUICK_BAR_RECENT_LIMIT = QUICK_BAR_RECENT_LIMIT_DEFAULT

export function getQuickBarRecentLimit(): number {
  return clampQuickBarRecentLimit(
    getSetting(QUICK_BAR_RECENT_LIMIT_KEY) ?? QUICK_BAR_RECENT_LIMIT_DEFAULT,
  )
}

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
  const limit = getQuickBarRecentLimit()
  setSetting(QUICK_BAR_RECENT_KEY, JSON.stringify(ids.slice(0, limit)))
}

function hasQuickBarRecentStore(): boolean {
  const raw = getSetting(QUICK_BAR_RECENT_KEY)
  return raw != null && raw !== ''
}

function seedQuickBarRecentIfEmpty(entries: PasswordEntry[]): string[] {
  if (hasQuickBarRecentStore()) {
    return getQuickBarRecentIds()
  }

  const seeded = getRecentOpenedEntries(entries, getQuickBarRecentLimit()).map((entry) => entry.id)
  setQuickBarRecentIds(seeded)
  return seeded
}

function pruneRecentIds(ids: string[], entries: PasswordEntry[]): string[] {
  const validIds = new Set(entries.map((entry) => entry.id))
  const limit = getQuickBarRecentLimit()
  const pruned = ids.filter((id) => validIds.has(id)).slice(0, limit)
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
    getQuickBarRecentLimit(),
  )
  setQuickBarRecentIds(next)
}

export function removeQuickBarRecentEntry(entryId: string): void {
  setQuickBarRecentIds(getQuickBarRecentIds().filter((id) => id !== entryId))
}

/** 设置条数上限变小时，立刻按新上限截断已存 ID 列表。 */
export function truncateQuickBarRecentToLimit(): void {
  setQuickBarRecentIds(getQuickBarRecentIds())
}
