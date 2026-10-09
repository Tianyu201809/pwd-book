import { beforeEach, describe, expect, it, vi } from 'vitest'

const values = new Map<string, string>()

vi.mock('../db/helpers', () => ({
  getSetting: (key: string) => values.get(key) ?? null,
  setSetting: (key: string, value: string) => values.set(key, value),
}))

vi.mock('./quickBarRecentService', () => ({
  truncateQuickBarRecentToLimit: vi.fn(),
}))

describe('settingsService', () => {
  beforeEach(() => {
    values.clear()
  })

  it('does not expose automatic update settings', async () => {
    const { getSecuritySettings } = await import('./settingsService')
    expect(getSecuritySettings()).not.toHaveProperty('autoUpdateEnabled')
  })
})
