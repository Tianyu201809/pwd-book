export const NOTES_MANAGER_ACCELERATOR = 'Alt+Shift+N'

export type NotesManagerOpenResult = 'locked' | 'toggle'

export function resolveNotesManagerOpen(unlocked: boolean): NotesManagerOpenResult {
  return unlocked ? 'toggle' : 'locked'
}
