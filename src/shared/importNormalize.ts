import type { ExportPayload, PasswordEntryInput, VaultCategory } from './types'

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
} {
  const parsed = JSON.parse(content) as ExportPayload
  return {
    categories: collectImportCategories(parsed),
    entries: (parsed.entries ?? []).map((entry) =>
      normalizeImportEntry(entry as unknown as Record<string, unknown>),
    ),
  }
}
