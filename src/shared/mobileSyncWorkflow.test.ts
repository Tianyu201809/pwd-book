import { describe, expect, it } from 'vitest'
import {
  assertPairingFingerprint,
  assertVerificationCode,
  pullMergeAndPushWithTransport,
} from './mobileSyncWorkflow'
import { mergeSyncBundles } from './syncMerge'
import type { SyncBundle, SyncEntry } from './syncTypes'
import { SYNC_BUNDLE_FORMAT, SYNC_BUNDLE_VERSION } from './syncTypes'
import { getSyncVerificationCode } from './syncVerification'

function makeEntry(overrides: Partial<SyncEntry> & { id: string }): SyncEntry {
  return {
    id: overrides.id,
    title: overrides.title ?? 'Title',
    url: overrides.url ?? '',
    username: overrides.username ?? 'user',
    password: overrides.password ?? 'secret',
    note: overrides.note ?? '',
    tags: overrides.tags ?? [],
    categoryId: overrides.categoryId ?? 'cat-work',
    isFavorite: overrides.isFavorite ?? false,
    displayIcon: overrides.displayIcon ?? '',
    localProgramPath: overrides.localProgramPath ?? '',
    totpSecret: overrides.totpSecret ?? '',
    lastUsedAt: overrides.lastUsedAt ?? null,
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 1000,
    deletedAt: overrides.deletedAt ?? null,
  }
}

function makeBundle(deviceId: string, revision: number, entries: SyncEntry[]): SyncBundle {
  return {
    format: SYNC_BUNDLE_FORMAT,
    version: SYNC_BUNDLE_VERSION,
    deviceId,
    revision,
    exportedAt: new Date(revision * 1000).toISOString(),
    categories: [],
    entries,
  }
}

describe('mobile sync workflow guards', () => {
  it('rejects fingerprint mismatch', () => {
    expect(() => assertPairingFingerprint('AAAA', 'BBBB')).toThrow('SYNC_FINGERPRINT_MISMATCH')
  })

  it('rejects verification mismatch when both sides provided', () => {
    const fingerprint = 'ABCD1234EF567890'
    const code = getSyncVerificationCode(fingerprint)
    expect(() => assertVerificationCode(code, fingerprint, 'ZZZZZZ')).toThrow(
      'SYNC_VERIFICATION_MISMATCH',
    )
  })
})

describe('pullMergeAndPushWithTransport', () => {
  it('pulls remote bundle, merges, and pushes encrypted result', async () => {
    const local = makeBundle('local', 1, [makeEntry({ id: 'e1', title: 'Local', updatedAt: 1000 })])
    const remote = makeBundle('remote', 2, [makeEntry({ id: 'e1', title: 'Remote', updatedAt: 3000 })])

    const pushed: Uint8Array[] = []
    const output = await pullMergeAndPushWithTransport(
      {
        async fetchEncryptedBundle() {
          return new TextEncoder().encode(JSON.stringify(remote))
        },
        async pushEncryptedBundle(_config, payload) {
          pushed.push(payload)
        },
      },
      {
        decryptBundle(payload) {
          return JSON.parse(new TextDecoder().decode(payload)) as SyncBundle
        },
        encryptBundle(bundle) {
          return new TextEncoder().encode(JSON.stringify(bundle))
        },
      },
      {
        pairing: {
          host: '192.168.1.10',
          port: 8765,
          accessPassword: 'secret',
          fingerprint: 'ABCD1234EF567890',
        },
        masterPassword: 'master',
        localBundle: local,
      },
    )

    expect(output.result.updated).toBe(1)
    expect(output.mergedBundle.entries[0]?.title).toBe('Remote')
    expect(pushed).toHaveLength(1)
    expect(mergeSyncBundles(local, remote).merged.revision).toBe(output.mergedBundle.revision)
  })
})
