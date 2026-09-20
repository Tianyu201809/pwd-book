import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { IPC, IPC_EVENTS } from '../shared/types'
import { getNote, listDesktopVisibleNoteIds, updateNoteWindowState } from './services/noteService'
import { isUnlocked } from './services/sessionService'

let managerWindow: BrowserWindow | null = null
const noteWindows = new Map<string, BrowserWindow>()
const visibleBeforeLock = new Set<string>()
const closingForLock = new Set<string>()
let managerVisibleBeforeLock = false

function rendererUrl(page: string, query = ''): string {
  if (process.env.ELECTRON_RENDERER_URL) return `${process.env.ELECTRON_RENDERER_URL}/${page}${query}`
  return join(__dirname, `../renderer/${page}`)
}

function loadRenderer(win: BrowserWindow, page: string, query = ''): void {
  const target = rendererUrl(page, query)
  if (target.startsWith('http')) void win.loadURL(target)
  else void win.loadFile(target, query ? { query: Object.fromEntries(new URLSearchParams(query.slice(1))) } : undefined)
}

function browserPreferences(): Electron.BrowserWindowConstructorOptions['webPreferences'] {
  return { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false }
}

export function openNotesManager(): boolean {
  if (!isUnlocked()) return false
  if (!managerWindow || managerWindow.isDestroyed()) {
    managerWindow = new BrowserWindow({
      width: 1080, height: 720, minWidth: 820, minHeight: 560, show: false, frame: false,
      backgroundColor: '#0f1219', webPreferences: browserPreferences(),
    })
    loadRenderer(managerWindow, 'notes.html')
    managerWindow.on('closed', () => { managerWindow = null })
    managerWindow.once('ready-to-show', () => managerWindow?.show())
  } else managerWindow.show()
  managerWindow.focus()
  managerWindow.webContents.send(IPC_EVENTS.themeChanged)
  return true
}

function clampBounds(noteId: string): Electron.Rectangle {
  const note = getNote(noteId)
  const width = Math.max(280, Math.min(720, note?.windowWidth ?? 360))
  const height = Math.max(240, Math.min(800, note?.windowHeight ?? 420))
  const fallback = screen.getPrimaryDisplay().workArea
  const proposed = { x: note?.windowX ?? fallback.x + 48, y: note?.windowY ?? fallback.y + 48, width, height }
  const area = screen.getDisplayMatching(proposed).workArea
  return {
    width, height,
    x: Math.min(area.x + area.width - width, Math.max(area.x, proposed.x)),
    y: Math.min(area.y + area.height - height, Math.max(area.y, proposed.y)),
  }
}

function persistBounds(noteId: string, win: BrowserWindow): void {
  if (win.isDestroyed() || !isUnlocked()) return
  const bounds = win.getBounds()
  updateNoteWindowState(noteId, {
    windowX: bounds.x, windowY: bounds.y, windowWidth: bounds.width, windowHeight: bounds.height,
  })
}

export function openNoteWindow(noteId: string): boolean {
  if (!isUnlocked() || !getNote(noteId)) return false
  const existing = noteWindows.get(noteId)
  if (existing && !existing.isDestroyed()) {
    existing.show()
    existing.focus()
    updateNoteWindowState(noteId, { isDesktopVisible: true })
    return true
  }
  const note = getNote(noteId)!
  const win = new BrowserWindow({
    ...clampBounds(noteId), minWidth: 280, minHeight: 240, show: false, frame: false,
    alwaysOnTop: note.isAlwaysOnTop, backgroundColor: '#f4edcf', webPreferences: browserPreferences(),
  })
  noteWindows.set(noteId, win)
  loadRenderer(win, 'note.html', `?id=${encodeURIComponent(noteId)}`)
  let boundsTimer: NodeJS.Timeout | null = null
  const queueBounds = (): void => {
    if (boundsTimer) clearTimeout(boundsTimer)
    boundsTimer = setTimeout(() => persistBounds(noteId, win), 180)
  }
  win.on('move', queueBounds)
  win.on('resize', queueBounds)
  win.on('closed', () => {
    if (boundsTimer) clearTimeout(boundsTimer)
    noteWindows.delete(noteId)
    const lockedClose = closingForLock.delete(noteId)
    if (!lockedClose && isUnlocked() && getNote(noteId)) updateNoteWindowState(noteId, { isDesktopVisible: false })
    broadcastNotesChanged(noteId)
  })
  win.once('ready-to-show', () => win.show())
  updateNoteWindowState(noteId, { isDesktopVisible: true })
  broadcastNotesChanged(noteId)
  return true
}

export function hideNoteWindow(noteId: string): void {
  const win = noteWindows.get(noteId)
  if (win && !win.isDestroyed()) win.close()
  else if (isUnlocked() && getNote(noteId)) updateNoteWindowState(noteId, { isDesktopVisible: false })
}

export function closeNoteWindowForDeletion(noteId: string): void {
  const win = noteWindows.get(noteId)
  noteWindows.delete(noteId)
  if (win && !win.isDestroyed()) win.destroy()
}

export function broadcastNotesChanged(noteId?: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC_EVENTS.notesChanged, noteId ?? null)
  }
}

export function hideNoteWindowsOnLock(): void {
  managerVisibleBeforeLock = Boolean(managerWindow?.isVisible())
  managerWindow?.destroy()
  managerWindow = null
  visibleBeforeLock.clear()
  noteWindows.forEach((win, id) => {
    if (!win.isDestroyed() && win.isVisible()) visibleBeforeLock.add(id)
    closingForLock.add(id)
    noteWindows.delete(id)
    win.destroy()
  })
}

export function restoreNoteWindowsAfterUnlock(): void {
  if (managerVisibleBeforeLock) openNotesManager()
  const ids = visibleBeforeLock.size > 0 ? [...visibleBeforeLock] : listDesktopVisibleNoteIds()
  ids.forEach((id) => openNoteWindow(id))
  visibleBeforeLock.clear()
  managerVisibleBeforeLock = false
}

export async function requestNoteDraftFlush(): Promise<void> {
  const windows = [managerWindow, ...noteWindows.values()].filter((win): win is BrowserWindow => Boolean(win && !win.isDestroyed()))
  for (const win of windows) win.webContents.send(IPC_EVENTS.notesFlush)
  if (windows.length > 0) await new Promise((resolve) => setTimeout(resolve, 280))
}

export function destroyNoteWindows(): void {
  managerWindow?.destroy()
  managerWindow = null
  noteWindows.forEach((win) => win.destroy())
  noteWindows.clear()
}

export function registerNoteWindowIpc(): void {
  ipcMain.handle(IPC.notesManagerOpen, () => openNotesManager())
  ipcMain.on(IPC.notesManagerClose, () => managerWindow?.close())
  ipcMain.handle(IPC.noteWindowOpen, (_event, id: string) => openNoteWindow(id))
  ipcMain.on(IPC.noteWindowHide, (_event, id: string) => hideNoteWindow(id))
  ipcMain.handle(IPC.noteWindowToggleAlwaysOnTop, (event, id: string) => {
    const win = noteWindows.get(id)
    if (!win || win.isDestroyed() || win.webContents !== event.sender) return false
    const next = !win.isAlwaysOnTop()
    win.setAlwaysOnTop(next, 'floating')
    updateNoteWindowState(id, { isAlwaysOnTop: next })
    broadcastNotesChanged(id)
    return next
  })
}
