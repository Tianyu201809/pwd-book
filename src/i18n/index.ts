import { createI18n } from 'vue-i18n'
import { getLetterFromIcon, isLetterIcon } from '@/shared/categoryIcons'
import zhCN from './locales/zh-CN'
import en from './locales/en'

export const LOCALE_STORAGE_KEY = 'pwdbook-locale'

export type AppLocale = 'zh-CN' | 'en'

export const LOCALE_OPTIONS: { id: AppLocale; labelKey: string }[] = [
  { id: 'zh-CN', labelKey: 'locale.zhCN' },
  { id: 'en', labelKey: 'locale.en' },
]

const ACCENT_LABEL_KEYS: Record<string, string> = {
  brass: 'theme.accentBrass',
  teal: 'theme.accentTeal',
  indigo: 'theme.accentIndigo',
  rose: 'theme.accentRose',
  emerald: 'theme.accentEmerald',
  violet: 'theme.accentViolet',
  amber: 'theme.accentAmber',
  ocean: 'theme.accentOcean',
}

const MODE_LABEL_KEYS: Record<string, string> = {
  light: 'theme.modeLight',
  dark: 'theme.modeDark',
  system: 'theme.modeSystem',
}

const ICON_LABEL_KEYS: Record<string, string> = {
  Folder: 'icons.folder',
  Briefcase: 'icons.briefcase',
  Users: 'icons.users',
  Landmark: 'icons.landmark',
  Wallet: 'icons.wallet',
  CreditCard: 'icons.creditCard',
  Globe: 'icons.globe',
  Shield: 'icons.shield',
  Heart: 'icons.heart',
  Home: 'icons.home',
  Gamepad2: 'icons.gamepad2',
  Tag: 'icons.tag',
  ShoppingBag: 'icons.shoppingBag',
  GraduationCap: 'icons.graduationCap',
  BookOpen: 'icons.bookOpen',
  Plane: 'icons.plane',
  Car: 'icons.car',
  Smartphone: 'icons.smartphone',
  Mail: 'icons.mail',
  Music: 'icons.music',
  Camera: 'icons.camera',
  Coffee: 'icons.coffee',
  Dumbbell: 'icons.dumbbell',
  Palette: 'icons.palette',
  Code: 'icons.code',
  Cloud: 'icons.cloud',
  Building2: 'icons.building2',
  Gift: 'icons.gift',
  Star: 'icons.star',
  LayoutGrid: 'icons.layoutGrid',
  KeyRound: 'icons.keyRound',
  Lock: 'icons.lock',
  Fingerprint: 'icons.fingerprint',
  Server: 'icons.server',
  Database: 'icons.database',
  HardDrive: 'icons.hardDrive',
  Monitor: 'icons.monitor',
  Laptop: 'icons.laptop',
  Wifi: 'icons.wifi',
  Terminal: 'icons.terminal',
  MessageCircle: 'icons.messageCircle',
  Phone: 'icons.phone',
  Video: 'icons.video',
  Tv: 'icons.tv',
  Headphones: 'icons.headphones',
  Calendar: 'icons.calendar',
  MapPin: 'icons.mapPin',
  Rocket: 'icons.rocket',
  Bookmark: 'icons.bookmark',
  Banknote: 'icons.banknote',
  Store: 'icons.store',
  Wrench: 'icons.wrench',
  Link2: 'icons.link2',
  Bot: 'icons.bot',
  FileText: 'icons.fileText',
  UserCircle: 'icons.userCircle',
  Sparkles: 'icons.sparkles',
  Layers: 'icons.layers',
  Hash: 'icons.hash',
  Settings: 'icons.settings',
}

export function readStoredLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored === 'en' || stored === 'zh-CN') return stored
  } catch {
    /* ignore */
  }
  return 'zh-CN'
}

export function applyDocumentLocale(locale: AppLocale): void {
  document.documentElement.lang = locale
}

function detectDefaultLocale(): AppLocale {
  const stored = readStoredLocale()
  if (localStorage.getItem(LOCALE_STORAGE_KEY)) return stored
  const lang = navigator.language.toLowerCase()
  return lang.startsWith('zh') ? 'zh-CN' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectDefaultLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    en,
  },
})

export function translateAccentLabel(accentId: string): string {
  const key = ACCENT_LABEL_KEYS[accentId]
  return key ? i18n.global.t(key) : accentId
}

export function translateModeLabel(modeId: string): string {
  const key = MODE_LABEL_KEYS[modeId]
  return key ? i18n.global.t(key) : modeId
}

export function translateIconLabel(iconValue: string): string {
  if (isLetterIcon(iconValue)) {
    return getLetterFromIcon(iconValue)
  }
  const key = ICON_LABEL_KEYS[iconValue]
  return key ? i18n.global.t(key) : iconValue
}

export function getWipeConfirmPhrase(): string {
  return i18n.global.t('recovery.wipeConfirmPhrase')
}
