import { describe, expect, it } from 'vitest'
import {
  PRESET_ICONS,
  formatPresetIconId,
  getPresetIconById,
  isPresetIcon,
  isRenderableDisplayIcon,
  matchPresetIconByUrl,
  parsePresetIconId,
  searchPresetIcons,
  shouldApplyPresetFromUrl,
} from './presetIcons'

describe('preset icon ids', () => {
  it('parses a preset value and rejects lucide or empty names', () => {
    expect(isPresetIcon('preset:github')).toBe(true)
    expect(parsePresetIconId('preset:github')).toBe('github')
    expect(formatPresetIconId('github')).toBe('preset:github')
    expect(isPresetIcon('')).toBe(false)
    expect(isPresetIcon('Mail')).toBe(false)
    expect(parsePresetIconId('Mail')).toBeNull()
    expect(parsePresetIconId('preset:')).toBeNull()
    expect(parsePresetIconId('preset:GitHub')).toBeNull()
  })
})

describe('matchPresetIconByUrl', () => {
  it('returns null for empty or unparseable input', () => {
    expect(matchPresetIconByUrl('')).toBeNull()
    expect(matchPresetIconByUrl('   ')).toBeNull()
    expect(matchPresetIconByUrl('not a url')).toBeNull()
  })

  it('matches without a protocol and strips www', () => {
    expect(matchPresetIconByUrl('github.com')).toBe('preset:github')
    expect(matchPresetIconByUrl('https://www.github.com/foo')).toBe('preset:github')
  })

  it('matches subdomains and prefers the longer domain', () => {
    expect(matchPresetIconByUrl('https://gist.github.com/x')).toBe('preset:github')
    expect(matchPresetIconByUrl('https://mail.google.com')).toBe('preset:gmail')
    expect(matchPresetIconByUrl('https://www.google.com')).toBe('preset:google')
    expect(matchPresetIconByUrl('https://aws.amazon.com')).toBe('preset:aws')
    expect(matchPresetIconByUrl('https://www.amazon.com')).toBe('preset:amazon')
    expect(matchPresetIconByUrl('https://music.163.com')).toBe('preset:netease-music')
    expect(matchPresetIconByUrl('https://mail.163.com')).toBe('preset:netease-mail')
    expect(matchPresetIconByUrl('https://mail.qq.com')).toBe('preset:qqmail')
    expect(matchPresetIconByUrl('https://im.qq.com')).toBe('preset:qq')
  })

  it('returns null when no catalog domain matches', () => {
    expect(matchPresetIconByUrl('https://example.com')).toBeNull()
  })
})

describe('searchPresetIcons', () => {
  it('finds wechat by id, labels, and required aliases', () => {
    const byWx = searchPresetIcons('wx')
    const byWeixin = searchPresetIcons('weixin')
    const byZh = searchPresetIcons('微信')
    const byId = searchPresetIcons('wechat')
    expect(byWx.some((icon) => icon.id === 'wechat')).toBe(true)
    expect(byWeixin.some((icon) => icon.id === 'wechat')).toBe(true)
    expect(byZh.some((icon) => icon.id === 'wechat')).toBe(true)
    expect(byId.some((icon) => icon.id === 'wechat')).toBe(true)
  })

  it('returns the full catalog when the query is empty', () => {
    expect(searchPresetIcons('').length).toBeGreaterThan(50)
    expect(searchPresetIcons('   ').length).toBe(searchPresetIcons('').length)
  })
})

describe('shouldApplyPresetFromUrl', () => {
  it('applies only when the url text changed and the icon is empty', () => {
    expect(shouldApplyPresetFromUrl('', 'https://github.com', '')).toBe(true)
    expect(shouldApplyPresetFromUrl('https://github.com', 'https://github.com', '')).toBe(false)
    expect(shouldApplyPresetFromUrl('', 'https://github.com', 'preset:github')).toBe(false)
    expect(shouldApplyPresetFromUrl('', 'https://github.com', 'Mail')).toBe(false)
  })
})

describe('isRenderableDisplayIcon', () => {
  const hasGithub = (id: string) => id === 'github'

  it('treats lucide and letter icons as renderable', () => {
    expect(isRenderableDisplayIcon('Mail', hasGithub)).toBe(true)
    expect(isRenderableDisplayIcon('LetterA', hasGithub)).toBe(true)
  })

  it('treats empty and unknown presets as not renderable', () => {
    expect(isRenderableDisplayIcon('', hasGithub)).toBe(false)
    expect(isRenderableDisplayIcon('preset:missing', hasGithub)).toBe(false)
    expect(isRenderableDisplayIcon('preset:github', () => false)).toBe(false)
  })

  it('treats a known preset with an asset as renderable', () => {
    expect(isRenderableDisplayIcon('preset:github', hasGithub)).toBe(true)
  })
})

describe('catalog integrity', () => {
  it('uses unique ids and hostname-only domains', () => {
    const ids = PRESET_ICONS.map((icon) => icon.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(PRESET_ICONS.some((icon) => icon.id === 'rail12306')).toBe(true)
    for (const icon of PRESET_ICONS) {
      expect(icon.file.startsWith(`${icon.id}.`)).toBe(true)
      for (const domain of icon.domains) {
        expect(domain).not.toMatch(/^www\./)
        expect(domain).not.toMatch(/^https?:/)
        expect(domain).toBe(domain.toLowerCase())
      }
    }
    expect(getPresetIconById('wechat')?.aliases).toEqual(expect.arrayContaining(['wx', 'weixin']))
  })
})
