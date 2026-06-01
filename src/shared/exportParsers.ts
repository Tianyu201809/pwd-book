import { buildCsvContent } from './csvFormat'
import type { ExportFormatId } from './exportFormats'
import type { PasswordEntry } from './types'

function formatKeePassDate(timestamp: number): string {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function rowKeePass(entry: PasswordEntry): string[] {
  return [
    entry.title,
    entry.username,
    entry.password,
    entry.url,
    entry.note,
    entry.categoryName,
    formatKeePassDate(entry.updatedAt),
    formatKeePassDate(entry.createdAt),
  ]
}

function rowEnpass(entry: PasswordEntry): string[] {
  return [entry.title, entry.username, '', entry.password, entry.url, entry.note]
}

function rowBitwarden(entry: PasswordEntry): string[] {
  const favorite = entry.isFavorite ? '1' : '0'
  return [
    entry.categoryName,
    favorite,
    'login',
    entry.title,
    entry.note,
    '',
    '0',
    entry.url,
    entry.username,
    entry.password,
  ]
}

function rowOnePassword(entry: PasswordEntry): string[] {
  return [entry.title, entry.url, entry.username, entry.password, entry.note]
}

function rowChrome(entry: PasswordEntry): string[] {
  return [entry.title, entry.url, entry.username, entry.password]
}

const EXPORT_SPECS: Record<
  ExportFormatId,
  { headers: string[]; row: (entry: PasswordEntry) => string[] }
> = {
  keepass: {
    headers: ['Account', 'Login Name', 'Password', 'Web Site', 'Comments', 'Group', 'Last Modified', 'Created'],
    row: rowKeePass,
  },
  enpass: {
    headers: ['Title', 'Username', 'Email', 'Password', 'Website', 'Note'],
    row: rowEnpass,
  },
  bitwarden: {
    headers: [
      'folder',
      'favorite',
      'type',
      'name',
      'notes',
      'fields',
      'reprompt',
      'login_uri',
      'login_username',
      'login_password',
    ],
    row: rowBitwarden,
  },
  onepassword: {
    headers: ['Title', 'Website', 'Username', 'Password', 'Notes'],
    row: rowOnePassword,
  },
  chrome: {
    headers: ['name', 'url', 'username', 'password'],
    row: rowChrome,
  },
}

export function entriesToCsv(formatId: ExportFormatId, entries: PasswordEntry[]): string {
  const spec = EXPORT_SPECS[formatId]
  const rows = entries
    .filter((entry) => entry.title?.trim() && entry.password)
    .map((entry) => spec.row(entry))
  return buildCsvContent(spec.headers, rows)
}
