<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getCategoryIcon, getCategoryIconMeta, getLetterFromIcon, isLetterIcon } from '@/shared/categoryIcons'
import { parsePresetIconId } from '@/shared/presetIcons'
import { getPresetIconUrl } from '@/shared/presetIconAssets'

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
const presetUrl = computed(() => {
  const id = parsePresetIconId(props.name)
  return id ? getPresetIconUrl(id) : undefined
})
const presetFailed = ref(false)
watch(presetUrl, () => {
  presetFailed.value = false
})

const badgeStyle = computed(() => {
  if (presetUrl.value && !presetFailed.value) {
    return {
      width: `${props.badgeSize}px`,
      height: `${props.badgeSize}px`,
      background: 'var(--bg-elevated)',
      color: 'var(--text-secondary)',
    }
  }
  return {
    width: `${props.badgeSize}px`,
    height: `${props.badgeSize}px`,
    background: meta.value.bg,
    color: meta.value.color,
  }
})
</script>

<template>
  <span
    v-if="colored"
    class="category-icon-badge"
    :style="badgeStyle"
  >
    <img
      v-if="presetUrl && !presetFailed"
      :src="presetUrl"
      alt=""
      class="preset-icon"
      @error="presetFailed = true"
    >
    <span
      v-else-if="letter"
      class="letter-icon"
      :style="{ fontSize: `${letterFontSize}px` }"
    >{{ letter }}</span>
    <component
      :is="Icon"
      v-else
      :size="size"
      :stroke-width="1.5"
    />
  </span>
  <img
    v-else-if="presetUrl && !presetFailed"
    :src="presetUrl"
    alt=""
    class="preset-icon"
    @error="presetFailed = true"
  >
  <span
    v-else-if="letter"
    class="plain-letter"
    :style="{ fontSize: `${letterFontSize}px`, color: meta.color }"
  >
    {{ letter }}
  </span>
  <component
    :is="Icon"
    v-else
    :size="size"
    :stroke-width="1.5"
    class="plain-icon"
  />
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

.preset-icon {
  width: 72%;
  height: 72%;
  object-fit: contain;
  pointer-events: none;
}
</style>
