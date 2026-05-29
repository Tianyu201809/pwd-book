import { randomUUID } from 'crypto'
import { appError, ErrorCode } from '../../shared/errors'
import { getDatabase, persistDatabase } from '../db/database'
import {
  countEntriesInCategory,
  findCategoryByName,
  getDefaultCategoryId,
  readCategoryRow,
  readCategoryRows,
} from '../db/categories'
import { isUnlocked } from './sessionService'
import { getSetting, setSetting } from '../db/helpers'
import type { CategoryInput, VaultCategory } from '../../shared/types'
import { RESERVED_CATEGORY_NAMES } from '../../shared/types'
import { CATEGORY_ICON_VALUES } from '../../shared/categoryIcons'

const SIDEBAR_ORDER_KEY = 'sidebar_category_order'
const SYSTEM_CATEGORY_IDS = new Set(['all', 'favorite'])

const ALLOWED_ICONS = new Set(CATEGORY_ICON_VALUES)

function normalizeCategoryName(name: string): string {
  return name.trim()
}

function assertValidCategoryName(name: string, excludeId?: string): string {
  const normalized = normalizeCategoryName(name)
  if (!normalized) {
    throw appError(ErrorCode.CATEGORY_NAME_EMPTY)
  }
  if (normalized.length > 20) {
    throw appError(ErrorCode.CATEGORY_NAME_TOO_LONG)
  }
  const lower = normalized.toLowerCase()
  if (RESERVED_CATEGORY_NAMES.some((reserved) => reserved.toLowerCase() === lower)) {
    throw appError(ErrorCode.CATEGORY_NAME_RESERVED, { name: normalized })
  }

  const db = getDatabase()
  const duplicate = findCategoryByName(db, normalized, excludeId)
  if (duplicate) {
    throw appError(ErrorCode.CATEGORY_NAME_EXISTS, { name: normalized })
  }

  return normalized
}

function rowToCategory(row: ReturnType<typeof readCategoryRow>, entryCount = 0): VaultCategory {
  if (!row) throw appError(ErrorCode.CATEGORY_NOT_FOUND)
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
  if (!isUnlocked()) throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)

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
  if (!isUnlocked()) throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)

  const db = getDatabase()
  const existing = readCategoryRow(db, id)
  if (!existing) throw appError(ErrorCode.CATEGORY_NOT_FOUND)

  const name = assertValidCategoryName(input.name, id)
  const icon = ALLOWED_ICONS.has(input.icon ?? '') ? input.icon! : existing.icon

  db.run('UPDATE categories SET name = ?, icon = ? WHERE id = ?', [name, icon, id])
  persistDatabase()

  const row = readCategoryRow(db, id)
  return rowToCategory(row, countEntriesInCategory(db, id))
}

export function deleteCategory(id: string): void {
  if (!isUnlocked()) throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)

  const db = getDatabase()
  const existing = readCategoryRow(db, id)
  if (!existing) throw appError(ErrorCode.CATEGORY_NOT_FOUND)

  const entryCount = countEntriesInCategory(db, id)
  if (entryCount > 0) {
    throw appError(ErrorCode.CATEGORY_HAS_ENTRIES, { count: entryCount })
  }

  const categories = readCategoryRows(db)
  if (categories.length <= 1) {
    throw appError(ErrorCode.CATEGORY_MIN_ONE)
  }

  db.run('DELETE FROM categories WHERE id = ?', [id])
  persistDatabase()
}

export function reorderCategories(categoryIds: string[]): VaultCategory[] {
  if (!isUnlocked()) throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)

  const db = getDatabase()
  const existing = readCategoryRows(db)
  if (categoryIds.length !== existing.length) {
    throw appError(ErrorCode.CATEGORY_LIST_INCOMPLETE)
  }

  const existingIds = new Set(existing.map((row) => row.id))
  for (const id of categoryIds) {
    if (!existingIds.has(id)) {
      throw appError(ErrorCode.CATEGORY_NOT_FOUND)
    }
  }

  categoryIds.forEach((id, index) => {
    db.run('UPDATE categories SET sort_order = ? WHERE id = ?', [index + 1, id])
  })
  persistDatabase()

  return listCategories()
}

export function getSidebarCategoryOrder(): string[] {
  const raw = getSetting(SIDEBAR_ORDER_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : []
  } catch {
    return []
  }
}

function setSidebarCategoryOrder(order: string[]): void {
  setSetting(SIDEBAR_ORDER_KEY, JSON.stringify(order))
}

export function reorderSidebarCategories(order: string[]): VaultCategory[] {
  if (!isUnlocked()) throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)

  const categories = listCategories()
  const categoryIds = categories.map((category) => category.id)
  const expected = new Set(['all', 'favorite', ...categoryIds])

  if (order.length !== expected.size) {
    throw appError(ErrorCode.CATEGORY_LIST_INCOMPLETE)
  }
  if (!order.includes('all') || !order.includes('favorite')) {
    throw appError(ErrorCode.CATEGORY_LIST_INCOMPLETE)
  }
  for (const id of order) {
    if (!expected.has(id)) {
      throw appError(ErrorCode.CATEGORY_NOT_FOUND)
    }
  }

  setSidebarCategoryOrder(order)
  const dbCategoryOrder = order.filter((id) => !SYSTEM_CATEGORY_IDS.has(id))
  reorderCategories(dbCategoryOrder)

  return listCategories()
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
