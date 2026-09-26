import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ACCELERATORS,
  acceleratorFromKeyInput,
  acceleratorKeyLabel,
  findReservedAccelerator,
  normalizeAccelerator,
  resolveAccelerators,
} from './globalAccelerator'

const base = {
  quickBarAccelerator: DEFAULT_ACCELERATORS.quickBar,
  mainWindowShortcutAccelerator: DEFAULT_ACCELERATORS.main,
  notesManagerAccelerator: DEFAULT_ACCELERATORS.notes,
  clipboardAccelerator: DEFAULT_ACCELERATORS.clipboard,
}

describe('global accelerators', () => {
  it('keeps the four default shortcuts distinct', () => {
    const values = Object.values(DEFAULT_ACCELERATORS)
    expect(new Set(values).size).toBe(values.length)
  })

  it('normalizes modifier order and rejects bare or shift-only keys', () => {
    expect(normalizeAccelerator('shift+alt+p')).toBe('Alt+Shift+P')
    expect(normalizeAccelerator('Ctrl+K')).toBe('Ctrl+K')
    expect(normalizeAccelerator('P')).toBeNull()
    expect(normalizeAccelerator('Shift+P')).toBeNull()
    expect(normalizeAccelerator('Alt+Shift')).toBeNull()
  })

  it('reads a keyboard chord into an Electron accelerator', () => {
    expect(
      acceleratorFromKeyInput({
        key: 'p',
        code: 'KeyP',
        ctrlKey: false,
        altKey: true,
        shiftKey: true,
        metaKey: false,
        platform: 'win32',
      }),
    ).toEqual({ status: 'ok', accelerator: 'Alt+Shift+P' })
    expect(
      acceleratorFromKeyInput({
        key: 'p',
        code: 'KeyP',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        platform: 'win32',
      }).status,
    ).toBe('needs-modifier')
    expect(
      acceleratorFromKeyInput({
        key: 'Control',
        code: 'ControlLeft',
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        platform: 'win32',
      }).status,
    ).toBe('modifier')
  })

  it('labels the Windows key and detects a reserved chord', () => {
    expect(acceleratorKeyLabel('Super', 'win32')).toBe('Win')
    expect(
      findReservedAccelerator('alt+shift+n', [
        { label: '便签', accelerator: 'Alt+Shift+N' },
      ])?.label,
    ).toBe('便签')
  })

  it('rejects an invalid or colliding replacement', () => {
    expect(resolveAccelerators(base, { notesManagerAccelerator: 'N' })).toEqual({
      ok: false,
      reason: 'invalid',
    })
    expect(resolveAccelerators(base, { clipboardAccelerator: 'Alt+Shift+N' })).toEqual({
      ok: false,
      reason: 'conflict',
    })
    expect(resolveAccelerators(base, { clipboardAccelerator: 'Ctrl+Alt+O' })).toMatchObject({
      ok: true,
      accelerators: { clipboardAccelerator: 'Ctrl+Alt+O' },
    })
  })
})
