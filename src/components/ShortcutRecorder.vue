<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RotateCcw } from 'lucide-vue-next'
import { showToast } from '@/composables/useToast'
import {
  acceleratorFromKeyInput,
  acceleratorKeyLabel,
  findReservedAccelerator,
  normalizeAccelerator,
  splitAccelerator,
  type ReservedAccelerator,
  type ShortcutPlatform,
} from '@/shared/globalAccelerator'
import { parseErrorMessage } from '@/shared/utils'

const props = defineProps<{
  accelerator: string
  fallback: string
  reserved?: ReservedAccelerator[]
  save: (accelerator: string) => Promise<void>
}>()

const { t } = useI18n()
const listening = ref(false)
const hint = ref('')
const saved = ref(false)
let savedTimer = 0

const platform = computed<ShortcutPlatform>(() => {
  const value = navigator.platform || ''
  if (/Mac/i.test(value)) return 'darwin'
  if (/Linux/i.test(value)) return 'linux'
  return 'win32'
})

const caps = computed(() =>
  splitAccelerator(props.accelerator).map((part) => acceleratorKeyLabel(part, platform.value)),
)

const isFallback = computed(
  () => normalizeAccelerator(props.accelerator) === normalizeAccelerator(props.fallback),
)

const kicker = computed(() => {
  if (saved.value) return t('settings.shortcutSaved')
  if (listening.value) return t('settings.shortcutListening')
  return t('settings.shortcutCapture')
})

const modifierHint = computed(() =>
  platform.value === 'darwin'
    ? t('settings.shortcutNeedsModifierMac')
    : t('settings.shortcutNeedsModifier'),
)

function stop(): void {
  listening.value = false
  window.removeEventListener('keydown', onKeyDown, true)
}

function start(): void {
  hint.value = ''
  saved.value = false
  listening.value = true
  window.addEventListener('keydown', onKeyDown, true)
}

function toggle(): void {
  if (listening.value) stop()
  else start()
}

async function commit(next: string): Promise<void> {
  stop()
  if (normalizeAccelerator(next) === normalizeAccelerator(props.accelerator)) return
  try {
    await props.save(next)
    saved.value = true
    window.clearTimeout(savedTimer)
    savedTimer = window.setTimeout(() => {
      saved.value = false
    }, 1400)
  } catch (error) {
    const message = parseErrorMessage(error)
    hint.value = message
    showToast(message, 'error')
  }
}

function onKeyDown(event: KeyboardEvent): void {
  if (!listening.value) return
  event.preventDefault()
  event.stopPropagation()
  if (event.repeat) return
  if (event.key === 'Escape' && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
    stop()
    return
  }
  const parsed = acceleratorFromKeyInput({
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
    platform: platform.value,
  })
  if (parsed.status === 'modifier') return
  if (parsed.status === 'needs-modifier') {
    hint.value = modifierHint.value
    return
  }
  if (parsed.status === 'unsupported') {
    hint.value = t('settings.shortcutUnsupported')
    return
  }
  const conflict = findReservedAccelerator(parsed.accelerator, props.reserved ?? [])
  if (conflict) {
    hint.value = t('settings.shortcutConflict', { name: conflict.label })
    return
  }
  hint.value = ''
  void commit(parsed.accelerator)
}

async function reset(): Promise<void> {
  const conflict = findReservedAccelerator(props.fallback, props.reserved ?? [])
  if (conflict) {
    hint.value = t('settings.shortcutConflict', { name: conflict.label })
    return
  }
  hint.value = ''
  await commit(props.fallback)
}

onUnmounted(() => {
  stop()
  window.clearTimeout(savedTimer)
})
</script>

<template>
  <div
    class="recorder"
    :class="{ 'is-listening': listening, 'is-saved': saved }"
  >
    <button
      type="button"
      class="well"
      :aria-pressed="listening"
      :aria-label="t('settings.shortcutAria', { accelerator })"
      @click="toggle"
    >
      <span class="kicker">{{ kicker }}</span>
      <span class="caps">
        <template
          v-for="(cap, index) in caps"
          :key="`${cap}-${index}`"
        >
          <span
            v-if="index > 0"
            class="plus"
            aria-hidden="true"
          >+</span>
          <kbd>{{ cap }}</kbd>
        </template>
      </span>
    </button>
    <button
      type="button"
      class="reset"
      :disabled="isFallback || listening"
      @click="reset"
    >
      <RotateCcw
        :size="12"
        :stroke-width="1.75"
      />
      {{ t('settings.shortcutReset') }}
    </button>
    <p
      v-if="hint"
      class="hint"
      role="status"
    >
      {{ hint }}
    </p>
    <p
      v-else-if="listening"
      class="hint hint--quiet"
    >
      {{ t('settings.shortcutHint') }}
    </p>
  </div>
</template>

<style scoped>
.recorder {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 7px;
  min-width: 196px;
}

.well {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 9px;
  width: 100%;
  min-width: 196px;
  padding: 10px 12px 12px;
  border: 1px solid color-mix(in srgb, var(--accent-500) 42%, var(--border-strong));
  border-radius: 14px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 88%, transparent), var(--bg-surface));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 14%, transparent),
    inset 0 -10px 18px color-mix(in srgb, black 16%, transparent);
  cursor: pointer;
  text-align: left;
}

.well:hover {
  border-color: color-mix(in srgb, var(--accent-400) 70%, var(--border-strong));
}

.well:focus-visible {
  outline: 2px solid var(--accent-400);
  outline-offset: 2px;
}

.kicker {
  font: 600 10px/1 var(--font-mono);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent-400);
}

.caps {
  display: flex;
  align-items: center;
  gap: 6px;
}

kbd {
  min-width: 28px;
  padding: 7px 8px 8px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--text-primary) 16%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-elevated) 70%, white) 0%,
    var(--bg-surface) 100%
  );
  box-shadow: 0 2px 0 color-mix(in srgb, black 28%, var(--border-strong));
  color: var(--text-primary);
  font: 600 12px/1 var(--font-mono);
}

.plus {
  color: color-mix(in srgb, var(--accent-400) 80%, var(--text-muted));
  font: 600 12px/1 var(--font-mono);
}

.reset {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font: 600 11px/1 var(--font-body);
  letter-spacing: 0.04em;
  cursor: pointer;
}

.reset:hover:not(:disabled) {
  color: var(--text-primary);
}

.reset:disabled {
  opacity: 0.4;
  cursor: default;
}

.hint {
  max-width: 220px;
  margin: 0;
  text-align: right;
  font-size: 11px;
  line-height: 1.4;
  color: var(--status-danger);
}

.hint--quiet {
  color: var(--text-muted);
}

.is-listening .well {
  border-color: var(--accent-400);
  animation: well-pulse 1.35s ease-in-out infinite;
}

.is-saved .kicker {
  color: var(--status-success);
}

@keyframes well-pulse {
  0%,
  100% {
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, white 14%, transparent),
      0 0 0 0 color-mix(in srgb, var(--accent-400) 0%, transparent);
  }
  50% {
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, white 14%, transparent),
      0 0 0 4px color-mix(in srgb, var(--accent-400) 28%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .is-listening .well {
    animation: none;
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, white 14%, transparent),
      0 0 0 2px color-mix(in srgb, var(--accent-400) 45%, transparent);
  }
}
</style>
