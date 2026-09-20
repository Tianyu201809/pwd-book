<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArchiveRestore, BookOpen, ChevronRight, ExternalLink, FileText, Minus, Pencil, Plus, Search, Star, StickyNote, Trash2, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import NoteEditor from './NoteEditor.vue'
import { UiButton, UiModal } from '@/components/ui'
import { useNotes } from '@/composables/useNotes'
import type { NoteBook, NoteFilter, StickyNote as StickyNoteModel } from '@/shared/types'

const { t } = useI18n()
const { books, notes, filter, query, selectedId, selectedNote, loading, error, refresh, selectFilter, createNote } = useNotes()
const newBookName = ref('')
const addingBook = ref(false)
const renamingBookId = ref<string | null>(null)
const renamingBookName = ref('')
const pendingBook = ref<NoteBook | null>(null)
const editorRef = ref<InstanceType<typeof NoteEditor> | null>(null)
const contextMenu = ref<{ note: StickyNoteModel; x: number; y: number } | null>(null)
const contextMenuRef = ref<HTMLElement | null>(null)
const deleteConfirm = ref<{ id: string; title: string; permanent: boolean } | null>(null)
const showDeleteConfirm = computed({
  get: () => deleteConfirm.value !== null,
  set: (open: boolean) => { if (!open) deleteConfirm.value = null },
})
let removeNotesListener: (() => void) | undefined
let removeFlushListener: (() => void) | undefined
let searchTimer: ReturnType<typeof setTimeout> | null = null

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

async function submitBook(): Promise<void> {
  const name = newBookName.value.trim()
  if (!name || !window.electronAPI) return
  await window.electronAPI.createNoteBook(name)
  newBookName.value = ''
  addingBook.value = false
  await refresh()
}

function startRename(book: NoteBook): void {
  if (book.id === 'notes-default') return
  renamingBookId.value = book.id
  renamingBookName.value = book.name
}

