<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Server,
  Smartphone,
  Wifi,
} from 'lucide-vue-next'
import MasterPasswordConfirmModal from '@/components/MasterPasswordConfirmModal.vue'
import SyncTutorialPanel from '@/components/sync/SyncTutorialPanel.vue'
import { UiButton, UiInput } from '@/components/ui'
import { useAppState } from '@/composables/useAppState'
import { showToast } from '@/composables/useToast'
import { parseErrorMessage } from '@/shared/utils'
import type { WifiSyncDiscoveredServer } from '@/shared/syncTypes'

const {
  navigateTo,
  wifiSyncServerStatus,
  loadWifiSyncState,
  startWifiSyncServer,
  stopWifiSyncServer,
  refreshWifiSyncPairing,
  regenerateWifiSyncAccessPassword,
  discoverWifiSyncServers,
  pullWifiSyncMerge,
  pullWifiSyncMergeQr,
} = useAppState()

const { t } = useI18n()

const mode = ref<'server' | 'client'>('server')
const serverLoading = ref(false)
const discoverLoading = ref(false)
const syncLoading = ref(false)
const discoveredServers = ref<WifiSyncDiscoveredServer[]>([])
const pairingInfo = ref<Awaited<ReturnType<typeof refreshWifiSyncPairing>> | null>(null)
const selectedServer = ref<WifiSyncDiscoveredServer | null>(null)
const clientAccessPassword = ref('')
const qrPayload = ref('')
const showMasterModal = ref(false)
const masterModalRef = ref<InstanceType<typeof MasterPasswordConfirmModal> | null>(null)
const pendingAction = ref<'client' | 'qr' | null>(null)

let refreshTimer: ReturnType<typeof setInterval> | null = null

const serverRunning = computed(() => wifiSyncServerStatus.value.running)

const lastPublishedText = computed(() => {
  const at = wifiSyncServerStatus.value.lastPublishedAt
  if (!at) return t('tools.wifiSync.neverPublished')
  return new Date(at).toLocaleString()
})

async function refreshState(): Promise<void> {
  await loadWifiSyncState()
  if (serverRunning.value) {
    pairingInfo.value = await refreshWifiSyncPairing()
  } else {
    pairingInfo.value = null
  }
}

