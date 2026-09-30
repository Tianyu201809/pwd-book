import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const iconDir = path.join(root, 'icon')
const sourcePath = path.join(iconDir, 'source.png')

/**
 * 母版 `icon/source.png` 的实测几何（1024×1024 画布）：
 * 圆角方块自 (23, 24) 起、边长 976，圆角半径约 227（≈ 边长的 23.25%）。
 * 母版四角是不透明白底，必须按此几何裁切并套圆角遮罩，否则在 macOS /
 * 托盘 / 深色界面上会露出白色方块。
 *
 * 注意：文件名不要以 `icon-` 开头，`.gitignore` 中的 `icon/icon-*.png`
 * 会把生成产物连同母版一起忽略掉。
 */
const SHAPE = { left: 23, top: 24, size: 976, radiusRatio: 0.2325 }

const CANVAS = 1024

/** 写进 icon.png / icon-<size>.png 的尺寸族。 */
const pngSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]

/** 写进 icon.ico 的尺寸族，覆盖 Windows 100%~400% 缩放常见取值。 */
const icoSizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]

/** 生成一张带抗锯齿的圆角矩形遮罩 PNG。 */
async function buildMask(size) {
  const radius = Math.round(size * SHAPE.radiusRatio)
  const supersample = 4
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size * supersample}" height="${size * supersample}">` +
      `<rect x="0" y="0" width="${size * supersample}" height="${size * supersample}" ` +
      `rx="${radius * supersample}" ry="${radius * supersample}" fill="#ffffff"/></svg>`,
  )
  return sharp(svg).resize(size, size, { fit: 'fill' }).png().toBuffer()
}

/** 裁掉母版留白并套上透明圆角，得到规范化的 1024 母版。 */
async function buildMaster() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source icon: ${sourcePath}`)
  }

  const mask = await buildMask(CANVAS)

  return sharp(sourcePath)
    .extract({ left: SHAPE.left, top: SHAPE.top, width: SHAPE.size, height: SHAPE.size })
    .resize(CANVAS, CANVAS, { fit: 'fill' })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

/**
 * 缩到目标尺寸。母版细节密集，小尺寸直接用 lanczos 会糊成一团，
 * 因此 ≤64px 追加轻微锐化（越小越强），让轮廓/锁孔在小尺寸下仍可辨认；
 * >64px 不锐化，避免出现锐化光晕。
 */
function renderAt(master, size) {
  const resized = sharp(master).resize(size, size, { fit: 'fill' })
  const sigma = size <= 24 ? 0.75 : size <= 64 ? 0.5 : 0
  const pipeline = sigma > 0 ? resized.sharpen({ sigma }) : resized
  return pipeline.png({ compressionLevel: 9 }).toBuffer()
}

async function main() {
  const master = await buildMaster()

  const allSizes = [...new Set([...pngSizes, ...icoSizes])].sort((a, b) => a - b)
  const rendered = new Map()
  for (const size of allSizes) {
    const buffer = await renderAt(master, size)
    rendered.set(size, buffer)
    if (pngSizes.includes(size)) {
      fs.writeFileSync(path.join(iconDir, `icon-${size}.png`), buffer)
    }
  }

  // icon.png 为 electron-builder 的 mac / linux 图标源，固定 1024。
  fs.writeFileSync(path.join(iconDir, 'icon.png'), rendered.get(CANVAS))

  const ico = await pngToIco(icoSizes.map((size) => rendered.get(size)))
  fs.writeFileSync(path.join(iconDir, 'icon.ico'), ico)

  console.log(
    `Generated icon.png (${CANVAS}px), icon.ico (${icoSizes.join('/')}), ` +
      `icon-{${pngSizes.join(',')}}.png`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