async function submitRename(): Promise<void> {
  const id = renamingBookId.value
  const name = renamingBookName.value.trim()
  if (!id || !name || !window.electronAPI) return
  await window.electronAPI.updateNoteBook(id, name)
  renamingBookId.value = null
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

function closeContextMenu(): void {
  contextMenu.value = null
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
  contextMenu.value = { note, x: event.clientX, y: event.clientY }
  void nextTick(adjustContextMenuPosition)
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

onMounted(async () => {
  await refresh()
  removeNotesListener = window.electronAPI?.onNotesChanged(() => void refresh())
  removeFlushListener = window.electronAPI?.onNotesFlush(() => { void editorRef.value?.flush() })
  window.addEventListener('click', closeContextMenu)
  window.addEventListener('blur', closeContextMenu)
})
onUnmounted(() => {
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
    <main class="manager-workspace">
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
          <button type="button" :title="$t('notes.newBook')" @click="addingBook = true"><Plus :size="15" /></button>
        </div>
        <form v-if="addingBook" class="new-book-form" @submit.prevent="submitBook">
          <input v-model="newBookName" maxlength="80" autofocus :placeholder="$t('notes.newBook')">
        </form>
        <div v-for="book in books" :key="book.id" class="book-row-wrap">
          <form v-if="renamingBookId === book.id" class="new-book-form" @submit.prevent="submitRename">
            <input v-model="renamingBookName" maxlength="80" autofocus @blur="submitRename">
          </form>
          <button
            v-else
            type="button"
            class="nav-row book-row"
            :class="{ active: filter === book.id }"
            @click="selectFilter(book.id)"
          >
            <BookOpen :size="16" /><span>{{ book.id === 'notes-default' ? $t('notes.defaultBook') : book.name }}</span><small>{{ book.noteCount }}</small>
          </button>
          <div v-if="book.id !== 'notes-default' && renamingBookId !== book.id" class="book-actions titlebar-no-drag">
            <button type="button" :title="$t('notes.renameBook')" @click.stop="startRename(book)"><Pencil :size="13" /></button>
            <button type="button" :title="$t('notes.deleteBook')" @click.stop="pendingBook = book"><Trash2 :size="13" /></button>
          </div>
        </div>
        <div v-if="pendingBook" class="book-delete-card">
          <strong>{{ $t('notes.deleteBook') }} · {{ pendingBook.name }}</strong>
          <button type="button" @click="deleteBook(false)">{{ $t('notes.deleteBookMove') }}</button>
          <button type="button" @click="deleteBook(true)">{{ $t('notes.deleteBookTrash') }}</button>
          <button type="button" class="ghost" @click="pendingBook = null">{{ $t('common.cancel') }}</button>
        </div>
      </aside>

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

      <section class="editor-panel">
        <template v-if="selectedNote && filter === 'trash'">
          <div class="trash-preview" :data-note-color="selectedNote.color">
            <div><h2>{{ displayTitle(selectedNote) }}</h2><p>{{ preview(selectedNote) }}</p></div>
            <div class="trash-actions">
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
        <template v-if="filter === 'trash'">
          <button type="button" @click="restoreSelected(); closeContextMenu()">
            <ArchiveRestore :size="15" />{{ $t('notes.restore') }}
          </button>
          <button type="button" class="danger" @click="permanentlyDeleteSelected()">
            <Trash2 :size="15" />{{ $t('notes.deletePermanent') }}
          </button>
        </template>
        <template v-else>
          <button type="button" @click="openDesktop(contextMenu.note.id)">
            <ExternalLink :size="15" />{{ $t('notes.openDesktop') }}
          </button>
          <button type="button" @click="toggleFavorite(contextMenu.note.id)">
            <Star :size="15" :fill="contextMenu.note.isFavorite ? 'currentColor' : 'none'" />
            {{ contextMenu.note.isFavorite ? $t('notes.unfavorite') : $t('common.favorite') }}
          </button>
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
  </div>
</template>

<style scoped>
.notes-manager { height: 100vh; display: flex; flex-direction: column; color: var(--text-primary); }
.manager-titlebar { height: 38px; flex: 0 0 38px; display: flex; align-items: center; justify-content: space-between; padding-left: 14px; border-bottom: 1px solid var(--titlebar-border); background: var(--titlebar-base); box-shadow: var(--titlebar-shadow); }
.manager-brand { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }.manager-brand svg { color: var(--accent-primary); }
.window-actions { height: 100%; display: flex; }.window-actions button { width: 44px; height: 100%; display: grid; place-items: center; padding: 0; border: 0; background: transparent; color: var(--text-secondary); }.window-actions button:hover { background: var(--bg-hover); color: var(--text-primary); }
.manager-workspace { flex: 1; min-height: 0; display: grid; grid-template-columns: 220px 300px minmax(300px, 1fr); -webkit-app-region: no-drag; }
.notebook-panel,.notes-list-panel { min-height: 0; border-right: 1px solid var(--border-default); background: var(--bg-surface); }
.notebook-panel { padding: 14px 10px; overflow-y: auto; }
.nav-row { width: 100%; min-height: 38px; display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: 7px; padding: 7px 10px; border: 0; border-radius: 6px; background: transparent; color: var(--text-secondary); text-align: left; cursor: pointer; }.nav-row:hover { background: var(--bg-hover); color: var(--text-primary); }.nav-row.active { background: var(--accent-subtle); color: var(--accent-primary); }.nav-row small { font-size: 11px; color: var(--text-muted); }
.books-heading { display: flex; align-items: center; justify-content: space-between; margin: 18px 8px 7px; color: var(--text-muted); font-size: 11px; text-transform: uppercase; }.books-heading button { width: 26px; height: 26px; display: grid; place-items: center; border: 0; background: transparent; color: inherit; cursor: pointer; }
.new-book-form { padding: 0 4px 7px; }.new-book-form input { width: 100%; height: 34px; padding: 0 9px; border: 1px solid var(--border-accent); border-radius: 6px; outline: 0; background: var(--input-bg); color: var(--text-primary); }
.book-row-wrap { position: relative; }.book-row-wrap:hover .book-actions { opacity: 1; }
.book-actions { position: absolute; top: 4px; right: 6px; display: flex; gap: 2px; opacity: 0; }.book-actions button { width: 22px; height: 22px; display: grid; place-items: center; border: 0; border-radius: 4px; background: var(--bg-elevated); color: var(--text-muted); cursor: pointer; }.book-actions button:hover { color: var(--text-primary); }
.book-delete-card { display: flex; flex-direction: column; gap: 6px; margin: 8px 4px 0; padding: 10px; border: 1px solid var(--border-default); border-radius: 8px; background: var(--bg-elevated); font-size: 12px; }.book-delete-card button { min-height: 30px; border: 1px solid var(--border-default); border-radius: 6px; background: var(--input-bg); color: var(--text-primary); cursor: pointer; }.book-delete-card .ghost { background: transparent; }
.list-error { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; color: var(--status-danger); font-size: 12px; }.list-error button { border: 0; background: transparent; color: var(--accent-primary); cursor: pointer; }
.notes-list-panel { display: flex; flex-direction: column; background: var(--bg-app); }.list-toolbar { height: 58px; flex: 0 0 58px; display: flex; align-items: center; gap: 8px; padding: 10px; border-bottom: 1px solid var(--border-default); }
.search-field { flex: 1; height: 36px; display: flex; align-items: center; gap: 7px; padding: 0 10px; border: 1px solid var(--border-default); border-radius: 6px; background: var(--input-bg); color: var(--text-muted); }.search-field input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: var(--text-primary); }
.new-note-btn { width: 36px; height: 36px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 6px; background: var(--accent-primary); color: var(--btn-primary-text); cursor: pointer; }
.notes-list { flex: 1; min-height: 0; overflow-y: auto; }.note-list-item { width: 100%; min-height: 72px; display: grid; grid-template-columns: 4px minmax(0, 1fr) 16px 14px; align-items: center; gap: 9px; padding: 10px 12px 10px 0; border: 0; border-bottom: 1px solid var(--border-default); background: transparent; color: var(--text-secondary); text-align: left; cursor: pointer; }.note-list-item:hover { background: var(--bg-hover); }.note-list-item.active { background: var(--accent-subtle); }.note-color-mark { align-self: stretch; border-radius: 0 3px 3px 0; background: var(--note-paper); }.note-list-item[data-color="yellow"] .note-color-mark { background: var(--note-yellow-strong); }.note-list-item[data-color="green"] .note-color-mark { background: var(--note-green-strong); }.note-list-item[data-color="blue"] .note-color-mark { background: var(--note-blue-strong); }.note-list-item[data-color="pink"] .note-color-mark { background: var(--note-pink-strong); }.note-list-item[data-color="violet"] .note-color-mark { background: var(--note-violet-strong); }
.note-copy { min-width: 0; display: flex; flex-direction: column; gap: 5px; }.note-copy strong,.note-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.note-copy strong { color: var(--text-primary); font-size: 14px; }.note-copy small { color: var(--text-muted); font-size: 12px; }
.empty-list,.no-selection { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--text-muted); text-align: center; }.empty-list { min-height: 260px; padding: 24px; }.empty-list strong { color: var(--text-secondary); }.empty-list span { font-size: 12px; }
.editor-panel { min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-surface); }
.editor-panel :deep(.note-editor) { flex: 1; min-height: 0; height: auto; }
.trash-preview { flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 48px; background: var(--note-paper); color: var(--note-ink); }.trash-preview h2 { margin: 0 0 16px; }.trash-preview p { color: var(--note-muted); white-space: pre-wrap; }.trash-actions { display: flex; gap: 10px; }.trash-actions button { min-height: 36px; display: inline-flex; align-items: center; gap: 7px; padding: 0 13px; border-radius: 6px; cursor: pointer; }.restore-btn { border: 0; background: var(--accent-primary); color: var(--btn-primary-text); }.delete-btn { border: 1px solid color-mix(in srgb, var(--status-danger) 38%, transparent); background: transparent; color: var(--status-danger); }
.note-context-menu { position: fixed; z-index: 100; min-width: 188px; padding: 4px; border: 1px solid var(--border-default); border-radius: 8px; background: var(--bg-popover); box-shadow: var(--shadow-popover); }
.note-context-menu button { width: 100%; min-height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: var(--text-primary); text-align: left; cursor: pointer; font-size: 13px; }
.note-context-menu button:hover { background: var(--bg-hover); }
.note-context-menu button.danger { color: var(--status-danger); }
.delete-confirm-text { margin: 0; font-size: 14px; line-height: 1.6; color: var(--text-secondary); }
.confirm-modal-actions { display: flex; justify-content: flex-end; align-items: center; gap: 10px; width: 100%; }
.confirm-modal-actions :deep(.ui-classic-btn) { min-width: 96px; padding: 10px 22px; }
</style>
