import type { PasswordEntry } from './types'

export type LaunchEntryKind = 'program' | 'url' | 'none'

export interface LaunchEntryApi {
  openLocalProgram: (programPath: string) => Promise<void>
  /** 打开主窗口并定位到目标条目（网站条目，不再直接打开浏览器）。 */
  focusEntryInMain: (entryId: string) => void
  touchEntry: (entryId: string) => Promise<void>
}

export function resolveLaunchKind(entry: PasswordEntry): LaunchEntryKind {
  if (entry.localProgramPath?.trim()) return 'program'
  if (entry.url.trim()) return 'url'
  return 'none'
}

/**
 * 快捷条启动条目：优先本地程序；否则（网站）打开主窗口并定位条目。
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
    await api.touchEntry(entry.id)
    api.focusEntryInMain(entry.id)
    return 'url'
  }

  return 'none'
}
