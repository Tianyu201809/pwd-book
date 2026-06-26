import { computed, ref } from 'vue'
import { getTourById, PRODUCT_TOURS } from '@/components/tour/productTourCatalog'
import { useAppState } from '@/composables/useAppState'
import {
  TOUR_COMPLETED_STORAGE_PREFIX,
  TOUR_PREPARE_EVENT,
  type ProductTourDefinition,
  type ProductTourStep,
  type TourPrepareAction,
} from '@/shared/productTourTypes'

const hubOpen = ref(false)
const activeTourId = ref<string | null>(null)
const stepIndex = ref(0)
const transitioning = ref(false)

function dispatchPrepare(actions: TourPrepareAction[]): void {
  for (const action of actions) {
    window.dispatchEvent(new CustomEvent(TOUR_PREPARE_EVENT, { detail: { action } }))
  }
}

function cleanupTourUi(): void {
  dispatchPrepare(['collapse-footer-menus', 'collapse-list-menus'])
}

function isTourCompleted(id: string): boolean {
  return localStorage.getItem(`${TOUR_COMPLETED_STORAGE_PREFIX}${id}`) === '1'
}

function markTourCompleted(id: string): void {
  localStorage.setItem(`${TOUR_COMPLETED_STORAGE_PREFIX}${id}`, '1')
}

async function waitForTourTarget(step: ProductTourStep): Promise<void> {
  const selectors = [step.target, step.fallbackTarget].filter(Boolean) as string[]
  if (selectors.length === 0) return

  const deadline = Date.now() + 500
  while (Date.now() < deadline) {
    if (selectors.some((sel) => document.querySelector(sel))) return
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
}

async function runStepPrepare(step: ProductTourStep): Promise<void> {
  const { navigateTo, switchSettingsTab, screen, displayEntries, selectEntry, expandDetailPanel } =
    useAppState()

  if (step.screen && screen.value !== step.screen) {
    navigateTo(step.screen, step.settingsTab ?? 'security')
  } else if (step.settingsTab) {
    switchSettingsTab(step.settingsTab)
  }

  if (step.prepare?.length) {
    dispatchPrepare(step.prepare)
  }

  if (step.prepare?.includes('select-first-entry')) {
    const first = displayEntries.value[0]
    if (first) {
      selectEntry(first.id)
    }
  }

  if (step.prepare?.includes('expand-detail')) {
    expandDetailPanel()
  }

  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
  const hasPopoverPrepare = step.prepare?.some(
    (action) =>
      action === 'expand-utilities' ||
      action === 'expand-toolbox' ||
      action === 'expand-manage' ||
      action === 'expand-tag-filter',
  )
  const settleMs = step.settingsTab ? 180 : hasPopoverPrepare ? 160 : 80
  await new Promise((resolve) => setTimeout(resolve, settleMs))
  await waitForTourTarget(step)
}

export function useProductTour() {
  const { vaultStatus, screen } = useAppState()

  const activeTour = computed<ProductTourDefinition | null>(() => {
    if (!activeTourId.value) return null
    return getTourById(activeTourId.value) ?? null
  })

  const activeStep = computed<ProductTourStep | null>(() => {
    const tour = activeTour.value
    if (!tour) return null
    return tour.steps[stepIndex.value] ?? null
  })

  const isActive = computed(() => activeTourId.value !== null)
  const stepCount = computed(() => activeTour.value?.steps.length ?? 0)
  const isFirstStep = computed(() => stepIndex.value <= 0)
  const isLastStep = computed(() => stepIndex.value >= stepCount.value - 1)

  const completedTourIds = computed(() =>
    PRODUCT_TOURS.filter((t) => isTourCompleted(t.id)).map((t) => t.id),
  )

  function openHub(): void {
    if (!vaultStatus.value.unlocked) return
    hubOpen.value = true
  }

  function closeHub(): void {
    hubOpen.value = false
  }

  async function startTour(tourId: string): Promise<void> {
    const tour = getTourById(tourId)
    if (!tour) return
    if (tour.requiresUnlock && !vaultStatus.value.unlocked) return

    hubOpen.value = false
    activeTourId.value = tourId
    stepIndex.value = 0
    transitioning.value = true
    await runStepPrepare(tour.steps[0])
    transitioning.value = false
  }

  async function goToStep(index: number): Promise<void> {
    const tour = activeTour.value
    if (!tour) return
    const clamped = Math.max(0, Math.min(tour.steps.length - 1, index))
    if (clamped === stepIndex.value) return

    transitioning.value = true
    stepIndex.value = clamped
    await runStepPrepare(tour.steps[clamped])
    transitioning.value = false
  }

  async function nextStep(): Promise<void> {
    const tour = activeTour.value
    if (!tour) return
    if (stepIndex.value >= tour.steps.length - 1) {
      finishTour()
      return
    }
    await goToStep(stepIndex.value + 1)
  }

  async function prevStep(): Promise<void> {
    if (isFirstStep.value) return
    await goToStep(stepIndex.value - 1)
  }

  function finishTour(): void {
    if (activeTourId.value) {
      markTourCompleted(activeTourId.value)
    }
    cleanupTourUi()
    activeTourId.value = null
    stepIndex.value = 0
    transitioning.value = false
  }

  function skipTour(): void {
    cleanupTourUi()
    activeTourId.value = null
    stepIndex.value = 0
    transitioning.value = false
  }

  return {
    PRODUCT_TOURS,
    hubOpen,
    activeTourId,
    activeTour,
    activeStep,
    stepIndex,
    stepCount,
    isActive,
    isFirstStep,
    isLastStep,
    transitioning,
    completedTourIds,
    screen,
    openHub,
    closeHub,
    startTour,
    nextStep,
    prevStep,
    goToStep,
    finishTour,
    skipTour,
    isTourCompleted,
  }
}
