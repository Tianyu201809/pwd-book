import path from 'path'

const SQLITE_HEADER = 'SQLite format 3\u0000'

export function isValidSqliteHeader(buffer: Buffer): boolean {
  return buffer.length >= 16 && buffer.subarray(0, 16).toString('binary') === SQLITE_HEADER
}

export function accountDataPaths(userData: string, accountId: string) {
  const dir = path.join(userData, 'accounts', accountId)
  return {
    dir,
    database: path.join(dir, 'pwdbook.db'),
    attachments: path.join(dir, 'attachments'),
    syncServer: path.join(dir, 'sync-server'),
    wifiCerts: path.join(dir, 'wifi-sync-certs'),
    nativeHost: path.join(userData, 'native-host'),
    nativeBridge: path.join(userData, 'native-bridge.json'),
  }
}
