import { describe, expect, it } from 'vitest'
import {
  clampQuickBarRecentLimit,
  QUICK_BAR_RECENT_LIMIT_DEFAULT,
  QUICK_BAR_RECENT_LIMIT_MAX,
  QUICK_BAR_RECENT_LIMIT_MIN,
} from './quickBarLimits'

describe('clampQuickBarRecentLimit', () => {
  it('returns default for invalid values', () => {
    expect(clampQuickBarRecentLimit(undefined)).toBe(QUICK_BAR_RECENT_LIMIT_DEFAULT)
    expect(clampQuickBarRecentLimit(Number.NaN)).toBe(QUICK_BAR_RECENT_LIMIT_DEFAULT)
    expect(clampQuickBarRecentLimit('')).toBe(QUICK_BAR_RECENT_LIMIT_DEFAULT)
  })

  it('clamps to min and max', () => {
    expect(clampQuickBarRecentLimit(1)).toBe(QUICK_BAR_RECENT_LIMIT_MIN)
    expect(clampQuickBarRecentLimit(100)).toBe(QUICK_BAR_RECENT_LIMIT_MAX)
  })

  it('accepts values in range', () => {
    expect(clampQuickBarRecentLimit(5)).toBe(5)
    expect(clampQuickBarRecentLimit(12)).toBe(12)
    expect(clampQuickBarRecentLimit(20)).toBe(20)
  })
})
