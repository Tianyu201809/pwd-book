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

  it('returns none when neither is set', () => {
    expect(resolveLaunchKind(makeEntry())).toBe('none')
  })
})

describe('launchEntry', () => {
  it('launches local program and touches entry', async () => {
    const api = {
      openLocalProgram: vi.fn().mockResolvedValue(undefined),
      focusEntryInMain: vi.fn(),
      touchEntry: vi.fn().mockResolvedValue(undefined),
    }
    const entry = makeEntry({ localProgramPath: 'C:\\App.exe', url: 'https://example.com' })

    await expect(launchEntry(entry, api)).resolves.toBe('program')
    expect(api.openLocalProgram).toHaveBeenCalledWith('C:\\App.exe')
    expect(api.touchEntry).toHaveBeenCalledWith('entry-1')
    expect(api.focusEntryInMain).not.toHaveBeenCalled()
  })

  it('focuses main window for website entries instead of opening browser', async () => {
    const api = {
      openLocalProgram: vi.fn().mockResolvedValue(undefined),
      focusEntryInMain: vi.fn(),
      touchEntry: vi.fn().mockResolvedValue(undefined),
    }
    const entry = makeEntry({ url: 'https://example.com' })

    await expect(launchEntry(entry, api)).resolves.toBe('url')
    expect(api.focusEntryInMain).toHaveBeenCalledWith('entry-1')
    expect(api.touchEntry).toHaveBeenCalledWith('entry-1')
    expect(api.openLocalProgram).not.toHaveBeenCalled()
  })

  it('returns none when there is no launch target', async () => {
    const api = {
      openLocalProgram: vi.fn().mockResolvedValue(undefined),
      focusEntryInMain: vi.fn(),
      touchEntry: vi.fn().mockResolvedValue(undefined),
    }

    await expect(launchEntry(makeEntry(), api)).resolves.toBe('none')
    expect(api.openLocalProgram).not.toHaveBeenCalled()
    expect(api.focusEntryInMain).not.toHaveBeenCalled()
    expect(api.touchEntry).not.toHaveBeenCalled()
  })
})
