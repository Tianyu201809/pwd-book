import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {},
  globalShortcut: { register: vi.fn(), unregister: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  screen: { getPrimaryDisplay: vi.fn() },
}))

vi.mock('../services/noteService', () => ({
  getNote: vi.fn(),
  listDesktopVisibleNoteIds: vi.fn(() => []),
  updateNoteWindowState: vi.fn(),
}))

vi.mock('../services/settingsService', () => ({
  getSecuritySettings: vi.fn(),
}))

vi.mock('../services/sessionService', () => ({
  isUnlocked: vi.fn(() => false),
}))

vi.mock('../tray', () => ({
  showFromTray: vi.fn(),
}))

import { rememberLockedAccount, shouldRestoreLockedWindows } from '../noteWindows'

describe('lockBoundary', () => {
  it('restores locked windows only for the same account', () => {
    rememberLockedAccount('acc-a')
    expect(shouldRestoreLockedWindows('acc-a')).toBe(true)
    expect(shouldRestoreLockedWindows('acc-b')).toBe(false)
  })
})
