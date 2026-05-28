<script setup lang="ts">
import { computed } from 'vue'
import { getCategoryIcon, getCategoryIconMeta } from '@/shared/categoryIcons'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number
    badgeSize?: number
    colored?: boolean
  }>(),
  {
    size: 15,
    badgeSize: 26,
    colored: true,
  },
)

const meta = computed(() => getCategoryIconMeta(props.name))
const Icon = computed(() => getCategoryIcon(props.name))

const badgeStyle = computed(() => ({
  width: `${props.badgeSize}px`,
  height: `${props.badgeSize}px`,
  background: meta.value.bg,
  color: meta.value.color,
}))
</script>

<template>
  <span v-if="colored" class="category-icon-badge" :style="badgeStyle">
    <component :is="Icon" :size="size" :stroke-width="1.5" />
  </span>
  <component v-else :is="Icon" :size="size" :stroke-width="1.5" class="plain-icon" />
</template>

<style scoped>
.category-icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 8px;
}

.plain-icon {
  flex-shrink: 0;
}
</style>
