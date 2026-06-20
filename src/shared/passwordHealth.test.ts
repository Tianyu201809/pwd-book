import { describe, expect, it } from 'vitest'
import { analyzePasswordHealth } from './passwordHealth'
import type { PasswordEntry } from './types'

function makeEntry(overrides: Partial<PasswordEntry> & { id: string }): PasswordEntry {
  return {
    id: overrides.id,
    title: overrides.title ?? 'Title',
    url: '',
    username: '',
    password: overrides.password ?? 'StrongP@ssw0rd!',
    note: '',
    tags: [],
    categoryId: 'cat-work',
    categoryName: 'Work',
    isFavorite: false,
    displayIcon: '',
    localProgramPath: '',
    totpSecret: '',
    customFields: [],
    attachmentCount: 0,
    lastUsedAt: null,
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('passwordHealth', () => {
  it('flags weak passwords', () => {
    const report = analyzePasswordHealth([
      makeEntry({ id: '1', password: '123' }),
      makeEntry({ id: '2', password: 'AnotherStrong1!' }),
    ])
    expect(report.weakCount).toBe(1)
    expect(report.issues.some((item) => item.entryId === '1' && item.type === 'weak')).toBe(true)
  })

  it('flags duplicate passwords', () => {
    const report = analyzePasswordHealth([
      makeEntry({ id: '1', title: 'A', password: 'SamePass1!' }),
      makeEntry({ id: '2', title: 'B', password: 'SamePass1!' }),
    ])
    expect(report.duplicateGroupCount).toBe(1)
    expect(report.duplicateEntryCount).toBe(2)
  })
})
