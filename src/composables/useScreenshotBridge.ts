import { useAppState } from '@/composables/useAppState'
import { useTheme } from '@/composables/useTheme'
import type { AppScreen, SettingsTab, ThemeSkin } from '@/types'

type ScreenshotCommand = {
  action: 'applyTheme' | 'bootstrap' | 'navigate'
  skin?: ThemeSkin
  screen?: AppScreen
  settingsTab?: SettingsTab
  selectFirstEntry?: boolean
}

export function initScreenshotBridge(): void {
  const { setSkin } = useTheme()
  const { bootstrap, navigateTo, entries, selectEntry } = useAppState()

  window.__PWD_BOOK_SCREENSHOT_READY__ = true

  window.addEventListener('pwdbook-screenshot', (event) => {
    void (async () => {
      const detail = (event as CustomEvent<ScreenshotCommand>).detail

      if (detail.action === 'applyTheme' && detail.skin) {
        setSkin(detail.skin)
        return
      }

      if (detail.action === 'bootstrap') {
        await bootstrap()
        if (detail.screen) {
          navigateTo(detail.screen, detail.settingsTab ?? 'security')
        }
        if (detail.selectFirstEntry && entries.value.length > 0) {
          selectEntry(entries.value[0].id)
        }
        return
      }

      if (detail.action === 'navigate' && detail.screen) {
        navigateTo(detail.screen, detail.settingsTab ?? 'security')
      }
    })()
  })
}
