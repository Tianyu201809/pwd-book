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
  last_used_at: number | null
  created_at: number
  updated_at: number
}

export function readEntryRows(): EntryRow[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, title, url, username, password_encrypted, note, category, tags,
           is_favorite, last_used_at, created_at, updated_at
    FROM password_entries
    ORDER BY updated_at DESC
  `)

  const rows: EntryRow[] = []
  while (stmt.step()) {
    const values = stmt.get()
    rows.push({
      id: String(values[0]),
      title: String(values[1]),
      url: String(values[2]),
      username: String(values[3]),
      password_encrypted: String(values[4]),
      note: String(values[5]),
      category: String(values[6]),
      tags: String(values[7]),
      is_favorite: Number(values[8]),
      last_used_at: values[9] == null ? null : Number(values[9]),
      created_at: Number(values[10]),
      updated_at: Number(values[11]),
    })
  }
  stmt.free()
  return rows
}

export function readEntryRow(id: string): EntryRow | null {
  return readEntryRows().find((row) => row.id === id) ?? null
}
