<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRaw } from 'vue'
import { useI18n } from 'vue-i18n'
import { Clipboard, ClipboardPaste, Copy, ExternalLink, Pin, PinOff, Trash2, X } from 'lucide-vue-next'
import { showToast } from '@/composables/useToast'
import SearchHighlightText from '@/components/SearchHighlightText.vue'

type ClipboardKind = 'text' | 'image'
type ClipboardExpiry = 30 | 300 | 900 | 1800 | 0
interface ClipboardItem {
  id: string
  kind: ClipboardKind
  content: string
  createdAt: number
  pinned: boolean
  expiry: ClipboardExpiry
  expiresAt: number | null
}

const { t } = useI18n()
const STORAGE_KEY = 'pwdbook-clipboard-session'
const PERSISTENT_STORAGE_KEY = 'pwdbook-clipboard-history'
const items = ref<ClipboardItem[]>([])
const selectedId = ref<string | null>(null)
const unlocked = ref(false)
const clipboardEnabled = ref(false)
const clipboardPersistence = ref(false)
const settingsLoaded = ref(false)
const query = ref('')
const now = ref(Date.now())
const windowPinned = ref(false)
let expiryTimer: number | undefined
let clipboardPollTimer: number | undefined
let clipboardReadInFlight = false
let defaultExpiry: ClipboardExpiry = 300
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('pwdbook-clipboard') : null
const selected = computed(() => items.value.find((item) => item.id === selectedId.value) ?? items.value[0] ?? null)
const visibleItems = computed(() => {
  const q = query.value.trim().toLowerCase()
  return items.value.filter((item) => !q || item.content.toLowerCase().includes(q)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt)
})

function sync(next: ClipboardItem[]): void {
  items.value = next
  selectedId.value = selectedId.value && next.some((item) => item.id === selectedId.value) ? selectedId.value : next[0]?.id ?? null
  const serialized = JSON.stringify(next.map((item) => ({ ...toRaw(item) })))
  sessionStorage.setItem(STORAGE_KEY, serialized)
  if (settingsLoaded.value) {
    if (clipboardPersistence.value) localStorage.setItem(PERSISTENT_STORAGE_KEY, serialized)
    else localStorage.removeItem(PERSISTENT_STORAGE_KEY)
  }
}

function purgeExpired(): void {
  const next = items.value.filter((item) => item.pinned || !item.expiresAt || item.expiresAt > now.value)
  if (next.length === items.value.length) return
  sync(next)
  broadcast('replace-state', next)
}

function broadcast(type: string, payload?: unknown): void {
  const safePayload = Array.isArray(payload)
    ? payload.map((item) => ({ ...toRaw(item as ClipboardItem) }))
    : payload
  channel?.postMessage({ type, payload: safePayload })
}

async function captureSystemClipboard(): Promise<void> {
  if (!unlocked.value || !clipboardEnabled.value || clipboardReadInFlight) return
  clipboardReadInFlight = true
  try {
    const reader = window.electronAPI?.readClipboardText
    const text = reader ? await reader() : await navigator.clipboard?.readText()
    if (text && !items.value.some((item) => item.kind === 'text' && item.content === text)) {
      const createdAt = Date.now()
      const item: ClipboardItem = {
        id: `${createdAt}-${Math.random().toString(16).slice(2)}`,
        kind: 'text',
        content: text,
        createdAt,
        pinned: false,
        expiry: defaultExpiry,
        expiresAt: defaultExpiry ? createdAt + defaultExpiry * 1000 : null,
      }
      sync([item, ...items.value])
      broadcast('replace-state', items.value)
    }
  } catch {
    // The system clipboard can be briefly locked while another process writes.
    // Background polling retries silently on the next tick.
  } finally {
    clipboardReadInFlight = false
  }
}

async function refresh(): Promise<void> {
  const status = await window.electronAPI?.getVaultStatus?.()
  unlocked.value = Boolean(status?.unlocked)
  const settings = await window.electronAPI?.getSettings?.()
  clipboardEnabled.value = Boolean(settings?.clipboardEnabled)
  clipboardPersistence.value = Boolean(settings?.clipboardPersistence)
  defaultExpiry = settings?.clipboardDefaultExpiry ?? 300
  settingsLoaded.value = true
  try {
    const stored = clipboardPersistence.value
      ? localStorage.getItem(PERSISTENT_STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY)
      : sessionStorage.getItem(STORAGE_KEY)
    if (stored) sync(JSON.parse(stored) as ClipboardItem[])
  } catch {
    // Ignore malformed local history and continue with an empty popup.
  }
  purgeExpired()
  broadcast('request-state')
  await captureSystemClipboard()
}

async function copy(item: ClipboardItem): Promise<void> {
  if (item.kind === 'text') await window.electronAPI?.copySecret?.(item.content, 0)
  else await navigator.clipboard?.writeText(item.content)
  showToast(t('tools.clipboardCopied'), 'success')
}

function remove(item: ClipboardItem): void {
  const next = items.value.filter((entry) => entry.id !== item.id)
  sync(next)
  broadcast('replace-state', next)
}

