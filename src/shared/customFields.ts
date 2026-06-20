export interface EntryCustomField {
  name: string
  value: string
}

export const MAX_CUSTOM_FIELDS_PER_ENTRY = 20

export function normalizeCustomFields(fields: unknown): EntryCustomField[] {
  if (!Array.isArray(fields)) return []

  const normalized: EntryCustomField[] = []
  for (const item of fields) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Partial<EntryCustomField>
    const name = String(raw.name ?? '').trim()
    const value = String(raw.value ?? '')
    if (!name) continue
    normalized.push({ name, value })
    if (normalized.length >= MAX_CUSTOM_FIELDS_PER_ENTRY) break
  }
  return normalized
}

export function parseCustomFields(raw: string | unknown): EntryCustomField[] {
  if (Array.isArray(raw)) return normalizeCustomFields(raw)
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    return normalizeCustomFields(JSON.parse(raw))
  } catch {
    return []
  }
}

export function serializeCustomFields(fields: EntryCustomField[] | undefined): string {
  return JSON.stringify(normalizeCustomFields(fields ?? []))
}

export function customFieldsContentEqual(
  a: EntryCustomField[] | undefined,
  b: EntryCustomField[] | undefined,
): boolean {
  return JSON.stringify(normalizeCustomFields(a)) === JSON.stringify(normalizeCustomFields(b))
}
