<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import gsap from 'gsap'
import {
  Copy,
  Globe,
  KeyRound,
  Monitor,
  Puzzle,
  RefreshCw,
  ToggleRight,
  Unplug,
} from 'lucide-vue-next'

const props = defineProps<{
  step: number
}>()

const { t } = useI18n()
const rootRef = ref<HTMLElement | null>(null)
let ctx: gsap.Context | null = null

function killAnimations(): void {
  ctx?.revert()
  ctx = null
}

function runStepAnimation(step: number): void {
  if (!rootRef.value) return
  killAnimations()

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    gsap.set(rootRef.value.querySelectorAll('[data-guide-part]'), { autoAlpha: 1, scale: 1, x: 0, y: 0 })
    return
  }

  ctx = gsap.context(() => {
    const parts = rootRef.value!.querySelectorAll(`[data-step="${step}"] [data-guide-part]`)
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

    tl.fromTo(
      parts,
      { autoAlpha: 0, y: 18, scale: 0.94 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.55, stagger: 0.08 },
    )

    if (step === 0) {
      gsap.fromTo(
        '.guide-visual__switch-knob',
        { x: -14 },
        { x: 0, duration: 0.65, ease: 'back.out(2)', delay: 0.35 },
      )
      gsap.to('.guide-visual__switch-glow', {
        autoAlpha: 0.75,
        scale: 1.15,
        duration: 1.4,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: 0.5,
      })
    }

    if (step === 1) {
      gsap.to('.guide-visual__browser-bar', {
        backgroundPosition: '200% 0',
        duration: 2.8,
        repeat: -1,
        ease: 'none',
      })
      gsap.fromTo(
        '.guide-visual__puzzle',
        { rotation: -8, y: 6 },
        { rotation: 8, y: -4, duration: 1.6, repeat: -1, yoyo: true, ease: 'sine.inOut' },
      )
    }

    if (step === 2) {
      gsap.to('.guide-visual__id-shimmer', {
        x: '120%',
        duration: 1.8,
        repeat: -1,
        ease: 'power2.inOut',
        repeatDelay: 0.6,
      })
      gsap.to('.guide-visual__copy-badge', {
        y: -3,
        duration: 0.9,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: 0.4,
      })
    }

    if (step === 3) {
      gsap.to('.guide-visual__link-beam', {
        scaleX: 1,
        autoAlpha: 1,
        duration: 0.9,
        ease: 'power2.out',
        transformOrigin: 'left center',
      })
      gsap.to('.guide-visual__link-pulse', {
        x: 180,
        duration: 1.6,
        repeat: -1,
        ease: 'power1.inOut',
        repeatDelay: 0.2,
      })
      gsap.to('.guide-visual__lock-ring', {
        scale: 1.12,
        autoAlpha: 0.5,
        duration: 1.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
    }

    if (step === 4) {
      gsap.to('.guide-visual__restart-arrow', {
        rotation: 360,
        duration: 2.4,
        repeat: -1,
        ease: 'none',
        transformOrigin: '50% 50%',
      })
      gsap.fromTo(
        '.guide-visual__browser-ghost',
        { autoAlpha: 0.35, scale: 0.96 },
        { autoAlpha: 1, scale: 1, duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut' },
      )
    }

    if (step === 5) {
      gsap.fromTo(
        '.guide-visual__fill-bar',
        { autoAlpha: 0, x: 24, y: -12 },
        { autoAlpha: 1, x: 0, y: 0, duration: 0.75, ease: 'back.out(1.7)', delay: 0.25 },
      )
      gsap.to('.guide-visual__form-field--pwd', {
        borderColor: 'color-mix(in srgb, var(--accent-primary) 65%, transparent)',
        duration: 0.45,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: 0.9,
      })
      gsap.to('.guide-visual__key-icon', {
        rotation: 12,
        duration: 1.8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        transformOrigin: '50% 80%',
      })
    }
  }, rootRef.value)
}

watch(
  () => props.step,
  (step) => {
    void nextTick(() => runStepAnimation(step))
  },
  { immediate: true },
)

onUnmounted(() => {
  killAnimations()
})
</script>

<template>
  <div
    ref="rootRef"
    class="guide-visual"
    aria-hidden="true"
  >
    <!-- Step 0: Enable bridge -->
    <div
      v-show="step === 0"
      data-step="0"
      class="guide-visual__scene"
    >
      <div
        class="guide-visual__app-window"
        data-guide-part
      >
        <div class="guide-visual__app-titlebar">
          <span />
          <span />
          <span />
        </div>
        <div class="guide-visual__app-body">
          <div class="guide-visual__app-row">
            <span>{{ t('settings.browserFillGuide.visual.enableLabel') }}</span>
            <div class="guide-visual__switch">
              <span class="guide-visual__switch-glow" />
              <span class="guide-visual__switch-track">
                <span class="guide-visual__switch-knob" />
              </span>
              <ToggleRight
                :size="16"
                :stroke-width="1.75"
                class="guide-visual__switch-icon"
              />
            </div>
          </div>
        </div>
      </div>
      <Monitor
        class="guide-visual__scene-icon"
        data-guide-part
        :size="20"
        :stroke-width="1.5"
      />
    </div>

    <!-- Step 1: Install extension -->
    <div
      v-show="step === 1"
      data-step="1"
      class="guide-visual__scene"
    >
      <div
        class="guide-visual__browser"
        data-guide-part
      >
        <div class="guide-visual__browser-bar" />
        <div class="guide-visual__browser-content">
          <div class="guide-visual__ext-card">
            <Puzzle
              class="guide-visual__puzzle"
              :size="28"
              :stroke-width="1.5"
            />
            <div>
              <strong>PwdBook Autofill</strong>
              <small>{{ t('settings.browserFillGuide.visual.loadUnpacked') }}</small>
            </div>
          </div>
        </div>
      </div>
      <Globe
        class="guide-visual__scene-icon"
        data-guide-part
        :size="20"
        :stroke-width="1.5"
      />
    </div>

    <!-- Step 2: Copy ID -->
    <div
      v-show="step === 2"
      data-step="2"
      class="guide-visual__scene"
    >
      <div
        class="guide-visual__id-card"
        data-guide-part
      >
        <div class="guide-visual__id-header">
          <Puzzle
            :size="18"
            :stroke-width="1.5"
          />
          <span>PwdBook Autofill</span>
        </div>
        <div class="guide-visual__id-row">
          <span class="guide-visual__id-label">ID</span>
          <code class="guide-visual__id-value">
            <span class="guide-visual__id-shimmer" />
            abcdefghijklmnopabcdefghijklmnop
          </code>
          <span class="guide-visual__copy-badge">
            <Copy
              :size="12"
              :stroke-width="2"
            />
          </span>
        </div>
      </div>
    </div>

    <!-- Step 3: Register -->
    <div
      v-show="step === 3"
      data-step="3"
      class="guide-visual__scene guide-visual__scene--link"
    >
      <div
        class="guide-visual__node guide-visual__node--browser"
        data-guide-part
      >
        <Globe
          :size="22"
          :stroke-width="1.5"
        />
        <span>Chrome / Edge</span>
      </div>
      <div
        class="guide-visual__link"
        data-guide-part
      >
        <span class="guide-visual__link-beam" />
        <span class="guide-visual__link-pulse">
          <Unplug
            :size="11"
            :stroke-width="2"
          />
        </span>
        <span class="guide-visual__lock-ring" />
        <KeyRound
          :size="16"
          :stroke-width="1.75"
          class="guide-visual__link-key"
        />
      </div>
      <div
        class="guide-visual__node guide-visual__node--app"
        data-guide-part
      >
        <Monitor
          :size="22"
          :stroke-width="1.5"
        />
        <span>PwdBook</span>
      </div>
    </div>

    <!-- Step 4: Restart browser -->
    <div
      v-show="step === 4"
      data-step="4"
      class="guide-visual__scene"
    >
      <div
        class="guide-visual__restart"
        data-guide-part
      >
        <RefreshCw
          class="guide-visual__restart-arrow"
          :size="36"
          :stroke-width="1.5"
        />
        <span>{{ t('settings.browserFillGuide.visual.restartHint') }}</span>
      </div>
      <div
        class="guide-visual__browser guide-visual__browser-ghost"
        data-guide-part
      >
        <div class="guide-visual__browser-bar" />
        <div class="guide-visual__browser-content guide-visual__browser-content--empty" />
      </div>
    </div>

    <!-- Step 5: Ready -->
    <div
      v-show="step === 5"
      data-step="5"
      class="guide-visual__scene guide-visual__scene--login"
    >
      <div
        class="guide-visual__login-page"
        data-guide-part
      >
        <div class="guide-visual__fill-bar">
          <KeyRound
            class="guide-visual__key-icon"
            :size="12"
            :stroke-width="2"
          />
          <span>PwdBook</span>
          <em>{{ t('settings.browserFillGuide.visual.fillAction') }}</em>
        </div>
        <div class="guide-visual__form">
          <div class="guide-visual__form-field" />
          <div class="guide-visual__form-field guide-visual__form-field--pwd" />
          <div class="guide-visual__form-btn" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.guide-visual {
  position: relative;
  min-height: 200px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in srgb, var(--accent-primary) 14%, transparent), transparent 70%),
    color-mix(in srgb, var(--accent-primary) 4%, var(--bg-elevated));
  overflow: hidden;
}

