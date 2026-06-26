import type { AppScreen, SettingsTab } from './types'

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center'

export type TourPrepareAction =
  | 'expand-utilities'
  | 'expand-toolbox'
  | 'expand-manage'
  | 'collapse-footer-menus'
  | 'expand-tag-filter'
  | 'collapse-list-menus'
  | 'expand-detail'
  | 'select-first-entry'

export interface ProductTourStep {
  id: string
  /** `[data-tour="…"]` selector; empty = centered card, full dim */
  target: string
  /** When `target` is missing from DOM (e.g. empty vault) */
  fallbackTarget?: string
  titleKey: string
  bodyKey: string
  /** 聚光灯相对目标的位置（仅 spotlight 模式） */
  placement?: TourPlacement
  /** 引导卡片位置；全屏级目标请用 `center` */
  cardPlacement?: TourPlacement
  /**
   * - spotlight：单目标聚光灯（默认）
   * - backdrop：整屏遮罩 + 居中卡片（全视窗目标）
   * - columns：三栏分栏示意（快速认识第 2 步）
   */
  highlight?: 'spotlight' | 'backdrop' | 'columns'
  padding?: number
  screen?: AppScreen
  settingsTab?: SettingsTab
  prepare?: TourPrepareAction[]
}

export interface ProductTourDefinition {
  id: string
  titleKey: string
  descKey: string
  durationKey: string
  /** Lucide icon name key in tour catalog */
  icon: 'compass' | 'folder' | 'key' | 'wrench' | 'panel-top' | 'settings'
  accent: string
  steps: ProductTourStep[]
  requiresUnlock?: boolean
}

export const TOUR_PREPARE_EVENT = 'pwdbook-tour-prepare' as const

export const TOUR_COMPLETED_STORAGE_PREFIX = 'pwdbook-tour-done-' as const
