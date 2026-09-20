import { describe, expect, it } from 'vitest'
import { applyClipboardFavoriteFlags, toggleClipboardFavorite } from './clipboardFavorites'

interface TestItem {
  id: string
  content: string
  favorite: boolean
}

function item(id: string, favorite = false): TestItem {
  return { id, content: `content-${id}`, favorite }
}

describe('clipboard favorites', () => {
  it('adds an independent favorite copy and marks the history item', () => {
    const history = [item('a')]
    const favorites = toggleClipboardFavorite([], history[0])

    expect(favorites).toEqual([item('a', true)])
    expect(history).toEqual([item('a')])
    expect(applyClipboardFavoriteFlags(history, favorites)).toEqual([item('a', true)])
  })

  it('keeps favorites when history is cleared', () => {
    const favorites = toggleClipboardFavorite([], item('a'))

    expect(applyClipboardFavoriteFlags([], favorites)).toEqual([])
    expect(favorites).toEqual([item('a', true)])
  })

  it('removes only the favorite copy when toggled again', () => {
    const favorites = toggleClipboardFavorite([], item('a'))

    expect(toggleClipboardFavorite(favorites, item('a', true))).toEqual([])
  })
})
