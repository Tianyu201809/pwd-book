import { describe, expect, it } from 'vitest'
import { accountMonogram, validateAccountName } from './accountName'

describe('validateAccountName', () => {
  it('rejects blank, overlong and exact duplicates', () => {
    expect(validateAccountName('   ', [])).toBe('empty')
    expect(validateAccountName('a'.repeat(33), [])).toBe('too-long')
    expect(validateAccountName(' 工作 ', ['工作'])).toBe('duplicate')
    expect(validateAccountName('Work', ['work'])).toBeNull()
  })

  it('uses the first letter as the account seal', () => {
    expect(accountMonogram(' 工作 ')).toBe('工')
    expect(accountMonogram('work')).toBe('W')
    expect(accountMonogram('   ')).toBe('')
  })

  it('counts unicode code points', () => {
    expect(validateAccountName('😀'.repeat(32), [])).toBeNull()
    expect(validateAccountName('😀'.repeat(33), [])).toBe('too-long')
  })
})
