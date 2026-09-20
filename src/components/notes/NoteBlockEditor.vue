<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { CheckSquare2, Plus, Square } from 'lucide-vue-next'
import {
  applyBlockBackspaceAtStart,
  changeNoteBlockIndent,
  consumeChecklistPrefix,
  createNoteBlock,
  setNoteBlockType,
  splitNoteBlock,
} from '@/shared/noteBlocks'
import type { NoteBlockType, NoteContent } from '@/shared/types'

const model = defineModel<NoteContent>({ required: true })
const emit = defineEmits<{ leaveToTitle: [] }>()

const fieldById = new Map<string, HTMLTextAreaElement>()
const focusedIndex = ref(0)

const activeType = computed(() => model.value.blocks[focusedIndex.value]?.type ?? 'text')

function commit(blocks: NoteContent['blocks']): void {
  model.value = { version: 1, blocks }
}

function bindField(id: string, el: unknown): void {
  if (el instanceof HTMLTextAreaElement) fieldById.set(id, el)
  else fieldById.delete(id)
}

function resizeField(field: HTMLTextAreaElement | null): void {
  if (!field) return
  field.style.height = 'auto'
  field.style.height = `${Math.max(30, field.scrollHeight)}px`
}

function resizeAll(): void {
  for (const field of fieldById.values()) resizeField(field)
}

function updateBlock(index: number, patch: Partial<NoteContent['blocks'][number]>): void {
  const blocks = model.value.blocks.map((block, blockIndex) => blockIndex === index ? { ...block, ...patch } : block)
  commit(blocks)
  const id = blocks[index]?.id
  if (id) void nextTick(() => resizeField(fieldById.get(id) ?? null))
}

function focusBlock(id: string, caret?: number): void {
  void nextTick(() => {
    const field = fieldById.get(id)
    if (!field) return
    field.focus()
    const offset = caret == null ? field.value.length : Math.max(0, Math.min(field.value.length, caret))
    field.setSelectionRange(offset, offset)
    resizeField(field)
  })
}

function addBlock(type: NoteBlockType = activeType.value): void {
  const block = createNoteBlock(type)
  commit([...model.value.blocks, block])
  focusedIndex.value = model.value.blocks.length - 1
  focusBlock(block.id, 0)
}

function setFocusedType(type: NoteBlockType): void {
  const index = focusedIndex.value
  const block = model.value.blocks[index]
  if (!block || block.type === type) return
  updateBlock(index, setNoteBlockType(block, type))
  focusBlock(block.id)
}

function onBlockInput(index: number, text: string, field: HTMLTextAreaElement): void {
  const block = model.value.blocks[index]
  if (block?.type === 'text') {
    const rest = consumeChecklistPrefix(text)
    if (rest !== null) {
      updateBlock(index, { ...setNoteBlockType(block, 'checklist'), text: rest })
      void nextTick(() => {
        resizeField(field)
        field.focus()
        field.setSelectionRange(rest.length, rest.length)
      })
      return
    }
  }
  updateBlock(index, { text })
  resizeField(field)
}

function handleKeydown(event: KeyboardEvent, index: number): void {
  const target = event.currentTarget as HTMLTextAreaElement
  const block = model.value.blocks[index]
  if (!block) return

  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    setFocusedType(block.type === 'text' ? 'checklist' : 'text')
    return
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    const [left, right] = splitNoteBlock(block, target.selectionStart)
    const blocks = [...model.value.blocks]
    blocks.splice(index, 1, left, right)
    commit(blocks)
    focusedIndex.value = index + 1
    focusBlock(right.id, 0)
    return
  }

  if (event.key === 'Backspace' && target.selectionStart === 0 && target.selectionEnd === 0) {
    const result = applyBlockBackspaceAtStart(model.value.blocks, index)
    if (!result) return
    event.preventDefault()
    commit(result.blocks)
    focusedIndex.value = Math.max(0, result.blocks.findIndex((item) => item.id === result.focusId))
    focusBlock(result.focusId, result.caret)
    return
  }

  if (event.key === 'Tab') {
    event.preventDefault()
    updateBlock(index, changeNoteBlockIndent(block, event.shiftKey ? -1 : 1))
    return
  }

  if (event.key === 'ArrowUp' && target.selectionStart === 0 && target.selectionEnd === 0) {
    event.preventDefault()
    if (index === 0) {
      emit('leaveToTitle')
      return
    }
    const previous = model.value.blocks[index - 1]
    if (previous) {
      focusedIndex.value = index - 1
      focusBlock(previous.id)
    }
    return
  }

  if (event.key === 'ArrowDown' && target.selectionStart === target.value.length && target.selectionEnd === target.value.length) {
    const next = model.value.blocks[index + 1]
    if (!next) return
    event.preventDefault()
    focusedIndex.value = index + 1
    focusBlock(next.id, 0)
  }
}

