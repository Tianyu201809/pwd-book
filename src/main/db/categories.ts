import type { Database } from 'sql.js'
import { persistDatabase } from './database'
import { appError, ErrorCode } from '../../shared/errors'

export interface CategoryRow {
  id: string
  name: string
  icon: string
  sort_order: number
  created_at: number
}

export const DEFAULT_CATEGORIES: Array<Omit<CategoryRow, 'created_at'>> = [
  { id: 'cat-work', name: '工作', icon: 'Briefcase', sort_order: 1 },
  { id: 'cat-social', name: '社交', icon: 'Users', sort_order: 2 },
  { id: 'cat-finance', name: '金融', icon: 'Landmark', sort_order: 3 },
  { id: 'cat-other', name: '其他', icon: 'Folder', sort_order: 99 },
]

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  work: 'cat-work',
  social: 'cat-social',
  finance: 'cat-finance',
  other: 'cat-other',
}

export function seedAndMigrateCategories(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'Folder',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `)

  const countResult = db.exec('SELECT COUNT(*) AS count FROM categories')
  const count = countResult.length ? Number(countResult[0].values[0][0]) : 0

  if (count === 0) {
    const now = Date.now()
    DEFAULT_CATEGORIES.forEach((category) => {
      db.run(
        'INSERT INTO categories (id, name, icon, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
        [category.id, category.name, category.icon, category.sort_order, now],
      )
    })
  }

  Object.entries(LEGACY_CATEGORY_MAP).forEach(([legacy, categoryId]) => {
    db.run('UPDATE password_entries SET category = ? WHERE category = ?', [categoryId, legacy])
  })

  persistDatabase()
}

export function readCategoryRows(db: Database): CategoryRow[] {
  const stmt = db.prepare(`
    SELECT id, name, icon, sort_order, created_at
    FROM categories
    ORDER BY sort_order ASC, created_at ASC
  `)

  const rows: CategoryRow[] = []
  while (stmt.step()) {
    const values = stmt.get()
    rows.push({
      id: String(values[0]),
      name: String(values[1]),
      icon: String(values[2]),
      sort_order: Number(values[3]),
      created_at: Number(values[4]),
    })
  }
  stmt.free()
  return rows
}

export function readCategoryRow(db: Database, id: string): CategoryRow | null {
  const stmt = db.prepare(`
    SELECT id, name, icon, sort_order, created_at
    FROM categories
    WHERE id = ?
  `)
  stmt.bind([id])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const values = stmt.get()
  stmt.free()
  return {
    id: String(values[0]),
    name: String(values[1]),
    icon: String(values[2]),
    sort_order: Number(values[3]),
    created_at: Number(values[4]),
  }
}

export function findCategoryByName(db: Database, name: string, excludeId?: string): CategoryRow | null {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return null

  const rows = readCategoryRows(db)
  return (
    rows.find(
      (row) => row.name.trim().toLowerCase() === normalized && row.id !== excludeId,
    ) ?? null
  )
}

export function countEntriesInCategory(db: Database, categoryId: string): number {
  const stmt = db.prepare(
    'SELECT COUNT(*) FROM password_entries WHERE category = ? AND deleted_at IS NULL',
  )
  stmt.bind([categoryId])
  stmt.step()
  const count = Number(stmt.get()[0])
  stmt.free()
  return count
}

export function getDefaultCategoryId(db: Database): string {
  const other = readCategoryRow(db, 'cat-other')
  if (other) return other.id
  const rows = readCategoryRows(db)
  if (rows.length === 0) throw appError(ErrorCode.DEFAULT_CATEGORY_NOT_FOUND)
  return rows[0].id
}
