import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CLIPBOARD_WINDOW_DEFAULT_PINNED,
  CLIPBOARD_WINDOW_DEFAULT_QUICK_MODE,
  isClipboardItemDeleteKey,
  nextClipboardSelectionAfterDelete,
  resolveClipboardWindowOpen,
  shouldBlockClipboardArrowNav,
  shouldBlockClipboardListEnter,
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

  it('lets Enter copy the selected item when a toolbar or item button is focused', () => {
    expect(shouldBlockClipboardListEnter({
      overlayOpen: false,
      keepsOwnEnter: false,
    })).toBe(false)
  })

  it('leaves Enter to open dialogs and to select or multiline fields', () => {
    expect(shouldBlockClipboardListEnter({ overlayOpen: true, keepsOwnEnter: false })).toBe(true)
    expect(shouldBlockClipboardListEnter({ overlayOpen: false, keepsOwnEnter: true })).toBe(true)
  })

  it('lets Up and Down move the list from the search box, but not from a select', () => {
    expect(shouldBlockClipboardArrowNav({ overlayOpen: false, isSelect: false })).toBe(false)
    expect(shouldBlockClipboardArrowNav({ overlayOpen: false, isSelect: true })).toBe(true)
    expect(shouldBlockClipboardArrowNav({ overlayOpen: true, isSelect: false })).toBe(true)
  })

  it('keeps clipboard item action buttons out of Tab order', () => {
    const source = readFileSync(new URL('../components/ClipboardWindowApp.vue', import.meta.url), 'utf8')
    const actions = source.match(/class="clipboard-popup-item-actions"[\s\S]*?<\/div>/)?.[0] ?? ''
    const buttons = actions.match(/<button/g) ?? []
    expect(buttons.length).toBeGreaterThan(0)
    expect(actions.match(/tabindex="-1"/g)?.length).toBe(buttons.length)
  })

  it('keeps the toolbar capture button out of Tab order', () => {
    const source = readFileSync(new URL('../components/ClipboardWindowApp.vue', import.meta.url), 'utf8')
    const toolButtons = source.match(/<button[^>]*clipboard-popup-tool-button[^>]*>/g) ?? []
    expect(toolButtons).toHaveLength(2)
    expect(toolButtons.every((button) => button.includes('tabindex="-1"'))).toBe(true)
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
