<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import gsap from 'gsap'
import { Check, Clipboard, HardDrive, Keyboard, Pin, ToggleRight } from 'lucide-vue-next'

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
      gsap.to('.guide-visual__keycap', {
        y: -3,
        duration: 0.9,
        stagger: 0.08,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
    }

    if (step === 2) {
      gsap.fromTo(
        '.guide-visual__incoming',
        { y: -18, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.7, ease: 'back.out(1.6)', delay: 0.2 },
      )
      gsap.to('.guide-visual__incoming', {
        boxShadow: '0 0 0 6px color-mix(in srgb, var(--accent-primary) 16%, transparent)',
        duration: 1.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: 0.8,
      })
    }

    if (step === 3) {
      gsap.to('.guide-visual__list-row--active', {
        x: 3,
        duration: 0.9,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
    }

    if (step === 4) {
      gsap.to('.guide-visual__pin', {
        scale: 1.12,
        duration: 1.1,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
    }

    if (step === 5) {
      gsap.fromTo(
        '.guide-visual__ready-badge',
        { autoAlpha: 0, scale: 0.7 },
        { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(2)', delay: 0.2 },
      )
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
            <span>{{ t('settings.clipboardGuide.visual.enableLabel') }}</span>
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
      <Clipboard
        class="guide-visual__scene-icon"
        data-guide-part
        :size="20"
        :stroke-width="1.5"
      />
    </div>

    <div
      v-show="step === 1"
      data-step="1"
      class="guide-visual__scene"
    >
      <div
        class="guide-visual__popup"
        data-guide-part
      >
        <div class="guide-visual__popup-bar" />
        <div class="guide-visual__popup-body">
          <i class="guide-visual__line" />
          <i class="guide-visual__line" />
          <i class="guide-visual__line" />
        </div>
      </div>
      <div
        class="guide-visual__shortcut"
        data-guide-part
      >
        <kbd class="guide-visual__keycap">Shift</kbd>
        <span>+</span>
        <kbd class="guide-visual__keycap">Alt</kbd>
        <span>+</span>
        <kbd class="guide-visual__keycap">O</kbd>
      </div>
      <Keyboard
        class="guide-visual__scene-icon"
        data-guide-part
        :size="20"
        :stroke-width="1.5"
      />
    </div>

    <div
      v-show="step === 2"
      data-step="2"
      class="guide-visual__scene"
    >
      <div
        class="guide-visual__popup"
        data-guide-part
      >
        <div class="guide-visual__popup-bar" />
        <div class="guide-visual__popup-body">
          <div
            class="guide-visual__incoming"
            data-guide-part
          >
            {{ t('settings.clipboardGuide.visual.captureHint') }}
          </div>
          <i class="guide-visual__line" />
          <i class="guide-visual__line" />
        </div>
      </div>
    </div>

    <div
      v-show="step === 3"
      data-step="3"
      class="guide-visual__scene"
    >
      <div
        class="guide-visual__popup"
        data-guide-part
      >
        <div class="guide-visual__popup-bar" />
        <div class="guide-visual__popup-body">
          <div class="guide-visual__list-row guide-visual__list-row--active" />
          <div class="guide-visual__list-row" />
          <div class="guide-visual__list-row" />
        </div>
      </div>
      <div
        class="guide-visual__shortcut"
        data-guide-part
      >
        <kbd>↑</kbd>
        <kbd>↓</kbd>
        <kbd>Enter</kbd>
      </div>
    </div>

    <div
      v-show="step === 4"
      data-step="4"
      class="guide-visual__scene"
    >
      <div
        class="guide-visual__node"
        data-guide-part
      >
        <Pin
          class="guide-visual__pin"
          :size="22"
          :stroke-width="1.6"
        />
        <span>{{ t('tools.clipboardPin') }}</span>
      </div>
      <div
        class="guide-visual__node"
        data-guide-part
      >
        <HardDrive
          :size="22"
          :stroke-width="1.6"
        />
        <span>{{ t('settings.clipboardGuide.visual.persistHint') }}</span>
      </div>
    </div>

    <div
      v-show="step === 5"
      data-step="5"
      class="guide-visual__scene"
    >
      <div
        class="guide-visual__popup"
        data-guide-part
      >
        <div class="guide-visual__popup-bar" />
        <div class="guide-visual__popup-body">
          <div class="guide-visual__list-row guide-visual__list-row--active" />
          <div class="guide-visual__list-row" />
          <div class="guide-visual__list-row" />
        </div>
        <div
          class="guide-visual__ready-badge"
          data-guide-part
        >
          <Check
            :size="14"
            :stroke-width="2.4"
          />
          {{ t('settings.clipboardGuide.visual.readyAction') }}
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

.guide-visual__app-window,
.guide-visual__popup {
  position: relative;
  width: min(100%, 280px);
  border-radius: 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  box-shadow: 0 16px 40px color-mix(in srgb, var(--accent-primary) 12%, transparent);
  overflow: hidden;
}

.guide-visual__app-titlebar,
.guide-visual__popup-bar {
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

.guide-visual__popup-bar {
  min-height: 28px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent-primary) 8%, var(--bg-elevated)),
    color-mix(in srgb, var(--accent-primary) 22%, var(--bg-elevated)),
    color-mix(in srgb, var(--accent-primary) 8%, var(--bg-elevated))
  );
}

.guide-visual__app-body,
.guide-visual__popup-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.guide-visual__app-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
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
}

.guide-visual__switch-icon {
  color: var(--accent-primary);
}

.guide-visual__line {
  display: block;
  height: 10px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--text-muted) 18%, var(--bg-elevated));
}

.guide-visual__line:nth-child(2) {
  width: 72%;
}

.guide-visual__line:nth-child(3) {
  width: 54%;
}

.guide-visual__shortcut {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

kbd,
.guide-visual__keycap {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 3px 8px;
  border-radius: 7px;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  box-shadow: 0 2px 0 color-mix(in srgb, var(--text-primary) 12%, transparent);
  color: var(--text-primary);
  font: 600 11px/1 var(--font-mono);
}

.guide-visual__incoming {
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 10%, var(--bg-elevated));
  border: 1px dashed color-mix(in srgb, var(--accent-primary) 40%, var(--border-default));
}

.guide-visual__list-row {
  height: 14px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--text-muted) 16%, var(--bg-elevated));
}

.guide-visual__list-row--active {
  background: color-mix(in srgb, var(--accent-primary) 28%, var(--bg-elevated));
}

.guide-visual__node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 88px;
  font-size: 11px;
  color: var(--text-secondary);
}

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

.guide-visual__ready-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: var(--status-success);
  background: color-mix(in srgb, var(--status-success) 14%, var(--bg-surface));
  border: 1px solid color-mix(in srgb, var(--status-success) 30%, transparent);
  box-shadow: 0 8px 20px color-mix(in srgb, var(--status-success) 16%, transparent);
}
</style>
