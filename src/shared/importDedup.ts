import type { PasswordEntryInput } from './types'

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

function normalizeUrl(url: string): string {
  const raw = url.trim().toLowerCase()
  if (!raw) return ''
  try {
    const withScheme = raw.includes('://') ? raw : `https://${raw}`
    const parsed = new URL(withScheme)
    const path = parsed.pathname.replace(/\/$/, '') || ''
    return `${parsed.hostname}${path}`
  } catch {
    return raw.replace(/^https?:\/\//, '').replace(/\/$/, '')
  }
}
