import { execFileSync, spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const bundledLauncher = path.join(projectRoot, 'native-host', 'pwdbook-native-host.sh')

describe('macOS native messaging launcher', () => {
  it.skipIf(process.platform !== 'darwin')(
    'uses the packaged Electron runtime when the browser PATH has no Node.js',
    () => {
      const appBundle = fs.mkdtempSync(path.join(os.tmpdir(), 'pwdbook-app-'))
      const contentsDir = path.join(appBundle, 'PwdBook.app', 'Contents')
      const hostDir = path.join(contentsDir, 'Resources', 'native-host')
      const executablePath = path.join(contentsDir, 'MacOS', 'PwdBook')
      const launcherPath = path.join(hostDir, 'pwdbook-native-host.sh')
      const entryPath = path.join(hostDir, 'index.mjs')
      const capturePath = path.join(appBundle, 'electron-arguments.txt')

      try {
        fs.mkdirSync(path.dirname(executablePath), { recursive: true })
        fs.mkdirSync(hostDir, { recursive: true })
        fs.copyFileSync(bundledLauncher, launcherPath)
        expect(fs.readFileSync(launcherPath, 'utf8')).not.toContain('\r')
        fs.writeFileSync(entryPath, '')
        fs.writeFileSync(
          executablePath,
          '#!/bin/sh\nprintf "%s\\n" "$ELECTRON_RUN_AS_NODE" "$@" > "$HOST_CAPTURE"\n',
          { mode: 0o755 },
        )
        fs.chmodSync(launcherPath, 0o755)

        const env = {
          HOME: appBundle,
          HOST_CAPTURE: capturePath,
          PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
        }
        const result = spawnSync(launcherPath, [], { env, encoding: 'utf8' })

        expect(result.status).toBe(0)
        expect(fs.readFileSync(capturePath, 'utf8').trim().split('\n')).toEqual([
          '1',
          entryPath,
        ])
      } finally {
        execFileSync('/bin/rm', ['-rf', appBundle])
      }
    },
  )
})
