export type ClipboardWindowOpenResult = 'allow' | 'locked' | 'disabled'

export const CLIPBOARD_WINDOW_DEFAULT_PINNED = false

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