.guide-visual__scene {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px 24px;
  gap: 16px;
}

.guide-visual__scene-icon {
  position: absolute;
  right: 16px;
  top: 14px;
  color: color-mix(in srgb, var(--accent-primary) 70%, var(--text-secondary));
  opacity: 0.85;
}

.guide-visual__app-window {
  width: min(100%, 280px);
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  box-shadow: 0 16px 40px color-mix(in srgb, var(--accent-primary) 12%, transparent);
  overflow: hidden;
}

.guide-visual__app-titlebar {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.guide-visual__app-titlebar span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--text-muted) 35%, transparent);
}

.guide-visual__app-body {
  padding: 18px 16px;
}

.guide-visual__app-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--text-primary);
}

.guide-visual__switch {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
}

.guide-visual__switch-glow {
  position: absolute;
  inset: -8px -4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-primary) 25%, transparent);
  opacity: 0;
  pointer-events: none;
}

.guide-visual__switch-track {
  position: relative;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: var(--accent-primary);
}

.guide-visual__switch-knob {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--bg-app);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.guide-visual__switch-icon {
  color: var(--accent-primary);
}

.guide-visual__browser {
  width: min(100%, 300px);
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
}

.guide-visual__browser-bar {
  height: 28px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent-primary) 8%, var(--bg-elevated)),
    color-mix(in srgb, var(--accent-primary) 22%, var(--bg-elevated)),
    color-mix(in srgb, var(--accent-primary) 8%, var(--bg-elevated))
  );
  background-size: 200% 100%;
}

