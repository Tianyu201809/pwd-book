import { onMounted, onUnmounted, watch } from 'vue'
import { useAppState } from '@/composables/useAppState'
import { AUTO_LOCK_FOLLOW_SYSTEM } from '@/shared/types'

export function useAutoLock(): void {
  const { screen, securitySettings, lastActivityAt, lock } = useAppState()
  let timer: number | null = null
  let removeSystemLockListener: (() => void) | undefined

  const resetTimer = (): void => {
    if (timer) window.clearInterval(timer)
    if (screen.value !== 'vault' && screen.value !== 'settings') return

    const minutes = securitySettings.value.autoLockMinutes
    if (minutes <= 0) return

    timer = window.setInterval(() => {
      const idleMs = Date.now() - lastActivityAt.value
      if (idleMs >= minutes * 60 * 1000) {
        lock()
      }
    }, 1000)
  }

  const resetSystemLockListener = (): void => {
    removeSystemLockListener?.()
    removeSystemLockListener = undefined

    if (securitySettings.value.autoLockMinutes !== AUTO_LOCK_FOLLOW_SYSTEM) return

    removeSystemLockListener = window.electronAPI?.onSystemLockScreen(() => {
      if (screen.value === 'lock') return
      void lock()
    })
  }

  onMounted(() => {
    resetTimer()
    resetSystemLockListener()
  })

  watch([screen, securitySettings, lastActivityAt], resetTimer, { deep: true })
  watch(securitySettings, resetSystemLockListener, { deep: true })

  onUnmounted(() => {
    if (timer) window.clearInterval(timer)
    removeSystemLockListener?.()
  })
}
