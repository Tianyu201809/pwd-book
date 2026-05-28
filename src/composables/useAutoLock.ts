import { onMounted, onUnmounted, watch } from 'vue'
import { useAppState } from '@/composables/useAppState'

export function useAutoLock(): void {
  const { screen, securitySettings, lastActivityAt, lock } = useAppState()
  let timer: number | null = null

  const resetTimer = (): void => {
    if (timer) window.clearInterval(timer)
    if (screen.value !== 'vault' && screen.value !== 'settings') return

    const minutes = securitySettings.value.autoLockMinutes
    if (!minutes || minutes <= 0) return

    timer = window.setInterval(() => {
      const idleMs = Date.now() - lastActivityAt.value
      if (idleMs >= minutes * 60 * 1000) {
        lock()
      }
    }, 1000)
  }

  onMounted(resetTimer)

  watch([screen, securitySettings, lastActivityAt], resetTimer, { deep: true })

  onUnmounted(() => {
    if (timer) window.clearInterval(timer)
  })
}
