<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  Clipboard,
  ClipboardPaste,
  Copy,
  Image as ImageIcon,
  Pin,
  PinOff,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  Type,
  X,
} from 'lucide-vue-next'
import { useAppState } from '@/composables/useAppState'
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

const STORAGE_KEY = 'pwdbook-clipboard-session'
const PERSISTENT_STORAGE_KEY = 'pwdbook-clipboard-history'
const { t } = useI18n()
const { navigateTo, securitySettings } = useAppState()
const items = ref<ClipboardItem[]>([])
const selectedId = ref<string | null>(null)
const query = ref('')
const filter = ref<'all' | ClipboardKind | 'pinned'>('all')
const draft = ref('')
const isCaptureOpen = ref(false)
const now = ref(Date.now())
let pollTimer: number | undefined
let clockTimer: number | undefined
let lastWritten = ''
let lastSeen = ''
const clipboardChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('pwdbook-clipboard') : null

function snapshot(source: ClipboardItem[]): ClipboardItem[] {
  return source.map((item) => ({ ...toRaw(item) }))
}

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

function persist(): void {
  const serialized = JSON.stringify(snapshot(items.value))
  sessionStorage.setItem(STORAGE_KEY, serialized)
  if (securitySettings.value.clipboardPersistence) localStorage.setItem(PERSISTENT_STORAGE_KEY, serialized)
  else localStorage.removeItem(PERSISTENT_STORAGE_KEY)
  clipboardChannel?.postMessage({ type: 'state', payload: snapshot(items.value) })
}

function load(): void {
  try {
    const raw = securitySettings.value.clipboardPersistence
      ? localStorage.getItem(PERSISTENT_STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY)
      : sessionStorage.getItem(STORAGE_KEY)
    const parsed = JSON.parse(raw ?? '[]') as ClipboardItem[]
    items.value = parsed.filter((item) => item && item.id && item.content)
    if (securitySettings.value.clipboardPersistence && items.value.length) {
      localStorage.setItem(PERSISTENT_STORAGE_KEY, JSON.stringify(snapshot(items.value)))
    }
    purgeExpired()
    selectedId.value = items.value[0]?.id ?? null
  } catch {
    items.value = []
  }
}

function purgeExpired(): void {
  const before = items.value.length
  // Fixed records are intentionally retained even when their original expiry has passed.
  items.value = items.value.filter((item) => item.pinned || !item.expiresAt || item.expiresAt > now.value)
  if (items.value.length !== before) {
    persist()
    if (selectedId.value && !items.value.some((item) => item.id === selectedId.value)) selectedId.value = items.value[0]?.id ?? null
  }
}

function addItem(kind: ClipboardKind, content: string, expiry: ClipboardExpiry = 300): void {
  const trimmed = kind === 'text' ? content.trim() : content
  if (!trimmed) return
  const existingPinned = items.value.find((entry) => entry.kind === kind && entry.content === trimmed && entry.pinned)
  if (existingPinned) {
    selectedId.value = existingPinned.id
    persist()
    return
  }
  const effectiveExpiry = expiry === 300 ? securitySettings.value.clipboardDefaultExpiry : expiry
  const item: ClipboardItem = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind,
    content: trimmed,
    createdAt: Date.now(),
    pinned: false,
    expiry: effectiveExpiry,
    expiresAt: effectiveExpiry ? Date.now() + effectiveExpiry * 1000 : null,
  }
  items.value = [item, ...items.value.filter((entry) => entry.content !== trimmed)]
  selectedId.value = item.id
  persist()
}

async function captureSystem(options: { notifyOnError?: boolean } = {}): Promise<void> {
  if (!securitySettings.value.clipboardEnabled) return
  try {
    const text = window.electronAPI?.readClipboardText
      ? await window.electronAPI.readClipboardText()
      : await navigator.clipboard?.readText()
    if (text && text !== lastWritten && text !== lastSeen) {
      lastSeen = text
      addItem('text', text)
      showToast(t('tools.clipboardCaptured'), 'success')
    }
  } catch {
    // Windows may briefly lock the clipboard while another process is writing.
    // Background polling should retry silently; only an explicit user action shows an error.
    if (options.notifyOnError) {
      showToast(t('tools.clipboardPermission'), 'error')
    }
  }
}

