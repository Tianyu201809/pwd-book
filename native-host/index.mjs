#!/usr/bin/env node
/**
 * Chrome/Edge Native Messaging host for PwdBook.
 * Reads length-prefixed JSON from stdin, forwards to local bridge, writes response to stdout.
 */
import fs from 'fs'
import net from 'net'
import path from 'path'

const BRIDGE_CONFIG_ENV = 'PWD_BOOK_BRIDGE_CONFIG'

function bridgeConfigCandidates() {
  const list = []
  if (process.env[BRIDGE_CONFIG_ENV]) {
    list.push(process.env[BRIDGE_CONFIG_ENV])
  }
  const appData = process.env.APPDATA
  if (appData) {
    // Electron userData 与 package.json name 一致时为 pwd-book（非 PwdBook）
    list.push(path.join(appData, 'pwd-book', 'native-bridge.json'))
    list.push(path.join(appData, 'PwdBook', 'native-bridge.json'))
  }
  const home = process.env.HOME
  if (home) {
    list.push(path.join(home, 'Library/Application Support/pwd-book/native-bridge.json'))
    list.push(path.join(home, 'Library/Application Support/PwdBook/native-bridge.json'))
  }
  return list
}

function resolveBridgeConfigPath() {
  for (const candidate of bridgeConfigCandidates()) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

function loadBridgeConfig() {
  const configPath = resolveBridgeConfigPath()
  if (!configPath) {
    return null
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'))
}

function readNativeMessage() {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    let expected = -1

    function onData(chunk) {
      chunks.push(chunk)
      total += chunk.length
      if (expected < 0 && total >= 4) {
        const header = Buffer.concat(chunks)
        expected = header.readUInt32LE(0)
        chunks.length = 0
        chunks.push(header.subarray(4))
        total = header.length - 4
      }
      if (expected >= 0 && total >= expected) {
        process.stdin.removeListener('data', onData)
        const body = Buffer.concat(chunks).subarray(0, expected)
        resolve(JSON.parse(body.toString('utf8')))
      }
    }

    process.stdin.on('data', onData)
    process.stdin.on('error', reject)
    process.stdin.on('end', () => {
      if (expected < 0) reject(new Error('NO_MESSAGE'))
    })
  })
}

function writeNativeMessage(obj) {
  const json = JSON.stringify(obj)
  const body = Buffer.from(json, 'utf8')
  const header = Buffer.alloc(4)
  header.writeUInt32LE(body.length, 0)
  process.stdout.write(header)
  process.stdout.write(body)
}

function forwardToBridge(config, payload) {
  return new Promise((resolve, reject) => {
    let settled = false
    const done = (fn) => (value) => {
      if (settled) return
      settled = true
      fn(value)
    }

    const socket = net.connect(
      { host: config.host || '127.0.0.1', port: config.port },
      () => {
        const req = {
          action: payload.action,
          token: config.token,
          pageUrl: payload.pageUrl,
          entryId: payload.entryId,
        }
        socket.write(`${JSON.stringify(req)}\n`)
      },
    )

    let buffer = ''
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      const idx = buffer.indexOf('\n')
      if (idx >= 0) {
        const line = buffer.slice(0, idx).trim()
        socket.end()
        try {
          done(resolve)(JSON.parse(line))
        } catch {
          done(reject)(new Error('INVALID_BRIDGE_RESPONSE'))
        }
      }
    })
    socket.on('error', (err) => {
      if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
        done(reject)(new Error('BRIDGE_CLOSED'))
        return
      }
      done(reject)(err)
    })
    socket.setTimeout(8000, () => {
      socket.destroy()
      done(reject)(new Error('BRIDGE_TIMEOUT'))
    })
  })
}

async function main() {
  const config = loadBridgeConfig()
  if (!config?.port || !config?.token) {
    writeNativeMessage({ ok: false, error: 'BRIDGE_NOT_RUNNING' })
    process.exit(0)
  }

  try {
    const incoming = await readNativeMessage()
    const response = await forwardToBridge(config, incoming)
    writeNativeMessage(response)
  } catch (error) {
    writeNativeMessage({
      ok: false,
      error: error instanceof Error ? error.message : 'NATIVE_HOST_ERROR',
    })
  }
  process.exit(0)
}

void main()
