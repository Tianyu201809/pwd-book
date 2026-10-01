import { describe, expect, it } from 'vitest'
import { resolveCreateNoteBookId, resolveFilterAfterCreate } from './noteCreate'

describe('create note target', () => {
  it('keeps an explicit book id and ignores click events', () => {
    const click = { type: 'click', preventDefault() {} }
    expect(resolveCreateNoteBookId('book-222', 'all')).toBe('book-222')
    expect(resolveCreateNoteBookId(click, 'all')).toBeUndefined()
    expect(resolveCreateNoteBookId(click, 'book-222')).toBe('book-222')
    expect(resolveCreateNoteBookId(undefined, 'favorite')).toBeUndefined()
  })

  it('does not switch the list filter to a click event', () => {
    const click = { type: 'click', preventDefault() {} }
    expect(resolveFilterAfterCreate('book-222', 'all')).toBe('book-222')
    expect(resolveFilterAfterCreate(click, 'trash')).toBe('all')
    expect(resolveFilterAfterCreate(click, 'favorite')).toBe('all')
    expect(resolveFilterAfterCreate(click, 'book-222')).toBe('book-222')
    expect(resolveFilterAfterCreate(undefined, 'all')).toBe('all')
  })
})
