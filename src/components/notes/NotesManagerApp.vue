<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArchiveRestore, BookOpen, ChevronRight, Copy, ExternalLink, FileText, Minus, Pencil, Plus, Search, Star, StickyNote, Trash2, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import NoteEditor from './NoteEditor.vue'
import { copyFormattedNote, writeClipboardText } from './copyNoteText'
import ToastHost from '@/components/ToastHost.vue'
import { UiButton, UiInput, UiModal } from '@/components/ui'
import { showToast } from '@/composables/useToast'
import { useNotes } from '@/composables/useNotes'
import { clampNotesPaneWidths, NOTES_DIVIDER_WIDTH, NOTES_MIN_EDITOR, NOTES_MIN_LIST, NOTES_MIN_NOTEBOOK } from '@/shared/notesManagerLayout'
import { moveNoteInput } from '@/shared/noteMove'
import type { NoteBook, NoteFilter, StickyNote as StickyNoteModel } from '@/shared/types'

const { t } = useI18n()
const { books, notes, filter, query, selectedId, selectedNote, loading, error, refresh, selectFilter, createNote } = useNotes()
const newBookName = ref('')
const addingBook = ref(false)
const creatingBook = ref(false)
const renamingBookName = ref('')
const pendingRenameBook = ref<NoteBook | null>(null)
const pendingBook = ref<NoteBook | null>(null)
const bookDeleteMode = ref<'move' | 'trash'>('move')
const editorRef = ref<InstanceType<typeof NoteEditor> | null>(null)
const workspaceRef = ref<HTMLElement | null>(null)
const workspaceWidth = ref(820)
const notebookWidth = ref(220)
const listWidth = ref(300)
const isResizing = ref(false)
const paneStyle = computed(() => ({
  '--notes-notebook-width': `${notebookWidth.value}px`,
  '--notes-list-width': `${listWidth.value}px`,
}))
const paneStorageKey = 'pwdbook-notes-manager-panes'
let workspaceObserver: ResizeObserver | null = null
let previousUserSelect = ''
const contextMenu = ref<
  | { kind: 'note'; note: StickyNoteModel; x: number; y: number }
  | { kind: 'book'; book: NoteBook; x: number; y: number }
  | null
>(null)
const contextMenuRef = ref<HTMLElement | null>(null)
const submenuRef = ref<HTMLElement | null>(null)
const submenuOpen = ref(false)
const submenuStyle = ref<Record<string, string>>({})
const movingNote = ref(false)
const moveError = ref(false)
const targetBooks = computed(() => {
  const menu = contextMenu.value
  return menu?.kind === 'note' ? books.value.filter((book) => book.id !== menu.note.bookId) : []
})
const deleteConfirm = ref<{ id: string; title: string; permanent: boolean } | null>(null)
const showDeleteConfirm = computed({
  get: () => deleteConfirm.value !== null,
  set: (open: boolean) => { if (!open) deleteConfirm.value = null },
})
const showBookDelete = computed({
  get: () => pendingBook.value !== null,
  set: (open: boolean) => { if (!open) pendingBook.value = null },
})
const showBookRename = computed({
  get: () => pendingRenameBook.value !== null,
  set: (open: boolean) => { if (!open) cancelRename() },
})
const showNewBook = computed({
  get: () => addingBook.value,
  set: (open: boolean) => { if (!open) cancelNewBook() },
})
let removeNotesListener: (() => void) | undefined
let removeFlushListener: (() => void) | undefined
let searchTimer: ReturnType<typeof setTimeout> | null = null

function applyPaneWidths(notebook: number, list: number): void {
  const widths = clampNotesPaneWidths(workspaceWidth.value, notebook, list)
  notebookWidth.value = widths.notebook
  listWidth.value = widths.list
}

function persistPaneWidths(): void {
  try {
    localStorage.setItem(paneStorageKey, JSON.stringify({ notebook: notebookWidth.value, list: listWidth.value }))
  } catch { /* Storage may be disabled in an embedded window. */ }
}

function resizePane(pane: 'notebook' | 'list', width: number): void {
  const available = workspaceWidth.value - 2 * NOTES_DIVIDER_WIDTH - NOTES_MIN_EDITOR
  if (pane === 'notebook') {
    applyPaneWidths(Math.min(width, available - listWidth.value), listWidth.value)
  } else {
    applyPaneWidths(notebookWidth.value, width)
  }
}

function stopPaneResize(persist = true): void {
  if (!isResizing.value) return
  isResizing.value = false
  window.removeEventListener('pointermove', onPanePointerMove)
  window.removeEventListener('pointerup', onPanePointerEnd)
  window.removeEventListener('pointercancel', onPanePointerEnd)
  document.body.style.userSelect = previousUserSelect
  if (persist) persistPaneWidths()
}

