const RECOVERY_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function normalizeRecoveryKey(input: string): string {
  return input.replace(/[-\s]/g, '').toUpperCase()
}

export function formatRecoveryKey(raw: string): string {
  const normalized = normalizeRecoveryKey(raw)
  const parts: string[] = []
  for (let i = 0; i < normalized.length; i += 4) {
    parts.push(normalized.slice(i, i + 4))
  }
  return parts.join('-')
}

export function isRecoveryKeyFormatValid(input: string): boolean {
  return /^[A-Z2-9]{20}$/.test(normalizeRecoveryKey(input))
}

/** 测试/展示用：确定性字符集生成（非加密随机） */
export function formatRecoveryKeyFromChars(chars: string): string {
  return formatRecoveryKey(chars.slice(0, 20))
}

export { RECOVERY_CHARSET }
