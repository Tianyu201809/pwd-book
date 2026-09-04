<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRaw } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Clipboard,
  ClipboardPaste,
  Copy,
  Image as ImageIcon,
  Pin,
  PinOff,
  Search,
  ShieldCheck,
  Trash2,
  Type,
  X,
} from 'lucide-vue-next'
import { showToast } from '@/composables/useToast'
import SearchHighlightText from '@/components/SearchHighlightText.vue'

type ClipboardKind = 'text' | 'image'
type ClipboardExpiry = 30 | 300 | 900 | 1800 | 0
type ClipboardFilter = 'all' | ClipboardKind | 'pinned'

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
const filter = ref<ClipboardFilter>('all')
const draft = ref('')
const isCaptureOpen = ref(false)
const now = ref(Date.now())
const windowPinned = ref(false)
let expiryTimer: number | undefined
let clipboardPollTimer: number | undefined
let clipboardReadInFlight = false
let lastWritten = ''
let lastSeen = ''
let defaultExpiry: ClipboardExpiry = 300
let removeShownListener: (() => void) | undefined
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('pwdbook-clipboard') : null

const visibleItems = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  return items.value
    .filter((item) => filter.value === 'all' || (filter.value === 'pinned' ? item.pinned : item.kind === filter.value))
    .filter((item) => !normalized || item.content.toLowerCase().includes(normalized))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt)
})
const selected = computed(() => items.value.find((item) => item.id === selectedId.value) ?? visibleItems.value[0] ?? null)
const textCount = computed(() => items.value.filter((item) => item.kind === 'text').length)
const imageCount = computed(() => items.value.filter((item) => item.kind === 'image').length)
const pinnedCount = computed(() => items.value.filter((item) => item.pinned).length)

function snapshot(source: ClipboardItem[]): ClipboardItem[] {
  return source.map((item) => ({ ...toRaw(item) }))
}

function broadcast(type: string, payload?: unknown): void {
  const safePayload = Array.isArray(payload)
    ? payload.map((item) => ({ ...toRaw(item as ClipboardItem) }))
    : payload
  channel?.postMessage({ type, payload: safePayload })
}

function sync(next: ClipboardItem[], announce = false): void {
  items.value = next
  selectedId.value = selectedId.value && next.some((item) => item.id === selectedId.value) ? selectedId.value : next[0]?.id ?? null
  const serialized = JSON.stringify(snapshot(next))
  sessionStorage.setItem(STORAGE_KEY, serialized)
  if (settingsLoaded.value) {
    if (clipboardPersistence.value) localStorage.setItem(PERSISTENT_STORAGE_KEY, serialized)
    else localStorage.removeItem(PERSISTENT_STORAGE_KEY)
  }
  if (announce) broadcast('replace-state', next)
}

function purgeExpired(): void {
  const next = items.value.filter((item) => item.pinned || !item.expiresAt || item.expiresAt > now.value)
  if (next.length !== items.value.length) sync(next, true)
}

function addItem(kind: ClipboardKind, content: string, expiry: ClipboardExpiry = 300): void {
  const normalized = kind === 'text' ? content.trim() : content
  if (!normalized) return
  const existingPinned = items.value.find((entry) => entry.kind === kind && entry.content === normalized && entry.pinned)
  if (existingPinned) {
    selectedId.value = existingPinned.id
    sync([...items.value], true)
    return
  }
  const effectiveExpiry = expiry === 300 ? defaultExpiry : expiry
  const createdAt = Date.now()
  const item: ClipboardItem = {
    id: `${createdAt}-${Math.random().toString(16).slice(2)}`,
    kind,
    content: normalized,
    createdAt,
    pinned: false,
    expiry: effectiveExpiry,
    expiresAt: effectiveExpiry ? createdAt + effectiveExpiry * 1000 : null,
  }
  sync([item, ...items.value.filter((entry) => entry.content !== normalized)], true)
}