function focusFirst(): void {
  const first = model.value.blocks[0]
  if (!first) return
  focusedIndex.value = 0
  focusBlock(first.id, 0)
}

onMounted(() => {
  void nextTick(resizeAll)
})

watch(() => model.value.blocks.map((block) => block.id).join(','), () => {
  if (focusedIndex.value > model.value.blocks.length - 1) {
    focusedIndex.value = Math.max(0, model.value.blocks.length - 1)
  }
  void nextTick(resizeAll)
})

defineExpose({ focusFirst })
</script>

<template>
  <div class="block-editor">
    <div class="block-list">
      <div
        v-for="(block, index) in model.blocks"
        :key="block.id"
        class="note-block"
        :class="{ 'note-block--checklist': block.type === 'checklist' }"
        :style="{ '--block-indent': block.indent }"
      >
        <button
          v-if="block.type === 'checklist'"
          type="button"
          class="block-check"
          :class="{ 'block-check--on': block.checked }"
          :aria-label="$t('notes.toggleChecked')"
          :title="$t('notes.toggleChecked')"
          @click="updateBlock(index, { checked: !block.checked })"
        >
          <CheckSquare2 v-if="block.checked" :size="16" :stroke-width="1.8" />
          <Square v-else :size="16" :stroke-width="1.8" />
        </button>
        <textarea
          :ref="(el) => bindField(block.id, el)"
          class="block-text"
          :class="{ 'block-text--checked': block.checked }"
          :value="block.text"
          rows="1"
          @focus="focusedIndex = index"
          @input="onBlockInput(index, ($event.target as HTMLTextAreaElement).value, $event.target as HTMLTextAreaElement)"
          @keydown="handleKeydown($event, index)"
        />
      </div>
    </div>
    <div class="block-format-row">
      <div
        class="type-switch"
        role="group"
        :aria-label="$t('notes.blockType')"
      >
        <button
          type="button"
          :class="{ active: activeType === 'text' }"
          @click="setFocusedType('text')"
        >
          {{ $t('notes.textBlock') }}
        </button>
        <button
          type="button"
          :class="{ active: activeType === 'checklist' }"
          @click="setFocusedType('checklist')"
        >
          {{ $t('notes.checklistBlock') }}
        </button>
      </div>
      <button
        type="button"
        class="block-add"
        :title="$t('notes.newBlock')"
        @click="addBlock()"
      >
        <Plus :size="15" />
        <span>{{ $t('notes.newBlock') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.block-editor { min-height: 100%; display: flex; flex-direction: column; }
.block-list { display: flex; flex-direction: column; gap: 2px; }
.note-block { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; margin-left: calc(var(--block-indent) * 24px); border-radius: 6px; }
.note-block--checklist { grid-template-columns: 26px minmax(0, 1fr); }
.note-block:focus-within { background: color-mix(in srgb, var(--note-ink) 4%, transparent); }
.block-check { width: 26px; height: 30px; padding: 0; display: grid; place-items: center; border: 0; background: transparent; color: var(--note-muted); cursor: pointer; }
.block-check--on,.block-check:hover { color: var(--accent-primary); }
.block-text { width: 100%; min-height: 30px; resize: none; overflow: hidden; padding: 5px 4px; border: 0; outline: 0; background: transparent; color: var(--note-ink); line-height: 20px; font-size: 14px; letter-spacing: 0; }
.block-text--checked { color: var(--note-muted); text-decoration: line-through; }
.block-format-row { display: flex; align-items: center; gap: 8px; padding: 12px 0 4px; }
.type-switch { display: inline-flex; padding: 2px; border: 1px solid color-mix(in srgb, var(--note-ink) 12%, transparent); border-radius: 8px; background: color-mix(in srgb, var(--note-ink) 4%, transparent); }
.type-switch button { height: 26px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: var(--note-muted); cursor: pointer; font-size: 12px; }
.type-switch button.active { background: color-mix(in srgb, var(--note-paper) 88%, var(--note-ink)); color: var(--note-ink); box-shadow: 0 0 0 1px color-mix(in srgb, var(--note-ink) 8%, transparent); }
.block-add { height: 30px; display: inline-flex; align-items: center; gap: 5px; padding: 0 9px; border: 0; border-radius: 6px; background: transparent; color: var(--note-muted); cursor: pointer; font-size: 12px; }
.block-add:hover { color: var(--note-ink); background: color-mix(in srgb, var(--note-ink) 5%, transparent); }
</style>
