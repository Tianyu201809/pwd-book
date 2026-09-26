import { describe, expect, it } from 'vitest'
import { getTrayLabels, trayMenuActions } from './trayLabels'

describe('tray menu', () => {
  it('offers clipboard and notes after the window actions', () => {
    expect(trayMenuActions(true)).toEqual([
      'showMain',
      'quickSearch',
      'clipboard',
      'notes',
      'settings',
      'separator',
      'quit',
    ])
    expect(trayMenuActions(false)).toEqual([
      'showMain',
      'clipboard',
      'notes',
      'settings',
      'separator',
      'quit',
    ])
  })

  it('labels both locales', () => {
    expect(getTrayLabels('zh-CN').clipboard).toBe('打开剪切板')
    expect(getTrayLabels('zh-CN').notes).toBe('打开便签')
    expect(getTrayLabels('en').clipboard).toBe('Open clipboard')
    expect(getTrayLabels('en').notes).toBe('Open notes')
  })
})
