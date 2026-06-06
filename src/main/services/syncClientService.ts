import { randomUUID } from 'crypto'
import { fetchRemoteEncryptedBundle, parsePairingPayload, pushRemoteEncryptedBundle } from '../../shared/syncClient'
import { assertPairingFingerprint } from '../../shared/mobileSyncWorkflow'
import type { SyncMergeResult, WifiSyncClientPullPayload, WifiSyncDiscoveredServer } from '../../shared/syncTypes'
import { deriveSyncTransportKey } from '../crypto/vaultCrypto'
import {
  encryptBundleForTransport,
  buildSyncBundle,
  recordSyncError,
  recordSyncSuccess,
} from './syncBundleService'
import { mergeEncryptedRemoteBundle, mergeRemoteBundle } from './syncMergeService'
import {
  discoverWifiSyncServers,
  getVerificationCode,
  updateWifiSyncSettings,
} from './wifiSyncService'

export async function discoverSyncServers(timeoutMs = 3000): Promise<WifiSyncDiscoveredServer[]> {
  return discoverWifiSyncServers(timeoutMs)
}

export function getClientVerificationCode(fingerprint: string): string {
  return getVerificationCode(fingerprint)
}

export async function pullMergeAndPush(payload: WifiSyncClientPullPayload): Promise<SyncMergeResult> {
  const pairing = {
    host: payload.host,
    port: payload.port,
    accessPassword: payload.accessPassword,
    fingerprint: payload.certificateFingerprint,
    secure: true,
  }

  assertPairingFingerprint(payload.certificateFingerprint, pairing.fingerprint)

  try {
    const remoteEncrypted = await fetchRemoteEncryptedBundle(pairing, { rejectUnauthorized: false })
    const transportKey = deriveSyncTransportKey(payload.masterPassword)
    const mergeResult = mergeEncryptedRemoteBundle(remoteEncrypted, transportKey)

    const mergedBundle = buildSyncBundle(mergeResult.revision)
    const encrypted = encryptBundleForTransport(mergedBundle, transportKey)
    await pushRemoteEncryptedBundle(pairing, encrypted, { rejectUnauthorized: false })

    recordSyncSuccess(mergeResult.revision)

    const settings = updateWifiSyncSettings({})
    const deviceName = payload.deviceName?.trim() || 'PwdBook Client'
    const now = Date.now()
    const existing = settings.pairedDevices.find((device) => device.name === deviceName)
    const pairedDevices = existing
      ? settings.pairedDevices.map((device) =>
          device.name === deviceName ? { ...device, lastSeenAt: now } : device,
        )
      : [
          ...settings.pairedDevices,
          {
            id: randomUUID(),
            name: deviceName,
            pairedAt: now,
            lastSeenAt: now,
          },
        ]
    updateWifiSyncSettings({ pairedDevices })

    return mergeResult
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SYNC_CLIENT_FAILED'
    recordSyncError(message)
    throw error
  }
}

export async function pullMergeFromPairingQr(
  qrPayload: string,
  masterPassword: string,
  deviceName?: string,
): Promise<SyncMergeResult> {
  const pairing = parsePairingPayload(qrPayload)
  return pullMergeAndPush({
    host: pairing.host,
    port: pairing.port,
    accessPassword: pairing.accessPassword,
    certificateFingerprint: pairing.fingerprint,
    masterPassword,
    deviceName,
  })
}

export function mergeFromEncryptedBuffer(buffer: Buffer, masterPassword: string): SyncMergeResult {
  const transportKey = deriveSyncTransportKey(masterPassword)
  return mergeEncryptedRemoteBundle(buffer, transportKey)
}

export function mergeFromRemoteBundle(remoteBundle: Parameters<typeof mergeRemoteBundle>[0]): SyncMergeResult {
  return mergeRemoteBundle(remoteBundle)
}
