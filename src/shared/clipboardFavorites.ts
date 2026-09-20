export interface ClipboardFavoriteEntry {
  id: string
  favorite: boolean
}

export function applyClipboardFavoriteFlags<T extends ClipboardFavoriteEntry>(
  history: readonly T[],
  favorites: readonly Pick<T, 'id'>[],
): T[] {
  const favoriteIds = new Set(favorites.map((item) => item.id))
  return history.map((item) => ({ ...item, favorite: favoriteIds.has(item.id) }))
}

export function toggleClipboardFavorite<T extends ClipboardFavoriteEntry>(
  favorites: readonly T[],
  item: T,
): T[] {
  if (favorites.some((entry) => entry.id === item.id)) {
    return favorites.filter((entry) => entry.id !== item.id)
  }
  return [{ ...item, favorite: true }, ...favorites]
}