let activePane: 'notebook' | 'list' = 'notebook'
let pointerStart = 0
let widthStart = 0
function onPanePointerMove(event: PointerEvent): void {
  resizePane(activePane, widthStart + event.clientX - pointerStart)
}
function onPanePointerEnd(): void { stopPaneResize() }

function startPaneResize(pane: 'notebook' | 'list', event: PointerEvent): void {
  if (event.button !== 0) return
  event.preventDefault()
  stopPaneResize()
  activePane = pane
  pointerStart = event.clientX
  widthStart = pane === 'notebook' ? notebookWidth.value : listWidth.value
  previousUserSelect = document.body.style.userSelect
  document.body.style.userSelect = 'none'
  isResizing.value = true
  window.addEventListener('pointermove', onPanePointerMove)
  window.addEventListener('pointerup', onPanePointerEnd)
  window.addEventListener('pointercancel', onPanePointerEnd)
}

function onPaneResizeKeydown(pane: 'notebook' | 'list', event: KeyboardEvent): void {
  const current = pane === 'notebook' ? notebookWidth.value : listWidth.value
  const minimum = pane === 'notebook' ? NOTES_MIN_NOTEBOOK : NOTES_MIN_LIST
  const maximum = pane === 'notebook'
    ? workspaceWidth.value - listWidth.value - 2 * NOTES_DIVIDER_WIDTH - NOTES_MIN_EDITOR
    : workspaceWidth.value - notebookWidth.value - 2 * NOTES_DIVIDER_WIDTH - NOTES_MIN_EDITOR
  const target = event.key === 'Home' ? minimum : event.key === 'End' ? maximum
    : event.key === 'ArrowLeft' ? current - 16 : event.key === 'ArrowRight' ? current + 16 : null
  if (target === null) return
  event.preventDefault()
  resizePane(pane, target)
  persistPaneWidths()
}

const filters = computed(() => [
  { id: 'all' as NoteFilter, label: 'notes.all', icon: StickyNote },
  { id: 'favorite' as NoteFilter, label: 'notes.favorite', icon: Star },
  { id: 'trash' as NoteFilter, label: 'notes.trash', icon: Trash2 },
])

function preview(note: StickyNoteModel): string {
  return note.content?.blocks?.map((block) => block.text.trim()).filter(Boolean).join(' · ') || '…'
}

function selectNote(id: string): void {
  selectedId.value = id
  contextMenu.value = null
}

function displayTitle(note: StickyNoteModel): string {
  return note.title.trim() || t('notes.untitled')
}

async function close(): Promise<void> {
  await editorRef.value?.flush()
  window.electronAPI?.closeNotesManager()
}
function minimize(): void { window.electronAPI?.minimize() }

function openNewBook(): void {
  newBookName.value = ''
  addingBook.value = true
}

function cancelNewBook(): void {
  addingBook.value = false
  newBookName.value = ''
  creatingBook.value = false
}

function focusNewBookInput(): void {
  const input = document.querySelector('.book-create-input input, .book-create-input .input-field') as HTMLInputElement | null
  input?.focus()
  input?.select()
}

function onNewBookKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return
  if (event.key === 'Escape') {
    event.preventDefault()
    cancelNewBook()
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    void submitBook()
  }
}

async function submitBook(): Promise<void> {
  const name = newBookName.value.trim()
  if (!name || !window.electronAPI || creatingBook.value) return
  creatingBook.value = true
  try {
    await window.electronAPI.createNoteBook(name)
    cancelNewBook()
    await refresh()
  } finally {
    creatingBook.value = false
  }
}

function cancelRename(): void {
  pendingRenameBook.value = null
  renamingBookName.value = ''
}

function startRename(book: NoteBook): void {
  if (book.id === 'notes-default') return
  closeContextMenu()
  renamingBookName.value = book.name
  window.setTimeout(() => {
    pendingRenameBook.value = book
  }, 0)
}

function focusRenameInput(): void {
  const input = document.querySelector('.book-rename-input input, .book-rename-input .input-field') as HTMLInputElement | null
  input?.focus()
  input?.select()
}

function onRenameKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancelRename()
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    void submitRename()
  }
}

async function submitRename(): Promise<void> {
  const book = pendingRenameBook.value
  const name = renamingBookName.value.trim()
  if (!book || !name || !window.electronAPI) return
  await window.electronAPI.updateNoteBook(book.id, name)
  cancelRename()
  await refresh()
}

async function deleteBook(deleteNotes: boolean): Promise<void> {
  const book = pendingBook.value
  if (!book || !window.electronAPI) return
  await window.electronAPI.deleteNoteBook(book.id, undefined, deleteNotes)
  pendingBook.value = null
  if (filter.value === book.id) await selectFilter('all')
  else await refresh()
}

function requestDelete(id: string, permanent = false): void {
  closeContextMenu()
  const note = notes.value.find((item) => item.id === id)
  const pending = {
    id,
    title: note ? displayTitle(note) : t('notes.untitled'),
    permanent,
  }
  window.setTimeout(() => {
    deleteConfirm.value = pending
  }, 0)
}

