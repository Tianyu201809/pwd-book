<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import gsap from 'gsap'
import { Lock, Monitor, Shield, Smartphone, Wifi } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    size?: 'default' | 'large'
    highlight?: 'server' | 'client'
  }>(),
  { size: 'default', highlight: undefined },
)

const { t } = useI18n()
const rootRef = ref<HTMLElement | null>(null)
let ctx: gsap.Context | null = null

function killAnimations(): void {
  ctx?.revert()
  ctx = null
}

function runAnimations(): void {
  if (!rootRef.value) return
  killAnimations()

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    gsap.set(rootRef.value.querySelectorAll('.diagram-node'), { opacity: 1, scale: 1 })
    return
  }

  ctx = gsap.context(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.from('.diagram-node', { autoAlpha: 0, scale: 0.82, duration: 0.55, stagger: 0.12 })
      .from('.diagram-link', { scaleX: 0, duration: 0.7, stagger: 0.1, transformOrigin: 'left center' }, '-=0.3')
      .from('.diagram-hub', { autoAlpha: 0, scale: 0.6, duration: 0.5, ease: 'back.out(1.8)' }, '-=0.4')
      .from('.diagram-packet', { autoAlpha: 0, scale: 0, duration: 0.35, stagger: 0.08 }, '-=0.2')

    gsap.to('.diagram-wave', {
      autoAlpha: 0.35,
      duration: 1.2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      stagger: { each: 0.25, from: 'center' },
    })

    const travel = props.size === 'large' ? 140 : 92
    gsap.to('.diagram-packet--a', {
      x: `+=${travel}`,
      duration: 1.8,
      repeat: -1,
      ease: 'power1.inOut',
      yoyo: true,
    })
    gsap.to('.diagram-packet--b', {
      x: `+=${travel}`,
      duration: 1.8,
      repeat: -1,
      ease: 'power1.inOut',
      yoyo: true,
      delay: 0.9,
    })
    gsap.to('.diagram-shield', {
      rotation: 8,
      duration: 2.4,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      transformOrigin: '50% 50%',
    })
    gsap.to('.diagram-lock-ring', {
      scale: 1.08,
      autoAlpha: 0.55,
      duration: 1.6,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    })
  }, rootRef.value)
}

onMounted(() => {
  void nextTick(() => runAnimations())
})

onUnmounted(() => {
  killAnimations()
})
</script>

<template>
  <div
    ref="rootRef"
    class="tutorial-diagram"
    :class="{
      'tutorial-diagram--large': size === 'large',
      'tutorial-diagram--server': highlight === 'server',
      'tutorial-diagram--client': highlight === 'client',
    }"
    aria-hidden="true"
  >
    <div
      class="diagram-node diagram-node--desktop"
      :class="{ 'diagram-node--active': highlight === 'server' }"
    >
      <div class="diagram-node__icon">
        <Monitor :size="size === 'large' ? 28 : 22" :stroke-width="1.5" />
      </div>
      <span>{{ t('tools.wifiSync.tutorial.diagramDesktop') }}</span>
    </div>

    <div class="diagram-link diagram-link--left">
      <span class="diagram-packet diagram-packet--a">
        <Lock :size="12" :stroke-width="2" />
      </span>
    </div>

    <div class="diagram-hub">
      <div class="diagram-wave diagram-wave--1" />
      <div class="diagram-wave diagram-wave--2" />
      <div class="diagram-wave diagram-wave--3" />
      <Wifi :size="size === 'large' ? 34 : 26" :stroke-width="1.5" />
      <span>{{ t('tools.wifiSync.tutorial.diagramLan') }}</span>
    </div>

    <div class="diagram-link diagram-link--right">
      <span class="diagram-packet diagram-packet--b">
        <Lock :size="12" :stroke-width="2" />
      </span>
    </div>

    <div
      class="diagram-node diagram-node--phone"
      :class="{ 'diagram-node--active': highlight === 'client' }"
    >
      <div class="diagram-node__icon">
        <Smartphone :size="size === 'large' ? 28 : 22" :stroke-width="1.5" />
      </div>
      <span>{{ t('tools.wifiSync.tutorial.diagramClient') }}</span>
    </div>

    <div class="diagram-shield">
      <Shield :size="size === 'large' ? 22 : 18" :stroke-width="1.5" />
      <span class="diagram-lock-ring" />
    </div>
  </div>
</template>

<style scoped>
.tutorial-diagram {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 56px 88px 56px 1fr;
  align-items: center;
  gap: 4px;
  padding: 20px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: color-mix(in srgb, var(--accent-primary) 6%, var(--bg-elevated));
}

.tutorial-diagram--large {
  grid-template-columns: 1fr 80px 120px 80px 1fr;
  gap: 8px;
  padding: 36px 24px;
  max-width: 560px;
  width: 100%;
}

.tutorial-diagram--large .diagram-node__icon {
  width: 64px;
  height: 64px;
  border-radius: 18px;
}

.tutorial-diagram--large .diagram-node {
  font-size: 13px;
  gap: 12px;
}

.tutorial-diagram--large .diagram-hub {
  font-size: 12px;
}

.tutorial-diagram--large .diagram-wave--1 {
  width: 72px;
  height: 72px;
  margin: -36px 0 0 -36px;
}

.tutorial-diagram--large .diagram-wave--2 {
  width: 96px;
  height: 96px;
  margin: -48px 0 0 -48px;
}

.tutorial-diagram--large .diagram-wave--3 {
  width: 120px;
  height: 120px;
  margin: -60px 0 0 -60px;
}

.diagram-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
}

.diagram-node__icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  color: var(--accent-primary);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--accent-primary) 18%, transparent);
  transition: opacity 0.2s, transform 0.2s, border-color 0.2s;
}

.tutorial-diagram--server .diagram-node--phone:not(.diagram-node--active),
.tutorial-diagram--client .diagram-node--desktop:not(.diagram-node--active) {
  opacity: 0.45;
}

.diagram-node--active {
  color: var(--text-primary);
}

.diagram-node--active .diagram-node__icon {
  border-color: var(--accent-primary);
  transform: scale(1.05);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--accent-primary) 28%, transparent);
}

.diagram-link {
  position: relative;
  height: 3px;
  border-radius: 99px;
  background: linear-gradient(90deg, transparent, var(--accent-primary), transparent);
  overflow: visible;
}

.diagram-packet {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-primary);
  color: var(--bg-app);
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent-primary) 45%, transparent);
}

.diagram-hub {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--accent-primary);
  font-size: 10px;
  z-index: 1;
}

.diagram-wave {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 52px;
  height: 52px;
  margin: -26px 0 0 -26px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 35%, transparent);
  pointer-events: none;
}

.diagram-wave--2 {
  width: 68px;
  height: 68px;
  margin: -34px 0 0 -34px;
}

.diagram-wave--3 {
  width: 84px;
  height: 84px;
  margin: -42px 0 0 -42px;
}

.diagram-shield {
  position: absolute;
  right: 14px;
  top: 10px;
  color: var(--status-safe);
  display: flex;
  align-items: center;
  justify-content: center;
}

.diagram-lock-ring {
  position: absolute;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--status-safe);
  pointer-events: none;
}
</style>
