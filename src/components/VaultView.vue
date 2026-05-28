<script setup lang="ts">
import VaultSidebar from '@/components/VaultSidebar.vue'
import PasswordList from '@/components/PasswordList.vue'
import PasswordDetail from '@/components/PasswordDetail.vue'
</script>

<template>
  <div class="vault-view">
    <div class="vault-body">
      <VaultSidebar />
      <PasswordList />
      <PasswordDetail />
    </div>
  </div>
</template>

<style scoped>
.vault-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.vault-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
</style>
