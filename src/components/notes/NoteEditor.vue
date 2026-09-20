<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, toRaw, watch } from 'vue'
import { ExternalLink, Star, Trash2 } from 'lucide-vue-next'
import NoteBlockEditor from './NoteBlockEditor.vue'
import { NOTE_COLORS, normalizeNoteContent } from '@/shared/noteBlocks'
import type { NoteBook, NoteColor, NoteContent, StickyNote, StickyNoteInput } from '@/shared/types'

function cloneContent(content: NoteContent): NoteContent {
  return normalizeNoteContent(toRaw(content))
}

function toDraft(note: StickyNote): StickyNoteInput {
  return {
    title: note.title,
    content: cloneContent(note.content),
    bookId: note.bookId,
    color: note.color,
    isFavorite: note.isFavorite,
  }
}

const props = withDefaults(defineProps<{ note: StickyNote; books?: NoteBook[]; desktop?: boolean }>(), {
  books: () => [], desktop: false,
})
const emit = defineEmits<{ saved: [note: StickyNote]; delete: [id: string] }>()

const draft = ref<StickyNoteInput>(toDraft(props.note))
const saveState = ref<'saved' | 'saving' | 'failed'>('saved')
let saveTimer: ReturnType<typeof setTimeout> | null = null
let hydrating = false
let lastSavedAt = props.note.updatedAt

function hydrate(note: StickyNote): void {
  hydrating = true
  lastSavedAt = note.updatedAt
  draft.value = toDraft(note)
  saveState.value = 'saved'
  void nextTick(() => { hydrating = false })
}

watch(() => [props.note.id, props.note.updatedAt] as const, () => {
  if (props.note.updatedAt === lastSavedAt) return
  hydrate(props.note)
})

async function save(): Promise<void> {
  if (!window.electronAPI || props.note.contentInvalid) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  saveState.value = 'saving'
  try {
    const saved = await window.electronAPI.updateNote(props.note.id, {
      title: draft.value.title,
      content: cloneContent(draft.value.content),
      bookId: draft.value.bookId,
      color: draft.value.color,
      isFavorite: draft.value.isFavorite,
    })
    lastSavedAt = saved.updatedAt
    saveState.value = 'saved'
    emit('saved', saved)
  } catch {
    saveState.value = 'failed'
  }
}

watch(draft, () => {
  if (hydrating || props.note.contentInvalid) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void save(), 400)
}, { deep: true })

function setColor(color: NoteColor): void { draft.value.color = color }
function toggleFavorite(): void { draft.value.isFavorite = !draft.value.isFavorite }
function openDesktop(): void { void window.electronAPI?.openNoteWindow(props.note.id) }

async function flush(): Promise<void> {
  if (props.note.contentInvalid) return
  await save()
}

onBeforeUnmount(() => { if (saveTimer && !props.note.contentInvalid) void save() })
defineExpose({ flush })
</script>

<template>
  <section class="note-editor" :data-note-color="draft.color">
    <header v-if="!desktop" class="editor-toolbar">
      <select v-model="draft.bookId" class="book-select" :aria-label="$t('notes.moveTo')">
        <option v-for="book in books" :key="book.id" :value="book.id">{{ book.id === 'notes-default' ? $t('notes.defaultBook') : book.name }}</option>
      </select>
      <div class="toolbar-spacer" />
      <span class="save-state" :class="`save-state--${saveState}`">
        {{ $t(`notes.${saveState === 'failed' ? 'saveFailed' : saveState}`) }}
        <button v-if="saveState === 'failed'" type="button" class="retry-save" @click="save">{{ $t('notes.retry') }}</button>
      </span>
      <div class="color-row" :aria-label="$t('notes.color')">
        <button
          v-for="color in NOTE_COLORS"
          :key="color"
          type="button"
          class="color-swatch"
          :class="{ 'color-swatch--active': draft.color === color }"
          :data-color="color"
          :title="color"
          @click="setColor(color)"
        />
      </div>
      <button type="button" class="icon-action" :class="{ active: draft.isFavorite }" :title="$t('common.favorite')" @click="toggleFavorite">
        <Star :size="17" :fill="draft.isFavorite ? 'currentColor' : 'none'" />
      </button>
      <button type="button" class="icon-action" :title="$t('notes.openDesktop')" @click="openDesktop"><ExternalLink :size="17" /></button>
      <button type="button" class="icon-action icon-action--danger" :title="$t('common.delete')" @click="emit('delete', note.id)"><Trash2 :size="17" /></button>
    </header>
    <div class="editor-paper" @focusout="flush">
      <p v-if="note.contentInvalid" class="content-invalid">{{ $t('notes.contentInvalid') }}</p>
      <input v-model="draft.title" class="note-title-input" :placeholder="$t('notes.untitled')" maxlength="200" :disabled="note.contentInvalid">
      <NoteBlockEditor v-if="!note.contentInvalid" v-model="draft.content" />
    </div>
  </section>
