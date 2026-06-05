import { decryptSecret } from '../crypto/vaultCrypto'
import type { EntryRow } from '../db/helpers'
import type { PasswordEntry } from '../../shared/types'
import { getCategoryName } from './categoryService'
import { getSessionKey } from './sessionService'

export function rowToEntry(row: EntryRow): PasswordEntry {
  const key = getSessionKey()
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    username: row.username,
    password: decryptSecret(row.password_encrypted, key),
    note: row.note,
    categoryId: row.category,
    categoryName: getCategoryName(row.category),
    tags: JSON.parse(row.tags || '[]') as string[],
    isFavorite: row.is_favorite === 1,
    displayIcon: row.display_icon,
    localProgramPath: row.local_program_path,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
