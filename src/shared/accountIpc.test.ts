import { describe, expect, it } from 'vitest'
import { IPC } from './types'

describe('account IPC channels', () => {
  it('keeps the six account channel names stable', () => {
    expect(IPC.accountsCreate).toBe('accounts:create')
    expect(IPC.accountsSelect).toBe('accounts:select')
    expect(IPC.accountsRename).toBe('accounts:rename')
    expect(IPC.accountsDelete).toBe('accounts:delete')
    expect(IPC.accountsRebuild).toBe('accounts:rebuild')
    expect(IPC.accountsBoot).toBe('accounts:boot')
  })
})
