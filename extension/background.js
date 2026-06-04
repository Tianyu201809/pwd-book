const NATIVE_HOST = 'com.pwdbook.app'

function sendNative(message) {
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connectNative(NATIVE_HOST)
    port.onMessage.addListener(resolve)
    port.onDisconnect.addListener(() => {
      const err = chrome.runtime.lastError
      if (err) reject(new Error(err.message))
    })
    port.postMessage(message)
  })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    try {
      const response = await sendNative(message)
      sendResponse(response)
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'NATIVE_ERROR',
      })
    }
  })()
  return true
})
