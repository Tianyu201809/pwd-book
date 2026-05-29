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
        <Footer v-if="isAnimalIsland" type="tree" class="vault-footer-tree" />
      </div>
      <PasswordDetail />
    </div>
  </div>
</template>

<style scoped>
.vault-view {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.vault-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.vault-list-column {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.vault-password-list {
  flex: 1 1 auto;
  min-height: 0;
}

.vault-footer-tree {
  flex-shrink: 0;
  pointer-events: none;
}
</style>
