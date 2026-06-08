import { describe, expect, it } from 'vitest'
import {
  generateTotpCode,
  isValidTotpSecret,
  normalizeTotpSecret,
} from './totp'

describe('totp', () => {
  it('normalizes secret spacing and case', () => {
    expect(normalizeTotpSecret(' jbsw y3dp ')).toBe('JBSWY3DP')
  })

  it('validates base32 secrets', () => {
    expect(isValidTotpSecret('JBSWY3DPEHPK3PXP')).toBe(true)
    expect(isValidTotpSecret('invalid!')).toBe(false)
  })

  it('generates stable 6-digit codes for the same timestamp', async () => {
    const timestamp = 1_700_000_000_000
    const first = await generateTotpCode('JBSWY3DPEHPK3PXP', timestamp)
    const second = await generateTotpCode('JBSWY3DPEHPK3PXP', timestamp)
    expect(first).toBe(second)
    expect(first).toMatch(/^\d{6}$/)
  })
})
