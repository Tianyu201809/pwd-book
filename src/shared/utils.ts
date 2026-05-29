import { ERR_PREFIX } from '@/shared/errors'
import { i18n } from '@/i18n'
import type { PasswordEntry } from '@/shared/types'

function translateErrorCode(raw: string): string | null {
  if (!raw.startsWith(ERR_PREFIX)) return null
  const payload = raw.slice(ERR_PREFIX.length)
  const colonIndex = payload.indexOf(':')
  const code = (colonIndex >= 0 ? payload.slice(0, colonIndex) : payload).toLowerCase()
  let params: Record<string, string | number> = {}
  if (colonIndex >= 0) {
    try {
      params = JSON.parse(payload.slice(colonIndex + 1)) as Record<string, string | number>
    } catch {
      /* ignore malformed params */
    }
  }
  const key = `errors.${code}`
  if (!i18n.global.te(key)) return null
  return i18n.global.t(key, params)
}

export function parseErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return i18n.global.t('common.operationFailed')
  const nested = error.message.match(/:\s*Error:\s*(.+)$/)
  const message = nested?.[1]?.trim() ?? error.message
  const stripped = message.replace(/^Error invoking remote method '[^']+':\s*/i, '').trim()
  const translated = translateErrorCode(stripped)
  if (translated) return translated
  return stripped || i18n.global.t('common.operationFailed')
}

export function formatRecoveryKeyInput(input: string): string {
  const normalized = input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 20)
  const parts: string[] = []
  for (let i = 0; i < normalized.length; i += 4) {
    parts.push(normalized.slice(i, i + 4))
  }
  return parts.join('-')
}

export function buildRecoveryKeyFileContent(recoveryKey: string): string {
  const date = new Date().toISOString().slice(0, 10)
  const t = i18n.global.t
  return [
    t('recovery.recoveryKeyFileTitle'),
    '================',
    '',
    t('recovery.recoveryKeyFileKey', { key: recoveryKey }),
    '',
    t('recovery.recoveryKeyFileInstructions'),
    t('recovery.recoveryKeyFileStep1'),
    t('recovery.recoveryKeyFileStep2'),
    t('recovery.recoveryKeyFileStep3'),
    '',
    t('recovery.recoveryKeyFileGenerated', { date }),
  ].join('\n')
}

/** Append `user` and `pwd` query params for sites that read credentials from the URL. */
export function buildUrlWithCredentialParams(
  rawUrl: string,
  username: string,
  password: string,
): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    throw new Error(`${ERR_PREFIX}URL_REQUIRED`)
  }

  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const url = new URL(href)
  url.searchParams.set('user', username)
  url.searchParams.set('pwd', password)
  return url.toString()
}

export function formatEntryForClipboard(entry: PasswordEntry): string {
  const t = i18n.global.t
  const lines = [
    t('clipboard.title', { value: entry.title }),
    t('clipboard.url', { value: entry.url || '' }),
    t('clipboard.category', { value: entry.categoryName }),
    t('clipboard.username', { value: entry.username || '' }),
    t('clipboard.password', { value: entry.password }),
  ]
  if (entry.note) lines.push(t('clipboard.note', { value: entry.note }))
  if (entry.tags.length) lines.push(t('clipboard.tags', { value: entry.tags.join('、') }))
  lines.push(
    t('clipboard.favorite', {
      value: entry.isFavorite ? t('common.yes') : t('common.no'),
    }),
  )
  return lines.join('\n')
}

import type { PasswordGenOptions } from '@/shared/types'
import {
  DEFAULT_PASSWORD_GEN_OPTIONS,
  generatePasswordWithOptions,
} from '@/shared/passwordGenerator'

export function generatePassword(length = 16, options?: Partial<PasswordGenOptions>): string {
  return generatePasswordWithOptions({
    ...DEFAULT_PASSWORD_GEN_OPTIONS,
    length,
    ...options,
  })
}

export function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return i18n.global.t('common.neverUsed')
  const diff = Date.now() - timestamp
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day
  if (diff < hour) {
    return i18n.global.t('common.minutesAgo', {
      n: Math.max(1, Math.floor(diff / minute)),
    })
  }
  if (diff < day) {
    return i18n.global.t('common.hoursAgo', { n: Math.floor(diff / hour) })
  }
  if (diff < week) {
    return i18n.global.t('common.daysAgo', { n: Math.floor(diff / day) })
  }
  return i18n.global.t('common.weeksAgo', { n: Math.floor(diff / week) })
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
