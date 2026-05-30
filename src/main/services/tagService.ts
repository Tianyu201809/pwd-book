import { appError, ErrorCode } from '../../shared/errors'
import { getDatabase, persistDatabase } from '../db/database'
import { getSetting, readEntryRows, setSetting } from '../db/helpers'
import { isUnlocked } from './sessionService'
import type { TagInput, VaultTag } from '../../shared/types'

const TAG_REGISTRY_KEY = 'vault_tag_registry'
const TAG_NAME_MAX_LENGTH = 30

function tagKey(name: string): string {
  return name.trim().toLowerCase()
}

function parseEntryTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => String(item).trim()).filter(Boolean)
  } catch {
    return []
  }
}

function readRegistry(): string[] {
  const raw = getSetting(TAG_REGISTRY_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => String(item).trim()).filter(Boolean)
  } catch {
    return []
  }
}

function writeRegistry(tags: string[]): void {
  const unique: string[] = []
  const seen = new Set<string>()
  for (const tag of tags) {
    const normalized = tag.trim()
    if (!normalized) continue
    const key = tagKey(normalized)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(normalized)
  }
  setSetting(TAG_REGISTRY_KEY, JSON.stringify(unique))
}

function assertUnlocked(): void {
  if (!isUnlocked()) throw appError(ErrorCode.VAULT_UNLOCK_REQUIRED)
}

function assertValidTagName(name: string, excludeKey?: string): string {
  const normalized = name.trim()
  if (!normalized) throw appError(ErrorCode.TAG_NAME_EMPTY)
  if (normalized.length > TAG_NAME_MAX_LENGTH) throw appError(ErrorCode.TAG_NAME_TOO_LONG)
  if (/[,，]/.test(normalized)) throw appError(ErrorCode.TAG_NAME_INVALID)
  const key = tagKey(normalized)
  if (excludeKey && key === excludeKey) return normalized
  if (findTagByKey(key)) throw appError(ErrorCode.TAG_NAME_EXISTS, { name: normalized })
  return normalized
}

function findTagByKey(key: string): VaultTag | null {
  return listTags().find((tag) => tagKey(tag.name) === key) ?? null
}

function collectTagUsage(): Map<string, { name: string; entryCount: number }> {
  const usage = new Map<string, { name: string; entryCount: number }>()

  function addTag(rawName: string, increment = 1): void {
    const trimmed = rawName.trim()
    if (!trimmed) return
    const key = tagKey(trimmed)
    const existing = usage.get(key)
    if (existing) {
      existing.entryCount += increment
      return
    }
    usage.set(key, { name: trimmed, entryCount: increment })
  }

  for (const row of readEntryRows()) {
    const tags = parseEntryTags(row.tags)
    const seenInEntry = new Set<string>()
    for (const tag of tags) {
      const key = tagKey(tag)
      if (seenInEntry.has(key)) continue
      seenInEntry.add(key)
      addTag(tag, 1)
    }
  }

  for (const tag of readRegistry()) {
    const key = tagKey(tag)
    if (!usage.has(key)) {
      usage.set(key, { name: tag, entryCount: 0 })
    }
  }

  return usage
}

export function listTags(): VaultTag[] {
  assertUnlocked()
  return [...collectTagUsage()]
    .map(([, value]) => ({ name: value.name, entryCount: value.entryCount }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

export function createTag(input: TagInput): VaultTag {
  assertUnlocked()
  const name = assertValidTagName(input.name)
  const registry = readRegistry()
  registry.push(name)
  writeRegistry(registry)
  return { name, entryCount: 0 }
}

function dedupeTags(tags: string[]): string[] {
  const next: string[] = []
  const seen = new Set<string>()
  for (const tag of tags) {
    const trimmed = tag.trim()
    if (!trimmed) continue
    const key = tagKey(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    next.push(trimmed)
  }
  return next
}

function replaceTagInEntries(oldName: string, newName: string | null): number {
  const db = getDatabase()
  const oldKey = tagKey(oldName)
  let affected = 0
  const now = Date.now()

  for (const row of readEntryRows()) {
    const tags = parseEntryTags(row.tags)
    const mapped = tags.map((tag) => {
      if (tagKey(tag) !== oldKey) return tag
      return newName
    })
    const next = dedupeTags(mapped.filter((tag): tag is string => tag != null))
    const changed = JSON.stringify(next) !== JSON.stringify(dedupeTags(tags))
    if (!changed) continue

    db.run('UPDATE password_entries SET tags = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(next),
      now,
      row.id,
    ])
    affected += 1
  }

  if (affected > 0) persistDatabase()
  return affected
}

export function updateTag(oldName: string, input: TagInput): VaultTag {
  assertUnlocked()
  const trimmedOld = oldName.trim()
  if (!trimmedOld) throw appError(ErrorCode.TAG_NOT_FOUND)

  const oldKey = tagKey(trimmedOld)
  const existing = findTagByKey(oldKey)
  if (!existing) throw appError(ErrorCode.TAG_NOT_FOUND)

  const newName = assertValidTagName(input.name, oldKey)
  if (tagKey(newName) === oldKey) return existing

  replaceTagInEntries(trimmedOld, newName)

  const registry = readRegistry()
  const nextRegistry = registry.map((tag) => (tagKey(tag) === oldKey ? newName : tag))
  writeRegistry(nextRegistry)

  const usage = collectTagUsage()
  const updated = usage.get(tagKey(newName))
  return { name: newName, entryCount: updated?.entryCount ?? existing.entryCount }
}

export function deleteTag(name: string): void {
  assertUnlocked()
  const trimmed = name.trim()
  if (!trimmed) throw appError(ErrorCode.TAG_NOT_FOUND)

  const key = tagKey(trimmed)
  if (!findTagByKey(key)) throw appError(ErrorCode.TAG_NOT_FOUND)

  replaceTagInEntries(trimmed, null)

  const registry = readRegistry().filter((tag) => tagKey(tag) !== key)
  writeRegistry(registry)
}
