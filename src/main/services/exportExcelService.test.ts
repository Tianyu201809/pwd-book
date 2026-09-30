import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { buildExcelBuffer } from './exportExcelService'
import type { ExportPayload, PasswordEntry } from '../../shared/types'

function makeEntry(id: string, categoryId: string, categoryName: string): PasswordEntry {
  return {
    id,
    title: id,
    url: `https://${id}.example.com`,
    username: `${id}-user`,
    password: `${id}-secret`,
    note: '',
    tags: [],
    categoryId,
    categoryName,
    isFavorite: false,
    displayIcon: '',
    localProgramPath: '',
    totpSecret: '',
    customFields: [],
    attachmentCount: 0,
    lastUsedAt: null,
    createdAt: 1,
    updatedAt: 2,
  }
}

describe('buildExcelBuffer', () => {
  it('exports only selected entries and their recalculated categories', () => {
    const payload: ExportPayload = {
      exportedAt: '2026-09-30T00:00:00.000Z',
      categories: [
        { id: 'work', name: 'Work', icon: 'Folder', sortOrder: 1, createdAt: 1, entryCount: 2 },
        { id: 'home', name: 'Home', icon: 'Home', sortOrder: 2, createdAt: 1, entryCount: 1 },
      ],
      entries: [
        makeEntry('one', 'work', 'Work'),
        makeEntry('two', 'home', 'Home'),
        makeEntry('three', 'work', 'Work'),
      ],
    }

    const workbook = XLSX.read(buildExcelBuffer(payload, ['three']))
    const entryRows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets['密码条目'], { header: 1 })
    const categoryRows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets['分类'], { header: 1 })

    expect(entryRows).toHaveLength(2)
    expect(entryRows[1]?.[0]).toBe('three')
    expect(categoryRows).toHaveLength(2)
    expect(categoryRows[1]).toMatchObject(['work', 'Work', 'Folder', 1, 1])
  })
})
