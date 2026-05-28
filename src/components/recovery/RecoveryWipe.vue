<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  entryCount: number
  loading: boolean
  errorMessage: string
  mode: 'info' | 'confirm'
}>()

const emit = defineEmits<{
  back: []
  continue: []
  confirm: []
}>()

const confirmText = ref('')
const CONFIRM_PHRASE = '删除我的数据'

function submitConfirm(): void {
  if (confirmText.value.trim() === CONFIRM_PHRASE) {
    emit('confirm')
  }
}
</script>

<template>
  <div class="recovery-panel">
    <button type="button" class="back-link" @click="emit('back')">← 返回</button>

    <template v-if="mode === 'info'">
      <h2 class="panel-title">清除保险库</h2>
      <div class="danger-box">
        <p class="danger-title">危险操作</p>
        <p class="danger-desc">
          此操作将永久删除本机所有密码条目（共 {{ entryCount }} 条）及主密码设置。此操作不可撤销。
        </p>
        <p class="danger-hint">若您曾导出 JSON 备份，可先尝试从备份恢复。</p>
      </div>
      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
      <button type="button" class="btn-ghost danger-btn" @click="emit('continue')">
        我已了解，继续
      </button>
    </template>

    <template v-else>
      <h2 class="panel-title">最终确认</h2>
      <p class="panel-desc">请输入以下文字以确认：</p>
      <p class="confirm-phrase">{{ CONFIRM_PHRASE }}</p>
      <input
        v-model="confirmText"
        class="input-field"
        placeholder="输入确认文字"
        :disabled="loading"
        @keydown.enter="submitConfirm"
      />
      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
      <button
        type="button"
        class="btn-primary danger-submit"
        :disabled="loading || confirmText.trim() !== CONFIRM_PHRASE"
        @click="submitConfirm"
      >
        {{ loading ? '清除中…' : '清除并重置保险库' }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.recovery-panel {
  width: 100%;
}

.back-link {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 20px;
}

.panel-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
}

.panel-desc {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.danger-box {
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.06);
  margin-bottom: 16px;
}

.danger-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--status-danger);
}

.danger-desc,
.danger-hint {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.danger-hint {
  margin-bottom: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.confirm-phrase {
  margin: 0 0 12px;
  padding: 10px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  background: var(--accent-subtle);
  color: var(--accent-primary);
}

.input-field {
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
}

.error-text {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--status-danger);
}

.danger-btn {
  width: 100%;
  padding: 12px;
  color: var(--status-danger);
}

.danger-submit {
  width: 100%;
  margin-top: 16px;
  padding: 12px;
  background: var(--status-danger);
}

.danger-submit:disabled {
  opacity: 0.5;
}
</style>