async function captureSystemClipboard(options: { notifyOnError?: boolean } = {}): Promise<void> {
  if (!unlocked.value || !clipboardEnabled.value || clipboardReadInFlight) return
  clipboardReadInFlight = true
  try {
    const reader = window.electronAPI?.readClipboardText
    const text = reader ? await reader() : await navigator.clipboard?.readText()
    if (text && text !== lastWritten && text !== lastSeen) {
      lastSeen = text
      addItem('text', text)
      showToast(t('tools.clipboardCaptured'), 'success')
    }
  } catch {
    if (options.notifyOnError) showToast(t('tools.clipboardPermission'), 'error')
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
    sync([])
  }
  purgeExpired()
  broadcast('request-state')
  await captureSystemClipboard()
}

async function copyItem(item: ClipboardItem): Promise<void> {
  lastWritten = item.kind === 'text' ? item.content : ''
  if (item.kind === 'text') await window.electronAPI?.copySecret?.(item.content, 0)
  else await navigator.clipboard?.writeText(item.content)
  showToast(t('tools.clipboardCopied'), 'success')
}

function removeItem(item: ClipboardItem): void {
  sync(items.value.filter((entry) => entry.id !== item.id), true)
}

function clearAll(): void {
  sync([], true)
}

function togglePin(item: ClipboardItem): void {
  item.pinned = !item.pinned
  if (!item.pinned && item.expiry) item.expiresAt = Date.now() + item.expiry * 1000
  sync([...items.value], true)
}

function setExpiry(item: ClipboardItem, expiry: ClipboardExpiry): void {
  item.expiry = expiry
  item.expiresAt = expiry ? Date.now() + expiry * 1000 : null
  sync([...items.value], true)
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(timestamp)
}

function relativeExpiry(item: ClipboardItem): string {
  if (!item.expiresAt) return t('tools.clipboardNever')
  const seconds = Math.max(0, Math.ceil((item.expiresAt - now.value) / 1000))
  if (seconds < 60) return t('tools.clipboardSeconds', { n: seconds })
  return t('tools.clipboardMinutes', { n: Math.ceil(seconds / 60) })
}

function handlePaste(event: ClipboardEvent): void {
  const target = event.target as HTMLElement | null
  if (target?.matches('textarea, input, [contenteditable="true"]')) return
  const image = Array.from(event.clipboardData?.items ?? []).find((entry) => entry.type.startsWith('image/'))
  if (image) {
    const file = image.getAsFile()
    if (file) {
      const reader = new FileReader()
      reader.onload = () => addItem('image', String(reader.result))
      reader.readAsDataURL(file)
      showToast(t('tools.clipboardCaptured'), 'success')
      return
    }
  }
  const text = event.clipboardData?.getData('text/plain')
  if (text) addItem('text', text)
}

function startCapture(): void {
  isCaptureOpen.value = true
  draft.value = ''
}

function saveDraft(): void {
  addItem('text', draft.value)
  draft.value = ''
  isCaptureOpen.value = false
}

async function toggleWindowPinned(): Promise<void> {
  windowPinned.value = (await window.electronAPI?.toggleClipboardWindowPinned?.()) ?? windowPinned.value
}

function closeWindow(): void {
  window.electronAPI?.hideClipboardWindow?.()
}

function onMessage(event: MessageEvent): void {
  if (event.data?.type === 'state' && Array.isArray(event.data.payload)) sync(event.data.payload as ClipboardItem[])
  if (event.data?.type === 'request-state') broadcast('popup-state-requested')
}

onMounted(() => {
  channel?.addEventListener('message', onMessage)
  document.addEventListener('paste', handlePaste)
  const getPinned = window.electronAPI?.getClipboardWindowPinned
  if (getPinned) void getPinned().then((pinned) => { windowPinned.value = pinned })
  expiryTimer = window.setInterval(() => {
    now.value = Date.now()
    purgeExpired()
  }, 1000)
  clipboardPollTimer = window.setInterval(() => { void captureSystemClipboard() }, 1000)
  removeShownListener = window.electronAPI?.onClipboardWindowShown?.(() => { void refresh() })
  void refresh()
})

