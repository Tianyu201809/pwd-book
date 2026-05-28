import { randomUUID } from 'crypto'
import { getDatabase, persistDatabase } from '../db/database'
import {
  countEntriesInCategory,
  findCategoryByName,
  getDefaultCategoryId,
  readCategoryRow,
  readCategoryRows,
} from '../db/categories'
import { isUnlocked } from './sessionService'
import type { CategoryInput, VaultCategory } from '../../shared/types'
import { RESERVED_CATEGORY_NAMES } from '../../shared/types'

const ALLOWED_ICONS = new Set([
  'Briefcase',
  'Users',
  'Landmark',
  'Folder',
  'Star',
  'Tag',
  'Globe',
  'Shield',
  'Heart',
  'Gamepad2',
])

function normalizeCategoryName(name: string): string {
  return name.trim()
}

function assertValidCategoryName(name: string, excludeId?: string): string {
  const normalized = normalizeCategoryName(name)
  if (!normalized) {
    throw new Error('分类名称不能为空')
  }
  if (normalized.length > 20) {
    throw new Error('分类名称不能超过 20 个字符')
  }
  const lower = normalized.toLowerCase()
  if (RESERVED_CATEGORY_NAMES.some((reserved) => reserved.toLowerCase() === lower)) {
    throw new Error(`「${normalized}」是系统保留名称，请换一个名称`)
  }

  const db = getDatabase()
  const duplicate = findCategoryByName(db, normalized, excludeId)
  if (duplicate) {
    throw new Error(`分类名称「${normalized}」已存在`)
  }

  return normalized
}

function rowToCategory(row: ReturnType<typeof readCategoryRow>, entryCount = 0): VaultCategory {
  if (!row) throw new Error('分类不存在')
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    entryCount,
  }
}

export function listCategories(): VaultCategory[] {
  const db = getDatabase()
  return readCategoryRows(db).map((row) =>
    rowToCategory(row, countEntriesInCategory(db, row.id)),
  )
}

export function createCategory(input: CategoryInput): VaultCategory {
  if (!isUnlocked()) throw new Error('请先解锁保险库')

  const name = assertValidCategoryName(input.name)
  const icon = ALLOWED_ICONS.has(input.icon ?? '') ? input.icon! : 'Folder'
  const db = getDatabase()
  const id = randomUUID()
  const now = Date.now()
  const sortOrder = readCategoryRows(db).length + 1

  db.run(
    'INSERT INTO categories (id, name, icon, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, name, icon, sortOrder, now],
  )
  persistDatabase()

  const row = readCategoryRow(db, id)
  return rowToCategory(row, 0)
}

export function updateCategory(id: string, input: CategoryInput): VaultCategory {
  if (!isUnlocked()) throw new Error('请先解锁保险库')

  const db = getDatabase()
  const existing = readCategoryRow(db, id)
  if (!existing) throw new Error('分类不存在')

  const name = assertValidCategoryName(input.name, id)
  const icon = ALLOWED_ICONS.has(input.icon ?? '') ? input.icon! : existing.icon

  db.run('UPDATE categories SET name = ?, icon = ? WHERE id = ?', [name, icon, id])
  persistDatabase()

  const row = readCategoryRow(db, id)
  return rowToCategory(row, countEntriesInCategory(db, id))
}

export function deleteCategory(id: string): void {
  if (!isUnlocked()) throw new Error('请先解锁保险库')

  const db = getDatabase()
  const existing = readCategoryRow(db, id)
  if (!existing) throw new Error('分类不存在')

  const entryCount = countEntriesInCategory(db, id)
  if (entryCount > 0) {
    throw new Error(`该分类下还有 ${entryCount} 条密码，请先移动或删除后再试`)
  }

  const categories = readCategoryRows(db)
  if (categories.length <= 1) {
    throw new Error('至少需要保留一个分类')
  }

  db.run('DELETE FROM categories WHERE id = ?', [id])
  persistDatabase()
}

export function resolveCategoryId(categoryId?: string): string {
  const db = getDatabase()
  if (categoryId) {
    const category = readCategoryRow(db, categoryId)
    if (category) return category.id
  }
  return getDefaultCategoryId(db)
}

export function getCategoryName(categoryId: string): string {
  const db = getDatabase()
  const category = readCategoryRow(db, categoryId)
  return category?.name ?? '未分类'
}
