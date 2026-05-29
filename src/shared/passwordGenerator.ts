import type { PasswordGenOptions, PasswordStrengthResult } from './types'

export const GEN_CHAR_SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{}',
} as const

export const DEFAULT_PASSWORD_GEN_OPTIONS: PasswordGenOptions = {
  length: 16,
  upper: true,
  lower: true,
  numbers: true,
  symbols: true,
}

function secureRandomInt(max: number): number {
  if (max <= 0) return 0
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return array[0] % max
}

function buildPool(options: PasswordGenOptions): string {
  let pool = ''
  if (options.upper) pool += GEN_CHAR_SETS.upper
  if (options.lower) pool += GEN_CHAR_SETS.lower
  if (options.numbers) pool += GEN_CHAR_SETS.numbers
  if (options.symbols) pool += GEN_CHAR_SETS.symbols
  if (!pool) pool = GEN_CHAR_SETS.lower + GEN_CHAR_SETS.numbers
  return pool
}

export function generatePasswordWithOptions(options: PasswordGenOptions): string {
  const length = Math.min(32, Math.max(8, options.length))
  const pool = buildPool(options)
  const requiredSets: string[] = []
  if (options.upper) requiredSets.push(GEN_CHAR_SETS.upper)
  if (options.lower) requiredSets.push(GEN_CHAR_SETS.lower)
  if (options.numbers) requiredSets.push(GEN_CHAR_SETS.numbers)
  if (options.symbols) requiredSets.push(GEN_CHAR_SETS.symbols)
  if (!requiredSets.length) requiredSets.push(GEN_CHAR_SETS.lower, GEN_CHAR_SETS.numbers)

  const chars: string[] = requiredSets.map((set) => set[secureRandomInt(set.length)])
  for (let i = chars.length; i < length; i += 1) {
    chars.push(pool[secureRandomInt(pool.length)])
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = secureRandomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join('')
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  let score = 0
  if (password.length >= 12) score += 1
  if (password.length >= 16) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  const level = Math.min(3, Math.floor(score / 1.25)) as 0 | 1 | 2 | 3
  return { level, bars: level + 1 }
}