function togglePin(item: ClipboardItem): void {
  item.pinned = !item.pinned
  if (!item.pinned && item.expiry) item.expiresAt = Date.now() + item.expiry * 1000
  sync([...items.value])
  broadcast('replace-state', items.value)
}

function openFull(): void {
  window.electronAPI?.clipboardWindowShowMain?.()
  window.setTimeout(() => window.electronAPI?.hideClipboardWindow?.(), 50)
}

function closeWindow(): void {
  window.electronAPI?.hideClipboardWindow?.()
}

async function toggleWindowPinned(): Promise<void> {
  windowPinned.value = (await window.electronAPI?.toggleClipboardWindowPinned?.()) ?? windowPinned.value
}

function onMessage(event: MessageEvent): void {
  if (event.data?.type === 'state') sync(event.data.payload ?? [])
  if (event.data?.type === 'request-state') broadcast('popup-state-requested')
}

onMounted(() => {
  channel?.addEventListener('message', onMessage)
  const getPinned = window.electronAPI?.getClipboardWindowPinned
  if (getPinned) {
    void getPinned().then((pinned) => {
      windowPinned.value = pinned
    })
  }
  expiryTimer = window.setInterval(() => {
    now.value = Date.now()
    purgeExpired()
  }, 1000)
  clipboardPollTimer = window.setInterval(() => {
    void captureSystemClipboard()
  }, 1000)
  void refresh()
})
onUnmounted(() => {
  channel?.removeEventListener('message', onMessage)
  channel?.close()
  if (expiryTimer) window.clearInterval(expiryTimer)
  if (clipboardPollTimer) window.clearInterval(clipboardPollTimer)
})
</script>

<template>
  <main class="clipboard-popup" @keydown.esc="closeWindow">
    <header class="clipboard-popup-head">
      <div class="clipboard-popup-title"><span class="clipboard-popup-icon"><Clipboard :size="17" /></span><div><strong>{{ t('tools.clipboardTitle') }}</strong><span>{{ t('tools.clipboardShortcutHint') }}</span></div></div>
      <div class="clipboard-popup-head-actions">
        <button type="button" class="clipboard-popup-pin" :class="{ active: windowPinned }" :aria-label="windowPinned ? t('tools.clipboardWindowUnpin') : t('tools.clipboardWindowPin')" :aria-pressed="windowPinned" :title="windowPinned ? t('tools.clipboardWindowUnpin') : t('tools.clipboardWindowPin')" @click="toggleWindowPinned">
          <PinOff v-if="windowPinned" :size="15" />
          <Pin v-else :size="15" />
        </button>
        <button type="button" class="clipboard-popup-close" :aria-label="t('common.close')" @click="closeWindow"><X :size="16" /></button>
      </div>
    </header>
    <div v-if="!unlocked" class="clipboard-popup-locked"><Clipboard :size="26" /><p>{{ t('quickBar.locked') }}</p><button type="button" @click="openFull">{{ t('tools.clipboardOpenFull') }}</button></div>
    <template v-else>
      <div class="clipboard-popup-tools"><div class="clipboard-popup-search"><ClipboardPaste :size="14" /><input v-model="query" :placeholder="t('common.search')" /></div><button type="button" class="clipboard-popup-open" :title="t('tools.clipboardOpenFull')" @click="openFull"><ExternalLink :size="14" /></button></div>
      <div v-if="visibleItems.length" class="clipboard-popup-list">
        <article v-for="item in visibleItems.slice(0, 8)" :key="item.id" class="clipboard-popup-item" :class="{ selected: selected?.id === item.id }" @click="selectedId = item.id">
          <div class="clipboard-popup-item-copy"><small>{{ item.kind === 'image' ? t('tools.clipboardImageLabel') : t('tools.clipboardTextLabel') }}</small><p v-if="item.kind === 'image'">{{ t('tools.clipboardImagePreview') }}</p><p v-else><SearchHighlightText :text="item.content" :query="query" /></p></div>
          <div class="clipboard-popup-item-actions"><button type="button" :title="item.pinned ? t('tools.clipboardUnpin') : t('tools.clipboardPin')" :aria-pressed="item.pinned" @click.stop="togglePin(item)"><PinOff v-if="item.pinned" :size="13" /><Pin v-else :size="13" /></button><button type="button" :title="t('tools.clipboardCopy')" @click.stop="copy(item)"><Copy :size="13" /></button><button type="button" :title="t('common.delete')" @click.stop="remove(item)"><Trash2 :size="13" /></button></div>
        </article>
      </div>
      <div v-else class="clipboard-popup-empty"><Clipboard :size="24" /><p>{{ t('tools.clipboardEmptyTitle') }}</p></div>
      <footer class="clipboard-popup-foot"><span>{{ items.length }} {{ t('tools.clipboardTextLabel') }}</span><button type="button" @click="openFull">{{ t('tools.clipboardOpenFull') }} <ExternalLink :size="13" /></button></footer>
    </template>
  </main>
</template>
