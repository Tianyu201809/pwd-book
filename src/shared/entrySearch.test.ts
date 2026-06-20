import { describe, expect, it } from 'vitest'
import { entryMatchesSearch } from './entrySearch'
import type { PasswordEntry } from './types'

const sample: PasswordEntry = {
  id: '1',
  title: 'GitHub',
  url: 'https://github.com',
  username: 'dev',
  password: 'secret',
  note: '备用恢复邮箱',
  tags: ['工作'],
  categoryId: 'cat-work',
  categoryName: '工作',
  isFavorite: false,
  displayIcon: '',
  localProgramPath: '',
  totpSecret: '',
  attachmentCount: 0,
  lastUsedAt: null,
  createdAt: 1,
  updatedAt: 1,
}

describe('entrySearch', () => {
  it('matches note field', () => {
    expect(entryMatchesSearch(sample, '恢复邮箱')).toBe(true)
    expect(entryMatchesSearch(sample, '不存在')).toBe(false)
  })
})
