import { randomUUID } from 'crypto'
import { fetchRemoteEncryptedBundle, fetchRemoteAttachment, parsePairingPayload, pushRemoteEncryptedBundle, pushRemoteAttachment, deleteRemoteAttachment } from '../../shared/syncClient'
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
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getAttachmentFilePath, importAttachmentFromEncryptedFile } from './attachmentService'
import type { SyncBundle } from '../../shared/syncTypes'

async function syncAttachmentsWithRemote(
  pairing: {
    host: string
    port: number
    accessPassword: string
    fingerprint: string
    secure: boolean
  },
  mergedBundle: SyncBundle,
): Promise<void> {
  const attachments = mergedBundle.attachments ?? []
  for (const meta of attachments) {
    const localPath = getAttachmentFilePath(meta.id)
    if (fs.existsSync(localPath)) continue
    try {
      const data = await fetchRemoteAttachment(pairing, meta.id, { rejectUnauthorized: false })
      const tempDir = path.join(os.tmpdir(), 'pwdbook-sync-pull')
      fs.mkdirSync(tempDir, { recursive: true })
      const tempPath = path.join(tempDir, `${meta.id}.pwdattach`)
      fs.writeFileSync(tempPath, data)
      importAttachmentFromEncryptedFile(
        meta.entryId,
        meta.id,
        meta.filename,
        meta.mimeType,
        meta.sizeBytes,
        meta.createdAt,
        meta.updatedAt,
        tempPath,
      )
      fs.unlinkSync(tempPath)
    } catch {
      // remote attachment may not exist yet
    }
  }

  for (const meta of attachments) {
    const localPath = getAttachmentFilePath(meta.id)
    if (!fs.existsSync(localPath)) continue
    try {
      const encrypted = fs.readFileSync(localPath)
      await pushRemoteAttachment(pairing, meta.id, encrypted, { rejectUnauthorized: false })
    } catch {
      // ignore push failures for individual files
    }
  }

  for (const tombstone of mergedBundle.attachmentDeletions ?? []) {
    try {
      await deleteRemoteAttachment(pairing, tombstone.id, { rejectUnauthorized: false })
    } catch {
      // remote file may already be gone
    }
  }
}

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
    await syncAttachmentsWithRemote(pairing, mergedBundle)

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
