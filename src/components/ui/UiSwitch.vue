<script setup lang="ts">
import { Switch } from 'animal-island-vue'
import { useTheme } from '@/composables/useTheme'

const model = defineModel<boolean>({ default: false })

withDefaults(
  defineProps<{
    disabled?: boolean
    loading?: boolean
    size?: 'small' | 'default'
  }>(),
  {
    disabled: false,
    loading: false,
    size: 'default',
  },
)

const { isAnimalIsland } = useTheme()
</script>

<template>
  <Switch
    v-if="isAnimalIsland"
    v-model="model"
    :disabled="disabled"
    :loading="loading"
    :size="size"
  >
    <template v-if="$slots.checked" #checked>
      <slot name="checked" />
    </template>
    <template v-if="$slots.unchecked" #unchecked>
      <slot name="unchecked" />
    </template>
  </Switch>
  <label v-else class="ui-toggle">
    <input v-model="model" type="checkbox" class="ui-toggle-input" :disabled="disabled" />
    <span class="ui-toggle-track" :class="{ on: model }" />
  </label>
</template>

<style scoped>
.ui-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.ui-toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.ui-toggle-track {
  width: 40px;
  height: 22px;
  border-radius: 99px;
  background: var(--toggle-off);
  transition: background 0.2s;
  position: relative;
}

.ui-toggle-track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--toggle-knob);
  transition: transform 0.2s;
}

.ui-toggle-track.on {
  background: var(--accent-primary);
}

.ui-toggle-track.on::after {
  transform: translateX(18px);
}
</style>
