<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
import SyncPairingQr from '@/components/sync/SyncPairingQr.vue'
import SyncConflictModal from '@/components/sync/SyncConflictModal.vue'
import { UiButton, UiInput } from '@/components/ui'
import { useAppState } from '@/composables/useAppState'
import { showToast } from '@/composables/useToast'
import { parseErrorMessage } from '@/shared/utils'
import type { SyncConflict, SyncMergeResult, WifiSyncDiscoveredServer } from '@/shared/syncTypes'

const {
  navigateTo,
  wifiSyncSettings,
  wifiSyncServerStatus,
  syncStatus,
  loadWifiSyncState,
  startWifiSyncServer,
  stopWifiSyncServer,
  refreshWifiSyncPairing,
  regenerateWifiSyncAccessPassword,
  discoverWifiSyncServers,
  pullWifiSyncMerge,
  pullWifiSyncMergeQr,
  getWifiSyncVerificationCode,
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
const clientVerificationCode = ref('')
const syncConflicts = ref<SyncConflict[]>([])
const showConflictModal = ref(false)

let refreshTimer: ReturnType<typeof setInterval> | null = null
let verificationTimer: ReturnType<typeof setInterval> | null = null

const serverRunning = computed(() => wifiSyncServerStatus.value.running)

const lastPublishedText = computed(() => {
  const at = wifiSyncServerStatus.value.lastPublishedAt
  if (!at) return t('tools.wifiSync.neverPublished')
  return new Date(at).toLocaleString()
})

const lastSyncedText = computed(() => {
  const at = syncStatus.value.lastSyncedAt
  if (!at) return t('tools.wifiSync.lastSyncedNever')
  return t('tools.wifiSync.lastSynced', { time: new Date(at).toLocaleString() })
})

const pairedDevices = computed(() => wifiSyncSettings.value.pairedDevices)

async function refreshClientVerificationCode(): Promise<void> {
  if (!selectedServer.value?.fingerprint) {
    clientVerificationCode.value = ''
    return
  }
  clientVerificationCode.value = await getWifiSyncVerificationCode(selectedServer.value.fingerprint)
}

async function refreshState(): Promise<void> {
  await loadWifiSyncState()
  if (serverRunning.value) {
    pairingInfo.value = await refreshWifiSyncPairing()
  } else {
    pairingInfo.value = null
  }
}

watch(selectedServer, () => {
  void refreshClientVerificationCode()
})

onMounted(async () => {
  await refreshState()
  refreshTimer = setInterval(() => {
    if (serverRunning.value) {
      void refreshState()
    }
  }, 30_000)
  verificationTimer = setInterval(() => {
    if (selectedServer.value) {
      void refreshClientVerificationCode()
    }
  }, 5_000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (verificationTimer) clearInterval(verificationTimer)
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
  void refreshClientVerificationCode()
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

function handleSyncResult(result: SyncMergeResult): void {
  if (result.conflicts.length > 0) {
    syncConflicts.value = result.conflicts
    showConflictModal.value = true
    showToast(
      t('tools.wifiSync.syncSuccessWithConflicts', {
        added: result.added,
        updated: result.updated,
        conflicts: result.conflicts.length,
      }),
      'success',
    )
    return
  }
  showToast(
    t('tools.wifiSync.syncSuccess', {
      added: result.added,
      updated: result.updated,
    }),
    'success',
  )
}

async function confirmSync(masterPassword: string): Promise<void> {
  syncLoading.value = true
  try {
    if (pendingAction.value === 'qr') {
      const result = await pullWifiSyncMergeQr(qrPayload.value.trim(), masterPassword)
      handleSyncResult(result)
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
      handleSyncResult(result)
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
        <button
          type="button"
          class="tool-back-btn"
          @click="goBack"
        >
          <ArrowLeft
            :size="16"
            :stroke-width="1.5"
          />
          {{ t('settings.backToSettings') }}
        </button>

        <div class="tool-sidebar-hero">
          <div class="tool-hero-icon tool-hero-icon--wifi">
            <Wifi
              :size="22"
              :stroke-width="1.5"
            />
          </div>
          <h2 class="tool-sidebar-title font-display">
            {{ t('settings.sync') }}
          </h2>
          <p class="tool-sidebar-desc">
            {{ t('tools.wifiSync.subtitle') }}
          </p>
        </div>

        <nav class="sync-mode-nav">
          <button
            type="button"
            class="sync-mode-tab"
            :class="{ active: mode === 'server' }"
            @click="mode = 'server'"
          >
            <Server
              :size="16"
              :stroke-width="1.5"
            />
            {{ t('tools.wifiSync.serverMode') }}
          </button>
          <button
            type="button"
            class="sync-mode-tab"
            :class="{ active: mode === 'client' }"
            @click="mode = 'client'"
          >
            <Smartphone
              :size="16"
              :stroke-width="1.5"
            />
            {{ t('tools.wifiSync.clientMode') }}
          </button>
        </nav>
      </aside>

      <main class="tool-page-main">
        <div class="tool-page-content">
          <header class="role-header">
            <div
              class="role-header__icon"
              :class="`role-header__icon--${mode}`"
            >
              <Server
                v-if="mode === 'server'"
                :size="20"
                :stroke-width="1.5"
              />
              <Smartphone
                v-else
                :size="20"
                :stroke-width="1.5"
              />
            </div>
            <div>
              <h3 class="role-header__title">
                {{ mode === 'server' ? t('tools.wifiSync.serverRoleTitle') : t('tools.wifiSync.clientRoleTitle') }}
              </h3>
              <p class="role-header__desc">
                {{ mode === 'server' ? t('tools.wifiSync.serverRoleDesc') : t('tools.wifiSync.clientRoleDesc') }}
              </p>
            </div>
          </header>

          <SyncTutorialPanel :role="mode" />

          <div class="sync-status-bar surface-card">
            <p class="sync-status-title">
              {{ t('tools.wifiSync.syncStatusTitle') }}
            </p>
            <p class="sync-status-line">
              {{ t('tools.wifiSync.syncRevision', { revision: syncStatus.revision }) }}
            </p>
            <p class="sync-status-line">
              {{ lastSyncedText }}
            </p>
          </div>

          <section
            v-if="mode === 'server'"
            class="panel-glow surface-card sync-panel"
          >
            <UiButton
              class="sync-primary-btn"
              :variant="serverRunning ? 'default' : 'primary'"
              :disabled="serverLoading"
              @click="toggleServer"
            >
              <Loader2
                v-if="serverLoading"
                :size="16"
                class="spin"
              />
              {{ serverRunning ? t('tools.wifiSync.stopServer') : t('tools.wifiSync.startServer') }}
            </UiButton>

            <p
              v-if="!serverRunning"
              class="sync-hint"
            >
              {{ t('tools.wifiSync.serverCardDesc') }}
            </p>

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

              <UiButton
                variant="ghost"
                size="small"
                @click="handleRegeneratePassword"
              >
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

              <div
                v-if="pairingInfo"
                class="pairing-qr-section"
              >
                <p class="pairing-qr-title">
                  {{ t('tools.wifiSync.qrPayloadTitle') }}
                </p>
                <p class="sync-hint">
                  {{ t('tools.wifiSync.qrPayloadHint') }}
                </p>
                <SyncPairingQr :payload="pairingInfo.qrPayload" />
                <details class="sync-details sync-details--nested">
                  <summary>{{ t('tools.wifiSync.qrPayloadRaw') }}</summary>
                  <div class="sync-details-body">
                    <textarea
                      class="qr-payload"
                      readonly
                      :value="pairingInfo.qrPayload"
                      rows="3"
                    />
                  </div>
                </details>
              </div>

              <div
                v-if="pairedDevices.length"
                class="paired-devices"
              >
                <p class="paired-devices-title">
                  {{ t('tools.wifiSync.pairedDevices') }}
                </p>
                <ul class="paired-devices-list">
                  <li
                    v-for="device in pairedDevices"
                    :key="device.id"
                  >
                    <strong>{{ device.name }}</strong>
                    <span v-if="device.lastSeenAt">
                      {{ new Date(device.lastSeenAt).toLocaleString() }}
                    </span>
                  </li>
                </ul>
              </div>
              <p
                v-else
                class="sync-hint"
              >
                {{ t('tools.wifiSync.pairedDevicesEmpty') }}
              </p>
            </template>
          </section>

          <section
            v-else
            class="panel-glow surface-card sync-panel"
          >
            <UiButton
              class="sync-primary-btn"
              variant="default"
              :disabled="discoverLoading"
              @click="handleDiscover"
            >
              <Loader2
                v-if="discoverLoading"
                :size="16"
                class="spin"
              />
              <RefreshCw
                v-else
                :size="16"
                :stroke-width="1.5"
              />
              {{ t('tools.wifiSync.discover') }}
            </UiButton>

            <ul
              v-if="discoveredServers.length"
              class="server-list"
            >
              <li
                v-for="server in discoveredServers"
                :key="`${server.host}:${server.port}`"
              >
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

            <p
              v-else
              class="sync-hint"
            >
              {{ t('tools.wifiSync.clientCardDesc') }}
            </p>

            <div
              v-if="selectedServer && clientVerificationCode"
              class="pairing-card"
            >
              <div class="pairing-row pairing-row--highlight">
                <span class="pairing-label">{{ t('tools.wifiSync.clientVerificationCode') }}</span>
                <code class="verification">{{ clientVerificationCode }}</code>
              </div>
              <p class="sync-hint">
                {{ t('tools.wifiSync.clientVerificationHint') }}
              </p>
            </div>

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
                <UiInput
                  v-model="qrPayload"
                  :placeholder="t('tools.wifiSync.scanQrPlaceholder')"
                />
                <UiButton
                  variant="default"
                  size="small"
                  :disabled="syncLoading"
                  @click="openQrSync"
                >
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

    <SyncConflictModal
      :open="showConflictModal"
      :conflicts="syncConflicts"
      @close="showConflictModal = false"
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

.role-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.role-header__icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-subtle);
  color: var(--accent-primary);
}

.role-header__title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.role-header__desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.sync-status-bar {
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.sync-status-title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
}

.sync-status-line {
  margin: 0;
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.sync-panel {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.verification {
  font-size: 20px;
  letter-spacing: 0.12em;
}

.paired-devices-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
}

.paired-devices-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.paired-devices-list li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}

.paired-devices-list span {
  color: var(--text-secondary);
  font-size: 11px;
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

.sync-details--nested {
  border-top: none;
  padding-top: 0;
}

.pairing-qr-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 4px;
}

.pairing-qr-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
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
