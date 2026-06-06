<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    color: string
    bg: string
    badgeSize?: number
  }>(),
  {
    badgeSize: 24,
  },
)

const badgeStyle = computed(() => ({
  width: `${props.badgeSize}px`,
  height: `${props.badgeSize}px`,
  background: props.bg,
  color: props.color,
}))
</script>

<template>
  <span class="icon-badge" :style="badgeStyle">
    <slot />
  </span>
</template>

<style scoped>
.icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 8px;
}
</style>
