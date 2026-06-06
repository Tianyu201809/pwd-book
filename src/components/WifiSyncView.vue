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
const pendingAction = ref<'server' | 'client' | 'qr' | null>(null)

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
    showToast(t('tools.wifiSync.qrRequired'), 'info')
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
        showToast(t('tools.wifiSync.accessPasswordRequired'), 'info')
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
  <div class="wifi-sync-view">
    <header class="wifi-sync-header">
      <button type="button" class="back-btn" @click="navigateTo('vault')">
        <ArrowLeft :size="18" :stroke-width="1.5" />
        {{ t('tools.backToVault') }}
      </button>
      <div class="header-copy">
        <h2>{{ t('tools.wifiSync.title') }}</h2>
        <p>{{ t('tools.wifiSync.subtitle') }}</p>
      </div>
    </header>

    <div class="mode-tabs">
      <button
        type="button"
        class="mode-tab"
        :class="{ active: mode === 'server' }"
        @click="mode = 'server'"
      >
        <Server :size="16" :stroke-width="1.5" />
        {{ t('tools.wifiSync.serverMode') }}
      </button>
      <button
        type="button"
        class="mode-tab"
        :class="{ active: mode === 'client' }"
        @click="mode = 'client'"
      >
        <Smartphone :size="16" :stroke-width="1.5" />
        {{ t('tools.wifiSync.clientMode') }}
      </button>
    </div>

    <section v-if="mode === 'server'" class="panel-card">
      <div class="panel-head">
        <Wifi :size="18" :stroke-width="1.5" />
        <div>
          <h3>{{ t('tools.wifiSync.serverCardTitle') }}</h3>
          <p>{{ t('tools.wifiSync.serverCardDesc') }}</p>
        </div>
      </div>

      <UiButton
        :variant="serverRunning ? 'secondary' : 'primary'"
        :disabled="serverLoading"
        @click="toggleServer"
      >
        <Loader2 v-if="serverLoading" :size="16" class="spin" />
        {{ serverRunning ? t('tools.wifiSync.stopServer') : t('tools.wifiSync.startServer') }}
      </UiButton>

      <template v-if="serverRunning">
        <div class="info-grid">
          <div class="info-item">
            <span class="label">{{ t('tools.wifiSync.host') }}</span>
            <code>{{ wifiSyncServerStatus.host }}:{{ wifiSyncServerStatus.port }}</code>
          </div>
          <div class="info-item">
            <span class="label">{{ t('tools.wifiSync.accessPassword') }}</span>
            <code>{{ wifiSyncServerStatus.accessPassword }}</code>
          </div>
          <div class="info-item">
            <span class="label">{{ t('tools.wifiSync.verificationCode') }}</span>
            <code class="verification">{{ wifiSyncServerStatus.verificationCode }}</code>
          </div>
          <div class="info-item">
            <span class="label">{{ t('tools.wifiSync.fingerprint') }}</span>
            <code>{{ wifiSyncServerStatus.certificateFingerprint }}</code>
          </div>
          <div class="info-item">
            <span class="label">{{ t('tools.wifiSync.lastPublished') }}</span>
            <span>{{ lastPublishedText }}</span>
          </div>
        </div>

        <UiButton variant="ghost" @click="handleRegeneratePassword">
          {{ t('tools.wifiSync.regeneratePassword') }}
        </UiButton>

        <div v-if="pairingInfo" class="qr-block">
          <p class="qr-title">{{ t('tools.wifiSync.qrPayloadTitle') }}</p>
          <p class="qr-hint">{{ t('tools.wifiSync.qrPayloadHint') }}</p>
          <textarea class="qr-payload" readonly :value="pairingInfo.qrPayload" rows="4" />
        </div>
      </template>
    </section>

    <section v-else class="panel-card">
      <div class="panel-head">
        <Smartphone :size="18" :stroke-width="1.5" />
        <div>
          <h3>{{ t('tools.wifiSync.clientCardTitle') }}</h3>
          <p>{{ t('tools.wifiSync.clientCardDesc') }}</p>
        </div>
      </div>

      <UiButton variant="secondary" :disabled="discoverLoading" @click="handleDiscover">
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
            <span class="fingerprint">{{ server.fingerprint }}</span>
          </button>
        </li>
      </ul>

      <UiInput
        v-model="clientAccessPassword"
        :placeholder="t('tools.wifiSync.accessPasswordPlaceholder')"
      />

      <UiButton variant="primary" :disabled="syncLoading || !selectedServer" @click="openClientSync">
        {{ t('tools.wifiSync.syncNow') }}
      </UiButton>

      <div class="qr-import">
        <p class="qr-title">{{ t('tools.wifiSync.scanQrTitle') }}</p>
        <UiInput v-model="qrPayload" :placeholder="t('tools.wifiSync.scanQrPlaceholder')" />
        <UiButton variant="secondary" :disabled="syncLoading" @click="openQrSync">
          {{ t('tools.wifiSync.syncFromQr') }}
        </UiButton>
      </div>
    </section>

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
.wifi-sync-view {
  height: 100%;
  overflow: auto;
  padding: 24px 32px 48px;
}

.wifi-sync-header {
  margin-bottom: 24px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  margin-bottom: 16px;
  padding: 0;
}

.header-copy h2 {
  margin: 0 0 8px;
  font-size: 24px;
}

.header-copy p {
  margin: 0;
  color: var(--text-secondary);
}

.mode-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.mode-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
}

.mode-tab.active {
  color: var(--text-primary);
  border-color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
}

.panel-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  max-width: 720px;
}

.panel-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.panel-head h3 {
  margin: 0 0 4px;
}

.panel-head p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.info-grid {
  display: grid;
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item .label {
  font-size: 12px;
  color: var(--text-secondary);
}

.info-item code {
  font-family: var(--font-mono, monospace);
  word-break: break-all;
}

.verification {
  font-size: 20px;
  letter-spacing: 0.2em;
}

.qr-block,
.qr-import {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qr-title {
  margin: 0;
  font-weight: 600;
}

.qr-hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.qr-payload {
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-primary);
  padding: 12px;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  resize: vertical;
}

.server-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.server-item {
  width: 100%;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  cursor: pointer;
}

.server-item.selected {
  border-color: var(--accent-primary);
}

.server-item .fingerprint {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: var(--font-mono, monospace);
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
