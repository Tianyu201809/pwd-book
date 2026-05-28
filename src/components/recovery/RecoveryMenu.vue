<script setup lang="ts">
import { KeyRound, FileJson, AlertTriangle } from 'lucide-vue-next'

defineProps<{
  entryCount: number
}>()

const emit = defineEmits<{
  back: []
  recoveryKey: []
  backup: []
  wipe: []
}>()
</script>

<template>
  <div class="recovery-panel">
    <button type="button" class="back-link" @click="emit('back')">← 返回解锁</button>
    <h2 class="panel-title">无法解锁？</h2>
    <p class="panel-desc">请选择适合你的情况</p>

    <button type="button" class="option-card" @click="emit('recoveryKey')">
      <KeyRound :size="20" :stroke-width="1.5" class="option-icon" />
      <div>
        <p class="option-title">我记得恢复密钥</p>
        <p class="option-desc">输入恢复密钥，设置新的主密码</p>
      </div>
    </button>

    <button type="button" class="option-card" @click="emit('backup')">
      <FileJson :size="20" :stroke-width="1.5" class="option-icon" />
      <div>
        <p class="option-title">我有 JSON 备份</p>
        <p class="option-desc">从备份文件恢复（需知道备份时的主密码）</p>
      </div>
    </button>

    <button type="button" class="option-card danger" @click="emit('wipe')">
      <AlertTriangle :size="20" :stroke-width="1.5" class="option-icon danger-icon" />
      <div>
        <p class="option-title">我什么都没有</p>
        <p class="option-desc">清除全部数据并重新开始（共 {{ entryCount }} 条）</p>
      </div>
    </button>
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

.back-link:hover {
  color: var(--text-primary);
}

.panel-title {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 600;
}

.panel-desc {
  margin: 0 0 20px;
  font-size: 14px;
  color: var(--text-secondary);
}

.option-card {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 16px;
  margin-bottom: 10px;
  border: 1px solid var(--border-default);
  border-radius: 12px;
  background: var(--bg-elevated);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s, background-color 0.2s;
}

.option-card:hover {
  border-color: var(--border-accent);
  background: var(--bg-hover);
}

.option-card.danger:hover {
  border-color: rgba(248, 113, 113, 0.4);
}

.option-icon {
  color: var(--accent-primary);
  flex-shrink: 0;
  margin-top: 2px;
}

.danger-icon {
  color: var(--status-danger);
}

.option-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 500;
}

.option-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
