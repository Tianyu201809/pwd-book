import { describe, expect, it } from 'vitest'
import {
  changeNoteBlockIndent,
  createNoteBlock,
  mergeNoteBlocks,
  noteMatchesQuery,
  formatNotePlainText,
  normalizeNoteContent,
  parseNoteContentResult,
  sanitizeNoteInput,
  setNoteBlockType,
  splitNoteBlock,
  applyBlockBackspaceAtStart,
  consumeChecklistPrefix,
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

  it('unindents an empty block before deleting it', () => {
    const indented = { ...createNoteBlock('checklist'), indent: 2 }
    const sibling = createNoteBlock('text', 'keep')
    const unindented = applyBlockBackspaceAtStart([indented], 0)
    expect(unindented?.blocks[0]?.indent).toBe(1)
    expect(unindented?.focusId).toBe(indented.id)

    const removed = applyBlockBackspaceAtStart([indented, sibling], 0)
    expect(removed?.blocks).toHaveLength(2)
    expect(removed?.blocks[0]?.indent).toBe(1)

    const lastEmpty = applyBlockBackspaceAtStart([{ ...indented, indent: 0 }, sibling], 0)
    expect(lastEmpty?.blocks[0]).toMatchObject({ type: 'text', text: '' })
    expect(lastEmpty?.blocks[1]).toEqual(sibling)

    const onlyEmpty = applyBlockBackspaceAtStart([{ ...createNoteBlock('text'), indent: 0 }], 0)
    expect(onlyEmpty).toBeNull()
  })

  it('turns [] or - prefixes into a checklist block', () => {
    expect(consumeChecklistPrefix('[] buy milk')).toBe('buy milk')
    expect(consumeChecklistPrefix('- buy milk')).toBe('buy milk')
    expect(consumeChecklistPrefix('just text')).toBeNull()
  })

  it('merges into the previous block when backspacing at the start', () => {
    const first = createNoteBlock('text', 'hello')
    const second = createNoteBlock('text', 'world')
    const merged = applyBlockBackspaceAtStart([first, second], 1)
    expect(merged?.blocks).toHaveLength(1)
    expect(merged?.blocks[0]?.text).toBe('helloworld')
    expect(merged?.caret).toBe(5)
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

  it('copies the title and every block, including checklist marks and indent', () => {
    const text = formatNotePlainText({
      title: '  购物  ',
      content: {
        version: 1,
        blocks: [
          createNoteBlock('text', '记得带钥匙'),
          { ...createNoteBlock('checklist', '牛奶'), checked: false },
          { ...createNoteBlock('checklist', '面包'), checked: true, indent: 1 },
          createNoteBlock('text', ''),
        ],
      },
    })
    expect(text).toBe('购物\n\n记得带钥匙\n[ ] 牛奶\n  [x] 面包')
  })

  it('omits a blank title and trailing empty blocks', () => {
    expect(formatNotePlainText({
      title: '   ',
      content: { version: 1, blocks: [createNoteBlock('text', '只有正文'), createNoteBlock('text', '  ')] },
    })).toBe('只有正文')
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
