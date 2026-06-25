import { describe, expect, it } from 'vitest'
import { formatWindowsLoginCommand } from './launchAtLogin'

describe('formatWindowsLoginCommand', () => {
  it('quotes executable paths so Windows Run entries with spaces work', () => {
    expect(formatWindowsLoginCommand('C:\\Program Files\\PwdBook\\PwdBook.exe')).toBe(
      '"C:\\Program Files\\PwdBook\\PwdBook.exe"',
    )
  })

  it('quotes paths without spaces for consistent Run key formatting', () => {
    expect(formatWindowsLoginCommand('C:\\Apps\\PwdBook.exe')).toBe('"C:\\Apps\\PwdBook.exe"')
  })

  it('rejects embedded quotes in executable paths', () => {
    expect(() => formatWindowsLoginCommand('C:\\bad"path\\PwdBook.exe')).toThrow(
      'Invalid executable path for login item',
    )
  })
})
