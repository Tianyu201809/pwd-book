import { parseCustomFields, normalizeCustomFields } from './customFields'
import { parseExportAttachmentsFromPayload } from './exportAttachments'
import { parseCsvRecords, pickField } from './importCsv'
import type { ExportAttachment, ExportPayload, PasswordEntryInput, VaultCategory } from './types'

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  work: 'cat-work',
  personal: 'cat-personal',
  finance: 'cat-finance',
  social: 'cat-social',
  other: 'cat-other',
}

export function normalizeImportEntry(raw: Record<string, unknown>): PasswordEntryInput {
  const categoryId =
    (raw.categoryId as string | undefined) ??
    LEGACY_CATEGORY_MAP[String(raw.category ?? '')] ??
    undefined

  const id = String(raw.id ?? '').trim()

  return {
    title: String(raw.title ?? ''),
    url: String(raw.url ?? ''),
    username: String(raw.username ?? ''),
    password: String(raw.password ?? ''),
    note: String(raw.note ?? ''),
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    categoryId,
    isFavorite: Boolean(raw.isFavorite),
    displayIcon: String(raw.displayIcon ?? ''),
    localProgramPath: String(raw.localProgramPath ?? raw.local_program_path ?? ''),
    totpSecret: String(raw.totpSecret ?? raw.totp_secret ?? ''),
    customFields: normalizeCustomFields(raw.customFields ?? raw.custom_fields),
    ...(id ? { id } : {}),
  }
}

function normalizeImportCategory(raw: Record<string, unknown>): VaultCategory | null {
  const id = String(raw.id ?? '').trim()
  if (!id || id === 'all' || id === 'favorite') return null

  return {
    id,
    name: String(raw.name ?? raw.label ?? '').trim() || id,
    icon: String(raw.icon ?? 'Folder'),
    sortOrder: Number(raw.sortOrder ?? raw.sort_order ?? 0) || 0,
    createdAt: Number(raw.createdAt ?? raw.created_at ?? Date.now()),
  }
}

export function collectImportCategories(parsed: ExportPayload): VaultCategory[] {
  const byId = new Map<string, VaultCategory>()

  for (const raw of parsed.categories ?? []) {
    const category = normalizeImportCategory(raw as unknown as Record<string, unknown>)
    if (category) byId.set(category.id, category)
  }

  for (const raw of parsed.entries ?? []) {
    const entry = raw as unknown as Record<string, unknown>
    const categoryId = String(entry.categoryId ?? entry.category ?? '').trim()
    if (!categoryId || categoryId === 'all' || categoryId === 'favorite') continue
    if (byId.has(categoryId)) continue

    byId.set(categoryId, {
      id: categoryId,
      name: String(entry.categoryName ?? entry.category_name ?? categoryId).trim() || categoryId,
      icon: 'Folder',
      sortOrder: 99,
      createdAt: Date.now(),
    })
  }

  return Array.from(byId.values())
}

export function parsePwdbookJson(content: string): {
  categories: VaultCategory[]
  entries: PasswordEntryInput[]
  attachments: ExportAttachment[]
} {
  const parsed = JSON.parse(content) as ExportPayload
  return {
    categories: collectImportCategories(parsed),
    entries: (parsed.entries ?? []).map((entry) =>
      normalizeImportEntry(entry as unknown as Record<string, unknown>),
    ),
    attachments: parseExportAttachmentsFromPayload(parsed),
  }
}

function parsePwdbookFavorite(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return normalized === '是' || normalized === 'yes' || normalized === 'true' || normalized === '1'
}

function parsePwdbookTags(value: string): string[] {
  if (!value.trim()) return []
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

/** 解析 PwdBook 导出的 CSV（列与 exportEntryColumns 一致） */
export function parsePwdbookCsv(content: string): {
  categories: VaultCategory[]
  entries: PasswordEntryInput[]
} {
  const records = parseCsvRecords(content)
  const entries: PasswordEntryInput[] = []
  const categoryByName = new Map<string, VaultCategory>()

  for (const record of records) {
    const title = pickField(record, '标题', 'title')
    const password = pickField(record, '密码', 'password')
    if (!title && !password) continue

    const categoryName = pickField(record, '分类', 'category', 'categoryName')
    if (categoryName && !categoryByName.has(categoryName)) {
      categoryByName.set(categoryName, {
        id: categoryName,
        name: categoryName,
        icon: 'Folder',
        sortOrder: 99,
        createdAt: Date.now(),
      })
    }

    entries.push({
      title,
      url: pickField(record, '网址', 'url'),
      localProgramPath: pickField(record, '本地程序路径', 'localProgramPath', 'local_program_path'),
      username: pickField(record, '用户名', 'username'),
      password,
      note: pickField(record, '备注', 'note', 'notes'),
      tags: parsePwdbookTags(pickField(record, '标签', 'tags')),
      categoryId: categoryName || undefined,
      isFavorite: parsePwdbookFavorite(pickField(record, '收藏', 'favorite', 'isFavorite')),
      customFields: parseCustomFields(pickField(record, '自定义字段', 'customFields', 'custom_fields')),
    })
  }

  return {
    categories: Array.from(categoryByName.values()),
    entries,
  }
}
