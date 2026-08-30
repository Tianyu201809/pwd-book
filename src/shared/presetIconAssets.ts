import { getPresetIconById, isRenderableDisplayIcon } from './presetIcons'

const modules = import.meta.glob('../assets/preset-icons/*.{png,svg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const urlByFile = new Map<string, string>()
for (const [path, url] of Object.entries(modules)) {
  const file = path.split('/').pop()
  if (file) urlByFile.set(file, url)
}

export function getPresetIconUrl(id: string): string | undefined {
  const icon = getPresetIconById(id)
  if (!icon) return undefined
  return urlByFile.get(icon.file)
}

export function hasPresetIconAsset(id: string): boolean {
  return Boolean(getPresetIconUrl(id))
}

export function canRenderDisplayIcon(name: string): boolean {
  return isRenderableDisplayIcon(name, hasPresetIconAsset)
}
