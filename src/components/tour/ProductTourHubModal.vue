<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import gsap from 'gsap'
import {
  Check,
  Compass,
  FolderOpen,
  KeyRound,
  PanelTop,
  Settings,
  Sparkles,
  Wrench,
  X,
} from 'lucide-vue-next'
import { useProductTour } from '@/composables/useProductTour'
import type { ProductTourDefinition } from '@/shared/productTourTypes'

const { t } = useI18n()
const { hubOpen, closeHub, startTour, completedTourIds, PRODUCT_TOURS } = useProductTour()

const rootRef = ref<HTMLElement | null>(null)
let ctx: gsap.Context | null = null

const iconMap = {
  compass: Compass,
  folder: FolderOpen,
  key: KeyRound,
  wrench: Wrench,
  'panel-top': PanelTop,
  settings: Settings,
} as const

const tours = computed(() => PRODUCT_TOURS)

function tourIcon(tour: ProductTourDefinition) {
  return iconMap[tour.icon]
}

function isDone(id: string): boolean {
  return completedTourIds.value.includes(id)
}

function killAnim(): void {
  ctx?.revert()
  ctx = null
}

function animateIn(): void {
  if (!rootRef.value) return
  killAnim()
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) return

  ctx = gsap.context(() => {
    gsap.fromTo(
      '.tour-hub-backdrop',
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.35, ease: 'power2.out' },
    )
    gsap.fromTo(
      '.tour-hub-panel',
      { autoAlpha: 0, y: 28, scale: 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', delay: 0.05 },
    )
    gsap.fromTo(
      '.tour-hub-card',
      { autoAlpha: 0, y: 22, scale: 0.94 },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
        stagger: 0.07,
        ease: 'back.out(1.4)',
        delay: 0.12,
      },
    )
  }, rootRef.value)
}

watch(hubOpen, async (open) => {
  if (open) {
    await nextTick()
    animateIn()
  } else {
    killAnim()
  }
})

onUnmounted(killAnim)

function handleStart(id: string): void {
  void startTour(id)
}

function onBackdropClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) closeHub()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="tour-fade">
      <div
        v-if="hubOpen"
        ref="rootRef"
        class="tour-hub-root"
        @click="onBackdropClick"
      >
        <div class="tour-hub-backdrop" />

        <section
          class="tour-hub-panel surface-card"
          role="dialog"
          aria-modal="true"
          :aria-label="t('productTour.hubTitle')"
          @click.stop
        >
          <header class="tour-hub-header">
            <div class="tour-hub-hero">
              <span class="tour-hub-hero-icon">
                <Sparkles
                  :size="22"
                  :stroke-width="1.75"
                />
              </span>
              <div>
                <h2 class="tour-hub-title font-display">
                  {{ t('productTour.hubTitle') }}
                </h2>
                <p class="tour-hub-subtitle">
                  {{ t('productTour.hubSubtitle') }}
                </p>
              </div>
            </div>
            <button
              type="button"
              class="tour-hub-close"
              :aria-label="t('common.close')"
              @click="closeHub"
            >
              <X
                :size="18"
                :stroke-width="2"
              />
            </button>
          </header>

          <div class="tour-hub-grid">
            <button
              v-for="tour in tours"
              :key="tour.id"
              type="button"
              class="tour-hub-card"
              :class="{ 'tour-hub-card--done': isDone(tour.id) }"
              :style="{ '--tour-accent': tour.accent }"
              @click="handleStart(tour.id)"
            >
              <span
                class="tour-hub-card-icon"
                aria-hidden="true"
              >
                <component
                  :is="tourIcon(tour)"
                  :size="20"
                  :stroke-width="1.75"
                />
              </span>
              <span class="tour-hub-card-body">
                <span class="tour-hub-card-title">{{ t(tour.titleKey) }}</span>
                <span class="tour-hub-card-desc">{{ t(tour.descKey) }}</span>
                <span class="tour-hub-card-meta">{{ t(tour.durationKey) }}</span>
              </span>
              <span
                v-if="isDone(tour.id)"
                class="tour-hub-card-check"
                :title="t('productTour.completed')"
              >
                <Check
                  :size="14"
                  :stroke-width="2.5"
                />
              </span>
            </button>
          </div>

          <p class="tour-hub-footnote">
            {{ t('productTour.hubHint') }}
          </p>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
