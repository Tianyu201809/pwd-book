import { describe, expect, it } from 'vitest'
import { decryptSyncBundle, encryptSyncBundle } from './syncBundleCrypto'
import type { SyncBundle } from '../../shared/syncTypes'
import { SYNC_BUNDLE_FORMAT, SYNC_BUNDLE_VERSION } from '../../shared/syncTypes'

const sampleBundle: SyncBundle = {
  format: SYNC_BUNDLE_FORMAT,
  version: SYNC_BUNDLE_VERSION,
  deviceId: 'device-1',
  revision: 1,
  exportedAt: '2026-06-06T00:00:00.000Z',
  categories: [],
  entries: [
    {
      id: 'entry-1',
      title: 'Example',
      url: 'https://example.com',
      username: 'user',
      password: 'pass',
      note: '',
      tags: [],
      categoryId: 'cat-work',
      isFavorite: false,
      displayIcon: '',
      localProgramPath: '',
      totpSecret: '',
      lastUsedAt: null,
      createdAt: 1,
      updatedAt: 2,
      deletedAt: null,
    },
  ],
}

describe('syncBundleCrypto', () => {
  it('round-trips bundle with master password', () => {
    const encrypted = encryptSyncBundle(sampleBundle, 'master-password')
    const decrypted = decryptSyncBundle(encrypted, 'master-password')
    expect(decrypted).toEqual(sampleBundle)
  })

  it('fails decrypt with wrong password', () => {
    const encrypted = encryptSyncBundle(sampleBundle, 'master-password')
    expect(() => decryptSyncBundle(encrypted, 'wrong-password')).toThrow('SYNC_BUNDLE_DECRYPT_FAILED')
  })
})
