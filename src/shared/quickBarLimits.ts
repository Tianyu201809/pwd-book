/** 快捷条「最近打开 / 搜索结果」条数下限（亦为默认值） */
export const QUICK_BAR_RECENT_LIMIT_MIN = 5
/** 快捷条「最近打开 / 搜索结果」条数上限 */
export const QUICK_BAR_RECENT_LIMIT_MAX = 20
/** 默认条数（与历史写死行为一致） */
export const QUICK_BAR_RECENT_LIMIT_DEFAULT = QUICK_BAR_RECENT_LIMIT_MIN

/** 列表可视区域最大高度（约 7 行），超出滚动，窗口不再无限增高 */
export const QUICK_BAR_RESULTS_MAX_HEIGHT_PX = 320

export function clampQuickBarRecentLimit(value: unknown): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return QUICK_BAR_RECENT_LIMIT_DEFAULT
  return Math.min(QUICK_BAR_RECENT_LIMIT_MAX, Math.max(QUICK_BAR_RECENT_LIMIT_MIN, n))
}
