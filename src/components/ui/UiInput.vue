<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { useI18n } from 'vue-i18n'
import { X } from 'lucide-vue-next'
import { Input } from 'animal-island-vue'
import { useTheme } from '@/composables/useTheme'

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: '' })

const props = withDefaults(
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

const { t } = useI18n()
const { isAnimalIsland } = useTheme()
const attrs = useAttrs()

const passthroughAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

const showClear = computed(
  () => props.allowClear && !props.disabled && !props.readonly && model.value.length > 0,
)

function clearInput(): void {
  model.value = ''
}
</script>

<template>
  <Input
    v-if="isAnimalIsland"
    v-model="model"
    :class="$attrs.class"
    :style="$attrs.style"
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
  <div
    v-else
    class="ui-input-classic-wrap"
    :class="[$attrs.class, { 'ui-input-classic-wrap--has-clear': showClear }]"
    :style="$attrs.style"
  >
    <input
      v-model="model"
      v-bind="passthroughAttrs"
      :type="type"
      class="input-field"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :maxlength="maxlength"
      @keydown="emit('keydown', $event)"
    />
    <button
      v-if="showClear"
      type="button"
      class="ui-input-clear"
      :title="t('common.clear')"
      :aria-label="t('common.clear')"
      @click="clearInput"
    >
      <X :size="14" :stroke-width="1.5" />
    </button>
  </div>
</template>

<style scoped>
.ui-input-classic-wrap {
  position: relative;
  width: 100%;
  min-width: 0;
}

.ui-input-classic-wrap .input-field {
  width: 100%;
  box-sizing: border-box;
}

.ui-input-classic-wrap--has-clear .input-field {
  padding-right: 36px;
}

.ui-input-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
}

.ui-input-clear:hover {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

.ui-input-clear:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 1px;
}
</style>
