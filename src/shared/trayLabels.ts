export type TrayLocale = 'zh-CN' | 'en'

export interface TrayLabels {
  showMain: string
  quickSearch: string
  clipboard: string
  notes: string
  settings: string
  quit: string
}

export type TrayMenuAction = 'showMain' | 'quickSearch' | 'clipboard' | 'notes' | 'settings' | 'quit'

/** 右键托盘菜单的顺序。快捷搜索仅在悬浮条开启时出现。 */
export function trayMenuActions(quickBarEnabled: boolean): Array<TrayMenuAction | 'separator'> {
  return [
    'showMain',
    ...(quickBarEnabled ? (['quickSearch'] as const) : []),
    'clipboard',
    'notes',
    'settings',
    'separator',
    'quit',
  ]
}

const LABELS: Record<TrayLocale, TrayLabels> = {
  'zh-CN': {
    showMain: '显示主窗口',
    quickSearch: '快捷搜索',
    clipboard: '打开剪切板',
    notes: '打开便签',
    settings: '设置',
    quit: '退出 PwdBook',
  },
  en: {
    showMain: 'Show main window',
    quickSearch: 'Quick search',
    clipboard: 'Open clipboard',
    notes: 'Open notes',
    settings: 'Settings',
    quit: 'Quit PwdBook',
  },
}

export function getTrayLabels(locale: TrayLocale): TrayLabels {
  return LABELS[locale] ?? LABELS['zh-CN']
}

export const UI_LOCALE_SETTING_KEY = 'ui_locale'
