import { computed, ref } from 'vue'
import { createEmptyNoteContent } from '@/shared/noteBlocks'
import type { NoteBook, NoteFilter, StickyNote, StickyNoteInput } from '@/shared/types'

const books = ref<NoteBook[]>([])
const notes = ref<StickyNote[]>([])
const filter = ref<NoteFilter>('all')
const query = ref('')
const selectedId = ref<string | null>(null)
const loading = ref(false)
const error = ref('')

const selectedNote = computed(() => notes.value.find((note) => note.id === selectedId.value) ?? null)

async function refresh(): Promise<void> {
  if (!window.electronAPI) return
  loading.value = true
  error.value = ''
  try {
    const [nextBooks, nextNotes] = await Promise.all([
      window.electronAPI.listNoteBooks(),
      window.electronAPI.listNotes(filter.value, query.value),
    ])
    books.value = nextBooks
    notes.value = nextNotes
    if (!nextNotes.some((note) => note.id === selectedId.value)) selectedId.value = nextNotes[0]?.id ?? null
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'NOTE_LOAD_FAILED'
    books.value = []
    notes.value = []
    selectedId.value = null
  } finally {
    loading.value = false
  }
}

async function selectFilter(next: NoteFilter): Promise<void> {
  filter.value = next
  selectedId.value = null
  await refresh()
}

async function createNote(bookId?: string): Promise<StickyNote | null> {
  if (!window.electronAPI) return null
  error.value = ''
  try {
    const targetBookId = bookId
      ?? (!['all', 'favorite', 'trash'].includes(filter.value) ? filter.value : undefined)
    const input: Partial<StickyNoteInput> = {
      bookId: targetBookId,
      title: '',
      content: createEmptyNoteContent(),
      color: 'yellow',
    }
    const note = await window.electronAPI.createNote(input)
    if (bookId) filter.value = bookId
    else if (filter.value === 'trash' || filter.value === 'favorite') filter.value = 'all'
    await refresh()
    selectedId.value = note.id
    return note
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'NOTE_CREATE_FAILED'
    return null
  }
}

async function updateNote(id: string, input: StickyNoteInput): Promise<StickyNote> {
  const note = await window.electronAPI!.updateNote(id, input)
  const index = notes.value.findIndex((item) => item.id === id)
  if (index >= 0) notes.value[index] = note
  return note
}

export function useNotes() {
  return {
    books,
    notes,
    filter,
    query,
    selectedId,
    selectedNote,
    loading,
    error,
    refresh,
    selectFilter,
    createNote,
    updateNote,
  }
}
