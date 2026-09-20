import { randomUUID } from 'crypto'
import { decryptSecret, encryptSecret } from '../crypto/vaultCrypto'
import { getDatabase, persistDatabase } from '../db/database'
import { getSessionKey } from './sessionService'
import {
  createEmptyNoteContent,
  isNoteColor,
  normalizeNoteContent,
  noteMatchesQuery,
  NOTE_MAX_TITLE_LENGTH,
  parseNoteContentResult,
  sanitizeNoteInput,
} from '../../shared/noteBlocks'
import type {
  NoteBook,
  NoteFilter,
  NoteWindowStateInput,
  StickyNote,
  StickyNoteInput,
} from '../../shared/types'
import type { SyncNote, SyncNoteBook } from '../../shared/syncTypes'

export const DEFAULT_NOTE_BOOK_ID = 'notes-default'

interface NoteBookRow {
  id: string
  name_encrypted: string
  sort_order: number
  created_at: number
  updated_at: number
  deleted_at: number | null
}

interface NoteRow {
  id: string
  book_id: string
  title_encrypted: string
  content_encrypted: string
  color: string
  is_favorite: number
  is_desktop_visible: number
  is_always_on_top: number
  window_x: number | null
  window_y: number | null
  window_width: number | null
  window_height: number | null
  created_at: number
  updated_at: number
  deleted_at: number | null
}

const NOTE_COLUMNS = `id, book_id, title_encrypted, content_encrypted, color, is_favorite,
  is_desktop_visible, is_always_on_top, window_x, window_y, window_width, window_height,
  created_at, updated_at, deleted_at`

function mapBookRow(values: unknown[]): NoteBookRow {
  return {
    id: String(values[0]), name_encrypted: String(values[1]), sort_order: Number(values[2]),
    created_at: Number(values[3]), updated_at: Number(values[4]),
    deleted_at: values[5] == null ? null : Number(values[5]),
  }
}

function mapNoteRow(values: unknown[]): NoteRow {
  return {
    id: String(values[0]), book_id: String(values[1]), title_encrypted: String(values[2]),
    content_encrypted: String(values[3]), color: String(values[4]), is_favorite: Number(values[5]),
    is_desktop_visible: Number(values[6]), is_always_on_top: Number(values[7]),
    window_x: values[8] == null ? null : Number(values[8]), window_y: values[9] == null ? null : Number(values[9]),
    window_width: values[10] == null ? null : Number(values[10]), window_height: values[11] == null ? null : Number(values[11]),
    created_at: Number(values[12]), updated_at: Number(values[13]), deleted_at: values[14] == null ? null : Number(values[14]),
  }
}

function readBookRow(id: string): NoteBookRow | null {
  const stmt = getDatabase().prepare('SELECT id, name_encrypted, sort_order, created_at, updated_at, deleted_at FROM note_books WHERE id = ?')
  stmt.bind([id])
  const row = stmt.step() ? mapBookRow(stmt.get()) : null
  stmt.free()
  return row
}

