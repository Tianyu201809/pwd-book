import { describe, expect, it } from 'vitest'
import { resolveClipboardWindowOpen, shouldHideClipboardWindowOnBlur } from './clipboardWindowAccess'

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

  it('never hides on blur when clicking outside the clipboard window', () => {
    expect(shouldHideClipboardWindowOnBlur()).toBe(false)
  })
})
