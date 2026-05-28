<script setup lang="ts">
import { ref, watch } from 'vue'
import { Copy, Download } from 'lucide-vue-next'
import RecoveryTrustNotice from '@/components/recovery/RecoveryTrustNotice.vue'
import { buildRecoveryKeyFileContent } from '@/shared/utils'

const props = defineProps<{
  recoveryKey: string
  loading: boolean
  errorMessage: string
  title?: string
  subtitle?: string
}>()

const emit = defineEmits<{
  complete: []
  skip: []
  copy: []
}>()

const confirmed = ref(false)
const copyMessage = ref('')

watch(
  () => props.recoveryKey,
  () => {
    confirmed.value = false
    copyMessage.value = ''
  },
)

function saveToFile(): void {
  const blob = new Blob([buildRecoveryKeyFileContent(props.recoveryKey)], {
    type: 'text/plain;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  anchor.href = url
  anchor.download = `PwdBook-恢复密钥-${date}.txt`
  anchor.click()
  URL.revokeObjectURL(url)
}

function handleCopy(): void {
  emit('copy')
  copyMessage.value = '已复制到剪贴板'
}
</script>

<template>
  <div class="recovery-panel">
    <h2 class="panel-title">{{ title ?? '保存你的恢复密钥' }}</h2>
    <p class="panel-desc">{{ subtitle ?? '忘记主密码时，可用它重置主密码并保留数据' }}</p>
    <RecoveryTrustNotice />

    <label class="label">你的恢复密钥（仅显示一次）</label>
    <div class="key-box font-mono">{{ recoveryKey }}</div>

    <div class="action-row">
      <button type="button" class="btn-ghost action-btn" @click="handleCopy">
        <Copy :size="14" :stroke-width="1.5" />
        复制密钥
      </button>
      <button type="button" class="btn-ghost action-btn" @click="saveToFile">
        <Download :size="14" :stroke-width="1.5" />
        保存为文件
      </button>
    </div>

    <p v-if="copyMessage" class="success-text">{{ copyMessage }}</p>

    <label class="confirm-row">
      <input v-model="confirmed" type="checkbox" />
      <span>我已将恢复密钥保存在安全位置（纸质备份、密码管理器或加密 U 盘）</span>
    </label>

    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

    <button
      type="button"
      class="btn-primary submit-btn"
      :disabled="loading || !confirmed"
      @click="emit('complete')"
    >
      {{ loading ? '处理中…' : '完成并进入保险库' }}
    </button>

    <button type="button" class="skip-link" @click="emit('skip')">稍后再说（不推荐）</button>
  </div>
</template>

<style scoped>
.recovery-panel {
  width: 100%;
}

.panel-title {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
}

.panel-desc {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
}

.label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.key-box {
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  font-size: 15px;
  letter-spacing: 0.06em;
  text-align: center;
  word-break: break-all;
}

.action-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  font-size: 13px;
}

.success-text {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--status-success);
}

.confirm-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 16px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  cursor: pointer;
}

.error-text {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--status-danger);
}

.submit-btn {
  width: 100%;
  margin-top: 16px;
  padding: 12px;
}

.skip-link {
  width: 100%;
  margin-top: 12px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
}

.skip-link:hover {
  color: var(--text-secondary);
}
</style>