onUnmounted(() => {
  channel?.removeEventListener('message', onMessage)
  channel?.close()
  removeShownListener?.()
  document.removeEventListener('paste', handlePaste)
  if (expiryTimer) window.clearInterval(expiryTimer)
  if (clipboardPollTimer) window.clearInterval(clipboardPollTimer)
})
</script>

<template>
  <main class="clipboard-popup" @keydown.esc="closeWindow">
    <header class="clipboard-popup-head">
      <div class="clipboard-popup-title">
        <span class="clipboard-popup-icon"><Clipboard :size="17" /></span>
        <div><strong>{{ t('tools.clipboardTitle') }}</strong><span>{{ t('tools.clipboardShortcutHint') }}</span></div>
      </div>
      <div class="clipboard-popup-head-actions">
        <button type="button" class="clipboard-popup-pin" :class="{ active: windowPinned }" :aria-label="windowPinned ? t('tools.clipboardWindowUnpin') : t('tools.clipboardWindowPin')" :aria-pressed="windowPinned" :title="windowPinned ? t('tools.clipboardWindowUnpin') : t('tools.clipboardWindowPin')" @click="toggleWindowPinned">
          <PinOff v-if="windowPinned" :size="15" /><Pin v-else :size="15" />
        </button>
        <button type="button" class="clipboard-popup-close" :aria-label="t('common.close')" @click="closeWindow"><X :size="16" /></button>
      </div>
    </header>

    <div v-if="!unlocked" class="clipboard-popup-locked"><Clipboard :size="26" /><p>{{ t('quickBar.locked') }}</p><button type="button" @click="closeWindow">{{ t('common.close') }}</button></div>
    <template v-else>
      <div class="clipboard-popup-summary">
        <span><strong>{{ items.length }}</strong> {{ t('tools.clipboardTotal') }}</span>
        <span><strong>{{ textCount }}</strong> {{ t('tools.clipboardText') }}</span>
        <span><strong>{{ imageCount }}</strong> {{ t('tools.clipboardImages') }}</span>
        <span><strong>{{ pinnedCount }}</strong> {{ t('tools.clipboardPinned') }}</span>
      </div>
      <div class="clipboard-popup-tools">
        <div class="clipboard-popup-search"><Search :size="14" /><input v-model="query" :placeholder="t('common.search')" /></div>
        <button type="button" class="clipboard-popup-tool-button" :title="t('tools.clipboardCapture')" :disabled="!clipboardEnabled" @click="captureSystemClipboard({ notifyOnError: true })"><ClipboardPaste :size="15" /></button>
        <button type="button" class="clipboard-popup-tool-button" :title="t('tools.clipboardNew')" @click="startCapture"><Type :size="15" /></button>
      </div>
      <div class="clipboard-popup-filters">
        <button v-for="tab in (['all', 'text', 'image', 'pinned'] as const)" :key="tab" type="button" :class="{ active: filter === tab }" @click="filter = tab">
          {{ tab === 'all' ? t('common.all') : tab === 'text' ? t('tools.clipboardText') : tab === 'image' ? t('tools.clipboardImages') : t('tools.clipboardPinned') }}
        </button>
      </div>
      <div class="clipboard-popup-content">
        <section class="clipboard-popup-list-pane">
          <div v-if="visibleItems.length" class="clipboard-popup-list">
            <article v-for="item in visibleItems" :key="item.id" class="clipboard-popup-item" :class="{ selected: selected?.id === item.id }" @click="selectedId = item.id">
              <div class="clipboard-popup-item-type" :class="`is-${item.kind}`"><ImageIcon v-if="item.kind === 'image'" :size="14" /><Type v-else :size="14" /></div>
              <div class="clipboard-popup-item-copy"><div class="clipboard-popup-item-meta"><span>{{ item.kind === 'image' ? t('tools.clipboardImageLabel') : t('tools.clipboardTextLabel') }}</span><time>{{ formatTime(item.createdAt) }}</time></div><p v-if="item.kind === 'image'">{{ t('tools.clipboardImagePreview') }}</p><p v-else><SearchHighlightText :text="item.content" :query="query" /></p><small v-if="item.expiresAt">{{ relativeExpiry(item) }}</small></div>
              <Pin v-if="item.pinned" class="clipboard-popup-item-pin" :size="13" fill="currentColor" />
              <div class="clipboard-popup-item-actions"><button type="button" :title="item.pinned ? t('tools.clipboardUnpin') : t('tools.clipboardPin')" @click.stop="togglePin(item)"><PinOff v-if="item.pinned" :size="13" /><Pin v-else :size="13" /></button><button type="button" :title="t('tools.clipboardCopy')" @click.stop="copyItem(item)"><Copy :size="13" /></button><button type="button" :title="t('common.delete')" @click.stop="removeItem(item)"><Trash2 :size="13" /></button></div>
            </article>
          </div>
          <div v-else class="clipboard-popup-empty"><Clipboard :size="24" /><strong>{{ t('tools.clipboardEmptyTitle') }}</strong><p>{{ t('tools.clipboardEmptyDesc') }}</p><button type="button" @click="startCapture"><Type :size="14" />{{ t('tools.clipboardNew') }}</button></div>
        </section>
        <aside class="clipboard-popup-preview" :class="{ empty: !selected }">
          <template v-if="selected">
            <div class="clipboard-popup-preview-head"><span><ShieldCheck :size="13" />{{ t('tools.clipboardPreview') }}</span><div><button type="button" :title="selected.pinned ? t('tools.clipboardUnpin') : t('tools.clipboardPin')" @click="togglePin(selected)"><PinOff v-if="selected.pinned" :size="14" /><Pin v-else :size="14" /></button><button type="button" :title="t('common.delete')" @click="removeItem(selected)"><X :size="15" /></button></div></div>
            <div class="clipboard-popup-preview-content"><img v-if="selected.kind === 'image'" :src="selected.content" :alt="t('tools.clipboardImageLabel')" /><pre v-else>{{ selected.content }}</pre></div>
            <div class="clipboard-popup-preview-foot"><label>{{ t('tools.clipboardExpires') }}<select :value="selected.expiry" @change="setExpiry(selected, Number(($event.target as HTMLSelectElement).value) as ClipboardExpiry)"><option :value="30">{{ t('tools.clipboard30s') }}</option><option :value="300">{{ t('tools.clipboard5m') }}</option><option :value="900">{{ t('tools.clipboard15m') }}</option><option :value="1800">{{ t('tools.clipboard30m') }}</option><option :value="0">{{ t('tools.clipboardNever') }}</option></select></label><button type="button" class="clipboard-popup-copy" @click="copyItem(selected)"><Copy :size="14" />{{ t('tools.clipboardCopy') }}</button></div>
          </template>
          <div v-else class="clipboard-popup-preview-placeholder"><Clipboard :size="21" /><span>{{ t('tools.clipboardSelectHint') }}</span></div>
        </aside>
      </div>
      <footer class="clipboard-popup-foot"><span><ShieldCheck :size="12" />{{ t('tools.clipboardLocalOnly') }}</span><button type="button" :disabled="!items.length" @click="clearAll"><Trash2 :size="13" />{{ t('tools.clipboardClear') }}</button></footer>
    </template>

    <div v-if="isCaptureOpen" class="clipboard-popup-overlay" @click.self="isCaptureOpen = false"><div class="clipboard-popup-dialog"><div class="clipboard-popup-dialog-head"><strong>{{ t('tools.clipboardCaptureTitle') }}</strong><button type="button" :aria-label="t('common.close')" @click="isCaptureOpen = false"><X :size="16" /></button></div><textarea v-model="draft" autofocus :placeholder="t('tools.clipboardPlaceholder')" @keydown.ctrl.enter="saveDraft" /><div class="clipboard-popup-dialog-actions"><button type="button" @click="isCaptureOpen = false">{{ t('common.cancel') }}</button><button type="button" class="clipboard-popup-copy" :disabled="!draft.trim()" @click="saveDraft"><ClipboardPaste :size="14" />{{ t('tools.clipboardSave') }}</button></div></div></div>
  </main>
</template>
