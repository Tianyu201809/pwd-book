export type ClipboardWindowOpenResult = 'allow' | 'locked' | 'disabled'

export const CLIPBOARD_WINDOW_DEFAULT_PINNED = false
export const CLIPBOARD_WINDOW_DEFAULT_QUICK_MODE = false

export function shouldCloseClipboardWindowAfterEnterCopy(quickModeEnabled: boolean): boolean {
  return quickModeEnabled
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
