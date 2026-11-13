import { describe, expect, it } from 'vitest'
import { clipboardStorageKeys } from './clipboardStorageKeys'

describe('clipboardStorageKeys', () => {
  it('namespaces clipboard storage by account', () => {
    expect(clipboardStorageKeys('acc-a').persistent).toBe('pwdbook-clipboard-history:acc-a')
    expect(clipboardStorageKeys('acc-a').persistent).not.toBe(clipboardStorageKeys('acc-b').persistent)
  })
})