async function copyItem(item: ClipboardItem): Promise<void> {
  lastWritten = item.kind === 'text' ? item.content : ''
  if (item.kind === 'text') {
    await window.electronAPI?.copySecret(item.content, 0)
  } else {
    await navigator.clipboard?.writeText(item.content)
  }
  showToast(t('tools.clipboardCopied'), 'success')
}

function removeItem(item: ClipboardItem): void {
  items.value = items.value.filter((entry) => entry.id !== item.id)
  if (selectedId.value === item.id) selectedId.value = visibleItems.value[0]?.id ?? null
  persist()
}

function clearAll(): void {
  items.value = []
  selectedId.value = null
  persist()
}

function togglePin(item: ClipboardItem): void {
  item.pinned = !item.pinned
  if (!item.pinned && item.expiry) item.expiresAt = Date.now() + item.expiry * 1000
  persist()
}

function setExpiry(item: ClipboardItem, expiry: ClipboardExpiry): void {
  item.expiry = expiry
  item.expiresAt = expiry ? Date.now() + expiry * 1000 : null
  persist()
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

function startMonitoring(): void {
  if (clockTimer || !securitySettings.value.clipboardEnabled) return
  document.addEventListener('paste', handlePaste)
  clockTimer = window.setInterval(() => {
    now.value = Date.now()
    purgeExpired()
  }, 1000)
  pollTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void captureSystem()
  }, 1800)
}

function stopMonitoring(): void {
  document.removeEventListener('paste', handlePaste)
  if (clockTimer) window.clearInterval(clockTimer)
  if (pollTimer) window.clearInterval(pollTimer)
  clockTimer = undefined
  pollTimer = undefined
}

onMounted(() => {
  clipboardChannel?.addEventListener('message', (event) => {
    if (event.data?.type === 'replace-state' && Array.isArray(event.data.payload)) {
      items.value = event.data.payload as ClipboardItem[]
      persist()
    }
    if (event.data?.type === 'request-state' || event.data?.type === 'popup-state-requested') {
      clipboardChannel?.postMessage({ type: 'state', payload: items.value })
    }
  })
  load()
  startMonitoring()
})

watch(
  () => securitySettings.value.clipboardEnabled,
  (enabled) => {
    if (enabled) startMonitoring()
    else stopMonitoring()
  },
)

watch(
  () => [securitySettings.value.clipboardPersistence, securitySettings.value.clipboardDefaultExpiry],
  ([persistence], previous) => {
    if (persistence !== previous?.[0]) persist()
  },
)

onBeforeUnmount(() => {
  stopMonitoring()
  clipboardChannel?.close()
})
</script>

