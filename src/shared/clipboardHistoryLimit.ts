export const CLIPBOARD_HISTORY_LIMITS = [20, 50, 100, 200] as const

export type ClipboardHistoryLimit = (typeof CLIPBOARD_HISTORY_LIMITS)[number]

export const CLIPBOARD_HISTORY_LIMIT_DEFAULT: ClipboardHistoryLimit = 50

export function clampClipboardHistoryLimit(value: unknown): ClipboardHistoryLimit {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n) || n <= 0) return CLIPBOARD_HISTORY_LIMIT_DEFAULT
  return CLIPBOARD_HISTORY_LIMITS.reduce((best, option) =>
    Math.abs(option - n) < Math.abs(best - n) ? option : best,
  )
}

export function trimClipboardHistory<T extends { id: string; pinned: boolean; createdAt: number }>(
  items: T[],
  limit: number,
): T[] {
  const parsed = Math.floor(Number(limit))
  const safeLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : CLIPBOARD_HISTORY_LIMIT_DEFAULT
  if (items.length <= safeLimit) return items

  const pinned = items.filter((item) => item.pinned)
  if (pinned.length >= safeLimit) return pinned

  const keepUnpinned = items
    .filter((item) => !item.pinned)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
    .slice(0, safeLimit - pinned.length)
  const keepIds = new Set(keepUnpinned.map((item) => item.id))
  for (const item of pinned) keepIds.add(item.id)
  return items.filter((item) => keepIds.has(item.id))
}
