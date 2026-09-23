# Notes Manager Layout and Move Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both notes-manager column boundaries resizable, move notes between notebooks from the item context menu, and replace the editor notebook dropdown with a read-only label.

**Architecture:** Keep UI state in `NotesManagerApp.vue`, isolate width clamping and note-update payload construction as pure functions for focused tests, and reuse existing `notes:update` IPC. `NoteEditor.flush()` must report failure so the manager never moves a note while an unsaved draft remains.

**Tech Stack:** Vue 3, TypeScript, Electron IPC, Vitest, scoped CSS, existing `lucide-vue-next` icons and i18n.

## Global Constraints

- Preserve existing three-column defaults: 220px notebook pane and 300px list pane.
- Resizers are 8px; minimum widths are 160px notebook, 240px list, and 300px editor. The manager window has `minWidth: 820` in `src/main/noteWindows.ts`.
- Persist only pane widths in renderer `localStorage`; do not change note schema, IPC contracts, sync, or global CSS.
- Move menu excludes the current notebook and is absent in Trash. Keep existing right-click selection behavior.
- Save the selected note draft before updating its `bookId`, and do not report success on either save or move failure.
- Keep English and Chinese copy aligned and desktop note window behavior unchanged.

---

### Task 1: Resizable Three-Column Layout

**Files:**
- Create: `src/shared/notesManagerLayout.ts`
- Test: `src/shared/notesManagerLayout.test.ts`
- Modify: `src/components/notes/NotesManagerApp.vue:1-45,266-355,483-505`

**Interfaces:**
- Produces: `clampNotesPaneWidths(total: number, notebook: number, list: number): { notebook: number; list: number }` and `NOTES_DIVIDER_WIDTH = 8`.
- Consumes: manager workspace width from `ResizeObserver`, pointer coordinates, and `localStorage` key `pwdbook-notes-manager-panes`.

- [ ] **Step 1: Write a failing geometry test**

```ts
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
```

- [ ] **Step 2: Run `npx vitest run src/shared/notesManagerLayout.test.ts`**; expect failure because the helper is absent.
- [ ] **Step 3: Implement width clamping in the new helper**

```ts
export const NOTES_DIVIDER_WIDTH = 8
export const NOTES_MIN_NOTEBOOK = 160
export const NOTES_MIN_LIST = 240
export const NOTES_MIN_EDITOR = 300

export function clampNotesPaneWidths(total: number, notebook: number, list: number) {
  const usable = Math.max(0, total - 2 * NOTES_DIVIDER_WIDTH - NOTES_MIN_EDITOR)
  const first = Math.max(NOTES_MIN_NOTEBOOK, Number.isFinite(notebook) ? notebook : 220)
  const second = Math.max(NOTES_MIN_LIST, Number.isFinite(list) ? list : 300)
  const notebookWidth = Math.min(first, Math.max(NOTES_MIN_NOTEBOOK, usable - NOTES_MIN_LIST))
  return {
    notebook: notebookWidth,
    list: Math.min(second, Math.max(NOTES_MIN_LIST, usable - notebookWidth)),
  }
}
```

The Electron window minimum of 820px makes the three minima plus two dividers feasible; use `minmax(0, 1fr)` for editor overflow control. If tests reveal a smaller effective workspace, preserve minima and constrain inner content rather than writing invalid widths.

- [ ] **Step 4: Add manager state and lifecycle wiring**

```ts
const workspaceRef = ref<HTMLElement | null>(null)
const notebookWidth = ref(220)
const listWidth = ref(300)
const isResizing = ref(false)
const paneStyle = computed(() => ({
  '--notes-notebook-width': `${notebookWidth.value}px`,
  '--notes-list-width': `${listWidth.value}px`,
}))
```

On mount, parse `localStorage.getItem('pwdbook-notes-manager-panes')` with `JSON.parse` in `try/catch`, reject nonnumeric fields, clamp through the helper, and observe `workspaceRef` with `ResizeObserver`. On pointer-down, capture the initial workspace rectangle and column widths; window `pointermove` adjusts the target boundary through the helper, `pointerup`/`pointercancel` removes listeners and writes `{ notebook, list }` to storage. On unmount disconnect observer and remove any active listeners. Keyboard Left/Right changes the relevant boundary by 16px; Home/End uses the minimum/maximum allowed by the helper. Prevent text selection while dragging and restore it on stop.