function readNoteRow(id: string): NoteRow | null {
  const stmt = getDatabase().prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`)
  stmt.bind([id])
  const row = stmt.step() ? mapNoteRow(stmt.get()) : null
  stmt.free()
  return row
}

function ensureDefaultBook(): void {
  if (readBookRow(DEFAULT_NOTE_BOOK_ID)) return
  const now = Date.now()
  getDatabase().run(
    'INSERT INTO note_books (id, name_encrypted, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [DEFAULT_NOTE_BOOK_ID, encryptSecret('默认便签本', getSessionKey()), 0, now, now],
  )
  persistDatabase()
}

function bookExists(id: string): boolean {
  const row = readBookRow(id)
  return Boolean(row && row.deleted_at == null)
}

function decryptField(payload: string, key: ReturnType<typeof getSessionKey>): { value: string; invalid: boolean } {
  try {
    return { value: decryptSecret(payload, key), invalid: false }
  } catch {
    return { value: '', invalid: true }
  }
}

function toNote(row: NoteRow): StickyNote {
  const key = getSessionKey()
  const title = decryptField(row.title_encrypted, key)
  const body = decryptField(row.content_encrypted, key)
  const parsed = body.invalid ? { content: createEmptyNoteContent(), invalid: true } : parseNoteContentResult(body.value)
  return {
    id: row.id,
    bookId: row.book_id,
    title: title.value,
    content: parsed.content,
    color: isNoteColor(row.color) ? row.color : 'paper',
    isFavorite: row.is_favorite === 1,
    isDesktopVisible: row.is_desktop_visible === 1,
    isAlwaysOnTop: row.is_always_on_top === 1,
    windowX: row.window_x,
    windowY: row.window_y,
    windowWidth: row.window_width,
    windowHeight: row.window_height,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    contentInvalid: title.invalid || parsed.invalid || undefined,
  }
}

function validateTitle(title: string): string {
  return title.trim().slice(0, NOTE_MAX_TITLE_LENGTH)
}

export function listNoteBooks(): NoteBook[] {
  ensureDefaultBook()
  const stmt = getDatabase().prepare(`
    SELECT b.id, b.name_encrypted, b.sort_order, b.created_at, b.updated_at, b.deleted_at,
      COUNT(n.id) AS note_count
    FROM note_books b
    LEFT JOIN notes n ON n.book_id = b.id AND n.deleted_at IS NULL
    WHERE b.deleted_at IS NULL
    GROUP BY b.id
    ORDER BY b.sort_order ASC, b.created_at ASC
  `)
  const key = getSessionKey()
  const books: NoteBook[] = []
  while (stmt.step()) {
    const values = stmt.get()
    books.push({
      id: String(values[0]), name: decryptSecret(String(values[1]), key), sortOrder: Number(values[2]),
      createdAt: Number(values[3]), updatedAt: Number(values[4]), noteCount: Number(values[6]),
    })
  }
  stmt.free()
  return books
}

export function createNoteBook(name: string): NoteBook {
  ensureDefaultBook()
  const clean = name.trim().slice(0, 80)
  if (!clean) throw new Error('NOTE_BOOK_NAME_REQUIRED')
  const now = Date.now()
  const id = randomUUID()
  const books = listNoteBooks()
  getDatabase().run(
    'INSERT INTO note_books (id, name_encrypted, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, encryptSecret(clean, getSessionKey()), books.length, now, now],
  )
  persistDatabase()
  return listNoteBooks().find((book) => book.id === id)!
}

export function updateNoteBook(id: string, name: string): NoteBook {
  if (!bookExists(id)) throw new Error('NOTE_BOOK_NOT_FOUND')
  const clean = name.trim().slice(0, 80)
  if (!clean) throw new Error('NOTE_BOOK_NAME_REQUIRED')
  getDatabase().run('UPDATE note_books SET name_encrypted = ?, updated_at = ? WHERE id = ?', [encryptSecret(clean, getSessionKey()), Date.now(), id])
  persistDatabase()
  return listNoteBooks().find((book) => book.id === id)!
}

export function deleteNoteBook(id: string, targetBookId?: string, deleteNotes = false): void {
  if (id === DEFAULT_NOTE_BOOK_ID) throw new Error('DEFAULT_NOTE_BOOK_CANNOT_DELETE')
  if (!bookExists(id)) throw new Error('NOTE_BOOK_NOT_FOUND')
  const db = getDatabase()
  const now = Date.now()
  if (deleteNotes) {
    db.run('UPDATE notes SET deleted_at = ?, is_desktop_visible = 0, updated_at = ? WHERE book_id = ? AND deleted_at IS NULL', [now, now, id])
  } else {
    const destination = targetBookId && bookExists(targetBookId) ? targetBookId : DEFAULT_NOTE_BOOK_ID
    db.run('UPDATE notes SET book_id = ?, updated_at = ? WHERE book_id = ? AND deleted_at IS NULL', [destination, now, id])
  }
  db.run('UPDATE note_books SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id])
  persistDatabase()
}

export function listNotes(filter: NoteFilter = 'all', query = ''): StickyNote[] {
  ensureDefaultBook()
  const where = filter === 'trash'
    ? 'deleted_at IS NOT NULL'
    : filter === 'favorite'
      ? 'deleted_at IS NULL AND is_favorite = 1'
      : filter === 'all'
        ? 'deleted_at IS NULL'
        : 'deleted_at IS NULL AND book_id = ?'
  const stmt = getDatabase().prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE ${where} ORDER BY updated_at DESC`)
  if (!['trash', 'favorite', 'all'].includes(filter)) stmt.bind([filter])
  const notes: StickyNote[] = []
  while (stmt.step()) {
    const note = toNote(mapNoteRow(stmt.get()))
    if (noteMatchesQuery(note, query)) notes.push(note)
  }
  stmt.free()
  return notes
}

