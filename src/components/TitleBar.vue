<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ShieldCheck, Minus, Square, X, Palette, Check, TreePalm, Sparkles, Lock, Pin, GraduationCap } from 'lucide-vue-next'
import { UiModal, UiButton, UiCheckbox } from '@/components/ui'
import { useAppState } from '@/composables/useAppState'
import { useTheme } from '@/composables/useTheme'
import { useProductTour } from '@/composables/useProductTour'
import type { CloseWindowAction } from '@/shared/types'
import type { ThemeSkin } from '@/types'

const props = withDefaults(
  defineProps<{
    detailWindow?: boolean
  }>(),
  {
    detailWindow: false,
  },
)

const { t } = useI18n()
const { securitySettings, updateSecuritySettings, screen, navigateTo, vaultStatus, lock } = useAppState()
const { skin, skinOptions, setSkin, isAnimalIsland } = useTheme()
const { openHub, isActive: tourActive } = useProductTour()

const showCloseDialog = ref(false)
const rememberChoice = ref(false)
const showSkinMenu = ref(false)
const skinMenuRef = ref<HTMLElement | null>(null)
const skinTriggerRef = ref<HTMLButtonElement | null>(null)
const popoverStyle = ref<Record<string, string>>({})
const alwaysOnTop = ref(false)
const isMaximized = ref(false)

const canOpenAppearanceSettings = computed(() => screen.value !== 'lock')
const canQuickLock = computed(() => vaultStatus.value.unlocked && screen.value !== 'lock')
const canOpenLearn = computed(() => vaultStatus.value.unlocked && screen.value !== 'lock' && !props.detailWindow)

function openLearnHub(): void {
  showSkinMenu.value = false
  openHub()
}

let removeClosePromptListener: (() => void) | undefined
let removeMaximizeListener: (() => void) | undefined

function minimize(): void {
  window.electronAPI?.minimize()
}

function maximize(): void {
  window.electronAPI?.maximize()
}

async function syncMaximized(): Promise<void> {
  isMaximized.value = (await window.electronAPI?.getWindowMaximized?.()) ?? false
}

function applyCloseAction(action: CloseWindowAction): void {
  if (action === 'tray') {
    minimize()
    return
  }
  if (action === 'quit') {
    window.electronAPI?.close()
  }
}

function closeDetailWindow(): void {
  window.electronAPI?.closeDetailWindow?.()
}

async function syncAlwaysOnTop(): Promise<void> {
  alwaysOnTop.value = (await window.electronAPI?.getWindowAlwaysOnTop?.()) ?? false
}

async function toggleAlwaysOnTop(): Promise<void> {
  alwaysOnTop.value = (await window.electronAPI?.toggleWindowAlwaysOnTop?.()) ?? false
}

function openCloseDialog(): void {
  if (props.detailWindow) {
    closeDetailWindow()
    return
  }
  const saved = securitySettings.value.closeWindowAction
  if (saved !== 'ask') {
    applyCloseAction(saved)
    return
  }
  rememberChoice.value = false
  showCloseDialog.value = true
}

function dismissCloseDialog(): void {
  showCloseDialog.value = false
  rememberChoice.value = false
}

async function minimizeFromDialog(): Promise<void> {
  showCloseDialog.value = false
  if (rememberChoice.value) {
    await updateSecuritySettings({ closeWindowAction: 'tray' })
  }
  rememberChoice.value = false
  minimize()
}

async function quitApp(): Promise<void> {
  showCloseDialog.value = false
  if (rememberChoice.value) {
    await updateSecuritySettings({ closeWindowAction: 'quit' })
  }
  rememberChoice.value = false
  window.electronAPI?.close()
}

