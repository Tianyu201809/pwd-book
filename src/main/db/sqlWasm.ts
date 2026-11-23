import { app } from 'electron'
import path from 'path'

export function getSqlWasmPath(file: string): string {
  const directory = app?.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist')
    : path.join(app?.getAppPath?.() ?? process.cwd(), 'node_modules', 'sql.js', 'dist')

  return path.join(directory, file)
}
