import path from 'path'
import { describe, expect, it } from 'vitest'
import { accountDataPaths, isValidSqliteHeader } from '../accounts/accountPaths'

describe('account paths', () => {
  it('keeps native host at the user data root', () => {
    const paths = accountDataPaths('C:/data', 'acc-1')
    expect(paths.database).toBe(path.join('C:/data', 'accounts', 'acc-1', 'pwdbook.db'))
    expect(paths.nativeHost).toBe(path.join('C:/data', 'native-host'))
    expect(isValidSqliteHeader(Buffer.from('SQLite format 3\0'))).toBe(true)
    expect(isValidSqliteHeader(Buffer.from('nope'))).toBe(false)
  })
})
