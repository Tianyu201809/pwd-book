import type { PasswordEntry } from './types'

export type LaunchEntryKind = 'program' | 'url' | 'focus'

export interface LaunchEntryApi {
  openLocalProgram: (programPath: string) => Promise<void>
  openExternal: (url: string) => Promise<void>
  /** 打开主窗口并定位到目标条目（无程序且无网址时）。 */
  focusEntryInMain: (entryId: string) => void
  touchEntry: (entryId: string) => Promise<void>
}

function normalizeLaunchUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function resolveLaunchKind(entry: PasswordEntry): LaunchEntryKind {
  if (entry.localProgramPath?.trim()) return 'program'
  if (entry.url.trim()) return 'url'
  return 'focus'
}

/**
 * 快捷条启动条目：优先本地程序，其次打开网址，否则打开主窗口并定位该条目。
 */
export async function launchEntry(
  entry: PasswordEntry,
  api: LaunchEntryApi,
): Promise<LaunchEntryKind> {
  const programPath = entry.localProgramPath?.trim() ?? ''
  if (programPath) {
    await api.openLocalProgram(programPath)
    await api.touchEntry(entry.id)
    return 'program'
  }

  if (entry.url.trim()) {
    await api.openExternal(normalizeLaunchUrl(entry.url))
    await api.touchEntry(entry.id)
    return 'url'
  }

  await api.touchEntry(entry.id)
  api.focusEntryInMain(entry.id)
  return 'focus'
}
