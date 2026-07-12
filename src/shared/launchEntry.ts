import type { PasswordEntry } from './types'

export type LaunchEntryKind = 'program' | 'focus'

export interface LaunchEntryApi {
  openLocalProgram: (programPath: string) => Promise<void>
  /** 打开主窗口并定位到目标条目（无本地程序时）。 */
  focusEntryInMain: (entryId: string) => void
  touchEntry: (entryId: string) => Promise<void>
}

export function resolveLaunchKind(entry: PasswordEntry): LaunchEntryKind {
  if (entry.localProgramPath?.trim()) return 'program'
  return 'focus'
}

/**
 * 快捷条启动条目：有本地程序则启动；否则打开主窗口并定位该条目
 *（含仅网址、或网址与程序均未填写的情况）。
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

  await api.touchEntry(entry.id)
  api.focusEntryInMain(entry.id)
  return 'focus'
}