function updatePopoverPosition(): void {
  const trigger = skinTriggerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  popoverStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 6}px`,
    right: `${Math.max(8, window.innerWidth - rect.right)}px`,
    zIndex: '1000',
  }
}

function toggleSkinMenu(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  if (!showSkinMenu.value) {
    updatePopoverPosition()
  }
  showSkinMenu.value = !showSkinMenu.value
}

function closeSkinMenu(): void {
  showSkinMenu.value = false
}

function selectSkin(next: ThemeSkin): void {
  setSkin(next)
  closeSkinMenu()
}

function openAppearanceSettings(): void {
  navigateTo('settings', 'appearance')
  closeSkinMenu()
}

function onDocumentPointerDown(event: MouseEvent): void {
  if (!showSkinMenu.value) return
  const target = event.target as Node
  if (skinMenuRef.value?.contains(target) || skinTriggerRef.value?.contains(target)) return
  closeSkinMenu()
}

function onSkinMenuKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeSkinMenu()
}

function bindSkinMenuOutsideClose(): void {
  window.setTimeout(() => {
    if (!showSkinMenu.value) return
    document.addEventListener('mousedown', onDocumentPointerDown, true)
  }, 0)
}

function unbindSkinMenuOutsideClose(): void {
  document.removeEventListener('mousedown', onDocumentPointerDown, true)
}

watch(showSkinMenu, (open) => {
  if (open) {
    updatePopoverPosition()
    nextTick(() => bindSkinMenuOutsideClose())
    window.addEventListener('resize', updatePopoverPosition)
    document.addEventListener('keydown', onSkinMenuKeydown)
    return
  }
  unbindSkinMenuOutsideClose()
  window.removeEventListener('resize', updatePopoverPosition)
  document.removeEventListener('keydown', onSkinMenuKeydown)
})

onMounted(() => {
  void syncAlwaysOnTop()
  if (!props.detailWindow) {
    void syncMaximized()
    removeClosePromptListener = window.electronAPI?.onClosePrompt(() => openCloseDialog())
    removeMaximizeListener = window.electronAPI?.onWindowMaximizeChanged?.((maximized) => {
      isMaximized.value = maximized
    })
  }
})

onUnmounted(() => {
  removeClosePromptListener?.()
  removeMaximizeListener?.()
  unbindSkinMenuOutsideClose()
  window.removeEventListener('resize', updatePopoverPosition)
  document.removeEventListener('keydown', onSkinMenuKeydown)
})
</script>

<template>
  <header class="titlebar titlebar-drag">
    <div class="titlebar-left">
      <ShieldCheck
        class="icon-accent titlebar-no-drag"
        :size="14"
        :stroke-width="1.5"
      />
      <span class="title">{{ t('common.appName') }}</span>
    </div>
    <div
      class="titlebar-actions titlebar-no-drag"
      :class="{ 'titlebar-actions--detail': detailWindow }"
    >
      <div class="skin-menu-wrap">
        <button
          ref="skinTriggerRef"
          type="button"
          class="win-btn skin-trigger titlebar-no-drag"
          data-tour="titlebar-skin"
          :class="{ 'skin-trigger--open': showSkinMenu, 'skin-trigger--animal': isAnimalIsland }"
          :aria-label="t('titlebar.skinMenu')"
          :aria-expanded="showSkinMenu"
          @click.stop="toggleSkinMenu"
        >
          <Palette
            :size="14"
            :stroke-width="1.5"
          />
        </button>
        <Teleport to="body">
          <Transition name="skin-popover">
            <div
              v-if="showSkinMenu"
              ref="skinMenuRef"
              class="skin-popover menu-popover surface-card"
              :style="popoverStyle"
              @click.stop
            >
              <p class="skin-popover-title">
                {{ t('titlebar.skinMenuTitle') }}
              </p>
              <button
                v-for="item in skinOptions"
                :key="item.id"
                type="button"
                class="skin-option titlebar-no-drag"
                :class="{ active: skin === item.id }"
                @click="selectSkin(item.id as ThemeSkin)"
              >
                <span
                  class="skin-option-icon"
                  :class="`skin-option-icon--${item.id}`"
                >
                  <TreePalm
                    v-if="item.id === 'animalIsland'"
                    :size="15"
                    :stroke-width="1.5"
                  />
                  <Sparkles
                    v-else
                    :size="15"
                    :stroke-width="1.5"
                  />
                </span>
                <span class="skin-option-label">{{ item.label }}</span>
                <Check
                  v-if="skin === item.id"
                  class="skin-option-check"
                  :size="14"
                  :stroke-width="2.5"
                />
              </button>
              <button
                v-if="canOpenAppearanceSettings"
                type="button"
                class="skin-more-btn titlebar-no-drag"
                @click="openAppearanceSettings"
              >
                {{ t('titlebar.openAppearanceSettings') }}
              </button>
            </div>
          </Transition>
        </Teleport>
      </div>
      <button
        v-if="canOpenLearn"
        type="button"
        class="win-btn learn-btn"
        :class="{ 'learn-btn--active': tourActive }"
        data-tour="titlebar-learn"
        :aria-label="t('productTour.openHub')"
        :title="t('productTour.openHub')"
        @click="openLearnHub"
      >
        <GraduationCap
          :size="14"
          :stroke-width="1.5"
        />
      </button>
      <button
        v-if="!detailWindow && canQuickLock"
        type="button"
        class="win-btn lock-btn"
        data-tour="titlebar-lock"
        :aria-label="t('titlebar.quickLock')"
        @click="lock"
      >
        <Lock
          :size="14"
          :stroke-width="1.5"
        />
      </button>
      <button
        type="button"
        class="win-btn titlebar-always-on-top-btn"
        data-tour="titlebar-pin"
        :class="{ 'always-on-top-btn--active': alwaysOnTop }"
        :aria-label="alwaysOnTop ? t('titlebar.unpinAlwaysOnTop') : t('titlebar.pinAlwaysOnTop')"
        :aria-pressed="alwaysOnTop"
        @click="toggleAlwaysOnTop"
      >
        <Pin
          :size="14"
          :stroke-width="1.5"
        />
      </button>
      <span
        v-if="!detailWindow"
        class="titlebar-divider"
        aria-hidden="true"
      />
      <button
        type="button"
        class="win-btn titlebar-minimize-btn"
        :aria-label="t('titlebar.minimize')"
        @click="minimize"
      >
        <Minus
          :size="14"
          :stroke-width="1.5"
        />
      </button>
      <button
        v-if="!detailWindow"
        type="button"
        class="win-btn"
        :aria-label="isMaximized ? t('titlebar.restore') : t('titlebar.maximize')"
        @click="maximize"
      >
        <svg
          v-if="isMaximized"
          class="win-restore-icon"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="1"
            y="3"
            width="6.5"
            height="6.5"
            rx="0.75"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <rect
            x="4.5"
            y="0.5"
            width="6.5"
            height="6.5"
            rx="0.75"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
        <Square
          v-else
          :size="12"
          :stroke-width="1.5"
        />
      </button>
      <button
        type="button"
        class="win-btn close-btn"
        :aria-label="t('common.close')"
        @click="openCloseDialog"
      >
        <X
          :size="14"
          :stroke-width="1.5"
        />
      </button>
    </div>
  </header>

  <UiModal
    v-if="!detailWindow"
    v-model:open="showCloseDialog"
    class="close-app-modal"
    :title="t('titlebar.closeApp')"
    :width="400"
    :show-footer="false"
    :glow="false"
    @close="dismissCloseDialog"
  >
    <p class="dialog-desc">
      {{ t('titlebar.closePrompt') }}
    </p>
    <UiCheckbox
      v-model="rememberChoice"
      :label="t('titlebar.rememberChoice')"
      class="remember-row"
    />
    <div class="close-dialog-actions">
      <UiButton
        variant="ghost"
        block
        class="close-dialog-btn"
        @click="minimizeFromDialog"
      >
        {{ t('titlebar.minimize') }}
      </UiButton>
      <UiButton
        variant="primary"
        block
        class="close-dialog-btn"
        @click="quitApp"
      >
        {{ t('titlebar.quit') }}
      </UiButton>
    </div>
  </UiModal>
</template>

<style scoped>
.titlebar {
  position: relative;
  z-index: 100;
  height: var(--titlebar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--titlebar-base, var(--bg-surface));
  border-bottom: 1px solid var(--titlebar-border, var(--border-default));
  box-shadow: var(--titlebar-shadow, none);
  flex-shrink: 0;
  isolation: isolate;
}

.titlebar::before,
.titlebar::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.titlebar::before {
  background: var(--titlebar-accent-wash, none);
}

.titlebar::after {
  background: var(--titlebar-top-shine, none);
}

.titlebar-left {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-accent {
  color: var(--accent-primary);
}

.title {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.titlebar-actions {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 4px;
}

.titlebar-actions--detail .titlebar-always-on-top-btn {
  order: 0;
}

.titlebar-actions--detail .titlebar-minimize-btn {
  order: 1;
}

.titlebar-actions--detail .skin-menu-wrap {
  order: 2;
}

.titlebar-actions--detail .close-btn {
  order: 3;
}

.skin-menu-wrap {
  position: relative;
}

.skin-trigger--open,
.skin-trigger:hover {
  color: var(--accent-primary);
}

.skin-trigger--open {
  background: var(--accent-subtle);
}

.skin-trigger--animal.skin-trigger--open {
  color: #6b5344;
  background: rgba(189, 174, 160, 0.35);
}

.titlebar-divider {
  width: 1px;
  height: 14px;
  margin: 0 2px;
  background: var(--border-default);
  flex-shrink: 0;
}

.skin-popover {
  width: 220px;
  padding: 8px;
  border-radius: var(--radius-lg);
  pointer-events: auto;
}

.skin-popover-title {
  margin: 0;
  padding: 4px 8px 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.skin-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.skin-option:hover {
  background: var(--bg-hover);
}

.skin-option.active {
  background: var(--accent-subtle);
  color: var(--accent-primary);
}

.skin-option-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
}

.skin-option-icon--classic {
  background: var(--bg-elevated);
  color: var(--accent-primary);
  border: 1px solid var(--border-default);
}

.skin-option-icon--animalIsland {
  background: linear-gradient(145deg, #f7f3df, #e8dcc4);
  color: #6b8f71;
  border: 1px solid #d4c4a8;
}

.skin-option-label {
  flex: 1;
  min-width: 0;
}

.skin-option-check {
  flex-shrink: 0;
  color: var(--accent-primary);
}

.skin-more-btn {
  display: block;
  width: 100%;
  margin-top: 4px;
  padding: 8px 10px;
  border: none;
  border-top: 1px solid var(--border-default);
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
}

.skin-more-btn:hover {
  color: var(--accent-primary);
  background: var(--bg-hover);
}

.skin-popover-enter-active,
.skin-popover-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.skin-popover-enter-from,
.skin-popover-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

.win-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.win-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.win-restore-icon {
  display: block;
  flex-shrink: 0;
}

.lock-btn:hover {
  color: var(--accent-primary);
}

.learn-btn {
  position: relative;
}

.learn-btn:hover,
.learn-btn--active {
  color: var(--accent-primary);
  background: rgba(var(--accent-rgb), 0.12);
}

.learn-btn--active::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 8px;
  border: 1px solid rgba(var(--accent-rgb), 0.35);
  pointer-events: none;
  animation: learn-pulse 1.6s ease-in-out infinite;
}

@keyframes learn-pulse {
  0%,
  100% {
    opacity: 0.45;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.04);
  }
}

.always-on-top-btn--active,
.always-on-top-btn--active:hover {
  color: var(--accent-primary);
  background: var(--accent-subtle);
}

.close-btn:hover {
  background: var(--status-danger);
  color: #fff;
}

.dialog-desc {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.remember-row {
  margin: 0 0 20px;
}

.close-dialog-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.close-dialog-btn {
  min-width: 0;
}
</style>