function cancelDeleteConfirm(): void {
  deleteConfirm.value = null
}

async function confirmDelete(): Promise<void> {
  const pending = deleteConfirm.value
  if (!pending || !window.electronAPI) return
  deleteConfirm.value = null
  if (!pending.permanent) await editorRef.value?.flush()
  if (pending.permanent) await window.electronAPI.permanentlyDeleteNote(pending.id)
  else await window.electronAPI.deleteNote(pending.id)
  await refresh()
}

function deleteSelected(id: string): void {
  requestDelete(id, false)
}

async function restoreSelected(): Promise<void> {
  if (!selectedNote.value || !window.electronAPI) return
  await window.electronAPI.restoreNote(selectedNote.value.id)
  await refresh()
}

function onSaved(saved: StickyNoteModel): void {
  const index = notes.value.findIndex((item) => item.id === saved.id)
  if (index >= 0) notes.value[index] = saved
}

async function copyListedNote(note: StickyNoteModel): Promise<void> {
  closeContextMenu()
  if (note.contentInvalid) {
    showToast(t('notes.copyFailed'), 'error')
    return
  }
  const live = filter.value !== 'trash' ? editorRef.value?.plainTextFor(note.id) : undefined
  const ok = typeof live === 'string' ? await writeClipboardText(live) : await copyFormattedNote(note)
  showToast(ok ? t('notes.copied') : t('notes.copyFailed'), ok ? 'success' : 'error')
}

function closeContextMenu(): void {
  if (movingNote.value) return
  contextMenu.value = null
  submenuOpen.value = false
  moveError.value = false
}

async function openMoveSubmenu(focusFirst = false): Promise<void> {
  if (movingNote.value || !targetBooks.value.length) return
  submenuOpen.value = true
  submenuStyle.value = {}
  await nextTick()
  const submenu = submenuRef.value
  if (!submenu) return
  const rect = submenu.getBoundingClientRect()
  const trigger = submenu.parentElement?.getBoundingClientRect()
  submenuStyle.value = {
    ...(rect.right > window.innerWidth - 8 ? { left: 'auto', right: 'calc(100% - 4px)' } : {}),
    top: `${Math.max(8, Math.min(trigger?.top ?? rect.top, window.innerHeight - rect.height - 8)) - (trigger?.top ?? rect.top)}px`,
  }
  if (focusFirst) submenu.querySelector<HTMLButtonElement>('button')?.focus()
}

function onMoveTriggerKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    void openMoveSubmenu(true)
  } else if (event.key === 'Escape' || event.key === 'ArrowLeft') {
    event.preventDefault()
    submenuOpen.value = false
  }
}

function onSubmenuKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' || event.key === 'ArrowLeft') {
    event.preventDefault()
    submenuOpen.value = false
    contextMenuRef.value?.querySelector<HTMLButtonElement>('.move-menu-trigger')?.focus()
    return
  }
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
  event.preventDefault()
  const items = Array.from(submenuRef.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])
  const index = items.indexOf(document.activeElement as HTMLButtonElement)
  items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
}

async function moveNote(id: string, targetBookId: string): Promise<void> {
  if (movingNote.value) return
  if (!window.electronAPI) {
    moveError.value = true
    return
  }
  movingNote.value = true
  moveError.value = false
  try {
    await nextTick()
    if (selectedId.value === id && !await editorRef.value?.flush()) throw new Error('NOTE_SAVE_FAILED')
    const latest = await window.electronAPI.getNote(id)
    if (!latest || latest.deletedAt) throw new Error('NOTE_NOT_FOUND')
    await window.electronAPI.updateNote(id, moveNoteInput(latest, targetBookId))
    contextMenu.value = null
    submenuOpen.value = false
    await refresh()
  } catch {
    moveError.value = true
  } finally {
    movingNote.value = false
    if (moveError.value) {
      await nextTick()
      adjustContextMenuPosition()
      if (submenuOpen.value) await openMoveSubmenu()
    }
  }
}

function adjustContextMenuPosition(): void {
  const menu = contextMenuRef.value
  if (!menu || !contextMenu.value) return
  const { width, height } = menu.getBoundingClientRect()
  contextMenu.value = {
    ...contextMenu.value,
    x: Math.max(8, Math.min(contextMenu.value.x, window.innerWidth - width - 8)),
    y: Math.max(8, Math.min(contextMenu.value.y, window.innerHeight - height - 8)),
  }
}

function handleNoteContextMenu(note: StickyNoteModel, event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  selectedId.value = note.id
  submenuOpen.value = false
  moveError.value = false
  contextMenu.value = { kind: 'note', note, x: event.clientX, y: event.clientY }
  void nextTick(adjustContextMenuPosition)
}

