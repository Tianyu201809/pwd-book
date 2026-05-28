import {
  Briefcase,
  Folder,
  Gamepad2,
  Globe,
  Heart,
  Landmark,
  Shield,
  Tag,
  Users,
} from 'lucide-vue-next'
import type { Component } from 'vue'

export const CATEGORY_ICON_OPTIONS = [
  { value: 'Folder', label: '文件夹' },
  { value: 'Briefcase', label: '工作' },
  { value: 'Users', label: '社交' },
  { value: 'Landmark', label: '金融' },
  { value: 'Globe', label: '网站' },
  { value: 'Shield', label: '安全' },
  { value: 'Heart', label: '生活' },
  { value: 'Gamepad2', label: '游戏' },
  { value: 'Tag', label: '标签' },
] as const

export const categoryIconMap: Record<string, Component> = {
  Briefcase,
  Users,
  Landmark,
  Folder,
  Tag,
  Globe,
  Shield,
  Heart,
  Gamepad2,
}

export function getCategoryIcon(name: string): Component {
  return categoryIconMap[name] ?? Folder
}
