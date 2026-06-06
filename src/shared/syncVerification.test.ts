import { describe, expect, it } from 'vitest'
import {
  VERIFICATION_WINDOW_MS,
  getSyncVerificationCode,
  verificationCodesMatch,
} from './syncVerification'

describe('getSyncVerificationCode', () => {
  it('returns stable code within the same 30s window', () => {
    const fingerprint = 'ABCD1234EF567890'
    const now = VERIFICATION_WINDOW_MS * 100 + 1_000
    expect(getSyncVerificationCode(fingerprint, now)).toBe(getSyncVerificationCode(fingerprint, now + 10_000))
  })

  it('changes when crossing window boundary', () => {
    const fingerprint = 'ABCD1234EF567890'
    const now = VERIFICATION_WINDOW_MS * 10
    const current = getSyncVerificationCode(fingerprint, now)
    const next = getSyncVerificationCode(fingerprint, now + VERIFICATION_WINDOW_MS)
    expect(current).not.toBe(next)
  })
})

describe('verificationCodesMatch', () => {
  it('accepts exact match', () => {
    const fingerprint = 'ABCD1234EF567890'
    const now = 1_700_000_000_000
    const code = getSyncVerificationCode(fingerprint, now)
    expect(verificationCodesMatch(code, code, fingerprint, now)).toBe(true)
  })

  it('accepts previous window during rollover', () => {
    const fingerprint = 'ABCD1234EF567890'
    const windowStart = VERIFICATION_WINDOW_MS * 10
    const previous = getSyncVerificationCode(fingerprint, windowStart - 1)
    expect(verificationCodesMatch(previous, previous, fingerprint, windowStart + 1)).toBe(true)
  })
})
