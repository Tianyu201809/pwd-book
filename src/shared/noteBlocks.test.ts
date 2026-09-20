import { describe, expect, it } from 'vitest'
import {
  changeNoteBlockIndent,
  createNoteBlock,
  mergeNoteBlocks,
  noteMatchesQuery,
  normalizeNoteContent,
  parseNoteContentResult,
  sanitizeNoteInput,
  setNoteBlockType,
  splitNoteBlock,
} from './noteBlocks'

describe('note blocks', () => {
  it('normalizes malformed content and preserves a writable block', () => {
    const content = normalizeNoteContent({ blocks: [{ type: 'bad', text: 42, indent: 99, checked: true }] })
    expect(content.version).toBe(1)
    expect(content.blocks).toHaveLength(1)
    expect(content.blocks[0]).toMatchObject({ type: 'text', text: '42', indent: 4, checked: false })
    expect(normalizeNoteContent(null).blocks).toHaveLength(1)
  })

  it('splits and merges blocks without reusing the new block id', () => {
    const block = createNoteBlock('checklist', 'release notes')
    const [left, right] = splitNoteBlock(block, 7)
    expect(left.text).toBe('release')
    expect(right.text).toBe(' notes')
    expect(right.id).not.toBe(block.id)
    expect(mergeNoteBlocks(left, right).text).toBe('release notes')
  })

  it('clamps indentation and clears checked state for text blocks', () => {
    const checked = { ...createNoteBlock('checklist'), checked: true }
    expect(changeNoteBlockIndent(checked, 20).indent).toBe(4)
    expect(changeNoteBlockIndent(checked, -20).indent).toBe(0)
    expect(setNoteBlockType(checked, 'text').checked).toBe(false)
  })

  it('marks damaged JSON as invalid without inventing a writable document', () => {
    const parsed = parseNoteContentResult('{not-json')
    expect(parsed.invalid).toBe(true)
    expect(parsed.content.blocks).toHaveLength(1)
    expect(parseNoteContentResult('{"version":1,"blocks":[{"id":"a","type":"text","text":"ok","indent":0,"checked":false}]}').invalid).toBe(false)
  })

  it('matches titles, block text and pinyin initials', () => {
    const note = { title: '发布说明', content: { version: 1 as const, blocks: [createNoteBlock('text', '完成清单')] } }
    expect(noteMatchesQuery(note, '发布')).toBe(true)
    expect(noteMatchesQuery(note, '清单')).toBe(true)
    expect(noteMatchesQuery(note, 'fb')).toBe(true)
    expect(noteMatchesQuery(note, 'missing')).toBe(false)
  })

  it('sanitizes title length and unknown colors', () => {
    const input = sanitizeNoteInput({
      title: `  ${'x'.repeat(240)}  `,
      content: { version: 1, blocks: [] },
      color: 'neon' as never,
    })
    expect(input.title).toHaveLength(200)
    expect(input.color).toBeUndefined()
    expect(input.content.blocks).toHaveLength(1)
  })
})
