import { describe, expect, it } from 'vitest'
import {
  CLIPBOARD_HISTORY_LIMIT_DEFAULT,
  clampClipboardHistoryLimit,
  trimClipboardHistory,
} from './clipboardHistoryLimit'

function item(id: string, createdAt: number, pinned = false) {
  return { id, createdAt, pinned }
}

describe('clampClipboardHistoryLimit', () => {
  it('returns default for invalid values', () => {
    expect(clampClipboardHistoryLimit(undefined)).toBe(CLIPBOARD_HISTORY_LIMIT_DEFAULT)
    expect(clampClipboardHistoryLimit(Number.NaN)).toBe(CLIPBOARD_HISTORY_LIMIT_DEFAULT)
    expect(clampClipboardHistoryLimit('')).toBe(CLIPBOARD_HISTORY_LIMIT_DEFAULT)
  })

  it('keeps allowed options', () => {
    expect(clampClipboardHistoryLimit(20)).toBe(20)
    expect(clampClipboardHistoryLimit(50)).toBe(50)
    expect(clampClipboardHistoryLimit(100)).toBe(100)
    expect(clampClipboardHistoryLimit(200)).toBe(200)
  })

  it('snaps nearby values to the closest option', () => {
    expect(clampClipboardHistoryLimit(1)).toBe(20)
    expect(clampClipboardHistoryLimit(80)).toBe(100)
    expect(clampClipboardHistoryLimit(500)).toBe(200)
  })
})

describe('trimClipboardHistory', () => {
  it('keeps the list unchanged when under the limit', () => {
    const items = [item('a', 3), item('b', 2), item('c', 1)]
    expect(trimClipboardHistory(items, 20)).toEqual(items)
  })

  it('drops the oldest unpinned items first and preserves order', () => {
    const items = [
      item('new', 40),
      item('pin', 10, true),
      item('mid', 30),
      item('old', 20),
    ]
    expect(trimClipboardHistory(items, 2)).toEqual([
      item('new', 40),
      item('pin', 10, true),
    ])
  })

  it('keeps all pinned items when they already fill the limit', () => {
    const items = [
      item('fresh', 3),
      item('p1', 1, true),
      item('p2', 2, true),
    ]
    expect(trimClipboardHistory(items, 2)).toEqual([
      item('p1', 1, true),
      item('p2', 2, true),
    ])
  })
})
