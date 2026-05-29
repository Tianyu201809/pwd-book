<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { X } from 'lucide-vue-next'

defineProps<{
  open: boolean
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
  <Teleport to="body">
    <div v-if="open" class="modal-overlay" @click.self="handleClose">
      <div class="modal-card panel-glow surface-card">
        <div class="modal-header">
          <h3>{{ title }}</h3>
          <button type="button" class="close-btn" @click="handleClose">
            <X :size="16" :stroke-width="1.5" />
          </button>
        </div>
        <p class="modal-desc">{{ description }}</p>
        <input
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          class="input-field"
          :placeholder="t('tools.emailBackup.masterPasswordPlaceholder')"
          @keydown.enter="handleConfirm"
        />
        <label class="show-row">
          <input v-model="showPassword" type="checkbox" />
          <span>{{ t('tools.emailBackup.showPassword') }}</span>
        </label>
        <div class="modal-actions">
          <button type="button" class="btn-ghost modal-btn" @click="handleClose">
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="btn-primary modal-btn"
            :disabled="loading || !password.trim()"
            @click="handleConfirm"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  padding: 24px;
}

.modal-card {
  width: 100%;
  max-width: 400px;
  padding: 24px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.modal-header h3 {
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
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0 20px;
  font-size: 13px;
  color: var(--text-secondary);
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.modal-btn {
  flex: 1;
  padding: 10px 16px;
  font-size: 14px;
}
</style>