function handleBookContextMenu(book: NoteBook, event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  if (book.id === 'notes-default') return
  submenuOpen.value = false
  moveError.value = false
  contextMenu.value = { kind: 'book', book, x: event.clientX, y: event.clientY }
  void nextTick(adjustContextMenuPosition)
}

function requestDeleteBook(book: NoteBook): void {
  closeContextMenu()
  bookDeleteMode.value = 'move'
  window.setTimeout(() => {
    pendingBook.value = book
  }, 0)
}

async function confirmDeleteBook(): Promise<void> {
  const trashNotes = (pendingBook.value?.noteCount ?? 0) > 0 && bookDeleteMode.value === 'trash'
  await deleteBook(trashNotes)
}

async function openDesktop(id: string): Promise<void> {
  closeContextMenu()
  await editorRef.value?.flush()
  await window.electronAPI?.openNoteWindow(id)
}

async function toggleFavorite(id: string): Promise<void> {
  closeContextMenu()
  if (!window.electronAPI) return
  const saved = await window.electronAPI.toggleNoteFavorite(id)
  onSaved(saved)
}

function permanentlyDeleteSelected(): void {
  if (!selectedNote.value) return
  requestDelete(selectedNote.value.id, true)
}

watch(query, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void refresh(), 220)
})

watch(showBookRename, (open) => {
  if (!open) return
  void nextTick(() => {
    window.setTimeout(focusRenameInput, 0)
  })
})

watch(showNewBook, (open) => {
  if (!open) return
  void nextTick(() => {
    window.setTimeout(focusNewBookInput, 0)
  })
})

watch(() => selectedNote.value?.id, (id) => {
  if (!id || filter.value === 'trash') return
  void nextTick(() => {
    window.setTimeout(() => editorRef.value?.focusEditor(), 0)
  })
})

onMounted(async () => {
  try {
    const stored = JSON.parse(localStorage.getItem(paneStorageKey) || 'null')
    if (stored && typeof stored.notebook === 'number' && typeof stored.list === 'number') {
      notebookWidth.value = stored.notebook
      listWidth.value = stored.list
    }
  } catch { /* Ignore malformed or unavailable local storage. */ }
  if (workspaceRef.value) {
    workspaceWidth.value = workspaceRef.value.clientWidth
    applyPaneWidths(notebookWidth.value, listWidth.value)
    workspaceObserver = new ResizeObserver(([entry]) => {
      if (!entry) return
      workspaceWidth.value = entry.contentRect.width
      applyPaneWidths(notebookWidth.value, listWidth.value)
    })
    workspaceObserver.observe(workspaceRef.value)
  }
  await refresh()
  removeNotesListener = window.electronAPI?.onNotesChanged(() => void refresh())
  removeFlushListener = window.electronAPI?.onNotesFlush(() => { void editorRef.value?.flush() })
  window.addEventListener('click', closeContextMenu)
  window.addEventListener('blur', closeContextMenu)
})
onUnmounted(() => {
  stopPaneResize(false)
  workspaceObserver?.disconnect()
  if (searchTimer) clearTimeout(searchTimer)
  removeNotesListener?.()
  removeFlushListener?.()
  window.removeEventListener('click', closeContextMenu)
  window.removeEventListener('blur', closeContextMenu)
})
</script>

