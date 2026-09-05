#!/usr/bin/env node
/**
 * CLI wrapper — 与设置页「注册到 Chrome / Edge」逻辑一致。
 * 优先读取 extension/extension-id.txt 或参数；清单写入 %APPDATA%/pwd-book/native-host/
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
const HOST_NAME = 'com.pwdbook.app'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const hostDir = path.join(root, 'native-host')
const cmdPath = path.join(hostDir, 'pwdbook-native-host.cmd')
const extensionIdFile = path.join(root, 'extension', 'extension-id.txt')

function userManifestPath() {
  const appData = process.env.APPDATA
  if (!appData) throw new Error('APPDATA not set')
  return path.join(appData, 'pwd-book', 'native-host', `${HOST_NAME}.json`)
}

function readIdFromManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return ''
  try {
    const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const m = json.allowed_origins?.[0]?.match(/^chrome-extension:\/\/([a-p]{32})\/$/)
    return m?.[1] ?? ''
  } catch {
    return ''
  }
}

function resolveExtensionId() {
  const fromArgv = process.argv[2]?.trim().toLowerCase()
  if (fromArgv) return fromArgv
  if (fs.existsSync(extensionIdFile)) {
    return fs.readFileSync(extensionIdFile, 'utf8').trim().toLowerCase()
  }
  return readIdFromManifest(userManifestPath())
}

const extensionId = resolveExtensionId()
if (!extensionId || !/^[a-p]{32}$/.test(extensionId)) {
  console.error('用法: npm run register-native-host -- <扩展ID>')
  console.error('或在 PwdBook 设置 → 浏览器 中填写 ID 并点击注册。')
  process.exit(1)
}

if (!fs.existsSync(cmdPath)) {
  console.error(`未找到: ${cmdPath}`)
  process.exit(1)
}

const manifestPath = userManifestPath()
fs.mkdirSync(path.dirname(manifestPath), { recursive: true })

const manifest = {
  name: HOST_NAME,
  description: 'PwdBook Native Messaging Host',
  path: cmdPath.replace(/\//g, '\\'),
  type: 'stdio',
  allowed_origins: [`chrome-extension://${extensionId}/`],
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
fs.writeFileSync(extensionIdFile, `${extensionId}\n`, 'utf8')

const regValue = manifestPath.replace(/\//g, '\\')
for (const key of [
  `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`,
  `HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${HOST_NAME}`,
]) {
  execSync(`reg add "${key}" /ve /t REG_SZ /d "${regValue}" /f`, { stdio: 'inherit' })
}

console.log('已注册 Native Host（Chrome + Edge）')
console.log(`  清单: ${manifestPath}`)
console.log(`  扩展: ${extensionId}`)
console.log('请完全退出并重新打开浏览器。')
