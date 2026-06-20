import {
  Banknote,
  BookOpen,
  Bookmark,
  Bot,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Car,
  Cloud,
  Code,
  Coffee,
  CreditCard,
  Database,
  Dumbbell,
  FileText,
  Fingerprint,
  Folder,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  HardDrive,
  Hash,
  Headphones,
  Heart,
  Home,
  KeyRound,
  Landmark,
  Laptop,
  Layers,
  LayoutGrid,
  Link2,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Monitor,
  Music,
  Palette,
  Paperclip,
  Phone,
  Plane,
  Rocket,
  Server,
  Settings,
  Shield,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Tag,
  Terminal,
  Tv,
  UserCircle,
  Users,
  Video,
  Wallet,
  Wifi,
  Wrench,
} from 'lucide-vue-next'
import type { Component } from 'vue'

export interface CategoryIconMeta {
  value: string
  label: string
  color: string
  bg: string
}

const LETTER_ICON_PALETTE: { color: string; bg: string }[] = [
  { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.14)' },
  { color: '#ea580c', bg: 'rgba(234, 88, 12, 0.14)' },
  { color: '#ca8a04', bg: 'rgba(202, 138, 4, 0.14)' },
  { color: '#eab308', bg: 'rgba(234, 179, 8, 0.16)' },
  { color: '#16a34a', bg: 'rgba(22, 163, 74, 0.14)' },
  { color: '#059669', bg: 'rgba(5, 150, 105, 0.14)' },
  { color: '#0d9488', bg: 'rgba(13, 148, 136, 0.14)' },
  { color: '#0891b2', bg: 'rgba(8, 145, 178, 0.14)' },
  { color: '#0284c7', bg: 'rgba(2, 132, 199, 0.14)' },
  { color: '#2563eb', bg: 'rgba(37, 99, 235, 0.14)' },
  { color: '#4338ca', bg: 'rgba(67, 56, 202, 0.14)' },
  { color: '#4f46e5', bg: 'rgba(79, 70, 229, 0.14)' },
  { color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.14)' },
  { color: '#9333ea', bg: 'rgba(147, 51, 234, 0.14)' },
  { color: '#c026d3', bg: 'rgba(192, 38, 211, 0.14)' },
  { color: '#db2777', bg: 'rgba(219, 39, 119, 0.14)' },
  { color: '#e11d48', bg: 'rgba(225, 29, 72, 0.14)' },
  { color: '#be185d', bg: 'rgba(190, 24, 93, 0.14)' },
  { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.14)' },
  { color: '#64748b', bg: 'rgba(100, 116, 139, 0.14)' },
  { color: '#475569', bg: 'rgba(71, 85, 105, 0.14)' },
  { color: '#57534e', bg: 'rgba(87, 83, 78, 0.14)' },
  { color: '#334155', bg: 'rgba(51, 65, 85, 0.14)' },
  { color: '#1d4ed8', bg: 'rgba(29, 78, 216, 0.14)' },
  { color: '#15803d', bg: 'rgba(21, 128, 61, 0.14)' },
  { color: '#d97706', bg: 'rgba(217, 119, 6, 0.14)' },
]

