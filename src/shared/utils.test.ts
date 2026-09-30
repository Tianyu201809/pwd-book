import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { language: 'zh-CN' },
  })
})

import { cloneForIpc, getAvatarMeta } from './utils'

describe('getAvatarMeta', () => {
  it('uses the first trimmed character and falls back to ?', () => {
    expect(getAvatarMeta('  胡桃信用卡').text).toBe('胡')
    expect(getAvatarMeta('autoforge').text).toBe('A')
    expect(getAvatarMeta('   ').text).toBe('?')
    expect(getAvatarMeta('').text).toBe('?')
  })

  it('is stable for the same title', () => {
    expect(getAvatarMeta('阿里云OSS')).toEqual(getAvatarMeta('阿里云OSS'))
  })

  it('returns a dark text color and a lighter tinted background', () => {
    const meta = getAvatarMeta('胡桃信用卡')
    expect(meta.color.toLowerCase()).not.toBe('#fff')
    expect(meta.color.toLowerCase()).not.toBe('#ffffff')
    expect(meta.color.toLowerCase()).not.toBe('white')
    expect(meta.bg).toMatch(/rgba?\(/i)
    expect(meta.bg).not.toBe(meta.color)
  })
})

describe('cloneForIpc', () => {
  it('strips Proxy wrappers so Electron structured clone can send the value', () => {
    const proxiedIds = new Proxy(['one', 'two', 'three'], {})
    expect(() => structuredClone(proxiedIds)).toThrow()
    expect(structuredClone(cloneForIpc(proxiedIds))).toEqual(['one', 'two', 'three'])
  })
})
