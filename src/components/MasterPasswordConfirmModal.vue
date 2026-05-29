<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { X } from 'lucide-vue-next'
import { UiModal, UiInput, UiButton, UiCheckbox } from '@/components/ui'

const open = defineModel<boolean>('open', { default: false })

defineProps<{
  title: string
  description: string
  confirmLabel: string
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  confirm: [password: string]
}>()

const { t } = useI18n()
const password = ref('')
const showPassword = ref(false)

function handleClose(): void {
  password.value = ''
  open.value = false
  emit('close')
}

function handleConfirm(): void {
  if (!password.value.trim()) return
  emit('confirm', password.value)
}

function resetPassword(): void {
  password.value = ''
}
defineExpose({ resetPassword })
</script>

<template>
  <UiModal v-model:open="open" :title="title" :width="400" :show-footer="false" @close="handleClose">
    <template #title>
      <div class="modal-header-row">
        <h3>{{ title }}</h3>
        <button type="button" class="close-btn titlebar-no-drag" @click="handleClose">
          <X :size="16" :stroke-width="1.5" />
        </button>
      </div>
    </template>
    <p class="modal-desc">{{ description }}</p>
    <UiInput
      v-model="password"
      :type="showPassword ? 'text' : 'password'"
      :placeholder="t('tools.emailBackup.masterPasswordPlaceholder')"
      @keydown.enter="handleConfirm"
    />
    <UiCheckbox v-model="showPassword" :label="t('tools.emailBackup.showPassword')" class="show-row" />
    <div class="modal-actions">
      <UiButton variant="ghost" class="modal-btn" @click="handleClose">{{ t('common.cancel') }}</UiButton>
      <UiButton
        variant="primary"
        class="modal-btn"
        :disabled="loading || !password.trim()"
        :loading="loading"
        @click="handleConfirm"
      >
        {{ confirmLabel }}
      </UiButton>
    </div>
  </UiModal>
</template>

<style scoped>
.modal-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.modal-header-row h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
}

.close-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.modal-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.show-row {
  margin: 12px 0 20px;
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.modal-btn {
  flex: 1;
}
</style>
