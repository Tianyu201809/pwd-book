<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import gsap from 'gsap'
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-vue-next'
import { useProductTour } from '@/composables/useProductTour'
import type { TourPlacement } from '@/shared/productTourTypes'

const CARD_MARGIN = 16
const VIEWPORT_PAD = 12

const { t } = useI18n()
const {
  activeTour,
  activeStep,
  stepIndex,
  stepCount,
  isActive,
  isFirstStep,
  isLastStep,
  transitioning,
  nextStep,
  prevStep,
  skipTour,
} = useProductTour()

const rootRef = ref<HTMLElement | null>(null)
const cardRef = ref<HTMLElement | null>(null)
const spotlightRef = ref<HTMLElement | null>(null)

const targetRect = ref<{ top: number; left: number; width: number; height: number } | null>(null)
const columnHints = ref<Array<{ top: number; left: number; width: number; height: number; label: string }>>([])
const cardStyle = ref<Record<string, string>>({})
const useFullBackdrop = ref(false)

const COLUMN_HINT_SELECTORS = [
  { selector: '[data-tour="vault-col-sidebar"]', label: '1' },
  { selector: '[data-tour="vault-col-list"]', label: '2' },
  { selector: '[data-tour="vault-col-detail"]', label: '3' },
] as const

let gsapCtx: gsap.Context | null = null
let pulseTween: gsap.core.Tween | null = null

const progressPercent = computed(() =>
  stepCount.value > 0 ? ((stepIndex.value + 1) / stepCount.value) * 100 : 0,
)

const isCenterStep = computed(() => !activeStep.value?.target)

const resolvedCardPlacement = computed((): TourPlacement => {
  const step = activeStep.value
  if (!step) return 'center'
  if (step.cardPlacement) return step.cardPlacement
  if (!step.target) return 'center'
  return step.placement ?? 'bottom'
})

const showColumnHints = computed(() => activeStep.value?.highlight === 'columns')

const stepTitle = computed(() =>
  activeStep.value ? t(activeStep.value.titleKey) : '',
)

const stepBody = computed(() =>
  activeStep.value ? t(activeStep.value.bodyKey) : '',
)

const tourTitle = computed(() =>
  activeTour.value ? t(activeTour.value.titleKey) : '',
)

function killAnimations(): void {
  pulseTween?.kill()
  pulseTween = null
  gsapCtx?.revert()
  gsapCtx = null
  if (cardRef.value) {
    gsap.set(cardRef.value, { clearProps: 'opacity,visibility,transform' })
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 高亮目标与视口的交集，避免超长面板把卡片定位到屏幕外 */
function isOversizedAnchor(rect: DOMRect): boolean {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const viewportArea = vw * vh
  const anchorArea = rect.width * rect.height
  return (
    anchorArea >= viewportArea * 0.55 ||
    (rect.width >= vw * 0.82 && rect.height >= vh * 0.55)
  )
}

function applyCenterCardStyle(): void {
  cardStyle.value = {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    maxWidth: '420px',
  }
}

function resolveColumnHints(): void {
  columnHints.value = COLUMN_HINT_SELECTORS.flatMap(({ selector, label }) => {
    const el = document.querySelector(selector)
    if (!el) return []
    const rect = el.getBoundingClientRect()
    const pad = 6
    return [{
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
      label,
    }]
  })
}

function resolveHighlightMode(anchor: DOMRect | null): 'spotlight' | 'backdrop' | 'columns' {
  const step = activeStep.value
  if (step?.highlight) return step.highlight
  if (resolvedCardPlacement.value === 'center') return 'backdrop'
  if (anchor && isOversizedAnchor(anchor)) return 'backdrop'
  return 'spotlight'
}

/** 高亮目标与视口的交集，避免超长面板把卡片定位到屏幕外 */
function intersectViewport(rect: DOMRect): DOMRect {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const top = clamp(rect.top, VIEWPORT_PAD, vh - VIEWPORT_PAD)
  const bottom = clamp(rect.bottom, VIEWPORT_PAD, vh - VIEWPORT_PAD)
  const left = clamp(rect.left, VIEWPORT_PAD, vw - VIEWPORT_PAD)
  const right = clamp(rect.right, VIEWPORT_PAD, vw - VIEWPORT_PAD)
  return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top))
}