- [ ] **Step 5: Add two semantic separators and scoped styling**

Add `ref="workspaceRef" :class="{ 'is-resizing': isResizing }" :style="paneStyle"` to the existing `<main class="manager-workspace">`. Insert the following first divider immediately after `</aside>` and the second immediately after the list `</section>`; leave the existing pane contents unchanged:

```vue
<div class="pane-resizer" role="separator" tabindex="0" aria-orientation="vertical"
  :aria-valuenow="notebookWidth" :aria-valuemin="160" :aria-valuemax="Math.max(160, workspaceWidth - listWidth - 316)"
  @pointerdown="startPaneResize('notebook', $event)" @keydown="onPaneResizeKeydown('notebook', $event)" />

<div class="pane-resizer" role="separator" tabindex="0" aria-orientation="vertical"
  :aria-valuenow="listWidth" :aria-valuemin="240" :aria-valuemax="Math.max(240, workspaceWidth - notebookWidth - 316)"
  @pointerdown="startPaneResize('list', $event)" @keydown="onPaneResizeKeydown('list', $event)" />
```

Set the Grid tracks to `var(--notes-notebook-width) 8px var(--notes-list-width) 8px minmax(0, 1fr)`. Add a narrow visible border on hover/focus, `cursor: col-resize`, `touch-action: none`, and `:focus-visible` outline using existing tokens. Remove pane border-right where the separator replaces it.

- [ ] **Step 6: Run `npx vitest run src/shared/notesManagerLayout.test.ts` and `npm run typecheck`**; expect PASS and no TypeScript errors.
- [ ] **Step 7: Commit** `git add src/shared/notesManagerLayout.ts src/shared/notesManagerLayout.test.ts src/components/notes/NotesManagerApp.vue` then `git commit -m "feat: resize notes manager panes"`.

### Task 2: Safe Context-Menu Move

**Files:**
- Create: `src/shared/noteMove.ts`
- Test: `src/shared/noteMove.test.ts`
- Modify: `src/components/notes/NoteEditor.vue:65-152`
- Modify: `src/components/notes/NotesManagerApp.vue:1-245,357-395,504-508`
- Modify: `src/i18n/locales/zh-CN.ts:40-82`
- Modify: `src/i18n/locales/en.ts:40-82`

**Interfaces:**
- Produces: `moveNoteInput(note: StickyNote, bookId: string): StickyNoteInput` and `NoteEditor.flush(): Promise<boolean>`.
- Consumes: `electronAPI.getNote(id)` and `electronAPI.updateNote(id, input)`; `refresh()` and existing context-menu positioning.

- [ ] **Step 1: Write a failing payload test**

```ts
import { describe, expect, it } from 'vitest'
import { moveNoteInput } from './noteMove'

describe('moveNoteInput', () => {
  it('changes only the notebook field in a complete update payload', () => {
    const note = { id: 'n1', bookId: 'old', title: 'Draft', content: { blocks: [] }, color: 'yellow', isFavorite: true }
    expect(moveNoteInput(note as Parameters<typeof moveNoteInput>[0], 'new')).toEqual({
      title: 'Draft', content: { blocks: [] }, color: 'yellow', isFavorite: true, bookId: 'new',
    })
  })
})
```

- [ ] **Step 2: Run `npx vitest run src/shared/noteMove.test.ts`**; expect missing helper failure.
- [ ] **Step 3: Implement the pure payload helper**

```ts
import type { StickyNote, StickyNoteInput } from './types'
import { normalizeNoteContent } from './noteBlocks'

export function moveNoteInput(note: StickyNote, bookId: string): StickyNoteInput {
  return { title: note.title, content: normalizeNoteContent(note.content),
    color: note.color, isFavorite: note.isFavorite, bookId }
}
```

