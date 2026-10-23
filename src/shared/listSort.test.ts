import { describe, expect, it } from 'vitest'
import { defaultListSortDirection, sortEntriesForList, type ListSortableEntry } from './listSort'

const entries: ListSortableEntry[] = [
  { title: '香蕉', createdAt: 20, updatedAt: 20, lastUsedAt: 5 },
  { title: '苹果', createdAt: 10, updatedAt: 30, lastUsedAt: null },
  { title: '橙子', createdAt: 30, updatedAt: 10, lastUsedAt: 15 },
]

describe('sortEntriesForList', () => {
  it('uses ascending title and descending time as the existing defaults', () => {
    expect(defaultListSortDirection('title')).toBe('asc')
    expect(defaultListSortDirection('created')).toBe('desc')
    expect(defaultListSortDirection('recent')).toBe('desc')
  })

  it('sorts titles in both directions', () => {
    expect(sortEntriesForList(entries, 'title', 'asc', 'zh-CN').map((entry) => entry.title)).toEqual(['橙子', '苹果', '香蕉'])
    expect(sortEntriesForList(entries, 'title', 'desc', 'zh-CN').map((entry) => entry.title)).toEqual(['香蕉', '苹果', '橙子'])
  })

  it('sorts created time in both directions', () => {
    expect(sortEntriesForList(entries, 'created', 'asc', 'zh-CN').map((entry) => entry.title)).toEqual(['苹果', '香蕉', '橙子'])
    expect(sortEntriesForList(entries, 'created', 'desc', 'zh-CN').map((entry) => entry.title)).toEqual(['橙子', '香蕉', '苹果'])
  })

  it('sorts recent use in both directions and falls back to updated time', () => {
    expect(sortEntriesForList(entries, 'recent', 'desc', 'zh-CN').map((entry) => entry.title)).toEqual(['橙子', '香蕉', '苹果'])
    expect(sortEntriesForList(entries, 'recent', 'asc', 'zh-CN').map((entry) => entry.title)).toEqual(['苹果', '香蕉', '橙子'])
  })
})
