import type { PasswordEntryInput } from './types'
import type { ImportSourceId } from './importSources'
import { getImportSource } from './importSources'
import { parseCsvRecords, pickField } from './importCsv'
import { parsePwdbookCsv, parsePwdbookJson } from './importNormalize'

export interface ParsedImportRow {
  row: number
  entry: PasswordEntryInput | null
  invalidReason?: 'missing_title' | 'missing_password'
}

function rowEntry(
  row: number,
  partial: Partial<PasswordEntryInput> & { title?: string; password?: string },
): ParsedImportRow {
  const title = (partial.title ?? '').trim()
  const password = partial.password ?? ''
  if (!title) return { row, entry: null, invalidReason: 'missing_title' }
  if (!password) return { row, entry: null, invalidReason: 'missing_password' }
  return {
    row,
    entry: {
      title,
      password,
      url: partial.url?.trim() ?? '',
      username: partial.username?.trim() ?? '',
      note: partial.note?.trim() ?? '',
      tags: partial.tags ?? [],
      isFavorite: partial.isFavorite ?? false,
      displayIcon: partial.displayIcon ?? '',
      localProgramPath: partial.localProgramPath ?? '',
    },
  }
}

function parseKeePassCsv(content: string): ParsedImportRow[] {
  const records = parseCsvRecords(content)
  return records.map((record, index) =>
    rowEntry(index + 2, {
      title: pickField(record, 'Account', 'Title'),
      username: pickField(record, 'Login Name', 'Username'),
      password: pickField(record, 'Password'),
      url: pickField(record, 'Web Site', 'URL', 'Url'),
      note: pickField(record, 'Comments', 'Notes'),
    }),
  )
}

function parseEnpassCsv(content: string): ParsedImportRow[] {
  const records = parseCsvRecords(content)
  return records.map((record, index) =>
    rowEntry(index + 2, {
      title: pickField(record, 'Title', 'Name'),
      username: pickField(record, 'Username', 'Email', 'Login'),
      password: pickField(record, 'Password'),
      url: pickField(record, 'Website', 'URL', 'Url'),
      note: pickField(record, 'Note', 'Notes'),
    }),
  )
}

function parseBitwardenCsv(content: string): ParsedImportRow[] {
  const records = parseCsvRecords(content)
  return records.map((record, index) => {
    const type = pickField(record, 'type', 'Type').toLowerCase()
    if (type && type !== 'login') return { row: index + 2, entry: null, invalidReason: 'missing_title' }
    const title = pickField(record, 'name', 'Name')
    const password = pickField(record, 'login_password', 'password')
    if (!title && !password) return { row: index + 2, entry: null, invalidReason: 'missing_title' }
    return rowEntry(index + 2, {
      title: title || pickField(record, 'login_uri', 'uri'),
      username: pickField(record, 'login_username', 'username'),
      password,
      url: pickField(record, 'login_uri', 'uri', 'url'),
      note: pickField(record, 'notes', 'note'),
    })
  })
}

function parseOnePasswordCsv(content: string): ParsedImportRow[] {
  const records = parseCsvRecords(content)
  return records.map((record, index) =>
    rowEntry(index + 2, {
      title: pickField(record, 'Title', 'Name'),
      username: pickField(record, 'Username', 'Login'),
      password: pickField(record, 'Password'),
      url: pickField(record, 'Website', 'URL', 'Url'),
      note: pickField(record, 'Notes', 'Note'),
    }),
  )
}

function parseChromeCsv(content: string): ParsedImportRow[] {
  const records = parseCsvRecords(content)
  return records.map((record, index) =>
    rowEntry(index + 2, {
      title: pickField(record, 'name', 'Name', 'title'),
      username: pickField(record, 'username', 'Username'),
      password: pickField(record, 'password', 'Password'),
      url: pickField(record, 'url', 'URL', 'Url'),
    }),
  )
}

export function parseImportContent(
  sourceId: ImportSourceId,
  content: string,
): { rows: ParsedImportRow[]; categories?: ReturnType<typeof parsePwdbookJson>['categories'] } {
  if (sourceId === 'pwdbook-json') {
    const { categories, entries } = parsePwdbookJson(content)
    const rows: ParsedImportRow[] = entries.map((entry, index) => {
      if (!entry.title?.trim()) return { row: index + 1, entry: null, invalidReason: 'missing_title' }
      if (!entry.password) return { row: index + 1, entry: null, invalidReason: 'missing_password' }
      return { row: index + 1, entry }
    })
    return { rows, categories }
  }

  if (sourceId === 'pwdbook-csv') {
    const { categories, entries } = parsePwdbookCsv(content)
    const rows: ParsedImportRow[] = entries.map((entry, index) => {
      if (!entry.title?.trim()) return { row: index + 2, entry: null, invalidReason: 'missing_title' }
      if (!entry.password) return { row: index + 2, entry: null, invalidReason: 'missing_password' }
      return { row: index + 2, entry }
    })
    return { rows, categories }
  }

  const parsers: Record<
    Exclude<ImportSourceId, 'pwdbook-json' | 'pwdbook-csv'>,
    (c: string) => ParsedImportRow[]
  > = {
    keepass: parseKeePassCsv,
    enpass: parseEnpassCsv,
    bitwarden: parseBitwardenCsv,
    onepassword: parseOnePasswordCsv,
    chrome: parseChromeCsv,
  }

  const parser = parsers[sourceId as Exclude<ImportSourceId, 'pwdbook-json' | 'pwdbook-csv'>]
  if (!parser) {
    throw new Error(`Unsupported import source: ${sourceId}`)
  }
  void getImportSource(sourceId)
  return { rows: parser(content) }
}
