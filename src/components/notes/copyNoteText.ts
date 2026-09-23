import { formatNotePlainText } from '@/shared/noteBlocks'
import type { NoteContent } from '@/shared/types'

export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    if (window.electronAPI?.copySecret) {
      await window.electronAPI.copySecret(text, 0)
      return true
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    return false
  } catch {
    return false
  }
}

export function copyFormattedNote(note: { title: string; content: NoteContent }): Promise<boolean> {
  return writeClipboardText(formatNotePlainText(note))
}
