import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { rcedit } from 'rcedit'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const productFilename = context.packager.appInfo.productFilename
  const exePath = path.join(context.appOutDir, `${productFilename}.exe`)
  const iconPath = path.join(root, 'icon', 'icon.ico')

  await rcedit(exePath, {
    icon: iconPath,
    'version-string': {
      FileDescription: productFilename,
      ProductName: productFilename,
      InternalName: productFilename,
    },
  })

  console.log(`Embedded icon into ${exePath}`)

  const nativeHostDir = path.join(context.appOutDir, 'resources', 'native-host')
  const cmdPath = path.join(nativeHostDir, 'pwdbook-native-host.cmd')
  const manifestPath = path.join(nativeHostDir, 'com.pwdbook.app.json')
  if (fs.existsSync(cmdPath)) {
    const manifest = {
      name: 'com.pwdbook.app',
      description: 'PwdBook Native Messaging Host',
      path: cmdPath,
      type: 'stdio',
      allowed_origins: ['chrome-extension://REPLACE_EXTENSION_ID/'],
    }
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    console.log(`Wrote native messaging manifest: ${manifestPath}`)
  }
}
