export type ClipboardWindowOpenResult = 'allow' | 'locked' | 'disabled'

export const CLIPBOARD_WINDOW_DEFAULT_PINNED = false
export const CLIPBOARD_WINDOW_DEFAULT_QUICK_MODE = false

export function shouldCloseClipboardWindowAfterEnterCopy(quickModeEnabled: boolean): boolean {
  return quickModeEnabled
}

export function isClipboardItemDeleteKey(key: string): boolean {
  return key === 'Delete' || key === 'Backspace'
}

export function nextClipboardSelectionAfterDelete<T extends { id: string }>(
  visible: T[],
  deletedId: string,
): string | null {
  const index = visible.findIndex((item) => item.id === deletedId)
  if (index < 0) return visible[0]?.id ?? null
  return visible[index + 1]?.id ?? visible[index - 1]?.id ?? null
}

export function resolveClipboardWindowOpen(
  unlocked: boolean,
  clipboardEnabled: boolean,
): ClipboardWindowOpenResult {
  if (!unlocked) return 'locked'
  if (!clipboardEnabled) return 'disabled'
  return 'allow'
}

export function shouldHideClipboardWindowOnBlur(): boolean {
  return false
}
