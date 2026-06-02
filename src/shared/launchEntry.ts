import { buildUrlWithCredentialParams, normalizeExternalUrl } from './utils'
import type { PasswordEntry } from './types'

export type LaunchEntryKind = 'program' | 'url' | 'none'

export interface LaunchEntryApi {
  openLocalProgram: (programPath: string) => Promise<void>
  openExternal: (url: string) => Promise<void>
  touchEntry: (entryId: string) => Promise<void>
}

export function resolveLaunchKind(entry: PasswordEntry): LaunchEntryKind {
  if (entry.localProgramPath?.trim()) return 'program'
  if (entry.url.trim()) return 'url'
  return 'none'
}

/** 优先本地程序，否则打开网址。 */
export async function launchEntry(
  entry: PasswordEntry,
  options: { openUrlWithCredentials: boolean },
  api: LaunchEntryApi,
): Promise<LaunchEntryKind> {
  const programPath = entry.localProgramPath?.trim() ?? ''
  if (programPath) {
    await api.openLocalProgram(programPath)
    await api.touchEntry(entry.id)
    return 'program'
  }

  if (entry.url.trim()) {
    const target = options.openUrlWithCredentials
      ? buildUrlWithCredentialParams(entry.url, entry.username ?? '', entry.password ?? '')
      : normalizeExternalUrl(entry.url)
    await api.openExternal(target)
    await api.touchEntry(entry.id)
    return 'url'
  }

  return 'none'
}
