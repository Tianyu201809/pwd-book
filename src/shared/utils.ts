import type { PasswordEntry } from '@/shared/types'

export function formatEntryForClipboard(entry: PasswordEntry): string {
  const lines = [
    `标题：${entry.title}`,
    `网址：${entry.url || ''}`,
    `分类：${entry.categoryName}`,
    `用户名：${entry.username || ''}`,
    `密码：${entry.password}`,
  ]
  if (entry.note) lines.push(`备注：${entry.note}`)
  if (entry.tags.length) lines.push(`标签：${entry.tags.join('、')}`)
  lines.push(`收藏：${entry.isFavorite ? '是' : '否'}`)
  return lines.join('\n')
}

export function generatePassword(length = 16): string {
  const lowers = 'abcdefghijkmnopqrstuvwxyz'
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const symbols = '!@#$%^&*-_=+'
  const all = lowers + uppers + digits + symbols
  const pick = (source: string) => source[Math.floor(Math.random() * source.length)]
  const required = [pick(lowers), pick(uppers), pick(digits), pick(symbols)]
  const rest = Array.from({ length: Math.max(length - required.length, 0) }, () => pick(all))
  const chars = [...required, ...rest]
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return '从未使用'
  const diff = Date.now() - timestamp
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < week) return `${Math.floor(diff / day)} 天前`
  return `${Math.floor(diff / week)} 周前`
}

export function getAvatarMeta(title: string): { text: string; color: string } {
  const text = title.trim().charAt(0).toUpperCase() || '?'
  const palette = [
    'rgba(59,130,246,0.15)',
    'rgba(239,68,68,0.12)',
    'rgba(201,162,39,0.12)',
    'rgba(52,211,153,0.12)',
    'rgba(139,92,246,0.12)',
    'rgba(14,165,233,0.12)',
  ]
  const index = text.charCodeAt(0) % palette.length
  return { text, color: palette[index] }
}