function resolveTargetElement(): Element | null {
  const step = activeStep.value
  if (!step?.target) return null
  let el = document.querySelector(step.target)
  if (!el && step.fallbackTarget) {
    el = document.querySelector(step.fallbackTarget)
  }
  return el
}

function scrollTourTargetIntoView(): void {
  resolveTargetElement()?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
}

function queryTargetRect(): DOMRect | null {
  const el = resolveTargetElement()
  if (!el) return null
  return el.getBoundingClientRect()
}

function layoutCard(placement: TourPlacement, rect: DOMRect | null): void {
  const card = cardRef.value
  if (!card) return

  if (!rect || placement === 'center') {
    applyCenterCardStyle()
    return
  }

  const anchor = intersectViewport(rect)
  if (anchor.width <= 0 || anchor.height <= 0) {
    applyCenterCardStyle()
    return
  }

  const cardRect = card.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cardW = cardRect.width > 0 ? cardRect.width : 380
  const cardH = cardRect.height > 0 ? cardRect.height : 260

  let top = anchor.bottom + CARD_MARGIN
  let left = anchor.left + anchor.width / 2 - cardW / 2
  let resolvedPlacement: TourPlacement = 'bottom'

  if (placement === 'right') {
    top = anchor.top + anchor.height / 2 - cardH / 2
    left = anchor.right + CARD_MARGIN
    resolvedPlacement = 'right'
  } else if (placement === 'left') {
    top = anchor.top + anchor.height / 2 - cardH / 2
    left = anchor.left - cardW - CARD_MARGIN
    resolvedPlacement = 'left'
  } else if (placement === 'top') {
    top = anchor.top - cardH - CARD_MARGIN
    left = anchor.left + anchor.width / 2 - cardW / 2
    resolvedPlacement = 'top'
  } else if (placement === 'bottom') {
    top = anchor.bottom + CARD_MARGIN
    left = anchor.left + anchor.width / 2 - cardW / 2
    resolvedPlacement = 'bottom'
  }

  // 首选方向放不下时，依次尝试其余方向
  const fits = (): boolean =>
    top >= VIEWPORT_PAD &&
    left >= VIEWPORT_PAD &&
    top + cardH <= vh - VIEWPORT_PAD &&
    left + cardW <= vw - VIEWPORT_PAD

  if (!fits()) {
    const tryTop = anchor.top - cardH - CARD_MARGIN
    const tryBottom = anchor.bottom + CARD_MARGIN
    const tryLeft = anchor.left - cardW - CARD_MARGIN
    const tryRight = anchor.right + CARD_MARGIN
    const centerY = anchor.top + anchor.height / 2 - cardH / 2

    if (tryTop >= VIEWPORT_PAD && tryTop + cardH <= vh - VIEWPORT_PAD) {
      top = tryTop
      left = anchor.left + anchor.width / 2 - cardW / 2
      resolvedPlacement = 'top'
    } else if (tryBottom + cardH <= vh - VIEWPORT_PAD) {
      top = tryBottom
      left = anchor.left + anchor.width / 2 - cardW / 2
      resolvedPlacement = 'bottom'
    } else if (tryLeft >= VIEWPORT_PAD) {
      top = centerY
      left = tryLeft
      resolvedPlacement = 'left'
    } else if (tryRight + cardW <= vw - VIEWPORT_PAD) {
      top = centerY
      left = tryRight
      resolvedPlacement = 'right'
    } else {
      top = vh / 2 - cardH / 2
      left = vw / 2 - cardW / 2
      resolvedPlacement = 'center'
    }
  }

  top = clamp(top, VIEWPORT_PAD, Math.max(VIEWPORT_PAD, vh - cardH - VIEWPORT_PAD))
  left = clamp(left, VIEWPORT_PAD, Math.max(VIEWPORT_PAD, vw - cardW - VIEWPORT_PAD))

  cardStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    transform: 'none',
    maxWidth: '380px',
    '--tour-arrow-placement': resolvedPlacement,
  }

  void resolvedPlacement
}

