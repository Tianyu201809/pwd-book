<script setup lang="ts">
import { computed } from 'vue'
import { getCategoryIcon, getCategoryIconMeta, getLetterFromIcon, isLetterIcon } from '@/shared/categoryIcons'

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
const letter = computed(() => (isLetterIcon(props.name) ? getLetterFromIcon(props.name) : ''))
const letterFontSize = computed(() => Math.max(10, Math.round(props.size * 0.92)))

const badgeStyle = computed(() => ({
  width: `${props.badgeSize}px`,
  height: `${props.badgeSize}px`,
  background: meta.value.bg,
  color: meta.value.color,
}))
</script>

<template>
  <span v-if="colored" class="category-icon-badge" :style="badgeStyle">
    <span v-if="letter" class="letter-icon" :style="{ fontSize: `${letterFontSize}px` }">{{ letter }}</span>
    <component v-else :is="Icon" :size="size" :stroke-width="1.5" />
  </span>
  <span v-else-if="letter" class="plain-letter" :style="{ fontSize: `${letterFontSize}px`, color: meta.color }">
    {{ letter }}
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

.letter-icon,
.plain-letter {
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  user-select: none;
}

.plain-icon {
  flex-shrink: 0;
}
</style>
