import { textMatchesQuery } from './searchMatch'
import type { NoteBlock, NoteBlockType, NoteColor, NoteContent, StickyNoteInput } from './types'

export const NOTE_CONTENT_VERSION = 1 as const
export const NOTE_MAX_INDENT = 4
export const NOTE_MAX_TITLE_LENGTH = 200
export const NOTE_MAX_BLOCK_TEXT_LENGTH = 20_000
export const NOTE_MAX_BLOCKS = 1_000

export const NOTE_COLORS: readonly NoteColor[] = [
  'paper',
  'yellow',
  'green',
  'blue',
  'pink',
  'violet',
]

function createId(): string {
  return globalThis.crypto.randomUUID()
}

export function createNoteBlock(type: NoteBlockType = 'text', text = ''): NoteBlock {
  return { id: createId(), type, text, indent: 0, checked: false }
}

export function createEmptyNoteContent(): NoteContent {
  return { version: NOTE_CONTENT_VERSION, blocks: [createNoteBlock()] }
}

function normalizeBlock(value: unknown): NoteBlock | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<NoteBlock>
  const type: NoteBlockType = raw.type === 'checklist' ? 'checklist' : 'text'
  const indent = Math.min(NOTE_MAX_INDENT, Math.max(0, Math.trunc(Number(raw.indent) || 0)))
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : createId(),
    type,
    text: String(raw.text ?? '').slice(0, NOTE_MAX_BLOCK_TEXT_LENGTH),
    indent,
    checked: type === 'checklist' && raw.checked === true,
  }
}

export function normalizeNoteContent(value: unknown): NoteContent {
  const raw = value && typeof value === 'object' ? value as Partial<NoteContent> : null
  const blocks = Array.isArray(raw?.blocks)
    ? raw.blocks.slice(0, NOTE_MAX_BLOCKS).map(normalizeBlock).filter((block): block is NoteBlock => Boolean(block))
    : []
  return {
    version: NOTE_CONTENT_VERSION,
    blocks: blocks.length > 0 ? blocks : [createNoteBlock()],
  }
}

export function parseNoteContentResult(serialized: string): { content: NoteContent; invalid: boolean } {
  try {
    return { content: normalizeNoteContent(JSON.parse(serialized)), invalid: false }
  } catch {
    return { content: createEmptyNoteContent(), invalid: true }
  }
}

export function parseNoteContent(serialized: string): NoteContent {
  return parseNoteContentResult(serialized).content
}

export function noteMatchesQuery(note: { title: string; content: NoteContent }, query: string): boolean {
  const q = query.trim()
  if (!q) return true
  if (textMatchesQuery(note.title, q)) return true
  return note.content.blocks.some((block) => textMatchesQuery(block.text, q))
}

export function sanitizeNoteInput(input: StickyNoteInput): StickyNoteInput {
  return {
    ...input,
    title: input.title.trim().slice(0, NOTE_MAX_TITLE_LENGTH),
    content: normalizeNoteContent(input.content),
    color: isNoteColor(input.color) ? input.color : undefined,
  }
}

export function splitNoteBlock(block: NoteBlock, offset: number): [NoteBlock, NoteBlock] {
  const index = Math.min(block.text.length, Math.max(0, Math.trunc(offset)))
  return [
    { ...block, text: block.text.slice(0, index) },
    { ...block, id: createId(), text: block.text.slice(index), checked: false },
  ]
}

export function mergeNoteBlocks(previous: NoteBlock, current: NoteBlock): NoteBlock {
  return { ...previous, text: `${previous.text}${current.text}` }
}

export function setNoteBlockType(block: NoteBlock, type: NoteBlockType): NoteBlock {
  return { ...block, type, checked: type === 'checklist' ? block.checked : false }
}

export function changeNoteBlockIndent(block: NoteBlock, delta: number): NoteBlock {
  return {
    ...block,
    indent: Math.min(NOTE_MAX_INDENT, Math.max(0, block.indent + Math.trunc(delta))),
  }
}

export function applyBlockBackspaceAtStart(
  blocks: NoteBlock[],
  index: number,
): { blocks: NoteBlock[]; focusId: string; caret: number } | null {
  const block = blocks[index]
  if (!block) return null
  const empty = block.text.length === 0

  if (empty && block.indent > 0) {
    const next = blocks.map((item, itemIndex) => (
      itemIndex === index ? changeNoteBlockIndent(item, -1) : item
    ))
    return { blocks: next, focusId: block.id, caret: 0 }
  }

  if (empty && block.type === 'checklist') {
    const next = blocks.map((item, itemIndex) => (
      itemIndex === index ? setNoteBlockType(item, 'text') : item
    ))
    return { blocks: next, focusId: block.id, caret: 0 }
  }

  if (index > 0) {
    const previous = blocks[index - 1]!
    const merged = mergeNoteBlocks(previous, block)
    const next = [...blocks]
    next.splice(index - 1, 2, merged)
    return { blocks: next, focusId: merged.id, caret: previous.text.length }
  }

  if (empty && blocks.length > 1) {
    const next = blocks.filter((_, itemIndex) => itemIndex !== index)
    return { blocks: next, focusId: next[0]!.id, caret: 0 }
  }

  return null
}

export function consumeChecklistPrefix(text: string): string | null {
  const match = text.match(/^(?:\[\]|-)\s/)
  return match ? text.slice(match[0].length) : null
}

export function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === 'string' && NOTE_COLORS.includes(value as NoteColor)
}
