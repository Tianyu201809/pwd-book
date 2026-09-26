export { NOTES_MANAGER_ACCELERATOR } from './globalAccelerator'

export type NotesManagerOpenResult = 'locked' | 'toggle'

export function resolveNotesManagerOpen(unlocked: boolean): NotesManagerOpenResult {
  return unlocked ? 'toggle' : 'locked'
}