export const LETTER_ICON_OPTIONS: CategoryIconMeta[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  .split('')
  .map((letter, index) => {
    const palette = LETTER_ICON_PALETTE[index]!
    return {
      value: `Letter${letter}`,
      label: letter,
      color: palette.color,
      bg: palette.bg,
    }
  })

export function isLetterIcon(name: string): boolean {
  return /^Letter[A-Z]$/.test(name)
}

export function getLetterFromIcon(name: string): string {
  return name.slice('Letter'.length)
}

export const BASE_CATEGORY_ICON_OPTIONS: CategoryIconMeta[] = [
  { value: 'Folder', label: '文件夹', color: '#64748b', bg: 'rgba(100, 116, 139, 0.14)' },
  { value: 'Briefcase', label: '工作', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.14)' },
  { value: 'Users', label: '社交', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.14)' },
  { value: 'Landmark', label: '金融', color: '#ca8a04', bg: 'rgba(202, 138, 4, 0.14)' },
  { value: 'Wallet', label: '钱包', color: '#d97706', bg: 'rgba(217, 119, 6, 0.14)' },
  { value: 'CreditCard', label: '支付', color: '#0891b2', bg: 'rgba(8, 145, 178, 0.14)' },
  { value: 'Globe', label: '网站', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.14)' },
  { value: 'Shield', label: '安全', color: '#059669', bg: 'rgba(5, 150, 105, 0.14)' },
  { value: 'Heart', label: '生活', color: '#e11d48', bg: 'rgba(225, 29, 72, 0.14)' },
  { value: 'Home', label: '家庭', color: '#f97316', bg: 'rgba(249, 115, 22, 0.14)' },
  { value: 'Gamepad2', label: '游戏', color: '#9333ea', bg: 'rgba(147, 51, 234, 0.14)' },
  { value: 'Tag', label: '标签', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.14)' },
  { value: 'ShoppingBag', label: '购物', color: '#db2777', bg: 'rgba(219, 39, 119, 0.14)' },
  { value: 'GraduationCap', label: '学习', color: '#4f46e5', bg: 'rgba(79, 70, 229, 0.14)' },
  { value: 'BookOpen', label: '阅读', color: '#0d9488', bg: 'rgba(13, 148, 136, 0.14)' },
  { value: 'Plane', label: '旅行', color: '#0369a1', bg: 'rgba(3, 105, 161, 0.14)' },
  { value: 'Car', label: '交通', color: '#475569', bg: 'rgba(71, 85, 105, 0.14)' },
  { value: 'Smartphone', label: '手机', color: '#334155', bg: 'rgba(51, 65, 85, 0.14)' },
  { value: 'Mail', label: '邮箱', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.14)' },
  { value: 'Music', label: '音乐', color: '#c026d3', bg: 'rgba(192, 38, 211, 0.14)' },
  { value: 'Camera', label: '摄影', color: '#be185d', bg: 'rgba(190, 24, 93, 0.14)' },
  { value: 'Coffee', label: '餐饮', color: '#92400e', bg: 'rgba(146, 64, 14, 0.14)' },
  { value: 'Dumbbell', label: '健康', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.14)' },
  { value: 'Palette', label: '设计', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.14)' },
  { value: 'Code', label: '开发', color: '#1d4ed8', bg: 'rgba(29, 78, 216, 0.14)' },
  { value: 'Cloud', label: '云服务', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.16)' },
  { value: 'Building2', label: '企业', color: '#57534e', bg: 'rgba(87, 83, 78, 0.14)' },
  { value: 'Gift', label: '礼物', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.14)' },
  { value: 'Star', label: '星标', color: '#eab308', bg: 'rgba(234, 179, 8, 0.16)' },
  { value: 'LayoutGrid', label: '全部', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.14)' },
  { value: 'Paperclip', label: '附件', color: '#0f766e', bg: 'rgba(15, 118, 110, 0.14)' },
  { value: 'KeyRound', label: '密钥', color: '#b45309', bg: 'rgba(180, 83, 9, 0.14)' },
  { value: 'Lock', label: '锁定', color: '#a16207', bg: 'rgba(161, 98, 7, 0.14)' },
  { value: 'Fingerprint', label: '生物识别', color: '#0f766e', bg: 'rgba(15, 118, 110, 0.14)' },
  { value: 'Server', label: '服务器', color: '#4338ca', bg: 'rgba(67, 56, 202, 0.14)' },
  { value: 'Database', label: '数据库', color: '#155e75', bg: 'rgba(21, 94, 117, 0.14)' },
  { value: 'HardDrive', label: '存储', color: '#52525b', bg: 'rgba(82, 82, 91, 0.14)' },
  { value: 'Monitor', label: '电脑', color: '#1e40af', bg: 'rgba(30, 64, 175, 0.14)' },
  { value: 'Laptop', label: '笔记本', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.14)' },
  { value: 'Wifi', label: '网络', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.14)' },
  { value: 'Terminal', label: '终端', color: '#374151', bg: 'rgba(55, 65, 81, 0.14)' },
  { value: 'MessageCircle', label: '聊天', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.14)' },
  { value: 'Phone', label: '电话', color: '#059669', bg: 'rgba(5, 150, 105, 0.14)' },
  { value: 'Video', label: '视频', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.14)' },
  { value: 'Tv', label: '流媒体', color: '#7e22ce', bg: 'rgba(126, 34, 206, 0.14)' },
  { value: 'Headphones', label: '音频', color: '#9333ea', bg: 'rgba(147, 51, 234, 0.14)' },
  { value: 'Calendar', label: '日历', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.14)' },
  { value: 'MapPin', label: '位置', color: '#e11d48', bg: 'rgba(225, 29, 72, 0.14)' },
  { value: 'Rocket', label: '创业', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.14)' },
  { value: 'Bookmark', label: '书签', color: '#0891b2', bg: 'rgba(8, 145, 178, 0.14)' },
  { value: 'Banknote', label: '现金', color: '#15803d', bg: 'rgba(21, 128, 61, 0.14)' },
  { value: 'Store', label: '商店', color: '#db2777', bg: 'rgba(219, 39, 119, 0.14)' },
  { value: 'Wrench', label: '工具', color: '#64748b', bg: 'rgba(100, 116, 139, 0.14)' },
  { value: 'Link2', label: '链接', color: '#0369a1', bg: 'rgba(3, 105, 161, 0.14)' },
  { value: 'Bot', label: 'AI', color: '#4f46e5', bg: 'rgba(79, 70, 229, 0.14)' },
  { value: 'FileText', label: '文档', color: '#57534e', bg: 'rgba(87, 83, 78, 0.14)' },
  { value: 'UserCircle', label: '账户', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.14)' },
  { value: 'Sparkles', label: '精选', color: '#ca8a04', bg: 'rgba(202, 138, 4, 0.14)' },
  { value: 'Layers', label: '分层', color: '#0d9488', bg: 'rgba(13, 148, 136, 0.14)' },
  { value: 'Hash', label: '话题', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.14)' },
  { value: 'Settings', label: '设置', color: '#475569', bg: 'rgba(71, 85, 105, 0.14)' },
]

export const CATEGORY_ICON_OPTIONS: CategoryIconMeta[] = [
  ...BASE_CATEGORY_ICON_OPTIONS,
  ...LETTER_ICON_OPTIONS,
]

export const CATEGORY_ICON_VALUES = CATEGORY_ICON_OPTIONS.map((option) => option.value)

const categoryIconMap: Record<string, Component> = {
  Banknote,
  BookOpen,
  Bookmark,
  Bot,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Car,
  Cloud,
  Code,
  Coffee,
  CreditCard,
  Database,
  Dumbbell,
  FileText,
  Fingerprint,
  Folder,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  HardDrive,
  Hash,
  Headphones,
  Heart,
  Home,
  KeyRound,
  Landmark,
  Laptop,
  Layers,
  LayoutGrid,
  Link2,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Monitor,
  Music,
  Palette,
  Paperclip,
  Phone,
  Plane,
  Rocket,
  Server,
  Settings,
  Shield,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Tag,
  Terminal,
  Tv,
  UserCircle,
  Users,
  Video,
  Wallet,
  Wifi,
  Wrench,
}

const categoryIconMetaMap = Object.fromEntries(
  CATEGORY_ICON_OPTIONS.map((option) => [option.value, option]),
) as Record<string, CategoryIconMeta>

const DEFAULT_ICON_META: CategoryIconMeta = {
  value: 'Folder',
  label: '文件夹',
  color: '#64748b',
  bg: 'rgba(100, 116, 139, 0.14)',
}

export function getCategoryIcon(name: string): Component {
  return categoryIconMap[name] ?? Folder
}

export function getCategoryIconMeta(name: string): CategoryIconMeta {
  return categoryIconMetaMap[name] ?? DEFAULT_ICON_META
}
