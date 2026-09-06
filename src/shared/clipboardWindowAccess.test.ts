import { describe, expect, it } from 'vitest'
import {
  CLIPBOARD_WINDOW_DEFAULT_PINNED,
  CLIPBOARD_WINDOW_DEFAULT_QUICK_MODE,
  isClipboardItemDeleteKey,
  nextClipboardSelectionAfterDelete,
  resolveClipboardWindowOpen,
  shouldCloseClipboardWindowAfterEnterCopy,
  shouldHideClipboardWindowOnBlur,
} from './clipboardWindowAccess'

describe('resolveClipboardWindowOpen', () => {
  it('requires unlock before the clipboard feature flag', () => {
    expect(resolveClipboardWindowOpen(false, false)).toBe('locked')
    expect(resolveClipboardWindowOpen(false, true)).toBe('locked')
  })

  it('blocks the window when clipboard history is turned off', () => {
    expect(resolveClipboardWindowOpen(true, false)).toBe('disabled')
  })

  it('allows the window when unlocked and clipboard history is on', () => {
    expect(resolveClipboardWindowOpen(true, true)).toBe('allow')
  })

  it('hides on blur unless the clipboard window is pinned', () => {
    expect(shouldHideClipboardWindowOnBlur(false)).toBe(true)
    expect(shouldHideClipboardWindowOnBlur(true)).toBe(false)
  })

  it('does not pin the clipboard window on first open', () => {
    expect(CLIPBOARD_WINDOW_DEFAULT_PINNED).toBe(false)
  })

  it('does not enable quick mode by default', () => {
    expect(CLIPBOARD_WINDOW_DEFAULT_QUICK_MODE).toBe(false)
  })

  it('closes after Enter copy only when quick mode is on', () => {
    expect(shouldCloseClipboardWindowAfterEnterCopy(false)).toBe(false)
    expect(shouldCloseClipboardWindowAfterEnterCopy(true)).toBe(true)
  })

  it('treats Delete and Backspace as item-delete keys', () => {
    expect(isClipboardItemDeleteKey('Delete')).toBe(true)
    expect(isClipboardItemDeleteKey('Backspace')).toBe(true)
    expect(isClipboardItemDeleteKey('Enter')).toBe(false)
  })

  it('selects the next visible item after delete, then the previous', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(nextClipboardSelectionAfterDelete(items, 'b')).toBe('c')
    expect(nextClipboardSelectionAfterDelete(items, 'c')).toBe('b')
    expect(nextClipboardSelectionAfterDelete([{ id: 'only' }], 'only')).toBe(null)
  })
})