export function listAllNotes(): StickyNote[] {
  ensureDefaultBook()
  const stmt = getDatabase().prepare(`SELECT ${NOTE_COLUMNS} FROM notes ORDER BY updated_at DESC`)
  const notes: StickyNote[] = []
  while (stmt.step()) notes.push(toNote(mapNoteRow(stmt.get())))
  stmt.free()
  return notes
}

export function listDesktopVisibleNoteIds(): string[] {
  const stmt = getDatabase().prepare('SELECT id FROM notes WHERE deleted_at IS NULL AND is_desktop_visible = 1')
  const ids: string[] = []
  while (stmt.step()) ids.push(String(stmt.get()[0]))
  stmt.free()
  return ids
}

export function getNote(id: string, includeDeleted = false): StickyNote | null {
  const row = readNoteRow(id)
  if (!row || (!includeDeleted && row.deleted_at != null)) return null
  return toNote(row)
}

export function createNote(input?: Partial<StickyNoteInput>): StickyNote {
  ensureDefaultBook()
  const id = randomUUID()
  const now = Date.now()
  const bookId = input?.bookId && bookExists(input.bookId) ? input.bookId : DEFAULT_NOTE_BOOK_ID
  const content = normalizeNoteContent(input?.content ?? createEmptyNoteContent())
  const color = isNoteColor(input?.color) ? input.color : 'yellow'
  getDatabase().run(
    `INSERT INTO notes (id, book_id, title_encrypted, content_encrypted, color, is_favorite, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, bookId, encryptSecret(validateTitle(input?.title ?? ''), getSessionKey()), encryptSecret(JSON.stringify(content), getSessionKey()), color, input?.isFavorite ? 1 : 0, now, now],
  )
  persistDatabase()
  return getNote(id)!
}

export function updateNote(id: string, input: StickyNoteInput): StickyNote {
  const existing = readNoteRow(id)
  if (!existing || existing.deleted_at != null) throw new Error('NOTE_NOT_FOUND')
  if (toNote(existing).contentInvalid) throw new Error('NOTE_CONTENT_INVALID')
  const clean = sanitizeNoteInput(input)
  const bookId = clean.bookId && bookExists(clean.bookId) ? clean.bookId : existing.book_id
  const color = isNoteColor(clean.color) ? clean.color : existing.color
  const content = clean.content
  getDatabase().run(
    `UPDATE notes SET book_id = ?, title_encrypted = ?, content_encrypted = ?, color = ?, is_favorite = ?, updated_at = ? WHERE id = ?`,
    [bookId, encryptSecret(validateTitle(clean.title), getSessionKey()), encryptSecret(JSON.stringify(content), getSessionKey()), color, clean.isFavorite ? 1 : 0, Date.now(), id],
  )
  persistDatabase()
  return getNote(id)!
}

export function updateNoteWindowState(id: string, state: NoteWindowStateInput): StickyNote {
  const existing = readNoteRow(id)
  if (!existing || existing.deleted_at != null) throw new Error('NOTE_NOT_FOUND')
  const next = {
    visible: state.isDesktopVisible ?? existing.is_desktop_visible === 1,
    top: state.isAlwaysOnTop ?? existing.is_always_on_top === 1,
    x: state.windowX === undefined ? existing.window_x : state.windowX,
    y: state.windowY === undefined ? existing.window_y : state.windowY,
    width: state.windowWidth === undefined ? existing.window_width : state.windowWidth,
    height: state.windowHeight === undefined ? existing.window_height : state.windowHeight,
  }
  getDatabase().run(
    `UPDATE notes SET is_desktop_visible = ?, is_always_on_top = ?, window_x = ?, window_y = ?, window_width = ?, window_height = ? WHERE id = ?`,
    [next.visible ? 1 : 0, next.top ? 1 : 0, next.x, next.y, next.width, next.height, id],
  )
  persistDatabase()
  return getNote(id)!
}

export function toggleNoteFavorite(id: string): StickyNote {
  const existing = readNoteRow(id)
  if (!existing || existing.deleted_at != null) throw new Error('NOTE_NOT_FOUND')
  getDatabase().run('UPDATE notes SET is_favorite = ?, updated_at = ? WHERE id = ?', [existing.is_favorite === 1 ? 0 : 1, Date.now(), id])
  persistDatabase()
  return getNote(id)!
}

export function deleteNote(id: string): void {
  if (!getNote(id)) throw new Error('NOTE_NOT_FOUND')
  const now = Date.now()
  getDatabase().run('UPDATE notes SET deleted_at = ?, updated_at = ?, is_desktop_visible = 0 WHERE id = ?', [now, now, id])
  persistDatabase()
}

export function restoreNote(id: string): StickyNote {
  const row = readNoteRow(id)
  if (!row || row.deleted_at == null) throw new Error('NOTE_NOT_FOUND')
  ensureDefaultBook()
  const bookId = bookExists(row.book_id) ? row.book_id : DEFAULT_NOTE_BOOK_ID
  getDatabase().run('UPDATE notes SET deleted_at = NULL, book_id = ?, updated_at = ? WHERE id = ?', [bookId, Date.now(), id])
  persistDatabase()
  return getNote(id)!
}

export function permanentlyDeleteNote(id: string): void {
  const row = readNoteRow(id)
  if (!row || row.deleted_at == null) throw new Error('NOTE_NOT_FOUND')
  getDatabase().run('DELETE FROM notes WHERE id = ?', [id])
  persistDatabase()
}

export function importNotesFromPayload(books: NoteBook[], notes: StickyNote[]): void {
  ensureDefaultBook()
  const db = getDatabase()
  const key = getSessionKey()
  const bookIdMap = new Map<string, string>()
  for (const book of books) {
    const cleanName = String(book.name ?? '').trim().slice(0, 80)
    if (!cleanName) continue
    const requestedId = String(book.id ?? '').trim()
    const id = requestedId && !readBookRow(requestedId) ? requestedId : randomUUID()
    bookIdMap.set(requestedId, id)
    const createdAt = Number.isFinite(book.createdAt) ? book.createdAt : Date.now()
    const updatedAt = Number.isFinite(book.updatedAt) ? book.updatedAt : createdAt
    db.run(
      'INSERT INTO note_books (id, name_encrypted, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, encryptSecret(cleanName, key), Number(book.sortOrder) || 0, createdAt, updatedAt],
    )
  }
  for (const note of notes) {
    const requestedId = String(note.id ?? '').trim()
    const id = requestedId && !readNoteRow(requestedId) ? requestedId : randomUUID()
    const mappedBook = bookIdMap.get(note.bookId) ?? (bookExists(note.bookId) ? note.bookId : DEFAULT_NOTE_BOOK_ID)
    const content = normalizeNoteContent(note.content)
    const createdAt = Number.isFinite(note.createdAt) ? note.createdAt : Date.now()
    const updatedAt = Number.isFinite(note.updatedAt) ? note.updatedAt : createdAt
    db.run(
      `INSERT INTO notes (id, book_id, title_encrypted, content_encrypted, color, is_favorite,
        is_desktop_visible, is_always_on_top, window_x, window_y, window_width, window_height,
        created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, mappedBook, encryptSecret(validateTitle(note.title), key), encryptSecret(JSON.stringify(content), key),
        isNoteColor(note.color) ? note.color : 'paper', note.isFavorite ? 1 : 0, 0, note.isAlwaysOnTop ? 1 : 0,
        note.windowX, note.windowY, note.windowWidth, note.windowHeight, createdAt, updatedAt, note.deletedAt],
    )
  }
  persistDatabase()
}

