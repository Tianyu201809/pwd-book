import type { VaultCategory } from './types'

export const SYNC_BUNDLE_FORMAT = 'pwdbook-sync' as const
export const SYNC_BUNDLE_VERSION = 1 as const
export const SYNC_BUNDLE_FILENAME = 'vault.pwdbook'
export const SYNC_MAGIC = 'PBKS'

export interface SyncEntry {
  id: string
  title: string
  url: string
  username: string
  password: string
  note: string
  tags: string[]
  categoryId: string
  isFavorite: boolean
  displayIcon: string
  localProgramPath: string
  lastUsedAt: number | null
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface SyncBundleSettings {
  trashRetentionDays?: number
}

export interface SyncBundle {
  format: typeof SYNC_BUNDLE_FORMAT
  version: typeof SYNC_BUNDLE_VERSION
  deviceId: string
  revision: number
  exportedAt: string
  categories: VaultCategory[]
  entries: SyncEntry[]
  settings?: SyncBundleSettings
}

export interface SyncConflict {
  entryId: string
  localUpdatedAt: number
  remoteUpdatedAt: number
}

export interface SyncMergeResult {
  added: number
  updated: number
  removed: number
  conflicts: SyncConflict[]
  revision: number
}

export interface SyncStatus {
  deviceId: string
  revision: number
  lastSyncedAt: number | null
  lastSyncError: string | null
}

export interface PairedDevice {
  id: string
  name: string
  pairedAt: number
  lastSeenAt: number | null
}

export interface WifiSyncServerStatus {
  running: boolean
  port: number | null
  host: string | null
  accessPassword: string
  certificateFingerprint: string
  verificationCode: string
  lastPublishedAt: number | null
  lastPublishedRevision: number
  bundleSizeBytes: number
}

export interface WifiSyncPairingInfo {
  host: string
  port: number
  accessPassword: string
  certificateFingerprint: string
  verificationCode: string
  qrPayload: string
  secure: boolean
}

export interface WifiSyncDiscoveredServer {
  name: string
  host: string
  port: number
  fingerprint: string
}

export interface WifiSyncClientPullPayload {
  host: string
  port: number
  accessPassword: string
  certificateFingerprint: string
  masterPassword: string
  deviceName?: string
}

export interface WifiSyncSettings {
  serverEnabled: boolean
  accessPassword: string
  port: number
  pairedDevices: PairedDevice[]
}

export interface SyncPairingConfig {
  host: string
  port: number
  accessPassword: string
  fingerprint: string
  secure?: boolean
}