<template>
  <div class="notes-manager vault-texture">
    <header class="manager-titlebar titlebar-drag">
      <div class="manager-brand"><StickyNote :size="16" /><span>{{ $t('notes.managerTitle') }}</span></div>
      <div class="window-actions titlebar-no-drag">
        <button type="button" :aria-label="$t('common.hide')" @click="minimize"><Minus :size="16" /></button>
        <button type="button" :aria-label="$t('common.close')" @click="close"><X :size="16" /></button>
      </div>
    </header>
    <main ref="workspaceRef" class="manager-workspace" :class="{ 'is-resizing': isResizing }" :style="paneStyle">
      <aside class="notebook-panel">
        <button
          v-for="item in filters"
          :key="item.id"
          type="button"
          class="nav-row"
          :class="{ active: filter === item.id }"
          @click="selectFilter(item.id)"
        >
          <component :is="item.icon" :size="16" /><span>{{ $t(item.label) }}</span>
        </button>
        <div class="books-heading">
          <span>{{ $t('notes.books') }}</span>
          <button type="button" :title="$t('notes.newBook')" :aria-label="$t('notes.newBook')" @click="openNewBook"><Plus :size="15" /></button>
        </div>
        <div v-for="book in books" :key="book.id" class="book-row-wrap">
          <button
            type="button"
            class="nav-row book-row"
            :class="{ active: filter === book.id }"
            @click="selectFilter(book.id)"
            @contextmenu="handleBookContextMenu(book, $event)"
          >
            <BookOpen :size="16" /><span>{{ book.id === 'notes-default' ? $t('notes.defaultBook') : book.name }}</span><small>{{ book.noteCount }}</small>
          </button>
        </div>
      </aside>

      <div class="pane-resizer" role="separator" tabindex="0" aria-orientation="vertical"
        :aria-label="$t('notes.resizeNotebooks')" :aria-valuenow="notebookWidth" :aria-valuemin="NOTES_MIN_NOTEBOOK"
        :aria-valuemax="Math.max(NOTES_MIN_NOTEBOOK, workspaceWidth - listWidth - 2 * NOTES_DIVIDER_WIDTH - NOTES_MIN_EDITOR)"
        @pointerdown="startPaneResize('notebook', $event)" @keydown="onPaneResizeKeydown('notebook', $event)" />

      <section class="notes-list-panel">
        <div class="list-toolbar">
          <label class="search-field"><Search :size="16" /><input v-model="query" :placeholder="$t('notes.searchPlaceholder')"></label>
          <button type="button" class="new-note-btn" :title="$t('notes.newNote')" @click="createNote"><Plus :size="17" /></button>
        </div>
        <div v-if="error" class="list-error">
          <span>{{ $t('notes.loadFailed') }}</span>
          <button type="button" @click="refresh">{{ $t('notes.retry') }}</button>
        </div>
        <div class="notes-list">
          <button
            v-for="note in notes"
            :key="note.id"
            type="button"
            class="note-list-item"
            :class="{ active: selectedId === note.id }"
            :data-color="note.color"
            @click="selectNote(note.id)"
            @contextmenu="handleNoteContextMenu(note, $event)"
          >
            <span class="note-color-mark" />
            <span class="note-copy">
              <strong>{{ displayTitle(note) }}</strong>
              <small>{{ preview(note) }}</small>
            </span>
            <Star v-if="note.isFavorite" :size="13" fill="currentColor" />
            <ChevronRight :size="14" />
          </button>
          <div v-if="!loading && !error && notes.length === 0" class="empty-list">
            <FileText :size="28" />
            <strong>{{ $t('notes.empty') }}</strong>
            <span>{{ $t('notes.emptyHint') }}</span>
          </div>
        </div>
      </section>

      <div class="pane-resizer" role="separator" tabindex="0" aria-orientation="vertical"
        :aria-label="$t('notes.resizeNoteList')" :aria-valuenow="listWidth" :aria-valuemin="NOTES_MIN_LIST"
        :aria-valuemax="Math.max(NOTES_MIN_LIST, workspaceWidth - notebookWidth - 2 * NOTES_DIVIDER_WIDTH - NOTES_MIN_EDITOR)"
        @pointerdown="startPaneResize('list', $event)" @keydown="onPaneResizeKeydown('list', $event)" />

      <section class="editor-panel">
        <template v-if="selectedNote && filter === 'trash'">
          <div class="trash-preview" :data-note-color="selectedNote.color">
            <div><h2>{{ displayTitle(selectedNote) }}</h2><p>{{ preview(selectedNote) }}</p></div>
            <div class="trash-actions">
              <button type="button" class="copy-btn" :disabled="selectedNote.contentInvalid" @click="copyListedNote(selectedNote)"><Copy :size="16" />{{ $t('notes.copy') }}</button>
              <button type="button" class="restore-btn" @click="restoreSelected"><ArchiveRestore :size="16" />{{ $t('notes.restore') }}</button>
              <button type="button" class="delete-btn" @click="permanentlyDeleteSelected"><Trash2 :size="16" />{{ $t('notes.deletePermanent') }}</button>
            </div>
          </div>
        </template>
        <NoteEditor ref="editorRef" v-else-if="selectedNote" :key="selectedNote.id" :note="selectedNote" :books="books" @delete="deleteSelected" @saved="onSaved" />
        <div v-else class="no-selection"><StickyNote :size="36" /><span>{{ $t('notes.noSelection') }}</span></div>
      </section>
    </main>

    <Teleport to="body">
      <div
        v-if="contextMenu"
        ref="contextMenuRef"
        class="note-context-menu"
        :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
        @click.stop
        @contextmenu.prevent.stop
      >
        <template v-if="contextMenu.kind === 'book'">
          <button type="button" @click="startRename(contextMenu.book)">
            <Pencil :size="15" />{{ $t('notes.renameBook') }}
          </button>
          <button type="button" class="danger" @click="requestDeleteBook(contextMenu.book)">
            <Trash2 :size="15" />{{ $t('notes.deleteBook') }}
          </button>
        </template>
        <template v-else-if="filter === 'trash'">
          <button type="button" :disabled="contextMenu.note.contentInvalid" @click="copyListedNote(contextMenu.note)">
            <Copy :size="15" />{{ $t('notes.copy') }}
          </button>
          <button type="button" @click="restoreSelected(); closeContextMenu()">
            <ArchiveRestore :size="15" />{{ $t('notes.restore') }}
          </button>
          <button type="button" class="danger" @click="permanentlyDeleteSelected()">
            <Trash2 :size="15" />{{ $t('notes.deletePermanent') }}
          </button>
        </template>
        <template v-else>
          <button type="button" :disabled="contextMenu.note.contentInvalid" @click="copyListedNote(contextMenu.note)">
            <Copy :size="15" />{{ $t('notes.copy') }}
          </button>
          <button type="button" @click="openDesktop(contextMenu.note.id)">
            <ExternalLink :size="15" />{{ $t('notes.openDesktop') }}
          </button>
          <button type="button" @click="toggleFavorite(contextMenu.note.id)">
            <Star :size="15" :fill="contextMenu.note.isFavorite ? 'currentColor' : 'none'" />
            {{ contextMenu.note.isFavorite ? $t('notes.unfavorite') : $t('common.favorite') }}
          </button>
          <div class="move-menu-group" @pointerenter="openMoveSubmenu()" @pointerleave="submenuOpen = false">
            <button type="button" class="move-menu-trigger" :disabled="!targetBooks.length || movingNote"
              aria-haspopup="menu" :aria-expanded="submenuOpen" @click="openMoveSubmenu()"
              @focus="openMoveSubmenu()" @keydown="onMoveTriggerKeydown">
              <BookOpen :size="15" />{{ $t('notes.moveToBook') }}<ChevronRight class="submenu-chevron" :size="14" />
            </button>
            <div v-if="submenuOpen" ref="submenuRef" class="move-submenu" :style="submenuStyle" role="menu"
              :aria-label="$t('notes.moveToBook')" @keydown="onSubmenuKeydown">
              <button v-for="book in targetBooks" :key="book.id" type="button" role="menuitem" :disabled="movingNote"
                @click="moveNote(contextMenu.note.id, book.id)">
                <BookOpen :size="14" /><span>{{ book.id === 'notes-default' ? $t('notes.defaultBook') : book.name }}</span>
              </button>
            </div>
          </div>
          <p v-if="moveError" class="move-error" role="alert">{{ $t('notes.moveFailed') }}</p>
          <button type="button" class="danger" @click="deleteSelected(contextMenu.note.id)">
            <Trash2 :size="15" />{{ $t('common.delete') }}
          </button>
        </template>
      </div>
    </Teleport>

    <UiModal
      v-model:open="showDeleteConfirm"
      :title="deleteConfirm?.permanent ? t('notes.deletePermanent') : t('common.delete')"
      :width="400"
      :mask-closable="false"
      :show-footer="false"
      @close="cancelDeleteConfirm"
    >
      <p class="confirm-modal-body delete-confirm-text">
        {{ deleteConfirm?.permanent ? t('notes.confirmDeletePermanent') : t('notes.confirmDelete') }}
      </p>
      <template #footer>
        <div class="confirm-modal-actions">
          <UiButton variant="default" @click="cancelDeleteConfirm">{{ $t('common.cancel') }}</UiButton>
          <UiButton variant="danger" @click="confirmDelete">
            {{ deleteConfirm?.permanent ? t('notes.deletePermanent') : t('common.delete') }}
          </UiButton>
        </div>
      </template>
    </UiModal>

    <UiModal
      v-model:open="showNewBook"
      :title="t('notes.newBook')"
      :width="400"
      :mask-closable="false"
      :show-footer="false"
      @close="cancelNewBook"
    >
      <UiInput
        v-model="newBookName"
        class="book-create-input"
        :maxlength="80"
        :placeholder="t('notes.bookNamePlaceholder')"
        @keydown="onNewBookKeydown"
      />
      <template #footer>
        <div class="confirm-modal-actions">
          <UiButton variant="default" :disabled="creatingBook" @click="cancelNewBook">{{ $t('common.cancel') }}</UiButton>
          <UiButton variant="primary" :loading="creatingBook" :disabled="!newBookName.trim()" @click="submitBook">{{ $t('notes.createBook') }}</UiButton>
        </div>
      </template>
    </UiModal>

    <UiModal
      v-model:open="showBookRename"
      :title="t('notes.renameBookTitle')"
      :width="400"
      :mask-closable="false"
      :show-footer="false"
      @close="cancelRename"
    >
      <UiInput
        v-model="renamingBookName"
        class="book-rename-input"
        :maxlength="80"
        autofocus
        :placeholder="t('notes.bookNamePlaceholder')"
        @keydown="onRenameKeydown"
      />
      <template #footer>
        <div class="confirm-modal-actions">
          <UiButton variant="default" @click="cancelRename">{{ $t('common.cancel') }}</UiButton>
          <UiButton variant="primary" :disabled="!renamingBookName.trim()" @click="submitRename">{{ $t('common.save') }}</UiButton>
        </div>
      </template>
    </UiModal>

    <UiModal
      v-model:open="showBookDelete"
      :title="t('notes.deleteBook')"
      :width="420"
      :mask-closable="false"
      :show-footer="false"
      @close="pendingBook = null"
    >
      <p class="confirm-modal-body delete-confirm-text">
        {{ t('notes.confirmDeleteBook', { name: pendingBook?.name ?? '' }) }}
      </p>
      <div v-if="pendingBook && pendingBook.noteCount > 0" class="book-delete-options">
        <p class="book-delete-hint">{{ t('notes.confirmDeleteBookNotes', { count: pendingBook.noteCount }) }}</p>
        <button
          type="button"
          class="book-delete-option"
          :class="{ active: bookDeleteMode === 'move' }"
          @click="bookDeleteMode = 'move'"
        >
          {{ $t('notes.deleteBookMove') }}
        </button>
        <button
          type="button"
          class="book-delete-option"
          :class="{ active: bookDeleteMode === 'trash' }"
          @click="bookDeleteMode = 'trash'"
        >
          {{ $t('notes.deleteBookTrash') }}
        </button>
      </div>
      <template #footer>
        <div class="confirm-modal-actions">
          <UiButton variant="default" @click="pendingBook = null">{{ $t('common.cancel') }}</UiButton>
          <UiButton variant="danger" @click="confirmDeleteBook">{{ $t('common.delete') }}</UiButton>
        </div>
      </template>
    </UiModal>
    <ToastHost />
  </div>
