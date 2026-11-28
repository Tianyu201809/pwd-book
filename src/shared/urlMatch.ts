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

/** 条目 URL 是否与当前页面地址完全一致（包含路径、查询参数和哈希路由） */
export function entryUrlExactlyMatchesPage(entryUrl: string, pageUrl: string): boolean {
  const entry = parsePageUrl(entryUrl)
  const page = parsePageUrl(pageUrl)
  if (!entry || !page) return false
  return entry.href === page.href
}

function parsePageUrl(value: string): URL | null {
  const raw = value.trim()
  if (!raw) return null
  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`)
  } catch {
    return null
  }
}
