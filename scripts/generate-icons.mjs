import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const iconDir = path.join(root, 'icon')
const svgPath = path.join(iconDir, 'icon.svg')

const icoSizes = [16, 32, 48, 64, 128, 256]

async function main() {
  if (!fs.existsSync(svgPath)) {
    throw new Error(`Missing source SVG: ${svgPath}`)
  }

  const svgBuffer = fs.readFileSync(svgPath)

  await sharp(svgBuffer).resize(1024, 1024).png().toFile(path.join(iconDir, 'icon.png'))

  const icoBuffers = await Promise.all(
    icoSizes.map((size) => sharp(svgBuffer).resize(size, size).png().toBuffer()),
  )
  const ico = await pngToIco(icoBuffers)
  fs.writeFileSync(path.join(iconDir, 'icon.ico'), ico)

  console.log('Generated icon/icon.png and icon/icon.ico')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
