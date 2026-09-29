import { beforeEach, describe, expect, it, vi } from 'vitest'

const values = new Map<string, string>()

vi.mock('../db/helpers', () => ({
  getSetting: (key: string) => values.get(key) ?? null,
  setSetting: (key: string, value: string) => values.set(key, value),
}))

vi.mock('./quickBarRecentService', () => ({
  truncateQuickBarRecentToLimit: vi.fn(),
}))

describe('settingsService automatic update preference', () => {
  beforeEach(() => {
    values.clear()
  })

  it('defaults automatic updates to enabled when no stored value exists', async () => {
    const { getSecuritySettings } = await import('./settingsService')
    expect(getSecuritySettings().autoUpdateEnabled).toBe(true)
  })

  it('persists and reads a disabled automatic update setting', async () => {
    const { getSecuritySettings, updateSecuritySettings } = await import('./settingsService')
    const next = updateSecuritySettings({ autoUpdateEnabled: false })

    expect(next.autoUpdateEnabled).toBe(false)
    expect(getSecuritySettings().autoUpdateEnabled).toBe(false)
  })
})