.guide-visual__browser-content {
  padding: 20px 16px;
  min-height: 88px;
}

.guide-visual__browser-content--empty {
  min-height: 48px;
}

.guide-visual__ext-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  border: 1px dashed color-mix(in srgb, var(--accent-primary) 45%, var(--border-default));
  background: color-mix(in srgb, var(--accent-primary) 6%, var(--bg-elevated));
}

.guide-visual__ext-card strong {
  display: block;
  font-size: 12px;
  color: var(--text-primary);
}

.guide-visual__ext-card small {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: var(--text-muted);
}

.guide-visual__puzzle {
  color: var(--accent-primary);
  flex-shrink: 0;
}

.guide-visual__id-card {
  width: min(100%, 320px);
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--border-strong, var(--border-default));
  background: var(--bg-surface);
  box-shadow: 0 14px 36px color-mix(in srgb, var(--accent-primary) 10%, transparent);
}

.guide-visual__id-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.guide-visual__id-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.guide-visual__id-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.guide-visual__id-value {
  position: relative;
  flex: 1;
  overflow: hidden;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 9px;
  letter-spacing: 0.04em;
  color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 10%, var(--bg-elevated));
  border: 1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent);
}

.guide-visual__id-shimmer {
  position: absolute;
  inset: 0;
  width: 40%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.22), transparent);
  transform: translateX(-120%);
  pointer-events: none;
}

.guide-visual__copy-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--accent-primary);
  color: var(--bg-app);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--accent-primary) 40%, transparent);
}

.guide-visual__scene--link {
  flex-direction: row;
  gap: 10px;
}

.guide-visual__node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: var(--text-secondary);
  text-align: center;
}

.guide-visual__node__icon,
.guide-visual__node svg {
  width: 52px;
  height: 52px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  color: var(--accent-primary);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--accent-primary) 15%, transparent);
}

.guide-visual__link {
  position: relative;
  flex: 1;
  min-width: 80px;
  height: 3px;
  display: flex;
  align-items: center;
}

.guide-visual__link-beam {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 40%, transparent));
  transform: scaleX(0);
  opacity: 0;
}

.guide-visual__link-pulse {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-primary);
  color: var(--bg-app);
  box-shadow: 0 0 16px color-mix(in srgb, var(--accent-primary) 50%, transparent);
}

.guide-visual__lock-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 34px;
  height: 34px;
  margin: -17px 0 0 -17px;
  border-radius: 50%;
  border: 1px solid var(--status-safe, var(--accent-primary));
  opacity: 0;
  pointer-events: none;
}

.guide-visual__link-key {
  position: absolute;
  left: 50%;
  top: -28px;
  transform: translateX(-50%);
  color: var(--status-safe, var(--accent-primary));
}

.guide-visual__restart {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: var(--text-secondary);
  z-index: 1;
}

.guide-visual__restart-arrow {
  color: var(--accent-primary);
}

.guide-visual__browser-ghost {
  position: absolute;
  bottom: 16px;
  width: 200px;
  opacity: 0.5;
}

.guide-visual__scene--login {
  padding: 20px;
}

.guide-visual__login-page {
  position: relative;
  width: min(100%, 280px);
  padding: 36px 20px 24px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
}

.guide-visual__fill-bar {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong, var(--border-default));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.guide-visual__fill-bar em {
  font-style: normal;
  font-size: 9px;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--accent-primary);
  color: var(--bg-app);
}

.guide-visual__key-icon {
  color: var(--accent-primary);
}

.guide-visual__form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.guide-visual__form-field {
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.guide-visual__form-field--pwd {
  border-color: var(--border-default);
}

.guide-visual__form-btn {
  height: 30px;
  width: 40%;
  margin-top: 4px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent-primary) 80%, transparent);
}
</style>
