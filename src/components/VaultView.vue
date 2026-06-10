<script setup lang="ts">
import { Footer } from 'animal-island-vue'
import VaultSidebar from '@/components/VaultSidebar.vue'
import PasswordList from '@/components/PasswordList.vue'
import PasswordDetail from '@/components/PasswordDetail.vue'
import { useTheme } from '@/composables/useTheme'
import { useAppState } from '@/composables/useAppState'

const { isAnimalIsland } = useTheme()
const { detachedDetailOpen } = useAppState()
</script>

<template>
  <div class="vault-view">
    <div class="vault-body">
      <VaultSidebar />
      <div class="vault-list-column">
        <PasswordList class="vault-password-list" />
        <div
          v-if="isAnimalIsland"
          class="vault-footer-tree-wrap"
        >
          <Footer
            type="tree"
            class="vault-footer-tree"
          />
        </div>
      </div>
      <div
        class="vault-detail-slot"
        :class="{ 'is-detached': detachedDetailOpen }"
      >
        <PasswordDetail />
      </div>
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
  position: relative;
  z-index: 1;
  flex: 1 1 0%;
  min-width: var(--list-column-min-width);
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.vault-detail-slot {
  position: relative;
  z-index: 2;
  flex-shrink: 0;
  display: flex;
  align-self: stretch;
  min-height: 0;
}

.vault-detail-slot.is-detached {
  flex: 0 0 0;
  width: 0;
  min-width: 0;
  max-width: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
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
