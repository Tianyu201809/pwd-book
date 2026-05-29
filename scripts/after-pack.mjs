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
}
