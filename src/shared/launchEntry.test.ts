import { describe, expect, it, vi } from 'vitest'
import { launchEntry, resolveLaunchKind } from './launchEntry'
import type { PasswordEntry } from './types'

function makeEntry(partial: Partial<PasswordEntry> = {}): PasswordEntry {
  return {
    id: 'entry-1',
    title: 'Example',
    url: '',
    username: '',
    password: '',
    note: '',
    tags: [],
    categoryId: 'cat-other',
    categoryName: '其他',
    isFavorite: false,
    displayIcon: '',
    localProgramPath: '',
    totpSecret: '',
    customFields: [],
    attachmentCount: 0,
    lastUsedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  }
}

function makeApi() {
  return {
    openLocalProgram: vi.fn().mockResolvedValue(undefined),
    openExternal: vi.fn().mockResolvedValue(undefined),
    focusEntryInMain: vi.fn(),
    touchEntry: vi.fn().mockResolvedValue(undefined),
  }
}

describe('resolveLaunchKind', () => {
  it('prefers local program over url', () => {
    expect(
      resolveLaunchKind(
        makeEntry({ localProgramPath: 'C:\\App.exe', url: 'https://example.com' }),
      ),
    ).toBe('program')
  })

  it('returns url when only website is set', () => {
    expect(resolveLaunchKind(makeEntry({ url: 'https://example.com' }))).toBe('url')
  })

  it('returns focus when neither program nor url is set', () => {
    expect(resolveLaunchKind(makeEntry())).toBe('focus')
  })
})

describe('launchEntry', () => {
  it('launches local program and touches entry', async () => {
    const api = makeApi()
    const entry = makeEntry({ localProgramPath: 'C:\\App.exe', url: 'https://example.com' })

    await expect(launchEntry(entry, api)).resolves.toBe('program')
    expect(api.openLocalProgram).toHaveBeenCalledWith('C:\\App.exe')
    expect(api.touchEntry).toHaveBeenCalledWith('entry-1')
    expect(api.openExternal).not.toHaveBeenCalled()
    expect(api.focusEntryInMain).not.toHaveBeenCalled()
  })

  it('opens website in browser when url is set and no program', async () => {
    const api = makeApi()
    const entry = makeEntry({ url: 'example.com' })

    await expect(launchEntry(entry, api)).resolves.toBe('url')
    expect(api.openExternal).toHaveBeenCalledWith('https://example.com')
    expect(api.touchEntry).toHaveBeenCalledWith('entry-1')
    expect(api.openLocalProgram).not.toHaveBeenCalled()
    expect(api.focusEntryInMain).not.toHaveBeenCalled()
  })

  it('focuses main window when entry has no program and no url', async () => {
    const api = makeApi()

    await expect(launchEntry(makeEntry(), api)).resolves.toBe('focus')
    expect(api.focusEntryInMain).toHaveBeenCalledWith('entry-1')
    expect(api.touchEntry).toHaveBeenCalledWith('entry-1')
    expect(api.openLocalProgram).not.toHaveBeenCalled()
    expect(api.openExternal).not.toHaveBeenCalled()
  })
})
