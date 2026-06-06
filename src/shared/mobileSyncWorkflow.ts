import { mergeSyncBundles } from './syncMerge'
import type { SyncBundle, SyncMergeResult, SyncPairingConfig } from './syncTypes'
import { verificationCodesMatch } from './syncVerification'

export interface MobileSyncTransport {
  fetchEncryptedBundle(config: SyncPairingConfig): Promise<Uint8Array>
  pushEncryptedBundle(config: SyncPairingConfig, payload: Uint8Array): Promise<void>
}

export interface MobileSyncCrypto {
  decryptBundle(payload: Uint8Array, masterPassword: string): SyncBundle
  encryptBundle(bundle: SyncBundle, masterPassword: string): Uint8Array
}

export interface MobileSyncPullMergeInput {
  pairing: SyncPairingConfig
  masterPassword: string
  localBundle: SyncBundle
  expectedFingerprint?: string
  expectedVerificationCode?: string
}

export interface MobileSyncPullMergeOutput {
  result: SyncMergeResult
  mergedBundle: SyncBundle
  encryptedBundle: Uint8Array
}

export function assertPairingFingerprint(
  expectedFingerprint: string,
  pairingFingerprint: string,
): void {
  if (expectedFingerprint.trim().toUpperCase() !== pairingFingerprint.trim().toUpperCase()) {
    throw new Error('SYNC_FINGERPRINT_MISMATCH')
  }
}

export function assertVerificationCode(
  expectedCode: string | undefined,
  fingerprint: string,
  actualCode?: string,
): void {
  if (!expectedCode?.trim() || !actualCode?.trim()) return
  if (!verificationCodesMatch(expectedCode, actualCode, fingerprint)) {
    throw new Error('SYNC_VERIFICATION_MISMATCH')
  }
}

export async function pullMergeAndPushWithTransport(
  transport: MobileSyncTransport,
  crypto: MobileSyncCrypto,
  input: MobileSyncPullMergeInput,
): Promise<MobileSyncPullMergeOutput> {
  if (input.expectedFingerprint) {
    assertPairingFingerprint(input.expectedFingerprint, input.pairing.fingerprint)
  }
  assertVerificationCode(
    input.expectedVerificationCode,
    input.pairing.fingerprint,
    input.pairing.verificationCode,
  )

  const remoteEncrypted = await transport.fetchEncryptedBundle(input.pairing)
  const remoteBundle = crypto.decryptBundle(remoteEncrypted, input.masterPassword)
  const { merged, conflicts } = mergeSyncBundles(input.localBundle, remoteBundle)

  let added = 0
  let updated = 0
  let removed = 0
  const localById = new Map(input.localBundle.entries.map((entry) => [entry.id, entry]))

  for (const entry of merged.entries) {
    const localEntry = localById.get(entry.id)
    if (!localEntry) {
      added += 1
      continue
    }
    const wasActive = localEntry.deletedAt == null
    const willBeActive = entry.deletedAt == null
    if (wasActive && !willBeActive) {
      removed += 1
    } else if ((!wasActive && willBeActive) || localEntry.updatedAt !== entry.updatedAt) {
      updated += 1
    }
  }

  const encryptedBundle = crypto.encryptBundle(merged, input.masterPassword)
  await transport.pushEncryptedBundle(input.pairing, encryptedBundle)

  return {
    result: {
      added,
      updated,
      removed,
      conflicts,
      revision: merged.revision,
    },
    mergedBundle: merged,
    encryptedBundle,
  }
}