<template>
  <section class="clipboard-view">
    <header class="clipboard-header">
      <div class="clipboard-heading">
        <button class="clipboard-back" type="button" :title="t('tools.backToVault')" @click="navigateTo('vault')">
          <ArrowLeft :size="17" />
        </button>
        <div class="clipboard-mark"><Clipboard :size="22" :stroke-width="1.8" /></div>
        <div>
          <p class="clipboard-kicker">{{ t('tools.sectionLabel') }} / WORKSPACE</p>
          <h1>{{ t('tools.clipboardTitle') }}</h1>
          <p>{{ t('tools.clipboardSubtitle') }}</p>
        </div>
      </div>
      <div class="clipboard-actions">
        <button class="clipboard-secondary" type="button" :disabled="!securitySettings.clipboardEnabled" @click="captureSystem({ notifyOnError: true })"><ClipboardPaste :size="15" />{{ t('tools.clipboardCapture') }}</button>
        <button class="clipboard-primary" type="button" @click="startCapture"><Type :size="15" />{{ t('tools.clipboardNew') }}</button>
      </div>
    </header>

    <div class="clipboard-stats">
      <div><span>{{ t('tools.clipboardTotal') }}</span><strong>{{ items.length }}</strong></div>
      <div><span>{{ t('tools.clipboardText') }}</span><strong>{{ textCount }}</strong></div>
      <div><span>{{ t('tools.clipboardImages') }}</span><strong>{{ imageCount }}</strong></div>
      <div><span>{{ t('tools.clipboardPinned') }}</span><strong>{{ pinnedCount }}</strong></div>
      <div class="clipboard-privacy"><ShieldCheck :size="16" /><span>{{ t('tools.clipboardLocalOnly') }}</span></div>
    </div>

    <div class="clipboard-layout">
      <div class="clipboard-list-pane">
        <div class="clipboard-toolbar">
          <div class="clipboard-search"><Search :size="15" /><input v-model="query" :placeholder="t('common.search')" /></div>
          <button class="clear-all" type="button" :disabled="!items.length" @click="clearAll"><Trash2 :size="14" />{{ t('tools.clipboardClear') }}</button>
        </div>
        <div class="clipboard-filters">
          <button v-for="tab in (['all', 'text', 'image', 'pinned'] as const)" :key="tab" type="button" :class="{ active: filter === tab }" @click="filter = tab">
            <span v-if="tab === 'all'">{{ t('common.all') }}</span><span v-else-if="tab === 'text'">{{ t('tools.clipboardText') }}</span><span v-else-if="tab === 'image'">{{ t('tools.clipboardImages') }}</span><span v-else>{{ t('tools.clipboardPinned') }}</span>
          </button>
        </div>
        <div class="clipboard-list">
          <button v-for="item in visibleItems" :key="item.id" type="button" class="clipboard-item" :class="{ selected: selected?.id === item.id }" @click="selectedId = item.id">
            <div class="item-type" :class="`item-type--${item.kind}`"><ImageIcon v-if="item.kind === 'image'" :size="16" /><Type v-else :size="16" /></div>
            <div class="item-copy"><div class="item-meta"><span>{{ item.kind === 'image' ? t('tools.clipboardImageLabel') : t('tools.clipboardTextLabel') }}</span><time>{{ formatTime(item.createdAt) }}</time></div><p v-if="item.kind === 'image'">{{ t('tools.clipboardImagePreview') }}</p><p v-else><SearchHighlightText :text="item.content" :query="query" /></p><small v-if="item.expiresAt">{{ relativeExpiry(item) }}</small></div>
            <Pin v-if="item.pinned" class="item-pin" :size="14" fill="currentColor" />
          </button>
          <div v-if="!visibleItems.length" class="clipboard-empty"><div class="empty-icon"><Clipboard :size="24" /></div><strong>{{ t('tools.clipboardEmptyTitle') }}</strong><p>{{ t('tools.clipboardEmptyDesc') }}</p><button type="button" @click="startCapture"><Type :size="14" />{{ t('tools.clipboardNew') }}</button></div>
        </div>
      </div>

      <aside class="clipboard-preview" :class="{ 'preview-empty': !selected }">
        <template v-if="selected">
          <div class="preview-top"><span class="preview-label"><span class="live-dot" />{{ t('tools.clipboardPreview') }}</span><div class="preview-actions"><button type="button" :title="selected.pinned ? t('tools.clipboardUnpin') : t('tools.clipboardPin')" :aria-pressed="selected.pinned" @click="togglePin(selected)"><PinOff v-if="selected.pinned" :size="16" /><Pin v-else :size="16" /></button><button type="button" :title="t('common.delete')" @click="removeItem(selected)"><X :size="17" /></button></div></div>
          <div class="preview-content"><img v-if="selected.kind === 'image'" :src="selected.content" :alt="t('tools.clipboardImageLabel')" /><pre v-else>{{ selected.content }}</pre></div>
          <div class="preview-footer"><div><span>{{ t('tools.clipboardExpires') }}</span><select :value="selected.expiry" @change="setExpiry(selected, Number(($event.target as HTMLSelectElement).value) as ClipboardExpiry)"><option :value="30">{{ t('tools.clipboard30s') }}</option><option :value="300">{{ t('tools.clipboard5m') }}</option><option :value="900">{{ t('tools.clipboard15m') }}</option><option :value="1800">{{ t('tools.clipboard30m') }}</option><option :value="0">{{ t('tools.clipboardNever') }}</option></select></div><button class="copy-button" type="button" @click="copyItem(selected)"><Copy :size="15" />{{ t('tools.clipboardCopy') }}</button></div>
        </template>
        <div v-else class="preview-placeholder"><Star :size="22" /><p>{{ t('tools.clipboardSelectHint') }}</p></div>
      </aside>
    </div>

    <div v-if="isCaptureOpen" class="capture-overlay" @click.self="isCaptureOpen = false"><div class="capture-dialog"><div class="capture-dialog-head"><div><span class="clipboard-kicker">{{ t('tools.clipboardNew') }}</span><h2>{{ t('tools.clipboardCaptureTitle') }}</h2></div><button type="button" @click="isCaptureOpen = false"><X :size="18" /></button></div><textarea v-model="draft" autofocus :placeholder="t('tools.clipboardPlaceholder')" @keydown.ctrl.enter="saveDraft" /><div class="capture-dialog-actions"><button type="button" @click="isCaptureOpen = false">{{ t('common.cancel') }}</button><button class="clipboard-primary" type="button" :disabled="!draft.trim()" @click="saveDraft"><ClipboardPaste :size="15" />{{ t('tools.clipboardSave') }}</button></div></div></div>
  </section>
