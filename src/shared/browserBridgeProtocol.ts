export type BridgeAction =
  | 'ping'
  | 'status'
  | 'matchLogins'
  | 'getCredential'
  | 'listCategories'
  | 'createEntry'

export interface BridgeRequest {
  action: BridgeAction
  token: string
  pageUrl?: string
  entryId?: string
  entry?: BridgeCreateEntryInput
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

/** 扩展弹窗快捷添加：只带用户填写的字段，不含密码以外的机密 */
export interface BridgeCreateEntryInput {
  title: string
  url?: string
  username?: string
  password: string
  note?: string
  categoryId?: string
}

export interface BridgeCategoryOption {
  id: string
  name: string
}

export interface BridgeCreateEntryData {
  id: string
  title: string
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
