<script setup lang="ts">
import { Tabs } from 'animal-island-vue'
import type { TabItem } from 'animal-island-vue'
import { useTheme } from '@/composables/useTheme'

const model = defineModel<string>()

defineProps<{
  items: TabItem[]
}>()

const { isAnimalIsland } = useTheme()
</script>

<template>
  <Tabs v-if="isAnimalIsland" v-model="model" :items="items">
    <template v-for="item in items" :key="item.key" #[item.key]>
      <slot :name="item.key" :item="item" />
    </template>
  </Tabs>
  <div v-else class="ui-tabs-classic">
    <div class="ui-tabs-nav">
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        class="ui-tab-btn"
        :class="{ active: model === item.key }"
        @click="model = item.key"
      >
        {{ item.label }}
      </button>
    </div>
    <div class="ui-tabs-content">
      <template v-for="item in items" :key="item.key">
        <div v-show="model === item.key">
          <slot :name="item.key" :item="item" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ui-tabs-nav {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border-default);
  margin-bottom: 16px;
}

.ui-tab-btn {
  padding: 8px 14px;
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.ui-tab-btn.active {
  color: var(--accent-primary);
  border-bottom-color: var(--accent-primary);
  font-weight: 600;
}
</style>
