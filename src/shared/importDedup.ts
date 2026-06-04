import type { PasswordEntryInput } from './types'
import { normalizeUrl } from './urlMatch'

/** 用于判断「相同条目」的指纹：标题 + 用户名 + 网址 */
export function entryFingerprint(title: string, username: string, url: string): string {
  return [normalizeText(title), normalizeText(username), normalizeUrl(url)].join('\u0001')
}

export function fingerprintFromInput(entry: PasswordEntryInput): string {
  return entryFingerprint(entry.title, entry.username ?? '', entry.url ?? '')
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}
