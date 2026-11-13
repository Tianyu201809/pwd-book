import { describe, expect, it } from 'vitest'
import { lockScreenMode } from './lockScreenMode'

describe('lockScreenMode', () => {
  it('returns boot-empty when there are no accounts', () => {
    expect(lockScreenMode({
      accountCount: 0,
      initialized: false,
      creatingAccount: false,
    })).toBe('boot-empty')
  })

  it('returns create-account when accounts exist and a new account is being created', () => {
    expect(lockScreenMode({
      accountCount: 1,
      initialized: true,
      creatingAccount: true,
    })).toBe('create-account')
  })

  it('returns setup-password when accounts exist and the vault is not initialized', () => {
    expect(lockScreenMode({
      accountCount: 1,
      initialized: false,
      creatingAccount: false,
    })).toBe('setup-password')
  })

  it('returns unlock when accounts exist and the vault is initialized', () => {
    expect(lockScreenMode({
      accountCount: 2,
      initialized: true,
      creatingAccount: false,
    })).toBe('unlock')
  })
})
