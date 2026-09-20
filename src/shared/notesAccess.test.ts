import { describe, expect, it } from 'vitest'
import { NOTES_MANAGER_ACCELERATOR, resolveNotesManagerOpen } from './notesAccess'

describe('notes manager shortcut', () => {
  it('uses Alt+Shift+N and does not collide with existing global shortcuts', () => {
    expect(NOTES_MANAGER_ACCELERATOR).toBe('Alt+Shift+N')
    expect(NOTES_MANAGER_ACCELERATOR).not.toBe('Alt+Shift+P')
    expect(NOTES_MANAGER_ACCELERATOR).not.toBe('Alt+Shift+M')
    expect(NOTES_MANAGER_ACCELERATOR).not.toBe('Alt+Shift+O')
  })

  it('asks the main window to unlock when the vault is locked', () => {
    expect(resolveNotesManagerOpen(false)).toBe('locked')
    expect(resolveNotesManagerOpen(true)).toBe('toggle')
  })
})
