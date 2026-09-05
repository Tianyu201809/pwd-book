<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import gsap from 'gsap'
import { Check, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-vue-next'
import ClipboardGuideVisual from '@/components/clipboard/ClipboardGuideVisual.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  historyEnabled: boolean
}>()

const emit = defineEmits<{
  openWindow: []
}>()

const { t, tm } = useI18n()

const STEP_COUNT = 6
const currentStep = ref(0)
const guideRootRef = ref<HTMLElement | null>(null)
const progressRef = ref<HTMLElement | null>(null)
let ctx: gsap.Context | null = null
let stepCtx: gsap.Context | null = null

const steps = computed(() => {
  const raw = tm('settings.clipboardGuide.steps') as Array<{
    title: string
    desc: string
    tip?: string
  }>
  return Array.isArray(raw) ? raw : []
})

const stepMeta = computed(() => steps.value[currentStep.value])
const progressPercent = computed(() => ((currentStep.value + 1) / STEP_COUNT) * 100)
const isLastStep = computed(() => currentStep.value >= STEP_COUNT - 1)
const showOpenWindow = computed(() => currentStep.value === 1 || currentStep.value === 5)

function killAnimations(): void {
  stepCtx?.revert()
  stepCtx = null
  ctx?.revert()
  ctx = null
}

function animateOpen(): void {
  if (!guideRootRef.value) return
  killAnimations()

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    animateStepContent(false)
    return
  }

  ctx = gsap.context(() => {
    gsap.fromTo(
      '.guide-hero__badge',
      { autoAlpha: 0, scale: 0.6, rotation: -12 },
      { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(2.2)' },
    )
    gsap.fromTo(
      '.guide-progress__fill',
      { scaleX: 0 },
      { scaleX: progressPercent.value / 100, duration: 0.85, ease: 'power3.out', delay: 0.1 },
    )
    gsap.fromTo(
      '.guide-step-dot',
      { autoAlpha: 0, scale: 0.5 },
      {
        autoAlpha: 1,
        scale: 1,
        duration: 0.4,
        stagger: 0.05,
        ease: 'back.out(2)',
        delay: 0.15,
      },
    )
    animateStepContent(false)
  }, guideRootRef.value)
}

function animateStepContent(isTransition: boolean): void {
  if (!guideRootRef.value) return

  stepCtx?.revert()
  stepCtx = gsap.context(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const targets = guideRootRef.value!.querySelectorAll('.guide-step-copy > *')

    if (reduceMotion) {
      gsap.set(targets, { autoAlpha: 1, y: 0 })
      return
    }

    gsap.fromTo(
      targets,
      { autoAlpha: 0, y: isTransition ? 16 : 20 },
      {
        autoAlpha: 1,
        y: 0,
        duration: isTransition ? 0.45 : 0.5,
        stagger: 0.07,
        ease: 'power3.out',
        delay: isTransition ? 0 : 0.25,
      },
    )

    if (progressRef.value) {
      gsap.to(progressRef.value.querySelector('.guide-progress__fill'), {
        scaleX: progressPercent.value / 100,
        duration: 0.55,
        ease: 'power2.out',
        transformOrigin: 'left center',
      })
    }

    gsap.to('.guide-step-dot', {
      scale: (i: number) => (i === currentStep.value ? 1.15 : 1),
      autoAlpha: (i: number) => (i === currentStep.value ? 1 : 0.45),
      duration: 0.35,
      ease: 'power2.out',
    })
  }, guideRootRef.value)
}

function goNext(): void {
  if (isLastStep.value) {
    open.value = false
    return
  }
  currentStep.value += 1
}

function goPrev(): void {
  if (currentStep.value <= 0) return
  currentStep.value -= 1
}

watch(open, (visible) => {
  if (visible) {
    currentStep.value = 0
    void nextTick(() => animateOpen())
  } else {
    killAnimations()
  }
})

watch(currentStep, () => {
  void nextTick(() => animateStepContent(true))
})

onUnmounted(() => {
  killAnimations()
})
</script>

