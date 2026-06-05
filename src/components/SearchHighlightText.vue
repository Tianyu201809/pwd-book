<script setup lang="ts">
import { computed } from 'vue'
import { splitHighlightSegments } from '@/shared/searchMatch'

const props = defineProps<{
  text: string
  query: string
}>()

const segments = computed(() => splitHighlightSegments(props.text, props.query))
</script>

<template>
  <span class="search-highlight-text">
    <template v-for="(segment, index) in segments" :key="index">
      <mark v-if="segment.highlight" class="search-highlight">{{ segment.text }}</mark>
      <template v-else>{{ segment.text }}</template>
    </template>
  </span>
</template>

<style scoped>
.search-highlight-text {
  display: inline;
}

.search-highlight {
  background: var(--accent-subtle);
  color: var(--accent-primary);
  border-radius: 2px;
  padding: 0 1px;
  font-weight: 600;
}
</style>