async function updateLayout(): Promise<void> {
  const step = activeStep.value
  columnHints.value = []
  useFullBackdrop.value = false
  targetRect.value = null

  if (!step?.target) {
    useFullBackdrop.value = true
    applyCenterCardStyle()
    return
  }

  if (step.highlight !== 'columns') {
    scrollTourTargetIntoView()
  }
  await nextTick()

  const raw = queryTargetRect()
  const anchor = raw ? intersectViewport(raw) : null
  const mode = resolveHighlightMode(anchor)

  if (mode === 'columns') {
    useFullBackdrop.value = true
    resolveColumnHints()
    applyCenterCardStyle()
    return
  }

  if (mode === 'backdrop') {
    useFullBackdrop.value = true
    applyCenterCardStyle()
    return
  }

  const pad = step.padding ?? 8
  if (anchor && anchor.width > 0 && anchor.height > 0) {
    targetRect.value = {
      top: anchor.top - pad,
      left: anchor.left - pad,
      width: anchor.width + pad * 2,
      height: anchor.height + pad * 2,
    }
  }

  if (resolvedCardPlacement.value === 'center') {
    useFullBackdrop.value = true
    targetRect.value = null
    applyCenterCardStyle()
    return
  }

  if (cardRef.value) {
    gsap.set(cardRef.value, { autoAlpha: 1, visibility: 'visible' })
  }
  await nextTick()
  layoutCard(resolvedCardPlacement.value, anchor ?? raw)
  await nextTick()
  layoutCard(resolvedCardPlacement.value, anchor ?? raw)
}