</template>

<style scoped>
.clipboard-view { height: 100%; overflow: hidden; display: flex; flex-direction: column; color: var(--text-primary); background: linear-gradient(135deg, rgba(var(--accent-rgb), .045), transparent 32%), var(--bg-app); }
.clipboard-header { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; padding:34px 42px 22px; border-bottom:1px solid var(--border-default); }
.clipboard-heading { display:flex; align-items:flex-start; gap:14px; min-width:0; }.clipboard-back { border:0; background:transparent; color:var(--text-secondary); padding:8px 4px; cursor:pointer; }.clipboard-back:hover { color:var(--text-primary); }.clipboard-mark { width:44px; height:44px; display:grid; place-items:center; background:var(--accent-subtle); color:var(--accent-primary); border:1px solid var(--border-accent); border-radius:12px; flex-shrink:0; }.clipboard-kicker { margin:0 0 5px; color:var(--accent-primary); font-size:10px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; }.clipboard-heading h1 { margin:0; font: 700 27px/1.1 var(--font-display); letter-spacing:.01em; }.clipboard-heading p:last-child { margin:7px 0 0; color:var(--text-secondary); font-size:13px; }.clipboard-actions { display:flex; gap:9px; flex-shrink:0; padding-top:6px; }.clipboard-primary,.clipboard-secondary,.clear-all,.copy-button { display:inline-flex; align-items:center; justify-content:center; gap:7px; border-radius:9px; padding:9px 13px; font-size:12px; font-weight:600; cursor:pointer; transition:all .18s ease; }.clipboard-primary { border:1px solid var(--accent-primary); background:var(--accent-primary); color:var(--btn-primary-text); }.clipboard-primary:hover { filter:brightness(1.08); }.clipboard-secondary { border:1px solid var(--border-strong); background:var(--bg-surface); color:var(--text-primary); }.clipboard-secondary:hover { background:var(--bg-hover); border-color:var(--accent-primary); }.clipboard-stats { display:flex; align-items:center; gap:30px; padding:14px 42px; border-bottom:1px solid var(--border-default); background:color-mix(in srgb, var(--bg-surface) 55%, transparent); }.clipboard-stats > div:not(.clipboard-privacy) { display:flex; align-items:baseline; gap:9px; }.clipboard-stats span { font-size:11px; color:var(--text-muted); }.clipboard-stats strong { font:600 17px var(--font-mono); color:var(--text-primary); }.clipboard-privacy { margin-left:auto; display:flex; align-items:center; gap:7px; color:var(--status-safe); font-size:11px; }.clipboard-layout { flex:1; min-height:0; display:grid; grid-template-columns:minmax(360px, .95fr) minmax(320px, 1.05fr); }.clipboard-list-pane { min-width:0; min-height:0; display:flex; flex-direction:column; border-right:1px solid var(--border-default); }.clipboard-toolbar { display:flex; gap:10px; padding:18px 22px 10px; }.clipboard-search { flex:1; display:flex; align-items:center; gap:8px; padding:0 11px; min-height:36px; border:1px solid var(--border-default); border-radius:8px; background:var(--input-bg); color:var(--text-muted); }.clipboard-search input { min-width:0; width:100%; border:0; outline:0; background:transparent; color:var(--text-primary); font-size:13px; }.clear-all { border:1px solid transparent; background:transparent; color:var(--text-muted); white-space:nowrap; }.clear-all:hover:not(:disabled) { color:var(--status-danger); background:rgba(248,113,113,.08); }.clear-all:disabled { opacity:.35; cursor:not-allowed; }.clipboard-filters { display:flex; gap:4px; padding:0 22px 12px; border-bottom:1px solid var(--border-default); }.clipboard-filters button { border:0; background:transparent; color:var(--text-muted); padding:7px 9px; border-radius:6px; font-size:12px; cursor:pointer; }.clipboard-filters button:hover { color:var(--text-primary); }.clipboard-filters button.active { color:var(--accent-primary); background:var(--accent-subtle); }.clipboard-list { min-height:0; overflow-y:auto; padding:10px 12px 20px; }.clipboard-item { position:relative; width:100%; display:flex; align-items:flex-start; gap:11px; padding:13px 11px; border:1px solid transparent; border-radius:10px; background:transparent; color:var(--text-primary); text-align:left; cursor:pointer; transition:background .16s,border .16s; }.clipboard-item:hover { background:var(--bg-hover); }.clipboard-item.selected { background:var(--bg-elevated); border-color:var(--border-accent); box-shadow:inset 3px 0 0 var(--accent-primary); }.item-type { width:31px; height:31px; border-radius:8px; display:grid; place-items:center; flex-shrink:0; }.item-type--text { color:#60a5fa; background:rgba(96,165,250,.11); }.item-type--image { color:#34d399; background:rgba(52,211,153,.11); }.item-copy { min-width:0; flex:1; }.item-meta { display:flex; align-items:center; gap:8px; font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.08em; }.item-meta time { text-transform:none; letter-spacing:0; }.item-copy p { margin:5px 0 3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; line-height:1.4; }.item-copy small { color:var(--accent-primary); font-size:10px; }.item-pin { color:var(--accent-primary); margin-top:3px; }.clipboard-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:260px; padding:28px; text-align:center; color:var(--text-muted); }.empty-icon { width:52px; height:52px; display:grid; place-items:center; color:var(--accent-primary); background:var(--accent-subtle); border-radius:14px; margin-bottom:14px; }.clipboard-empty strong { color:var(--text-primary); font-size:14px; }.clipboard-empty p { max-width:250px; margin:8px 0 17px; font-size:12px; line-height:1.5; }.clipboard-empty button { display:inline-flex; align-items:center; gap:7px; border:1px solid var(--border-strong); border-radius:8px; background:var(--bg-surface); color:var(--text-primary); padding:8px 12px; font-size:12px; cursor:pointer; }.clipboard-preview { min-width:0; min-height:0; display:flex; flex-direction:column; background:color-mix(in srgb, var(--bg-surface) 48%, transparent); }.preview-top { display:flex; align-items:center; justify-content:space-between; padding:18px 24px 14px; border-bottom:1px solid var(--border-default); }.preview-label { display:flex; align-items:center; gap:7px; color:var(--text-muted); font-size:10px; text-transform:uppercase; letter-spacing:.13em; }.live-dot { width:6px; height:6px; border-radius:50%; background:var(--status-safe); box-shadow:0 0 0 3px rgba(45,212,191,.13); }.preview-actions { display:flex; gap:5px; }.preview-actions button,.capture-dialog-head button { width:30px; height:30px; display:grid; place-items:center; border:0; border-radius:7px; background:transparent; color:var(--text-muted); cursor:pointer; }.preview-actions button:hover,.capture-dialog-head button:hover { background:var(--bg-hover); color:var(--text-primary); }.preview-content { flex:1; min-height:0; overflow:auto; padding:25px; }.preview-content pre { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; font: 13px/1.7 var(--font-mono); color:var(--text-primary); }.preview-content img { display:block; max-width:100%; max-height:100%; margin:auto; border-radius:8px; border:1px solid var(--border-default); }.preview-footer { display:flex; align-items:flex-end; justify-content:space-between; gap:14px; padding:17px 24px 22px; border-top:1px solid var(--border-default); }.preview-footer > div { display:flex; flex-direction:column; gap:6px; }.preview-footer span { color:var(--text-muted); font-size:10px; text-transform:uppercase; letter-spacing:.1em; }.preview-footer select { min-width:120px; border:1px solid var(--border-default); border-radius:7px; background:var(--input-bg); color:var(--text-primary); padding:8px; font-size:12px; }.copy-button { border:1px solid var(--accent-primary); background:var(--accent-subtle); color:var(--accent-primary); }.copy-button:hover { background:var(--accent-primary); color:var(--btn-primary-text); }.preview-empty { display:grid; place-items:center; }.preview-placeholder { display:flex; flex-direction:column; align-items:center; gap:10px; color:var(--text-muted); text-align:center; }.preview-placeholder svg { color:var(--accent-primary); }.preview-placeholder p { max-width:190px; margin:0; font-size:12px; line-height:1.5; }.capture-overlay { position:fixed; inset:0; z-index:20; display:grid; place-items:center; padding:20px; background:rgba(5,8,12,.62); backdrop-filter:blur(5px); }.capture-dialog { width:min(540px,100%); background:var(--bg-surface); border:1px solid var(--border-strong); border-radius:14px; box-shadow:var(--shadow-panel); padding:22px; }.capture-dialog-head { display:flex; justify-content:space-between; align-items:flex-start; }.capture-dialog h2 { margin:0; font:600 20px var(--font-display); }.capture-dialog textarea { display:block; width:100%; min-height:170px; margin-top:20px; padding:13px; resize:vertical; border:1px solid var(--border-default); border-radius:9px; outline:0; background:var(--input-bg); color:var(--text-primary); font:13px/1.6 var(--font-mono); }.capture-dialog textarea:focus { border-color:var(--accent-primary); box-shadow:0 0 0 3px var(--focus-ring); }.capture-dialog-actions { display:flex; justify-content:flex-end; gap:9px; padding-top:16px; }.capture-dialog-actions > button:first-child { border:0; background:transparent; color:var(--text-secondary); padding:9px 12px; cursor:pointer; }.capture-dialog-actions .clipboard-primary:disabled { opacity:.4; cursor:not-allowed; }
@media (max-width: 760px) { .clipboard-header { padding:24px 20px 18px; flex-direction:column; }.clipboard-actions { width:100%; }.clipboard-actions button { flex:1; }.clipboard-stats { padding:12px 20px; gap:14px; flex-wrap:wrap; }.clipboard-privacy { margin-left:0; width:100%; }.clipboard-layout { grid-template-columns:1fr; overflow:auto; }.clipboard-list-pane { border-right:0; min-height:360px; }.clipboard-preview { min-height:300px; border-top:1px solid var(--border-default); }.clipboard-toolbar { padding-left:16px; padding-right:16px; }.clipboard-filters { padding-left:16px; padding-right:16px; } }
 .clipboard-secondary:disabled { opacity:.45; cursor:not-allowed; border-color:var(--border-default); }
</style>
