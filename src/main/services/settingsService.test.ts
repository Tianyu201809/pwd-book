import { beforeEach, describe, expect, it, vi } from 'vitest'

const values = new Map<string, string>()

vi.mock('electron', () => ({
  app: {
    getPath: () => 'dummy-user-data',
  },
}))

vi.mock('../db/helpers', () => ({
  getSetting: (key: string) => values.get(key) ?? null,
  setSetting: (key: string, value: string) => values.set(key, value),
}))

vi.mock('./quickBarRecentService', () => ({
  truncateQuickBarRecentToLimit: vi.fn(),
}))

vi.mock('../accounts/machineStore', () => ({
  readMachineDocument: vi.fn(),
  updateMachineSettings: vi.fn(),
}))

import { readMachineDocument, updateMachineSettings } from '../accounts/machineStore'

describe('settingsService', () => {
  beforeEach(() => {
    values.clear()
    vi.mocked(readMachineDocument).mockReset()
    vi.mocked(readMachineDocument).mockReturnValue(null)
    vi.mocked(updateMachineSettings).mockReset()
  })

  it('does not expose automatic update settings', async () => {
    const { getSecuritySettings } = await import('./settingsService')
    expect(getSecuritySettings()).not.toHaveProperty('autoUpdateEnabled')
  })

  it('stores closeWindowAction in machine settings instead of the account database', async () => {
    const { updateSecuritySettings } = await import('./settingsService')
    updateSecuritySettings({ closeWindowAction: 'quit' })

    expect(values.has('close_window_action')).toBe(false)
    expect(updateMachineSettings).toHaveBeenCalledWith(
      'dummy-user-data',
      expect.objectContaining({ closeWindowAction: 'quit' }),
    )
  })

  it('stores autoLockMinutes in the account database and not as a machine field', async () => {
    const { updateSecuritySettings } = await import('./settingsService')
    updateSecuritySettings({ autoLockMinutes: 5 })

    expect(values.get('auto_lock_minutes')).toBe('5')
    expect(values.has('close_window_action')).toBe(false)
    for (const call of vi.mocked(updateMachineSettings).mock.calls) {
      expect(call[1]).not.toHaveProperty('autoLockMinutes')
    }
  })
})
