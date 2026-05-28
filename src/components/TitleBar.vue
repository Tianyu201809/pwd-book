<script setup lang="ts">
import { ref } from 'vue'
import { ShieldCheck, Minus, Square, X } from 'lucide-vue-next'

const showCloseDialog = ref(false)

function minimize(): void {
  window.electronAPI?.minimize()
}

function maximize(): void {
  window.electronAPI?.maximize()
}

function openCloseDialog(): void {
  showCloseDialog.value = true
}

function dismissCloseDialog(): void {
  showCloseDialog.value = false
}

function minimizeFromDialog(): void {
  showCloseDialog.value = false
  minimize()
}

function quitApp(): void {
  showCloseDialog.value = false
  window.electronAPI?.close()
}
</script>

<template>
  <header class="titlebar titlebar-drag">
    <div class="titlebar-left">
      <ShieldCheck class="icon-accent titlebar-no-drag" :size="14" :stroke-width="1.5" />
      <span class="title">PwdBook</span>
    </div>
    <div class="titlebar-actions titlebar-no-drag">
      <button type="button" class="win-btn" aria-label="最小化" @click="minimize">
        <Minus :size="14" :stroke-width="1.5" />
      </button>
      <button type="button" class="win-btn" aria-label="最大化" @click="maximize">
        <Square :size="12" :stroke-width="1.5" />
      </button>
      <button type="button" class="win-btn close-btn" aria-label="关闭" @click="openCloseDialog">
        <X :size="14" :stroke-width="1.5" />
      </button>
    </div>
  </header>

  <Teleport to="body">
    <div v-if="showCloseDialog" class="close-dialog-overlay" @click.self="dismissCloseDialog">
      <div class="close-dialog surface-card">
        <h3 class="dialog-title">关闭 PwdBook</h3>
        <p class="dialog-desc">请选择要执行的操作</p>
        <div class="dialog-actions">
          <button type="button" class="btn-ghost dialog-btn" @click="dismissCloseDialog">
            取消
          </button>
          <button type="button" class="btn-ghost dialog-btn" @click="minimizeFromDialog">
            最小化
          </button>
          <button type="button" class="btn-primary dialog-btn" @click="quitApp">退出程序</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.titlebar {
  height: var(--titlebar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-accent {
  color: var(--accent-primary);
}

.title {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.titlebar-actions {
  display: flex;
  gap: 4px;
}

.win-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.win-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.close-btn:hover {
  background: var(--status-danger);
  color: #fff;
}

.close-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
}

.close-dialog {
  width: min(360px, calc(100vw - 48px));
  padding: 24px;
}

.dialog-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}

.dialog-desc {
  margin: 0 0 20px;
  font-size: 14px;
  color: var(--text-secondary);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.dialog-btn {
  padding: 8px 16px;
  font-size: 13px;
}
</style>
