<script setup lang="ts">
import { computed } from 'vue'
import { Checkbox } from 'animal-island-vue'
import type { CheckboxValue } from 'animal-island-vue'
import { useTheme } from '@/composables/useTheme'

const model = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    label?: string
    disabled?: boolean
  }>(),
  {
    disabled: false,
    label: undefined,
  },
)

const { isAnimalIsland } = useTheme()

const animalModel = computed({
  get(): CheckboxValue[] {
    return model.value ? ['checked'] : []
  },
  set(values: CheckboxValue[]) {
    model.value = values.includes('checked')
  },
})

const animalOptions = computed(() => [
  { label: props.label ?? '', value: 'checked' as CheckboxValue, disabled: props.disabled },
])
</script>

<template>
  <Checkbox
    v-if="isAnimalIsland"
    v-model="animalModel"
    :options="animalOptions"
    direction="horizontal"
    size="small"
  />
  <label
    v-else
    class="ui-checkbox-classic"
  >
    <input
      v-model="model"
      type="checkbox"
      :disabled="disabled"
    >
    <span v-if="label">{{ label }}</span>
    <slot v-else />
  </label>
</template>

<style scoped>
.ui-checkbox-classic {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
