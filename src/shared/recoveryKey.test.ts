import { describe, expect, it } from 'vitest'
import {
  formatRecoveryKey,
  isRecoveryKeyFormatValid,
  normalizeRecoveryKey,
} from './recoveryKey'

describe('recoveryKey', () => {
  it('normalizes dashes and spaces', () => {
    expect(normalizeRecoveryKey('abcd-efgh ijkl')).toBe('ABCDEFGHIJKL')
  })

  it('formats groups of four', () => {
    expect(formatRecoveryKey('ABCDEFGHIJKLMNOPQRST')).toBe('ABCD-EFGH-IJKL-MNOP-QRST')
  })

  it('validates 20-char base32-ish keys', () => {
    expect(isRecoveryKeyFormatValid('ABCD-EFGH-IJKL-MNOP-QRST')).toBe(true)
    expect(isRecoveryKeyFormatValid('TOO-SHORT')).toBe(false)
  })
})
