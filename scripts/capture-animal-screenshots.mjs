import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempDir = path.join(root, '.screenshot-temp')
const electronCli = path.join(root, 'node_modules', 'electron', 'cli.js')

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true })
}

console.log('Building app...')
await run('npm', ['run', 'build'], { cwd: root })

console.log('Capturing Animal Island screenshots...')
await run('node', [electronCli, '.'], {
  cwd: root,
  env: {
    ...process.env,
    PWD_BOOK_SCREENSHOT: '1',
  },
})

console.log('Done.')
