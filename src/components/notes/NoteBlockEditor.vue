<script setup lang="ts">
import { nextTick, onMounted } from 'vue'
import { CheckSquare2, Plus, TextCursorInput } from 'lucide-vue-next'
import { changeNoteBlockIndent, createNoteBlock, mergeNoteBlocks, setNoteBlockType, splitNoteBlock } from '@/shared/noteBlocks'
import type { NoteBlockType, NoteContent } from '@/shared/types'

const model = defineModel<NoteContent>({ required: true })

function commit(blocks: NoteContent['blocks']): void {
  model.value = { version: 1, blocks }
}

function resizeField(field: HTMLTextAreaElement | null): void {
  if (!field) return
  field.style.height = 'auto'
  field.style.height = `${Math.max(30, field.scrollHeight)}px`
}

function updateBlock(index: number, patch: Partial<NoteContent['blocks'][number]>): void {
  const blocks = model.value.blocks.map((block, blockIndex) => blockIndex === index ? { ...block, ...patch } : block)
  commit(blocks)
  const id = blocks[index]?.id
  if (id) void nextTick(() => resizeField(document.querySelector<HTMLTextAreaElement>(`[data-note-block="${id}"]`)))
}

onMounted(() => {
  document.querySelectorAll<HTMLTextAreaElement>('[data-note-block]').forEach(resizeField)
})

function focusBlock(id: string, atEnd = false): void {
  void nextTick(() => {
    const field = document.querySelector<HTMLTextAreaElement>(`[data-note-block="${id}"]`)
    field?.focus()
    if (field && atEnd) field.setSelectionRange(field.value.length, field.value.length)
  })
}

function addBlock(type: NoteBlockType): void {
  const block = createNoteBlock(type)
  commit([...model.value.blocks, block])
  focusBlock(block.id)
}

function handleKeydown(event: KeyboardEvent, index: number): void {
  const target = event.currentTarget as HTMLTextAreaElement
  const block = model.value.blocks[index]
  if (!block) return
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    const [left, right] = splitNoteBlock(block, target.selectionStart)
    const blocks = [...model.value.blocks]
    blocks.splice(index, 1, left, right)
    commit(blocks)
    focusBlock(right.id)
  } else if (event.key === 'Backspace' && target.selectionStart === 0 && target.selectionEnd === 0 && index > 0) {
    event.preventDefault()
    const previous = model.value.blocks[index - 1]!
    const merged = mergeNoteBlocks(previous, block)
    const blocks = [...model.value.blocks]
    blocks.splice(index - 1, 2, merged)
    commit(blocks)
    focusBlock(merged.id, true)
  } else if (event.key === 'Tab') {
    event.preventDefault()
    updateBlock(index, changeNoteBlockIndent(block, event.shiftKey ? -1 : 1))
  }
}

function toggleType(index: number): void {
  const block = model.value.blocks[index]
  if (!block) return
  updateBlock(index, setNoteBlockType(block, block.type === 'text' ? 'checklist' : 'text'))
}
</script>

<template>
  <div class="block-editor">
    <div class="block-list">
      <div
        v-for="(block, index) in model.blocks"
        :key="block.id"
        class="note-block"
        :style="{ '--block-indent': block.indent }"
      >
        <button
          type="button"
          class="block-kind"
          :class="{ 'block-kind--checked': block.checked }"
          :aria-label="block.type === 'checklist' ? 'Toggle checklist' : 'Convert to checklist'"
          @click="block.type === 'checklist' ? updateBlock(index, { checked: !block.checked }) : toggleType(index)"
        >
          <CheckSquare2 v-if="block.type === 'checklist'" :size="17" :stroke-width="1.8" />
          <span v-else class="text-dot" />
        </button>
        <textarea
          :data-note-block="block.id"
          class="block-text"
          :class="{ 'block-text--checked': block.checked }"
          :value="block.text"
          rows="1"
          @input="updateBlock(index, { text: ($event.target as HTMLTextAreaElement).value }); resizeField($event.target as HTMLTextAreaElement)"
          @keydown="handleKeydown($event, index)"
        />
      </div>
    </div>
    <div class="block-add-row">
      <button type="button" class="block-add" @click="addBlock('text')">
        <TextCursorInput :size="15" /><span>{{ $t('notes.textBlock') }}</span>
      </button>
      <button type="button" class="block-add" @click="addBlock('checklist')">
        <Plus :size="15" /><span>{{ $t('notes.checklistBlock') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.block-editor { min-height: 100%; display: flex; flex-direction: column; }
.block-list { display: flex; flex-direction: column; gap: 2px; }
.note-block { display: grid; grid-template-columns: 28px minmax(0, 1fr); align-items: start; margin-left: calc(var(--block-indent) * 24px); border-radius: 6px; }
.note-block:focus-within { background: color-mix(in srgb, var(--note-ink) 4%, transparent); }
.block-kind { width: 28px; height: 30px; padding: 0; display: grid; place-items: center; border: 0; background: transparent; color: var(--note-muted); cursor: pointer; }
.block-kind--checked { color: var(--accent-primary); }
.text-dot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
.block-text { width: 100%; min-height: 30px; resize: none; overflow: hidden; padding: 5px 4px; border: 0; outline: 0; background: transparent; color: var(--note-ink); line-height: 20px; font-size: 14px; letter-spacing: 0; }
.block-text--checked { color: var(--note-muted); text-decoration: line-through; }
.block-add-row { display: flex; gap: 6px; padding: 12px 0 4px 28px; }
.block-add { height: 30px; display: inline-flex; align-items: center; gap: 6px; padding: 0 9px; border: 1px solid color-mix(in srgb, var(--note-ink) 12%, transparent); border-radius: 6px; background: transparent; color: var(--note-muted); cursor: pointer; font-size: 12px; }
.block-add:hover { color: var(--note-ink); background: color-mix(in srgb, var(--note-ink) 5%, transparent); }
</style>