onMounted(async () => {
  await refreshState()
  refreshTimer = setInterval(() => {
    if (serverRunning.value) {
      void refreshState()
    }
  }, 30_000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

function goBack(): void {
  navigateTo('settings', 'data')
}

async function toggleServer(): Promise<void> {
  serverLoading.value = true
  try {
    if (serverRunning.value) {
      await stopWifiSyncServer()
      pairingInfo.value = null
    } else {
      await startWifiSyncServer()
      pairingInfo.value = await refreshWifiSyncPairing()
    }
    await refreshState()
    showToast(
      serverRunning.value ? t('tools.wifiSync.serverStarted') : t('tools.wifiSync.serverStopped'),
      'success',
    )
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  } finally {
    serverLoading.value = false
  }
}

async function handleRegeneratePassword(): Promise<void> {
  try {
    await regenerateWifiSyncAccessPassword()
    if (serverRunning.value) {
      pairingInfo.value = await refreshWifiSyncPairing()
    }
    await refreshState()
    showToast(t('tools.wifiSync.passwordRegenerated'), 'success')
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  }
}

async function handleDiscover(): Promise<void> {
  discoverLoading.value = true
  try {
    discoveredServers.value = await discoverWifiSyncServers()
    if (discoveredServers.value.length === 0) {
      showToast(t('tools.wifiSync.noServersFound'), 'success')
    }
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  } finally {
    discoverLoading.value = false
  }
}

function selectServer(server: WifiSyncDiscoveredServer): void {
  selectedServer.value = server
}

function openClientSync(): void {
  if (!selectedServer.value) {
    showToast(t('tools.wifiSync.selectServerFirst'), 'success')
    return
  }
  pendingAction.value = 'client'
  showMasterModal.value = true
}

function openQrSync(): void {
  if (!qrPayload.value.trim()) {
    showToast(t('tools.wifiSync.qrRequired'), 'success')
    return
  }
  pendingAction.value = 'qr'
  showMasterModal.value = true
}

async function confirmSync(masterPassword: string): Promise<void> {
  syncLoading.value = true
  try {
    if (pendingAction.value === 'qr') {
      const result = await pullWifiSyncMergeQr(qrPayload.value.trim(), masterPassword)
      showToast(
        t('tools.wifiSync.syncSuccess', {
          added: result.added,
          updated: result.updated,
        }),
        'success',
      )
    } else if (pendingAction.value === 'client' && selectedServer.value) {
      if (!clientAccessPassword.value.trim()) {
        showToast(t('tools.wifiSync.accessPasswordRequired'), 'success')
        return
      }
      const result = await pullWifiSyncMerge({
        host: selectedServer.value.host,
        port: selectedServer.value.port,
        accessPassword: clientAccessPassword.value.trim(),
        certificateFingerprint: selectedServer.value.fingerprint,
        masterPassword,
      })
      showToast(
        t('tools.wifiSync.syncSuccess', {
          added: result.added,
          updated: result.updated,
        }),
        'success',
      )
    }
    masterModalRef.value?.resetPassword()
    showMasterModal.value = false
    pendingAction.value = null
    await refreshState()
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  } finally {
    syncLoading.value = false
  }
}
</script>

<template>
  <div class="tool-page-view">
    <div class="tool-page-body">
      <aside class="tool-page-sidebar">
        <button type="button" class="tool-back-btn" @click="goBack">
          <ArrowLeft :size="16" :stroke-width="1.5" />
          {{ t('settings.backToSettings') }}
        </button>

        <div class="tool-sidebar-hero">
          <div class="tool-hero-icon tool-hero-icon--wifi">
            <Wifi :size="22" :stroke-width="1.5" />
          </div>
          <h2 class="tool-sidebar-title font-display">{{ t('settings.sync') }}</h2>
          <p class="tool-sidebar-desc">{{ t('tools.wifiSync.subtitle') }}</p>
        </div>

        <nav class="sync-mode-nav">
          <button
            type="button"
            class="sync-mode-tab"
            :class="{ active: mode === 'server' }"
            @click="mode = 'server'"
          >
            <Server :size="16" :stroke-width="1.5" />
            {{ t('tools.wifiSync.serverMode') }}
          </button>
          <button
            type="button"
            class="sync-mode-tab"
            :class="{ active: mode === 'client' }"
            @click="mode = 'client'"
          >
            <Smartphone :size="16" :stroke-width="1.5" />
            {{ t('tools.wifiSync.clientMode') }}
          </button>
        </nav>
      </aside>

      <main class="tool-page-main">
        <div class="tool-page-content">
          <SyncTutorialPanel />

          <section v-if="mode === 'server'" class="panel-glow surface-card sync-panel">
            <UiButton
              class="sync-primary-btn"
              :variant="serverRunning ? 'default' : 'primary'"
              :disabled="serverLoading"
              @click="toggleServer"
            >
              <Loader2 v-if="serverLoading" :size="16" class="spin" />
              {{ serverRunning ? t('tools.wifiSync.stopServer') : t('tools.wifiSync.startServer') }}
            </UiButton>

            <p v-if="!serverRunning" class="sync-hint">{{ t('tools.wifiSync.serverCardDesc') }}</p>

            <template v-else>
              <div class="pairing-card">
                <div class="pairing-row">
                  <span class="pairing-label">{{ t('tools.wifiSync.host') }}</span>
                  <code>{{ wifiSyncServerStatus.host }}:{{ wifiSyncServerStatus.port }}</code>
                </div>
                <div class="pairing-row pairing-row--highlight">
                  <span class="pairing-label">{{ t('tools.wifiSync.verificationCode') }}</span>
                  <code class="verification">{{ wifiSyncServerStatus.verificationCode }}</code>
                </div>
                <div class="pairing-row">
                  <span class="pairing-label">{{ t('tools.wifiSync.accessPassword') }}</span>
                  <code>{{ wifiSyncServerStatus.accessPassword }}</code>
                </div>
              </div>

              <UiButton variant="ghost" size="small" @click="handleRegeneratePassword">
                {{ t('tools.wifiSync.regeneratePassword') }}
              </UiButton>

              <details class="sync-details">
                <summary>{{ t('tools.wifiSync.advancedDetails') }}</summary>
                <div class="sync-details-body">
                  <div class="pairing-row">
                    <span class="pairing-label">{{ t('tools.wifiSync.fingerprint') }}</span>
                    <code>{{ wifiSyncServerStatus.certificateFingerprint }}</code>
                  </div>
                  <div class="pairing-row">
                    <span class="pairing-label">{{ t('tools.wifiSync.lastPublished') }}</span>
                    <span>{{ lastPublishedText }}</span>
                  </div>
                </div>
              </details>

              <details v-if="pairingInfo" class="sync-details">
                <summary>{{ t('tools.wifiSync.qrPayloadTitle') }}</summary>
                <div class="sync-details-body">
                  <p class="sync-hint">{{ t('tools.wifiSync.qrPayloadHint') }}</p>
                  <textarea class="qr-payload" readonly :value="pairingInfo.qrPayload" rows="3" />
                </div>
              </details>
            </template>
          </section>

          <section v-else class="panel-glow surface-card sync-panel">
            <UiButton
              class="sync-primary-btn"
              variant="default"
              :disabled="discoverLoading"
              @click="handleDiscover"
            >
              <Loader2 v-if="discoverLoading" :size="16" class="spin" />
              <RefreshCw v-else :size="16" :stroke-width="1.5" />
              {{ t('tools.wifiSync.discover') }}
            </UiButton>

            <ul v-if="discoveredServers.length" class="server-list">
              <li v-for="server in discoveredServers" :key="`${server.host}:${server.port}`">
                <button
                  type="button"
                  class="server-item"
                  :class="{ selected: selectedServer?.host === server.host && selectedServer?.port === server.port }"
                  @click="selectServer(server)"
                >
                  <strong>{{ server.name }}</strong>
                  <span>{{ server.host }}:{{ server.port }}</span>
                </button>
              </li>
            </ul>

            <p v-else class="sync-hint">{{ t('tools.wifiSync.clientCardDesc') }}</p>

            <UiInput
              v-model="clientAccessPassword"
              :placeholder="t('tools.wifiSync.accessPasswordPlaceholder')"
            />

            <UiButton
              variant="primary"
              :disabled="syncLoading || !selectedServer"
              @click="openClientSync"
            >
              {{ t('tools.wifiSync.syncNow') }}
            </UiButton>

            <details class="sync-details">
              <summary>{{ t('tools.wifiSync.manualPairing') }}</summary>
              <div class="sync-details-body">
                <UiInput v-model="qrPayload" :placeholder="t('tools.wifiSync.scanQrPlaceholder')" />
                <UiButton variant="default" size="small" :disabled="syncLoading" @click="openQrSync">
                  {{ t('tools.wifiSync.syncFromQr') }}
                </UiButton>
              </div>
            </details>
          </section>
        </div>
      </main>
    </div>

    <MasterPasswordConfirmModal
      ref="masterModalRef"
      v-model:open="showMasterModal"
      :title="t('tools.wifiSync.masterPasswordTitle')"
      :description="t('tools.wifiSync.masterPasswordDesc')"
      :confirm-label="t('tools.wifiSync.confirmSync')"
      :loading="syncLoading"
      @confirm="confirmSync"
    />
  </div>
</template>

<style scoped>
.tool-sidebar-hero {
  margin-bottom: 20px;
}

.sync-mode-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sync-mode-tab {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: background-color 0.2s, color 0.2s;
}

.sync-mode-tab:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.sync-mode-tab.active {
  background: var(--accent-subtle);
  color: var(--accent-primary);
}

.sync-panel {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sync-primary-btn {
  width: 100%;
}

.sync-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.pairing-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
}

.pairing-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pairing-row--highlight code {
  font-size: 20px;
  letter-spacing: 0.12em;
}

.pairing-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.pairing-row code {
  font-family: var(--font-mono);
  font-size: 12px;
  word-break: break-all;
}

.sync-details {
  border-top: 1px solid var(--border-default);
  padding-top: 12px;
}

.sync-details summary {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.sync-details summary:hover {
  color: var(--text-primary);
}

.sync-details-body {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qr-payload {
  width: 100%;
  box-sizing: border-box;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-primary);
  padding: 8px;
  font-family: var(--font-mono);
  font-size: 10px;
  resize: vertical;
}

.server-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.server-item {
  width: 100%;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  cursor: pointer;
  font-size: 12px;
}

.server-item.selected {
  border-color: var(--accent-primary);
  background: var(--accent-subtle);
}

.server-item span {
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 11px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
