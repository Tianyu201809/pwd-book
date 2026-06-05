import { pinyin } from 'pinyin-pro'

export interface HighlightSegment {
  text: string
  highlight: boolean
}

const initialsCache = new Map<string, string>()

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text)
}

function isPinyinInitialsQuery(query: string): boolean {
  return /^[a-z0-9]+$/i.test(query)
}

/** 提取文本的拼音首字母串，如「众趣科技」→「zqkj」。 */
export function getPinyinInitials(text: string): string {
  const cached = initialsCache.get(text)
  if (cached !== undefined) return cached

  const initials = pinyin(text, { pattern: 'first', toneType: 'none', type: 'string' })
    .replace(/\s/g, '')
    .toLowerCase()
  initialsCache.set(text, initials)
  return initials
}

/** 判断字段是否匹配搜索词（原文子串或拼音首字母）。 */
export function textMatchesQuery(text: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q || !text) return false

  if (text.toLowerCase().includes(q)) return true

  if (isPinyinInitialsQuery(q) && hasChinese(text)) {
    return getPinyinInitials(text).includes(q)
  }

  return false
}

/** 将文本按搜索词拆分为高亮片段（仅匹配原文子串，不含纯拼音首字母匹配）。 */
export function splitHighlightSegments(text: string, query: string): HighlightSegment[] {
  const q = query.trim()
  if (!text) return [{ text: '', highlight: false }]
  if (!q) return [{ text, highlight: false }]

  const segments: HighlightSegment[] = []
  const textLower = text.toLowerCase()
  const qLower = q.toLowerCase()
  let index = 0

  while (index < text.length) {
    const matchIndex = textLower.indexOf(qLower, index)
    if (matchIndex === -1) {
      segments.push({ text: text.slice(index), highlight: false })
      break
    }
    if (matchIndex > index) {
      segments.push({ text: text.slice(index, matchIndex), highlight: false })
    }
    segments.push({
      text: text.slice(matchIndex, matchIndex + q.length),
      highlight: true,
    })
    index = matchIndex + q.length
  }

  return segments.length > 0 ? segments : [{ text, highlight: false }]
}
