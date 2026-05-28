<template>
  <p class="trust-notice">
    <slot>恢复密钥仅保存在本机。PwdBook 不会上传任何数据。</slot>
  </p>
</template>

<style scoped>
.trust-notice {
  margin: 0 0 16px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--accent-subtle);
  border: 1px solid var(--border-accent);
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}
</style>
