export type BridgeAction = 'ping' | 'status' | 'matchLogins' | 'getCredential'

export interface BridgeRequest {
  action: BridgeAction
  token: string
  pageUrl?: string
  entryId?: string
}

export interface BridgeLoginMatch {
  id: string
  title: string
  username: string
}

export interface BridgeResponse {
  ok: boolean
  error?: string
  data?: unknown
}

export interface BridgeStatusData {
  unlocked: boolean
  entryCount: number
}

export interface BridgeCredentialData {
  username: string
  password: string
}

export interface BrowserBridgeStatus {
  enabled: boolean
  running: boolean
  port: number | null
  unlocked: boolean
}

export interface NativeHostRegistrationInfo {
  extensionId: string
  registered: boolean
  manifestPath: string
  hostCmdPath: string
  hostCmdExists: boolean
}
