<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { GripHorizontal, Pin, PinOff, Trash2, X } from 'lucide-vue-next'
import NoteEditor from './NoteEditor.vue'
import { UiButton, UiModal } from '@/components/ui'
import { NOTE_COLORS } from '@/shared/noteBlocks'
import type { NoteColor, StickyNote } from '@/shared/types'

const { t } = useI18n()
const noteId = new URLSearchParams(location.search).get('id') ?? ''
const note = ref<StickyNote | null>(null)
const pinned = ref(false)
const editorRef = ref<InstanceType<typeof NoteEditor> | null>(null)
const showDeleteConfirm = ref(false)
let removeListener: (() => void) | undefined
let removeFlushListener: (() => void) | undefined

async function load(): Promise<void> {
  note.value = await window.electronAPI?.getNote(noteId) ?? null
  pinned.value = note.value?.isAlwaysOnTop ?? false
}

async function hide(): Promise<void> {
  await editorRef.value?.flush()
  window.electronAPI?.hideNoteWindow(noteId)
}

async function togglePin(): Promise<void> {
  pinned.value = await window.electronAPI?.toggleNoteWindowAlwaysOnTop(noteId) ?? false
}

async function setColor(color: NoteColor): Promise<void> {
  if (!note.value || note.value.contentInvalid) return
  await editorRef.value?.flush()
  const current = await window.electronAPI?.getNote(noteId)
  if (!current) return
  note.value = await window.electronAPI.updateNote(noteId, {
    title: current.title,
    content: current.content,
    bookId: current.bookId,
    color,
    isFavorite: current.isFavorite,
  })
}

function requestDelete(): void {
  window.setTimeout(() => {
    showDeleteConfirm.value = true
  }, 0)
}

async function confirmDelete(): Promise<void> {
  showDeleteConfirm.value = false
  await editorRef.value?.flush()
  await window.electronAPI?.deleteNote(noteId)
}

onMounted(async () => {
  await load()
  removeListener = window.electronAPI?.onNotesChanged((id) => { if (!id || id === noteId) void load() })
  removeFlushListener = window.electronAPI?.onNotesFlush(() => { void editorRef.value?.flush() })
  void nextTick(() => editorRef.value?.focusEditor())
})
onUnmounted(() => {
  removeListener?.()
  removeFlushListener?.()
})
</script>

<template>
  <div v-if="note" class="sticky-window" :data-note-color="note.color">
    <header class="sticky-titlebar titlebar-drag">
      <GripHorizontal :size="17" />
      <span>{{ note.title.trim() || $t('notes.untitled') }}</span>
      <div class="sticky-actions titlebar-no-drag">
        <button type="button" :title="$t('notes.alwaysOnTop')" @click="togglePin"><PinOff v-if="pinned" :size="15" /><Pin v-else :size="15" /></button>
        <button type="button" :title="$t('common.delete')" @click="requestDelete"><Trash2 :size="15" /></button>
        <button type="button" :title="$t('notes.hide')" @click="hide"><X :size="15" /></button>
      </div>
    </header>
    <div class="sticky-colors titlebar-no-drag">
      <button
        v-for="color in NOTE_COLORS"
        :key="color"
        type="button"
        class="color-swatch"
        :class="{ 'color-swatch--active': note.color === color }"
        :data-color="color"
        :title="color"
        @click="setColor(color)"
      />
    </div>
    <main class="sticky-editor"><NoteEditor ref="editorRef" :note="note" desktop @saved="note = $event" /></main>

    <UiModal
      v-model:open="showDeleteConfirm"
      :title="t('common.delete')"
      :width="360"
      :mask-closable="false"
      :show-footer="false"
      @close="showDeleteConfirm = false"
    >
      <p class="delete-confirm-text">{{ $t('notes.confirmDelete') }}</p>
      <template #footer>
        <div class="confirm-modal-actions">
          <UiButton variant="default" @click="showDeleteConfirm = false">{{ $t('common.cancel') }}</UiButton>
          <UiButton variant="danger" @click="confirmDelete">{{ $t('common.delete') }}</UiButton>
        </div>
      </template>
    </UiModal>
  </div>
</template>

<style scoped>
.sticky-window { --note-ink: var(--text-primary); --note-muted: var(--text-secondary); height: 100vh; display: flex; flex-direction: column; overflow: hidden; background: var(--note-paper); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--note-ink) 10%, transparent); }
.sticky-window[data-note-color="yellow"] { --note-paper: var(--note-yellow); }.sticky-window[data-note-color="green"] { --note-paper: var(--note-green); }.sticky-window[data-note-color="blue"] { --note-paper: var(--note-blue); }.sticky-window[data-note-color="pink"] { --note-paper: var(--note-pink); }.sticky-window[data-note-color="violet"] { --note-paper: var(--note-violet); }
.sticky-titlebar { height: 34px; flex: 0 0 34px; display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; align-items: center; padding-left: 8px; border-bottom: 1px solid color-mix(in srgb, var(--note-ink) 10%, transparent); color: var(--note-muted); }.sticky-titlebar > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; }.sticky-actions { height: 100%; display: flex; }.sticky-actions button { width: 34px; height: 100%; display: grid; place-items: center; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; }.sticky-actions button:hover { background: color-mix(in srgb, var(--note-ink) 7%, transparent); color: var(--note-ink); }
.sticky-colors { display: flex; gap: 6px; padding: 8px 12px; }
.color-swatch { width: 16px; height: 16px; padding: 0; border: 1px solid color-mix(in srgb, var(--note-ink) 18%, transparent); border-radius: 50%; background: var(--note-paper); cursor: pointer; }
.color-swatch[data-color="yellow"] { background: var(--note-yellow); }.color-swatch[data-color="green"] { background: var(--note-green); }.color-swatch[data-color="blue"] { background: var(--note-blue); }.color-swatch[data-color="pink"] { background: var(--note-pink); }.color-swatch[data-color="violet"] { background: var(--note-violet); }
.color-swatch--active { outline: 2px solid var(--accent-primary); outline-offset: 2px; }
.sticky-editor { flex: 1; min-height: 0; }
:deep(.editor-paper) { padding: 18px 20px 30px; }:deep(.note-title-input) { font-size: 19px; margin-bottom: 12px; }
.delete-confirm-text { margin: 0; font-size: 14px; line-height: 1.6; color: var(--text-secondary); }
.confirm-modal-actions { display: flex; justify-content: flex-end; align-items: center; gap: 10px; width: 100%; }
.confirm-modal-actions :deep(.ui-classic-btn) { min-width: 96px; padding: 10px 22px; }
</style>
