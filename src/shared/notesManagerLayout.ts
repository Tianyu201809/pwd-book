export const NOTES_DIVIDER_WIDTH = 8
export const NOTES_MIN_NOTEBOOK = 160
export const NOTES_MIN_LIST = 240
export const NOTES_MIN_EDITOR = 300

export function clampNotesPaneWidths(total: number, notebook: number, list: number): { notebook: number; list: number } {
  const usable = Math.max(0, total - 2 * NOTES_DIVIDER_WIDTH - NOTES_MIN_EDITOR)
  const first = Math.max(NOTES_MIN_NOTEBOOK, Number.isFinite(notebook) ? notebook : 220)
  const second = Math.max(NOTES_MIN_LIST, Number.isFinite(list) ? list : 300)
  const notebookWidth = Math.min(first, Math.max(NOTES_MIN_NOTEBOOK, usable - NOTES_MIN_LIST))
  return {
    notebook: notebookWidth,
    list: Math.min(second, Math.max(NOTES_MIN_LIST, usable - notebookWidth)),
  }
}
