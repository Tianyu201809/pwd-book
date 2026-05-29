<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <p class="trust-notice">
    <slot>{{ t('recovery.trustNotice') }}</slot>
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
