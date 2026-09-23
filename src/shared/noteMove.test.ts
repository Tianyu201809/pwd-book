import { describe, expect, it } from 'vitest'
import { moveNoteInput } from './noteMove'

describe('moveNoteInput', () => {
  it('changes only the notebook field in a complete update payload', () => {
    const content = { version: 1, blocks: [{ id: 'b1', type: 'text', text: 'Keep this', indent: 0, checked: false }] }
    const note = { id: 'n1', bookId: 'old', title: 'Draft', content, color: 'yellow', isFavorite: true }
    expect(moveNoteInput(note as Parameters<typeof moveNoteInput>[0], 'new')).toEqual({
      title: 'Draft', content, color: 'yellow', isFavorite: true, bookId: 'new',
    })
  })
})