</template>

<style scoped>
.notes-manager { height: 100vh; display: flex; flex-direction: column; color: var(--text-primary); }
.manager-titlebar { height: 38px; flex: 0 0 38px; display: flex; align-items: center; justify-content: space-between; padding-left: 14px; border-bottom: 1px solid var(--titlebar-border); background: var(--titlebar-base); box-shadow: var(--titlebar-shadow); }
.manager-brand { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }.manager-brand svg { color: var(--accent-primary); }
.window-actions { height: 100%; display: flex; }.window-actions button { width: 44px; height: 100%; display: grid; place-items: center; padding: 0; border: 0; background: transparent; color: var(--text-secondary); }.window-actions button:hover { background: var(--bg-hover); color: var(--text-primary); }
.manager-workspace { flex: 1; min-height: 0; display: grid; grid-template-columns: var(--notes-notebook-width) 8px var(--notes-list-width) 8px minmax(0, 1fr); -webkit-app-region: no-drag; }
.manager-workspace.is-resizing { user-select: none; }
.pane-resizer { position: relative; z-index: 1; min-width: 0; background: var(--bg-surface); cursor: col-resize; touch-action: none; }
.pane-resizer::after { content: ''; position: absolute; inset: 0 3px; background: var(--border-default); transition: background 120ms ease; }
.pane-resizer:hover::after,.pane-resizer:focus-visible::after,.is-resizing .pane-resizer:hover::after { background: var(--accent-primary); }
.pane-resizer:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: -2px; }
.notebook-panel,.notes-list-panel { min-width: 0; min-height: 0; background: var(--bg-surface); }
.notebook-panel { padding: 14px 10px; overflow-y: auto; }
.nav-row { width: 100%; min-height: 38px; display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: 7px; padding: 7px 10px; border: 0; border-radius: 6px; background: transparent; color: var(--text-secondary); text-align: left; cursor: pointer; }.nav-row:hover { background: var(--bg-hover); color: var(--text-primary); }.nav-row.active { background: var(--accent-subtle); color: var(--accent-primary); }.nav-row small { font-size: 11px; color: var(--text-muted); }
.books-heading { display: flex; align-items: center; justify-content: space-between; margin: 18px 8px 7px; color: var(--text-muted); font-size: 11px; text-transform: uppercase; }.books-heading button { width: 26px; height: 26px; display: grid; place-items: center; border: 0; background: transparent; color: inherit; cursor: pointer; }
.book-row-wrap { position: relative; }
.list-error { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; color: var(--status-danger); font-size: 12px; }.list-error button { border: 0; background: transparent; color: var(--accent-primary); cursor: pointer; }
.notes-list-panel { display: flex; flex-direction: column; background: var(--bg-app); }.list-toolbar { height: 58px; flex: 0 0 58px; display: flex; align-items: center; gap: 8px; padding: 10px; border-bottom: 1px solid var(--border-default); }
.search-field { flex: 1; height: 36px; display: flex; align-items: center; gap: 7px; padding: 0 10px; border: 1px solid var(--border-default); border-radius: 6px; background: var(--input-bg); color: var(--text-muted); }.search-field input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: var(--text-primary); }
.new-note-btn { width: 36px; height: 36px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 6px; background: var(--accent-primary); color: var(--btn-primary-text); cursor: pointer; }
.notes-list { flex: 1; min-height: 0; overflow-y: auto; }.note-list-item { width: 100%; min-height: 72px; display: grid; grid-template-columns: 4px minmax(0, 1fr) 16px 14px; align-items: center; gap: 9px; padding: 10px 12px 10px 0; border: 0; border-bottom: 1px solid var(--border-default); background: transparent; color: var(--text-secondary); text-align: left; cursor: pointer; }.note-list-item:hover { background: var(--bg-hover); }.note-list-item.active { background: var(--accent-subtle); }.note-color-mark { align-self: stretch; border-radius: 0 3px 3px 0; background: var(--note-paper); }.note-list-item[data-color="yellow"] .note-color-mark { background: var(--note-yellow-strong); }.note-list-item[data-color="green"] .note-color-mark { background: var(--note-green-strong); }.note-list-item[data-color="blue"] .note-color-mark { background: var(--note-blue-strong); }.note-list-item[data-color="pink"] .note-color-mark { background: var(--note-pink-strong); }.note-list-item[data-color="violet"] .note-color-mark { background: var(--note-violet-strong); }
.note-copy { min-width: 0; display: flex; flex-direction: column; gap: 5px; }.note-copy strong,.note-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.note-copy strong { color: var(--text-primary); font-size: 14px; }.note-copy small { color: var(--text-muted); font-size: 12px; }
.empty-list,.no-selection { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--text-muted); text-align: center; }.empty-list { min-height: 260px; padding: 24px; }.empty-list strong { color: var(--text-secondary); }.empty-list span { font-size: 12px; }
.editor-panel { min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-surface); }
.editor-panel :deep(.note-editor) { flex: 1; min-height: 0; height: auto; }
.trash-preview { flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 48px; background: var(--note-paper); color: var(--note-ink); }.trash-preview h2 { margin: 0 0 16px; }.trash-preview p { color: var(--note-muted); white-space: pre-wrap; }.trash-actions { display: flex; flex-wrap: wrap; gap: 10px; }.trash-actions button { flex: 0 0 auto; min-height: 36px; display: inline-flex; align-items: center; gap: 7px; padding: 0 13px; border-radius: 6px; cursor: pointer; white-space: nowrap; }.copy-btn { border: 1px solid color-mix(in srgb, var(--note-ink) 22%, transparent); background: color-mix(in srgb, var(--note-paper) 55%, transparent); color: var(--note-ink); }.copy-btn:hover:not(:disabled) { border-color: var(--accent-primary); color: var(--accent-primary); }.copy-btn:disabled { opacity: .45; cursor: default; }.restore-btn { border: 0; background: var(--accent-primary); color: var(--btn-primary-text); }.delete-btn { border: 1px solid color-mix(in srgb, var(--status-danger) 38%, transparent); background: transparent; color: var(--status-danger); }
.note-context-menu { position: fixed; z-index: 100; min-width: 188px; padding: 4px; border: 1px solid var(--border-default); border-radius: 8px; background: var(--bg-popover); box-shadow: var(--shadow-popover); }
.note-context-menu button { width: 100%; min-height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: var(--text-primary); text-align: left; cursor: pointer; font-size: 13px; }
.note-context-menu button:hover { background: var(--bg-hover); }
.note-context-menu button:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: -2px; }
.note-context-menu button:disabled { opacity: .45; cursor: default; }
.note-context-menu button.danger { color: var(--status-danger); }
.move-menu-group { position: relative; }
.submenu-chevron { margin-left: auto; }
.move-submenu { position: absolute; z-index: 1; top: 0; left: calc(100% - 4px); min-width: 188px; max-width: min(260px, calc(100vw - 16px)); max-height: calc(100vh - 16px); overflow-y: auto; padding: 4px; border: 1px solid var(--border-default); border-radius: 8px; background: var(--bg-popover); box-shadow: var(--shadow-popover); }
.move-submenu button span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.move-error { margin: 4px 8px; max-width: 170px; color: var(--status-danger); font-size: 12px; line-height: 1.4; }
.delete-confirm-text { margin: 0; font-size: 14px; line-height: 1.6; color: var(--text-secondary); }
.confirm-modal-actions { display: flex; justify-content: flex-end; align-items: center; gap: 10px; width: 100%; }
.confirm-modal-actions :deep(.ui-classic-btn) { min-width: 96px; padding: 10px 22px; }
.book-rename-input,
.book-create-input { width: 100%; }
.book-delete-options { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
.book-delete-hint { margin: 0; font-size: 13px; color: var(--text-muted); }
.book-delete-option { width: 100%; min-height: 38px; padding: 8px 12px; border: 1px solid var(--border-default); border-radius: 8px; background: var(--bg-elevated); color: var(--text-primary); text-align: left; cursor: pointer; font-size: 13px; }
.book-delete-option:hover { border-color: var(--border-accent); background: var(--bg-hover); }
.book-delete-option.active { border-color: var(--accent-primary); background: var(--accent-subtle); color: var(--accent-primary); }
</style>
