<script setup lang="ts">
import {
  Plus,
  LayoutGrid,
  Star,
  Briefcase,
  Users,
  Landmark,
  Folder,
  Tag,
  Globe,
  Shield,
  Heart,
  Gamepad2,
  Settings,
  Lock,
} from 'lucide-vue-next'
import CategoryManagePanel from '@/components/CategoryManagePanel.vue'
import { useAppState } from '@/composables/useAppState'
import type { FilterCategory } from '@/types'

const { categories, selectedCategory, selectCategory, navigateTo, lock, startCreateEntry } =
  useAppState()

const iconMap = {
  LayoutGrid,
  Star,
  Briefcase,
  Users,
  Landmark,
  Folder,
  Tag,
  Globe,
  Shield,
  Heart,
  Gamepad2,
} as const

function getIcon(name: string) {
  return iconMap[name as keyof typeof iconMap] ?? Folder
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-top">
      <button type="button" class="btn-primary new-btn" @click="startCreateEntry">
        <Plus :size="16" :stroke-width="1.5" />
        新建条目
      </button>
    </div>

    <nav class="sidebar-nav">
      <button
        v-for="cat in categories"
        :key="cat.id"
        type="button"
        class="nav-item"
        :class="{ active: selectedCategory === cat.id }"
        @click="selectCategory(cat.id as FilterCategory)"
      >
        <component :is="getIcon(cat.icon)" :size="16" :stroke-width="1.5" />
        {{ cat.label }}
        <span class="count" :class="{ active: selectedCategory === cat.id }">{{ cat.count }}</span>
      </button>
    </nav>

    <CategoryManagePanel />

    <div class="sidebar-bottom">
      <button type="button" class="nav-item" @click="navigateTo('settings')">
        <Settings :size="16" :stroke-width="1.5" />
        设置
      </button>
      <button type="button" class="nav-item lock-btn" @click="lock">
        <Lock :size="16" :stroke-width="1.5" />
        锁定
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border-right: 1px solid var(--border-default);
}

.sidebar-top {
  padding: 16px;
}

.new-btn {
  width: 100%;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
}

.sidebar-nav {
  flex: 1;
  padding: 0 12px;
  overflow-y: auto;
}

.count {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
}

.count.active {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-muted);
  color: var(--accent-primary);
}

.sidebar-bottom {
  padding: 12px;
  border-top: 1px solid var(--border-default);
}

.lock-btn:hover {
  color: var(--status-danger);
}
</style>
