import { describe, expect, it } from 'vitest'
import { validateMasterPasswordSetup } from './vaultValidation'

describe('vaultValidation', () => {
  it('rejects short master password', () => {
    expect(validateMasterPasswordSetup('abc', 'abc')).toBe('MASTER_PASSWORD_TOO_SHORT')
  })

  it('rejects mismatched confirmation', () => {
    expect(validateMasterPasswordSetup('password1', 'password2')).toBe(
      'MASTER_PASSWORD_MISMATCH',
    )
  })

  it('accepts valid setup input', () => {
    expect(validateMasterPasswordSetup('password1', 'password1')).toBeNull()
  })
})
