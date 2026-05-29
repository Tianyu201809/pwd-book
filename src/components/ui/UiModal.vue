<script setup lang="ts">
import { Modal, Button } from 'animal-island-vue'
import { useTheme } from '@/composables/useTheme'
import { useI18n } from 'vue-i18n'

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(
  defineProps<{
    title?: string
    width?: number | string
    maskClosable?: boolean
    showFooter?: boolean
    loading?: boolean
    glow?: boolean
  }>(),
  {
    maskClosable: true,
    showFooter: true,
    loading: false,
    glow: true,
    width: 520,
  },
)

const emit = defineEmits<{
  close: []
  ok: []
}>()

const { isAnimalIsland } = useTheme()
const { t } = useI18n()

function handleClose(): void {
  open.value = false
  emit('close')
}

function handleOk(): void {
  emit('ok')
}
</script>

<template>
  <Modal
    v-if="isAnimalIsland"
    v-model:open="open"
    :title="title"
    :width="width"
    :mask-closable="maskClosable"
    :show-footer="showFooter && !$slots.footer"
    :typewriter="false"
    @close="handleClose"
    @ok="handleOk"
  >
    <slot />
    <template v-if="$slots.title" #title>
      <slot name="title" />
    </template>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
    <template v-else-if="showFooter && !$slots.footer" #footer>
      <Button @click="handleClose">{{ t('common.cancel') }}</Button>
      <Button type="primary" :loading="loading" @click="handleOk">{{ t('common.confirm') }}</Button>
    </template>
  </Modal>
  <Teleport v-else to="body">
    <div v-if="open" class="modal-overlay" @click.self="maskClosable ? handleClose() : undefined">
      <div
        class="modal-card surface-card"
        :class="{ 'panel-glow': glow }"
        :style="{ maxWidth: typeof width === 'number' ? `${width}px` : width }"
      >
        <div v-if="title || $slots.title" class="modal-header">
          <slot name="title">
            <h3>{{ title }}</h3>
          </slot>
          <button type="button" class="close-btn titlebar-no-drag" @click="handleClose">
            <slot name="close-icon" />
          </button>
        </div>
        <div class="modal-body">
          <slot />
        </div>
        <div v-if="showFooter || $slots.footer" class="modal-footer">
          <slot name="footer">
            <button type="button" class="btn-ghost" @click="handleClose">{{ t('common.cancel') }}</button>
            <button type="button" class="btn-primary" :disabled="loading" @click="handleOk">
              {{ t('common.confirm') }}
            </button>
          </slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay-stacked);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  padding: 24px;
}

.modal-card {
  width: 100%;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-default);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
}

.close-btn:hover {
  background: var(--bg-hover);
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 20px;
}
</style>
