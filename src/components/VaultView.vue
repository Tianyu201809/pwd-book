<script setup lang="ts">
import { Footer } from 'animal-island-vue'
import VaultSidebar from '@/components/VaultSidebar.vue'
import PasswordList from '@/components/PasswordList.vue'
import PasswordDetail from '@/components/PasswordDetail.vue'
import { useTheme } from '@/composables/useTheme'

const { isAnimalIsland } = useTheme()
</script>

<template>
  <div class="vault-view">
    <div class="vault-body">
      <VaultSidebar />
      <div class="vault-list-column">
        <PasswordList class="vault-password-list" />
        <div v-if="isAnimalIsland" class="vault-footer-tree-wrap">
          <Footer type="tree" class="vault-footer-tree" />
        </div>
      </div>
      <PasswordDetail />
    </div>
  </div>
</template>

<style scoped>
.vault-view {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.vault-body {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  display: flex;
  overflow: hidden;
}

.vault-list-column {
  flex: 1 1 0%;
  min-width: var(--list-column-min-width);
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.vault-password-list {
  flex: 1 1 auto;
  min-height: 0;
}

.vault-footer-tree-wrap {
  flex-shrink: 0;
  padding: 8px 16px 12px;
  pointer-events: none;
}

.vault-footer-tree {
  width: 100%;
  height: 44px;
  pointer-events: none;
}
</style>