<template>
  <UiModal
    v-model:open="open"
    :width="680"
    :show-footer="true"
    :mask-closable="false"
    :glow="true"
  >
    <template #title>
      <div class="guide-modal-title">
        <span class="guide-hero__badge">
          <Sparkles
            :size="14"
            :stroke-width="2"
          />
        </span>
        <span>
          <strong>{{ t('settings.clipboardGuide.title') }}</strong>
          <small>{{ t('settings.clipboardGuide.subtitle') }}</small>
        </span>
      </div>
    </template>

    <template #close-icon>
      <X
        :size="18"
        :stroke-width="1.75"
      />
    </template>

    <div
      ref="guideRootRef"
      class="clipboard-guide-modal guide-root"
    >
      <div
        ref="progressRef"
        class="guide-progress"
        aria-hidden="true"
      >
        <div class="guide-progress__track">
          <div
            class="guide-progress__fill"
            :style="{ transform: `scaleX(${progressPercent / 100})` }"
          />
        </div>
        <ol class="guide-step-dots">
          <li
            v-for="(_, index) in STEP_COUNT"
            :key="index"
            class="guide-step-dot"
            :class="{ 'guide-step-dot--active': index === currentStep, 'guide-step-dot--done': index < currentStep }"
          >
            <Check
              v-if="index < currentStep"
              :size="10"
              :stroke-width="2.5"
            />
            <span v-else>{{ index + 1 }}</span>
          </li>
        </ol>
      </div>

      <p class="guide-step-label">
        {{ t('settings.clipboardGuide.stepOf', { current: currentStep + 1, total: STEP_COUNT }) }}
      </p>

      <ClipboardGuideVisual :step="currentStep" />

      <div
        v-if="stepMeta"
        class="guide-step-copy"
      >
        <h4>{{ stepMeta.title }}</h4>
        <p>{{ stepMeta.desc }}</p>
        <p
          v-if="stepMeta.tip"
          class="guide-step-tip"
        >
          {{ stepMeta.tip }}
        </p>

        <div
          v-if="currentStep === 0 && historyEnabled"
          class="guide-step-status guide-step-status--ok"
        >
          <Check
            :size="14"
            :stroke-width="2"
          />
          {{ t('settings.clipboardGuide.alreadyEnabled') }}
        </div>

        <div
          v-if="showOpenWindow"
          class="guide-step-actions"
        >
          <UiButton
            variant="default"
            size="small"
            :disabled="!historyEnabled"
            @click="emit('openWindow')"
          >
            {{ t('settings.clipboardOpenWindow') }}
          </UiButton>
        </div>

        <div
          v-if="isLastStep"
          class="guide-step-status guide-step-status--ok"
        >
          <Check
            :size="14"
            :stroke-width="2"
          />
          {{ t('settings.clipboardGuide.readyHint') }}
        </div>
      </div>
    </div>

    <template #footer>
      <div class="guide-footer">
        <UiButton
          variant="default"
          size="small"
          :disabled="currentStep === 0"
          @click="goPrev"
        >
          <ChevronLeft
            :size="14"
            :stroke-width="2"
          />
          {{ t('settings.clipboardGuide.prev') }}
        </UiButton>
        <UiButton
          variant="primary"
          size="small"
          @click="goNext"
        >
          {{ isLastStep ? t('settings.clipboardGuide.finish') : t('settings.clipboardGuide.next') }}
          <ChevronRight
            v-if="!isLastStep"
            :size="14"
            :stroke-width="2"
          />
        </UiButton>
      </div>
    </template>
  </UiModal>
</template>

<style scoped>
.guide-modal-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.guide-modal-title strong {
  display: block;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}

.guide-modal-title small {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
}

.guide-hero__badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 14%, var(--bg-elevated));
  border: 1px solid color-mix(in srgb, var(--accent-primary) 35%, transparent);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--accent-primary) 18%, transparent);
}

.guide-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.guide-progress {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.guide-progress__track {
  height: 3px;
  border-radius: 99px;
  background: color-mix(in srgb, var(--text-muted) 20%, transparent);
  overflow: hidden;
}

.guide-progress__fill {
  height: 100%;
  width: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent-primary) 70%, transparent),
    var(--accent-primary)
  );
  transform-origin: left center;
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent-primary) 45%, transparent);
}

.guide-step-dots {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.guide-step-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
}

.guide-step-dot--active {
  color: var(--bg-app);
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 22%, transparent);
}

.guide-step-dot--done {
  color: var(--status-success, var(--accent-primary));
  border-color: color-mix(in srgb, var(--status-success, var(--accent-primary)) 40%, transparent);
  background: color-mix(in srgb, var(--status-success, var(--accent-primary)) 10%, var(--bg-elevated));
}

.guide-step-label {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.guide-step-copy h4 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}

.guide-step-copy p {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.guide-step-tip {
  margin-top: 10px !important;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px !important;
  color: var(--text-primary) !important;
  background: color-mix(in srgb, var(--accent-primary) 8%, var(--bg-elevated));
  border: 1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent);
}

.guide-step-actions {
  display: flex;
  margin-top: 14px;
}

.guide-step-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.guide-step-status--ok {
  color: var(--status-success);
  background: color-mix(in srgb, var(--status-success) 10%, var(--bg-elevated));
  border: 1px solid color-mix(in srgb, var(--status-success) 25%, transparent);
}

.guide-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.guide-footer :deep(.animal-btn:hover:not(:disabled)),
.guide-footer :deep(.ui-classic-btn:hover) {
  transform: none;
}

.guide-footer :deep(.animal-btn:active:not(:disabled)),
.guide-footer :deep(.ui-classic-btn:active) {
  transform: translateY(1px);
}
</style>

<style>
.modal-overlay:has(.clipboard-guide-modal) .modal-card {
  display: flex;
  flex-direction: column;
  max-height: min(90vh, 860px);
  overflow: hidden;
}

.modal-overlay:has(.clipboard-guide-modal) .modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.modal-overlay:has(.clipboard-guide-modal) .modal-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--border-default);
}

[data-skin='animalIsland'] .animal-modal:has(.clipboard-guide-modal) {
  max-height: min(90vh, 860px);
}

[data-skin='animalIsland'] .animal-modal:has(.clipboard-guide-modal) .animal-modal__content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
}

[data-skin='animalIsland'] .animal-modal:has(.clipboard-guide-modal) .animal-modal__footer {
  flex-shrink: 0;
  width: 100%;
  padding-top: 12px;
  border-top: 1px solid var(--border-default);
}
</style>
