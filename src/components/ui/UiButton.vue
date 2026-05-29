<script setup lang="ts">
import { computed } from 'vue'
import { Button } from 'animal-island-vue'
import type { ButtonHTMLType } from 'animal-island-vue'
import { useTheme } from '@/composables/useTheme'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost' | 'text' | 'dashed' | 'danger'
    block?: boolean
    loading?: boolean
    disabled?: boolean
    htmlType?: ButtonHTMLType
    size?: 'small' | 'middle' | 'large'
  }>(),
  {
    variant: 'primary',
    block: false,
    loading: false,
    disabled: false,
    htmlType: 'button',
    size: 'middle',
  },
)

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const { isAnimalIsland } = useTheme()

const animalType = computed(() => {
  if (props.variant === 'primary' || props.variant === 'danger') return 'primary'
  if (props.variant === 'ghost') return 'default'
  if (props.variant === 'dashed') return 'dashed'
  if (props.variant === 'text') return 'text'
  return 'default'
})

const classicClass = computed(() => {
  if (props.variant === 'primary' || props.variant === 'danger') return 'btn-primary'
  return 'btn-ghost'
})

const classicBtnClass = computed(() => [
  'ui-classic-btn',
  classicClass.value,
  props.block ? 'ui-classic-btn--block' : null,
])
</script>

<template>
  <Button
    v-if="isAnimalIsland"
    :type="animalType"
    :size="size"
    :danger="variant === 'danger'"
    :block="block"
    :loading="loading"
    :disabled="disabled"
    :html-type="htmlType"
    @click="emit('click', $event)"
  >
    <template v-if="$slots.icon" #icon>
      <slot name="icon" />
    </template>
    <slot />
  </Button>
  <button
    v-else
    :type="htmlType"
    :class="[classicBtnClass, $attrs.class]"
    :disabled="disabled || loading"
    @click="emit('click', $event)"
  >
    <slot name="icon" />
    <slot />
  </button>
</template>
