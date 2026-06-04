/** 规范化条目 URL，用于去重与域名匹配 */
export function normalizeUrl(url: string): string {
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

export function getHostnameFromUrl(url: string): string {
  const raw = url.trim()
  if (!raw) return ''
  try {
    const withScheme = raw.includes('://') ? raw : `https://${raw}`
    return new URL(withScheme).hostname.toLowerCase()
  } catch {
    const stripped = raw.replace(/^https?:\/\//, '').split('/')[0] ?? ''
    return stripped.toLowerCase()
  }
}

/** 条目 URL 是否与当前页面同源（hostname 一致） */
export function entryUrlMatchesPage(entryUrl: string, pageUrl: string): boolean {
  const entryHost = getHostnameFromUrl(entryUrl)
  const pageHost = getHostnameFromUrl(pageUrl)
  if (!entryHost || !pageHost) return false
  return entryHost === pageHost
}
