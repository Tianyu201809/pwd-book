<script setup lang="ts">
import { computed } from 'vue'
import { Select } from 'animal-island-vue'
import type { SelectOption } from 'animal-island-vue'
import { useTheme } from '@/composables/useTheme'

const model = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{
    options: { value: string | number; label: string }[]
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    placeholder: '',
    disabled: false,
  },
)

const { isAnimalIsland } = useTheme()

const animalOptions = computed<SelectOption[]>(() =>
  props.options.map((o) => ({
    key: String(o.value),
    label: o.label,
  })),
)

function onClassicChange(event: Event): void {
  model.value = (event.target as HTMLSelectElement).value
}
</script>

<template>
  <Select
    v-if="isAnimalIsland"
    v-model="model"
    :options="animalOptions"
    :placeholder="placeholder"
    :disabled="disabled"
  />
  <select
    v-else
    :value="model"
    class="input-field ui-select-classic"
    :class="$attrs.class"
    :disabled="disabled"
    @change="onClassicChange"
  >
    <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
    <option v-for="opt in options" :key="String(opt.value)" :value="String(opt.value)">
      {{ opt.label }}
    </option>
  </select>
</template>

<style scoped>
.ui-select-classic {
  cursor: pointer;
  padding: 8px 12px;
}
</style>
