import { normalizeNoteContent } from './noteBlocks'
import type { StickyNote, StickyNoteInput } from './types'

export function moveNoteInput(note: StickyNote, bookId: string): StickyNoteInput {
  return {
    title: note.title,
    content: normalizeNoteContent(note.content),
    color: note.color,
    isFavorite: note.isFavorite,
    bookId,
  }
}
