import {
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  Car,
  Cloud,
  Code,
  Coffee,
  CreditCard,
  Dumbbell,
  Folder,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Landmark,
  LayoutGrid,
  Mail,
  Music,
  Palette,
  Plane,
  Shield,
  ShoppingBag,
  Smartphone,
  Star,
  Tag,
  Users,
  Wallet,
} from 'lucide-vue-next'
import type { Component } from 'vue'

export interface CategoryIconMeta {
  value: string
  label: string
  color: string
  bg: string
}

export const CATEGORY_ICON_OPTIONS: CategoryIconMeta[] = [
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
]

export const CATEGORY_ICON_VALUES = CATEGORY_ICON_OPTIONS.map((option) => option.value)

const categoryIconMap: Record<string, Component> = {
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  Car,
  Cloud,
  Code,
  Coffee,
  CreditCard,
  Dumbbell,
  Folder,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Landmark,
  LayoutGrid,
  Mail,
  Music,
  Palette,
  Plane,
  Shield,
  ShoppingBag,
  Smartphone,
  Star,
  Tag,
  Users,
  Wallet,
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
