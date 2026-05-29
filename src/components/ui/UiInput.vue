<script setup lang="ts">
import { Input } from 'animal-island-vue'
import { useTheme } from '@/composables/useTheme'

const model = defineModel<string>({ default: '' })

withDefaults(
  defineProps<{
    type?: string
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    status?: 'error' | 'warning'
    allowClear?: boolean
    size?: 'small' | 'middle' | 'large'
    maxlength?: number
  }>(),
  {
    type: 'text',
    allowClear: false,
    size: 'middle',
  },
)

const emit = defineEmits<{
  keydown: [event: KeyboardEvent]
}>()

const { isAnimalIsland } = useTheme()
</script>

<template>
  <Input
    v-if="isAnimalIsland"
    v-model="model"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :status="status"
    :allow-clear="allowClear"
    :size="size"
    :maxlength="maxlength"
    @keydown="emit('keydown', $event)"
  >
    <template v-if="$slots.prefix" #prefix>
      <slot name="prefix" />
    </template>
    <template v-if="$slots.suffix" #suffix>
      <slot name="suffix" />
    </template>
  </Input>
  <input
    v-else
    v-model="model"
    :type="type"
    class="input-field"
    :class="$attrs.class"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :maxlength="maxlength"
    @keydown="emit('keydown', $event)"
  />
</template>