</template>

<style scoped>
.note-editor { --note-ink: var(--text-primary); --note-muted: var(--text-secondary); height: 100%; min-width: 0; display: flex; flex-direction: column; background: var(--note-paper); color: var(--note-ink); }
.note-editor[data-note-color="yellow"] { --note-paper: var(--note-yellow); }
.note-editor[data-note-color="green"] { --note-paper: var(--note-green); }
.note-editor[data-note-color="blue"] { --note-paper: var(--note-blue); }
.note-editor[data-note-color="pink"] { --note-paper: var(--note-pink); }
.note-editor[data-note-color="violet"] { --note-paper: var(--note-violet); }
.editor-toolbar { min-height: 48px; display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-bottom: 1px solid var(--border-default); background: var(--bg-surface); }
.book-select { width: 150px; height: 32px; padding: 0 28px 0 9px; border: 1px solid var(--border-default); border-radius: 6px; background: var(--input-bg); color: var(--text-primary); }
.toolbar-spacer { flex: 1; }
.save-state { min-width: 100px; text-align: right; font-size: 12px; color: var(--text-muted); display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px; }
.save-state--failed { color: var(--status-danger); }
.retry-save { border: 0; background: transparent; color: var(--accent-primary); cursor: pointer; font-size: 12px; }
.content-invalid { margin: 0 0 16px; padding: 10px 12px; border-radius: 8px; background: color-mix(in srgb, var(--status-danger) 10%, transparent); color: var(--status-danger); font-size: 13px; }
.color-row { display: flex; gap: 4px; }
.color-swatch { width: 18px; height: 18px; padding: 0; border: 1px solid var(--border-strong); border-radius: 50%; background: var(--note-paper); cursor: pointer; }
.color-swatch[data-color="yellow"] { background: var(--note-yellow); }.color-swatch[data-color="green"] { background: var(--note-green); }.color-swatch[data-color="blue"] { background: var(--note-blue); }.color-swatch[data-color="pink"] { background: var(--note-pink); }.color-swatch[data-color="violet"] { background: var(--note-violet); }
.color-swatch--active { outline: 2px solid var(--accent-primary); outline-offset: 2px; }
.icon-action { width: 32px; height: 32px; padding: 0; display: grid; place-items: center; border: 0; border-radius: 6px; background: transparent; color: var(--text-secondary); cursor: pointer; }
.icon-action:hover,.icon-action.active { color: var(--accent-primary); background: var(--accent-subtle); }.icon-action--danger:hover { color: var(--status-danger); background: color-mix(in srgb, var(--status-danger) 10%, transparent); }
.editor-paper { flex: 1; min-height: 0; overflow: auto; padding: 28px clamp(22px, 5vw, 64px) 48px; }
.note-title-input { width: 100%; margin: 0 0 20px; padding: 0 0 14px; border: 0; border-bottom: 1px solid color-mix(in srgb, var(--note-ink) 12%, transparent); outline: 0; background: transparent; color: var(--note-ink); font: 600 24px/1.25 var(--font-body); letter-spacing: 0; }
.note-title-input::placeholder { color: var(--note-muted); }
</style>
