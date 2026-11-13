import { describe, expect, it } from 'vitest'
import { DEFAULT_ACCOUNT_NAME, defaultMachineSettings, parseMachineDocument } from './machineDocument'

describe('parseMachineDocument', () => {
  it('accepts version 1 and rejects a missing active id', () => {
    const parsed = parseMachineDocument({
      version: 1,
      activeAccountId: 'a',
      accounts: [{ id: 'a', name: DEFAULT_ACCOUNT_NAME, createdAt: 1 }],
      settings: {},
    })
    expect(parsed?.activeAccountId).toBe('a')
    expect(parsed?.settings.uiLocale).toBe('zh-CN')
    expect(parseMachineDocument({ version: 1, accounts: [], settings: {} })).toBeNull()
    expect(parseMachineDocument({
      version: 1,
      activeAccountId: 'missing',
      accounts: [{ id: 'a', name: DEFAULT_ACCOUNT_NAME, createdAt: 1 }],
      settings: {},
    })?.activeAccountId).toBe('missing')
  })

  it('keeps default strings and omits a non-boolean auto update flag', () => {
    const parsed = parseMachineDocument({
      version: 1,
      activeAccountId: 'a',
      accounts: [{ id: 'a', name: DEFAULT_ACCOUNT_NAME, createdAt: 1 }],
      settings: { quickBarAccelerator: 12, autoUpdateEnabled: 'true' },
    })
    expect(parsed?.settings.quickBarAccelerator).toBe(defaultMachineSettings().quickBarAccelerator)
    expect(parsed?.settings).not.toHaveProperty('autoUpdateEnabled')
  })
})
