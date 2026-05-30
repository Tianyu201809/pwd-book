<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
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
  <div v-if="isAnimalIsland" class="ui-animal-select" :class="attrs.class">
    <Select
      v-model="model"
      :options="animalOptions"
      :placeholder="placeholder"
      :disabled="disabled"
    />
  </div>
  <select
    v-else
    :value="model"
    class="input-field ui-select-classic"
    :class="attrs.class"
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
  width: 100%;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  padding: 10px 36px 10px 12px;
  background-color: var(--input-bg);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238a8b9a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
}

/*
 * animal-island-vue Select opens dropdown beside trigger (left/right: 100%).
 * In right-aligned form rows this drifts to the screen edge — force below trigger.
 */
.ui-animal-select {
  position: relative;
  display: inline-block;
  min-width: 120px;
  max-width: 100%;
}

.ui-animal-select :deep(.animal-select) {
  position: relative;
  width: 100%;
}

.ui-animal-select :deep(.animal-select__dropdown) {
  left: 0 !important;
  right: auto !important;
  top: 100% !important;
  bottom: auto !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  margin-top: 6px !important;
  margin-bottom: 0 !important;
  transform: none !important;
  min-width: 100%;
  z-index: 200;
}
</style>
