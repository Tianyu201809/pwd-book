import { getDatabase, persistDatabase } from './database'

export function getSetting(key: string): string | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?')
  stmt.bind([key])
  if (stmt.step()) {
    const value = stmt.get()[0]
    stmt.free()
    return value == null ? null : String(value)
  }
  stmt.free()
  return null
}

export function setSetting(key: string, value: string): void {
  const db = getDatabase()
  db.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [key, value])
  persistDatabase()
}

export interface EntryRow {
  id: string
  title: string
  url: string
  username: string
  password_encrypted: string
  note: string
  category: string
  tags: string
  is_favorite: number
  display_icon: string
  local_program_path: string
  last_used_at: number | null
  created_at: number
  updated_at: number
  deleted_at: number | null
}

const ENTRY_SELECT_COLUMNS = `
  id, title, url, username, password_encrypted, note, category, tags,
  is_favorite, display_icon, local_program_path, last_used_at, created_at, updated_at, deleted_at
`

function mapEntryRow(values: unknown[]): EntryRow {
  return {
    id: String(values[0]),
    title: String(values[1]),
    url: String(values[2]),
    username: String(values[3]),
    password_encrypted: String(values[4]),
    note: String(values[5]),
    category: String(values[6]),
    tags: String(values[7]),
    is_favorite: Number(values[8]),
    display_icon: String(values[9] ?? ''),
    local_program_path: String(values[10] ?? ''),
    last_used_at: values[11] == null ? null : Number(values[11]),
    created_at: Number(values[12]),
    updated_at: Number(values[13]),
    deleted_at: values[14] == null ? null : Number(values[14]),
  }
}

function queryEntryRows(whereSql: string, orderBy: string): EntryRow[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT ${ENTRY_SELECT_COLUMNS}
    FROM password_entries
    WHERE ${whereSql}
    ORDER BY ${orderBy}
  `)

  const rows: EntryRow[] = []
  while (stmt.step()) {
    rows.push(mapEntryRow(stmt.get()))
  }
  stmt.free()
  return rows
}

/** 未在回收站中的条目（主列表、导出、分类计数等）。 */
export function readActiveEntryRows(): EntryRow[] {
  return queryEntryRows('deleted_at IS NULL', 'updated_at DESC')
}

/** 回收站中的条目。 */
export function readTrashedEntryRows(): EntryRow[] {
  return queryEntryRows('deleted_at IS NOT NULL', 'deleted_at DESC')
}

/** @deprecated 请使用 readActiveEntryRows */
export function readEntryRows(): EntryRow[] {
  return readActiveEntryRows()
}

export function readEntryRow(id: string): EntryRow | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT ${ENTRY_SELECT_COLUMNS}
    FROM password_entries
    WHERE id = ?
  `)
  stmt.bind([id])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const row = mapEntryRow(stmt.get())
  stmt.free()
  return row
}

export function readActiveEntryRow(id: string): EntryRow | null {
  const row = readEntryRow(id)
  if (!row || row.deleted_at != null) return null
  return row
}

export function countActiveEntries(): number {
  const db = getDatabase()
  const stmt = db.prepare('SELECT COUNT(*) FROM password_entries WHERE deleted_at IS NULL')
  stmt.step()
  const count = Number(stmt.get()[0])
  stmt.free()
  return count
}

export function countTrashedEntries(): number {
  const db = getDatabase()
  const stmt = db.prepare('SELECT COUNT(*) FROM password_entries WHERE deleted_at IS NOT NULL')
  stmt.step()
  const count = Number(stmt.get()[0])
  stmt.free()
  return count
}
