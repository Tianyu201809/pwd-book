import { describe, expect, it } from 'vitest'
import { formatClipboardTimestamp } from './clipboardTimestamp'

describe('formatClipboardTimestamp', () => {
  it('includes the full local date and time', () => {
    const timestamp = new Date(2026, 8, 30, 16, 59, 23).getTime()
    const result = formatClipboardTimestamp(timestamp, 'zh-CN')

    expect(result).toContain('2026')
    expect(result).toContain('09')
    expect(result).toContain('30')
    expect(result).toContain('16')
    expect(result).toContain('59')
    expect(result).toContain('23')
  })
})
