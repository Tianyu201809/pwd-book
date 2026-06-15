<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, ChevronRight, FolderOpen, RefreshCw } from 'lucide-vue-next'
import { useAppState } from '@/composables/useAppState'

const { navigateTo, openWifiSync, openFolderSync, loadSyncState } = useAppState()
const { t } = useI18n()

onMounted(() => {
  void loadSyncState()
})

function goBack(): void {
  navigateTo('settings', 'data')
}
</script>

<template>
  <div class="tool-page-view sync-hub-view">
    <div class="tool-page-body">
      <aside class="tool-page-sidebar">
        <button
          type="button"
          class="tool-back-btn"
          @click="goBack"
        >
          <ArrowLeft
            :size="16"
            :stroke-width="1.5"
          />
          {{ t('tools.syncHub.backToSettings') }}
        </button>

        <div class="tool-sidebar-hero">
          <div class="tool-hero-icon tool-hero-icon--sync">
            <RefreshCw
              :size="22"
              :stroke-width="1.5"
            />
          </div>
          <h2 class="tool-sidebar-title font-display">
            {{ t('tools.syncHub.title') }}
          </h2>
          <p class="tool-sidebar-desc">
            {{ t('tools.syncHub.subtitle') }}
          </p>
        </div>
      </aside>

      <main class="tool-page-main sync-hub-main">
        <div class="sync-hub-content">
          <p class="sync-hub-kicker">
            {{ t('tools.syncHub.chooseMethod') }}
          </p>

          <button
            type="button"
            class="sync-method-card sync-method-card--wifi"
            @click="openWifiSync"
          >
            <div class="sync-method-card__icon">
              <RefreshCw
                :size="22"
                :stroke-width="1.5"
              />
            </div>
            <div class="sync-method-card__body">
              <div class="sync-method-card__head">
                <h3>{{ t('tools.syncHub.wifiTitle') }}</h3>
                <span class="sync-method-badge">{{ t('tools.syncHub.wifiBadge') }}</span>
              </div>
              <p>{{ t('tools.syncHub.wifiDesc') }}</p>
            </div>
            <ChevronRight
              class="sync-method-card__arrow"
              :size="18"
              :stroke-width="1.5"
            />
          </button>

          <button
            type="button"
            class="sync-method-card sync-method-card--folder"
            @click="openFolderSync"
          >
            <div class="sync-method-card__icon">
              <FolderOpen
                :size="22"
                :stroke-width="1.5"
              />
            </div>
            <div class="sync-method-card__body">
              <div class="sync-method-card__head">
                <h3>{{ t('tools.syncHub.folderTitle') }}</h3>
                <span class="sync-method-badge sync-method-badge--folder">{{ t('tools.syncHub.folderBadge') }}</span>
              </div>
              <p>{{ t('tools.syncHub.folderDesc') }}</p>
            </div>
            <ChevronRight
              class="sync-method-card__arrow"
              :size="18"
              :stroke-width="1.5"
            />
          </button>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.tool-sidebar-hero {
  margin-top: 8px;
}

.sync-hub-main {
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.sync-hub-content {
  width: min(100%, 560px);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sync-hub-kicker {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.sync-method-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
  padding: 18px 18px 18px 16px;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  text-align: left;
  cursor: pointer;
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
}

.sync-method-card:hover {
  transform: translateY(-1px);
  border-color: var(--border-strong);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.08);
}

.sync-method-card--wifi:hover {
  border-color: rgba(96, 165, 250, 0.45);
}

.sync-method-card--folder:hover {
  border-color: rgba(251, 191, 36, 0.45);
}

.sync-method-card__icon {
  flex-shrink: 0;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sync-method-card--wifi .sync-method-card__icon {
  background: rgba(96, 165, 250, 0.12);
  color: #60a5fa;
}

.sync-method-card--folder .sync-method-card__icon {
  background: rgba(251, 191, 36, 0.12);
  color: #d97706;
}

.sync-method-card__body {
  flex: 1;
  min-width: 0;
}

.sync-method-card__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}

.sync-method-card__head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.sync-method-badge {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.12);
  color: #60a5fa;
}

.sync-method-badge--folder {
  background: rgba(251, 191, 36, 0.14);
  color: #b45309;
}

.sync-method-card__body p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.sync-method-card__arrow {
  flex-shrink: 0;
  margin-top: 4px;
  color: var(--text-secondary);
}
</style>