- [ ] **Step 4: Make editor flush report save failure**. Change `save(): Promise<void>` to `save(): Promise<boolean>`; return `true` when already clean or after successful update, `false` for invalid content, missing API, or the caught failure. Keep an `inFlightSave: Promise<boolean> | null` so an auto-save already in progress is awaited by `flush()`; after it settles, save again if the draft changed meanwhile. Preserve the existing auto-save timer calling `void save()`. Change `flush()` to `Promise<boolean>` and keep its exposed name. Existing callers that only await it remain valid.
- [ ] **Step 5: Add the move action**. On right-click keep the existing note selection. `moveNote(id, targetBookId)` sets a `movingNote` flag, awaits `editorRef.value?.flush()`, and aborts with a visible `notes.moveFailed` message on `false`. Fetch the current note again with `getNote(id)` after flush, reject a missing/deleted note, call `updateNote(id, moveNoteInput(latest, targetBookId))`, close the menu, and `await refresh()`. On failure keep the menu open and show the error; clear the flag in `finally`. Do not run two moves concurrently.
- [ ] **Step 6: Add a nested menu item**. Use `BookOpen` and `ChevronRight`; render eligible `books.filter(book => book.id !== contextMenu.note.bookId)`. Hover/focus opens the submenu; click toggles it; Enter/Right opens and focuses its first button, Escape/Left returns to the parent, Up/Down cycles options. Submenu is absolutely positioned from a relative wrapper, flips left if its measured rectangle exceeds viewport width, and vertically offsets to fit viewport height. Keep pointer movement between trigger and submenu continuous. Use `aria-haspopup="menu"`, `aria-expanded`, `role="menu"`, and visible keyboard focus. Disable the trigger when there are no targets or while moving. Do not render this branch for Trash.
- [ ] **Step 7: Add `notes.moveToBook` and `notes.moveFailed` translations**: Chinese `移动到便签本` / `移动失败，请重试`; English `Move to notebook` / `Could not move note. Try again.`. Keep existing `notes.moveTo` for the editor label.
- [ ] **Step 8: Run `npx vitest run src/shared/noteMove.test.ts` and `npm run typecheck`**; expect PASS and no TypeScript errors. Manually inject a rejected editor save and verify no `updateNote` move call happens.
- [ ] **Step 9: Commit** `git add src/shared/noteMove.ts src/shared/noteMove.test.ts src/components/notes/NoteEditor.vue src/components/notes/NotesManagerApp.vue src/i18n/locales/zh-CN.ts src/i18n/locales/en.ts` then `git commit -m "feat: move notes between notebooks from context menu"`.

### Task 3: Read-Only Notebook Label and End-to-End Checks

**Files:**
- Modify: `src/components/notes/NoteEditor.vue:1-25,155-215`
- Modify: `docs/code-map/sticky-notes.md`

**Interfaces:**
- Consumes: `props.note.bookId`, `props.books`, existing i18n `notes.defaultBook` and `notes.moveTo`.
- Produces: toolbar label; no editable `bookId` control.

- [ ] **Step 1: Replace the select with a computed label**

```ts
const bookName = computed(() => {
  const book = props.books.find((item) => item.id === props.note.bookId)
  return book?.id === 'notes-default' ? t('notes.defaultBook') : book?.name ?? t('notes.defaultBook')
})
```

Import `computed` and `useI18n`, initialize `t`, remove the `<select>` and its `v-model`, and render `<span class="book-label" :title="bookName">{{ bookName }}</span>` only under the existing `!desktop` toolbar. Remove `.book-select` and add ellipsis/`min-width: 0` styling for long names. Keep `bookId` in the draft payload so content edits preserve the current notebook.

- [ ] **Step 2: Document the changed manager UX** in `docs/code-map/sticky-notes.md`: adjustable local pane widths, right-click notebook move, read-only toolbar notebook name.
- [ ] **Step 3: Run `npm run typecheck`, `npm run lint`, and `npm test`**; expect all to pass. Inspect `git diff --check` and verify no unrelated files changed.
- [ ] **Step 4: Manually verify** a narrow 820px and normal 1080px window, drag/keyboard separators and reopening, context menu near right/bottom edges, moving a dirty current note from All/notebook/Favorites, failed save, Trash exclusion, both locales and dark/light skins. Capture screenshot evidence when a runnable Electron window is available.
- [ ] **Step 5: Commit** `git add src/components/notes/NoteEditor.vue docs/code-map/sticky-notes.md` then `git commit -m "docs: describe notes manager interactions"` (include any final in-scope fixes from verification in the same commit).
