import { readEntryRows } from '../db/helpers'
import type { BridgeLoginMatch } from '../../shared/browserBridgeProtocol'
import { entryUrlMatchesPage } from '../../shared/urlMatch'
import { isUnlocked } from './sessionService'

export function matchLoginsForPage(pageUrl: string): BridgeLoginMatch[] {
  if (!isUnlocked()) return []

  const page = pageUrl.trim()
  if (!page) return []

  const rows = readEntryRows()
  return rows
    .filter((row) => row.url.trim() && entryUrlMatchesPage(row.url, page))
    .map((row) => ({
      id: row.id,
      title: row.title,
      username: row.username,
      lastUsedAt: row.last_used_at ?? 0,
    }))
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .map(({ id, title, username }) => ({ id, title, username }))
}
