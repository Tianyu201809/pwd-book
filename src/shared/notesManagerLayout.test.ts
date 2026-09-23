import { describe, expect, it } from 'vitest'
import { clampNotesPaneWidths } from './notesManagerLayout'

describe('clampNotesPaneWidths', () => {
  it('preserves defaults in a wide workspace', () => {
    expect(clampNotesPaneWidths(1080, 220, 300)).toEqual({ notebook: 220, list: 300 })
  })

  it('reserves editor space when restored widths exceed the window', () => {
    const widths = clampNotesPaneWidths(820, 420, 420)
    expect(widths.notebook).toBeGreaterThanOrEqual(160)
    expect(widths.list).toBeGreaterThanOrEqual(240)
    expect(820 - widths.notebook - widths.list - 16).toBeGreaterThanOrEqual(300)
  })

  it('rejects invalid stored widths', () => {
    expect(clampNotesPaneWidths(1080, Number.NaN, -10)).toEqual({ notebook: 220, list: 240 })
  })
})
