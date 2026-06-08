export type TrayLocale = 'zh-CN' | 'en'

export interface TrayLabels {
  showMain: string
  quickSearch: string
  quit: string
}

const LABELS: Record<TrayLocale, TrayLabels> = {
  'zh-CN': {
    showMain: '显示主窗口',
    quickSearch: '快捷搜索',
    quit: '退出 PwdBook',
  },
  en: {
    showMain: 'Show main window',
    quickSearch: 'Quick search',
    quit: 'Quit PwdBook',
  },
}

export function getTrayLabels(locale: TrayLocale): TrayLabels {
  return LABELS[locale] ?? LABELS['zh-CN']
}

export const UI_LOCALE_SETTING_KEY = 'ui_locale'