function animateStepIn(): void {
  if (!rootRef.value || !cardRef.value) return
  killAnimations()

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const centerCard =
    useFullBackdrop.value || resolvedCardPlacement.value === 'center' || !activeStep.value?.target

  if (reduceMotion) {
    gsap.set(cardRef.value, { autoAlpha: 1, scale: 1 })
    return
  }

  gsapCtx = gsap.context(() => {
    if (centerCard) {
      gsap.fromTo(
        cardRef.value,
        { autoAlpha: 0, scale: 0.96 },
        { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out' },
      )
    } else {
      gsap.fromTo(
        cardRef.value,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.45, ease: 'power3.out' },
      )
    }

    if (showColumnHints.value) {
      gsap.fromTo(
        '.tour-column-hint',
        { autoAlpha: 0, scale: 0.94 },
        { autoAlpha: 1, scale: 1, duration: 0.45, stagger: 0.08, ease: 'back.out(1.6)' },
      )
    }

    if (spotlightRef.value && targetRect.value) {
      gsap.fromTo(
        spotlightRef.value,
        { autoAlpha: 0, scale: 0.92 },
        { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'power2.out' },
      )

      pulseTween = gsap.to(spotlightRef.value, {
        boxShadow:
          '0 0 0 9999px rgba(6, 8, 14, 0.78), 0 0 0 0 rgba(var(--accent-rgb), 0.55), inset 0 0 0 1px rgba(var(--accent-rgb), 0.35)',
        duration: 1.4,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
    }

    gsap.fromTo(
      '.tour-progress-fill',
      { scaleX: 0 },
      { scaleX: progressPercent.value / 100, duration: 0.7, ease: 'power3.out', transformOrigin: 'left center' },
    )
  }, rootRef.value)
}

function onKeydown(event: KeyboardEvent): void {
  if (!isActive.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    skipTour()
    return
  }
  if (event.key === 'ArrowRight' || event.key === 'Enter') {
    event.preventDefault()
    void nextStep()
    return
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    void prevStep()
  }
}

watch([activeStep, isActive], async () => {
  if (!isActive.value) {
    killAnimations()
    return
  }
  await updateLayout()
  await nextTick()
  animateStepIn()
}, { flush: 'post' })

watch(transitioning, (v) => {
  if (v && cardRef.value) {
    gsap.to(cardRef.value, { autoAlpha: 0.55, scale: 0.98, duration: 0.18, ease: 'power2.in' })
  } else if (cardRef.value) {
    gsap.set(cardRef.value, { autoAlpha: 1, scale: 1 })
  }
})

function onResize(): void {
  if (isActive.value) void updateLayout()
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  window.addEventListener('scroll', onResize, true)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('scroll', onResize, true)
  document.removeEventListener('keydown', onKeydown)
  killAnimations()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="tour-fade">
      <div
        v-if="isActive && activeStep"
        ref="rootRef"
        class="product-tour-root"
        role="dialog"
        aria-modal="true"
        :aria-label="tourTitle"
      >
        <div
          v-if="isCenterStep || useFullBackdrop"
          class="tour-backdrop tour-backdrop--full"
        />
        <div
          v-for="hint in columnHints"
          :key="hint.label"
          class="tour-column-hint"
          :style="{
            top: `${hint.top}px`,
            left: `${hint.left}px`,
            width: `${hint.width}px`,
            height: `${hint.height}px`,
          }"
        >
          <span class="tour-column-hint__badge">{{ hint.label }}</span>
        </div>
        <div
          v-if="targetRect && !useFullBackdrop"
          ref="spotlightRef"
          class="tour-spotlight"
          :style="{
            top: `${targetRect.top}px`,
            left: `${targetRect.left}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
          }"
        />

        <article
          ref="cardRef"
          class="tour-card surface-card"
          :class="{
            'tour-card--center':
              isCenterStep || useFullBackdrop || resolvedCardPlacement === 'center',
          }"
          :style="cardStyle"
        >
          <div
            class="tour-card-glow"
            aria-hidden="true"
          />

          <header class="tour-card-header">
            <div class="tour-card-badge">
              <Sparkles
                :size="14"
                :stroke-width="2"
              />
              <span>{{ tourTitle }}</span>
            </div>
            <button
              type="button"
              class="tour-close-btn"
              :aria-label="t('productTour.skip')"
              @click="skipTour"
            >
              <X
                :size="16"
                :stroke-width="2"
              />
            </button>
          </header>

          <div class="tour-progress">
            <div
              class="tour-progress-fill"
              :style="{ transform: `scaleX(${progressPercent / 100})` }"
            />
          </div>

          <p class="tour-step-index">
            {{ t('productTour.stepOf', { current: stepIndex + 1, total: stepCount }) }}
          </p>

          <h3 class="tour-card-title font-display">
            {{ stepTitle }}
          </h3>
          <p class="tour-card-body">
            {{ stepBody }}
          </p>

          <footer class="tour-card-footer">
            <button
              type="button"
              class="tour-link-btn"
              @click="skipTour"
            >
              {{ t('productTour.skip') }}
            </button>
            <div class="tour-nav">
              <button
                type="button"
                class="tour-nav-btn"
                :disabled="isFirstStep"
                @click="prevStep"
              >
                <ChevronLeft
                  :size="16"
                  :stroke-width="2"
                />
                {{ t('productTour.prev') }}
              </button>
              <button
                type="button"
                class="tour-primary-btn"
                @click="nextStep"
              >
                {{ isLastStep ? t('productTour.finish') : t('productTour.next') }}
                <ChevronRight
                  v-if="!isLastStep"
                  :size="16"
                  :stroke-width="2"
                />
              </button>
            </div>
          </footer>
        </article>
      </div>
    </Transition>
  </Teleport>
</template>
