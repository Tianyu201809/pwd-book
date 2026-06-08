import { evaluatePasswordStrength } from './passwordGenerator'
import type { PasswordEntry } from './types'

export type PasswordHealthIssueType = 'weak' | 'duplicate'

export interface PasswordHealthIssue {
  entryId: string
  title: string
  type: PasswordHealthIssueType
  detailKey: 'weak' | 'duplicate'
  duplicateGroupId?: string
}

export interface PasswordHealthReport {
  totalEntries: number
  weakCount: number
  duplicateEntryCount: number
  duplicateGroupCount: number
  issues: PasswordHealthIssue[]
}

export function analyzePasswordHealth(entries: PasswordEntry[]): PasswordHealthReport {
  const issues: PasswordHealthIssue[] = []
  const passwordGroups = new Map<string, PasswordEntry[]>()

  for (const entry of entries) {
    if (!entry.password) continue

    const strength = evaluatePasswordStrength(entry.password)
    if (strength.level <= 1) {
      issues.push({
        entryId: entry.id,
        title: entry.title,
        type: 'weak',
        detailKey: 'weak',
      })
    }

    const key = entry.password
    const group = passwordGroups.get(key) ?? []
    group.push(entry)
    passwordGroups.set(key, group)
  }

  let duplicateGroupCount = 0
  let duplicateEntryCount = 0

  for (const [password, group] of passwordGroups) {
    if (group.length < 2 || !password) continue
    duplicateGroupCount += 1
    duplicateEntryCount += group.length
    const groupId = `dup-${duplicateGroupCount}`
    for (const entry of group) {
      issues.push({
        entryId: entry.id,
        title: entry.title,
        type: 'duplicate',
        detailKey: 'duplicate',
        duplicateGroupId: groupId,
      })
    }
  }

  return {
    totalEntries: entries.length,
    weakCount: issues.filter((item) => item.type === 'weak').length,
    duplicateEntryCount,
    duplicateGroupCount,
    issues,
  }
}
