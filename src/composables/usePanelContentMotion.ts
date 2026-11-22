import { onBeforeUnmount } from 'vue'
import gsap from 'gsap'

type PanelEntrySide = 'left' | 'right'

type ActiveMotion = {
  tween: gsap.core.Tween
  done: () => void
}

const MOTION_PROPS = 'transform,transformOrigin,opacity,visibility'

function isAnimatableElement(element: Element): boolean {
  return typeof HTMLElement !== 'undefined' && element instanceof HTMLElement
}

export function usePanelContentMotion(entrySide: PanelEntrySide) {
  const activeMotions = new Map<Element, ActiveMotion>()
  const offset = entrySide === 'left' ? -12 : 12
  let prefersReducedMotion = false

  const media =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? gsap.matchMedia()
      : null

  media?.add('(prefers-reduced-motion: reduce)', () => {
    prefersReducedMotion = true
    for (const [element, motion] of activeMotions) {
      motion.tween.kill()
      activeMotions.delete(element)
      gsap.set(element, { clearProps: MOTION_PROPS })
      motion.done()
    }

    return () => {
      prefersReducedMotion = false
    }
  })

  function stopMotion(element: Element): void {
    activeMotions.get(element)?.tween.kill()
    activeMotions.delete(element)
  }

  function onEnter(element: Element, done: () => void): void {
    if (!isAnimatableElement(element)) {
      done()
      return
    }

    stopMotion(element)
    if (prefersReducedMotion) {
      done()
      return
    }

    const tween = gsap.fromTo(
      element,
      {
        autoAlpha: 0,
        x: offset,
        scale: 0.985,
        transformOrigin: 'center center',
      },
      {
        autoAlpha: 1,
        x: 0,
        scale: 1,
        duration: 0.28,
        ease: 'back.out(1.2)',
        onComplete: () => {
          if (activeMotions.get(element)?.tween !== tween) return
          activeMotions.delete(element)
          gsap.set(element, { clearProps: MOTION_PROPS })
          done()
        },
      },
    )
    activeMotions.set(element, { tween, done })
  }

  function onLeave(element: Element, done: () => void): void {
    if (!isAnimatableElement(element)) {
      done()
      return
    }

    stopMotion(element)
    if (prefersReducedMotion) {
      done()
      return
    }

    const tween = gsap.to(element, {
      autoAlpha: 0,
      x: offset,
      scale: 0.985,
      duration: 0.28,
      ease: 'power2.in',
      onComplete: () => {
        if (activeMotions.get(element)?.tween !== tween) return
        activeMotions.delete(element)
        done()
      },
    })
    activeMotions.set(element, { tween, done })
  }

  function onEnterCancelled(element: Element): void {
    stopMotion(element)
  }

  function onAfterLeave(element: Element): void {
    stopMotion(element)
    if (isAnimatableElement(element)) gsap.set(element, { clearProps: MOTION_PROPS })
  }

  onBeforeUnmount(() => {
    for (const motion of activeMotions.values()) motion.tween.kill()
    activeMotions.clear()
    media?.revert()
  })

  return { onEnter, onLeave, onEnterCancelled, onAfterLeave }
}
