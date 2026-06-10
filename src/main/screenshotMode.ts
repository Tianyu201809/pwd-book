import { app, type BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { createEntry, lockVault, setupVault, unlockVault } from './services/vaultService'
import type { PasswordEntryInput } from '../shared/types'

const SCREENSHOT_PASSWORD = 'screenshot-demo'

const SAMPLE_ENTRIES: PasswordEntryInput[] = [
  {
    title: 'GitHub',
    url: 'https://github.com',
    username: 'dev@example.com',
    password: 'p@ssw0rd!demo',
    note: '开发账号',
    categoryId: 'cat-work',
    tags: ['开发', '工作'],
    isFavorite: true,
    displayIcon: 'Github',
  },
  {
    title: '微信',
    url: 'https://weixin.qq.com',
    username: '13800138000',
    password: 'wx-demo-secret',
    categoryId: 'cat-social',
    tags: ['社交'],
    displayIcon: 'MessageCircle',
  },
  {
    title: '招商银行',
    url: 'https://cmbchina.com',
    username: '6222****1234',
    password: 'bank-demo-pwd',
    categoryId: 'cat-finance',
    tags: ['金融'],
    displayIcon: 'Landmark',
  },
  {
    title: '个人邮箱',
    url: 'https://mail.example.com',
    username: 'me@example.com',
    password: 'mail-demo-pwd',
    note: '常用邮箱',
    categoryId: 'cat-other',
    displayIcon: 'Mail',
  },
]

export function isScreenshotMode(): boolean {
  return process.env.PWD_BOOK_SCREENSHOT === '1'
}

export function prepareScreenshotEnvironment(): void {
  const tempDir = path.join(process.cwd(), '.screenshot-temp')
  fs.mkdirSync(tempDir, { recursive: true })
  app.setPath('userData', tempDir)
}

export function setupScreenshotFixture(): void {
  setupVault(SCREENSHOT_PASSWORD, SCREENSHOT_PASSWORD)
  for (const entry of SAMPLE_ENTRIES) {
    createEntry(entry)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function outputDir(): string {
  return path.join(process.cwd(), 'docs', 'images')
}

async function dispatchScreenshotCommand(
  win: BrowserWindow,
  detail: Record<string, unknown>,
): Promise<void> {
  await win.webContents.executeJavaScript(`
    window.dispatchEvent(new CustomEvent('pwdbook-screenshot', { detail: ${JSON.stringify(detail)} }));
  `)
}

async function waitForScreenshotReady(win: BrowserWindow): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const ready = await win.webContents.executeJavaScript('Boolean(window.__PWD_BOOK_SCREENSHOT_READY__)')
    if (ready) return
    await delay(250)
  }
  throw new Error('Screenshot bridge did not become ready in time')
}

async function saveCapture(win: BrowserWindow, filename: string): Promise<void> {
  const image = await win.webContents.capturePage()
  const target = path.join(outputDir(), filename)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, image.toPNG())
  console.log(`Saved ${filename}`)
}

async function captureScene(
  win: BrowserWindow,
  filename: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await dispatchScreenshotCommand(win, detail)
  await delay(900)
  await saveCapture(win, filename)
}

export async function runAnimalScreenshotCapture(win: BrowserWindow): Promise<void> {
  await waitForScreenshotReady(win)
  await dispatchScreenshotCommand(win, { action: 'applyTheme', skin: 'animalIsland' })
  await delay(500)

  lockVault()
  await captureScene(win, 'animal-lock.png', { action: 'bootstrap' })

  unlockVault(SCREENSHOT_PASSWORD)
  await captureScene(win, 'animal-main.png', {
    action: 'bootstrap',
    screen: 'vault',
    selectFirstEntry: true,
  })

  await captureScene(win, 'animal-appearance.png', {
    action: 'navigate',
    screen: 'settings',
    settingsTab: 'appearance',
  })

  await captureScene(win, 'animal-password-gen.png', {
    action: 'navigate',
    screen: 'password-gen',
  })

  await captureScene(win, 'animal-email-backup.png', {
    action: 'navigate',
    screen: 'email-backup',
  })

  console.log(`Animal Island screenshots saved to ${outputDir()}`)
}