export function buildSyncNotesFromDb(): { noteBooks: SyncNoteBook[]; notes: SyncNote[] } {
  ensureDefaultBook()
  const key = getSessionKey()
  const noteBooks: SyncNoteBook[] = []
  const bookStmt = getDatabase().prepare('SELECT id, name_encrypted, sort_order, created_at, updated_at, deleted_at FROM note_books')
  while (bookStmt.step()) {
    const row = mapBookRow(bookStmt.get())
    noteBooks.push({ id: row.id, name: decryptSecret(row.name_encrypted, key), sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at })
  }
  bookStmt.free()
  const notes: SyncNote[] = []
  const noteStmt = getDatabase().prepare(`SELECT ${NOTE_COLUMNS} FROM notes`)
  while (noteStmt.step()) {
    const note = toNote(mapNoteRow(noteStmt.get()))
    notes.push({ id: note.id, bookId: note.bookId, title: note.title, content: note.content, color: note.color, isFavorite: note.isFavorite, createdAt: note.createdAt, updatedAt: note.updatedAt, deletedAt: note.deletedAt })
  }
  noteStmt.free()
  return { noteBooks, notes }
}

export function applySyncedNotes(noteBooks: SyncNoteBook[], notes: SyncNote[]): void {
  ensureDefaultBook()
  const db = getDatabase()
  const key = getSessionKey()
  for (const book of noteBooks) {
    if (book.id === DEFAULT_NOTE_BOOK_ID && readBookRow(book.id)) {
      db.run('UPDATE note_books SET name_encrypted = ?, sort_order = ?, updated_at = ?, deleted_at = NULL WHERE id = ?', [encryptSecret(book.name, key), book.sortOrder, book.updatedAt, book.id])
      continue
    }
    db.run(
      'INSERT OR REPLACE INTO note_books (id, name_encrypted, sort_order, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)',
      [book.id, encryptSecret(book.name, key), book.sortOrder, book.createdAt, book.updatedAt, book.deletedAt],
    )
  }
  for (const note of notes) {
    const existing = readNoteRow(note.id)
    const bookId = bookExists(note.bookId) ? note.bookId : DEFAULT_NOTE_BOOK_ID
    db.run(
      `INSERT OR REPLACE INTO notes (id, book_id, title_encrypted, content_encrypted, color, is_favorite,
        is_desktop_visible, is_always_on_top, window_x, window_y, window_width, window_height,
        created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [note.id, bookId, encryptSecret(validateTitle(note.title), key), encryptSecret(JSON.stringify(normalizeNoteContent(note.content)), key),
        isNoteColor(note.color) ? note.color : 'paper', note.isFavorite ? 1 : 0,
        existing?.is_desktop_visible ?? 0, existing?.is_always_on_top ?? 0, existing?.window_x ?? null,
        existing?.window_y ?? null, existing?.window_width ?? null, existing?.window_height ?? null,
        note.createdAt, note.updatedAt, note.deletedAt],
    )
  }
  persistDatabase()
}
