const statusEl = document.getElementById('status')

const ERROR_HINTS = {
  BRIDGE_NOT_RUNNING:
    '未找到本机桥接：请运行 PwdBook，在 设置→安全 开启「浏览器自动填充」，并保持应用未退出。',
  BROWSER_BRIDGE_DISABLED: '请在 PwdBook 设置→安全 中开启「浏览器自动填充」。',
  VAULT_LOCKED: '保险库已锁定，请先在 PwdBook 中解锁。',
  NATIVE_ERROR: '无法连接 Native Host，请重新执行 npm run register-native-host 并重启浏览器。',
}

function formatError(code) {
  return ERROR_HINTS[code] || code || '无法连接 PwdBook'
}

void chrome.runtime
  .sendMessage({ action: 'status' })
  .then((res) => {
    if (!res?.ok) {
      statusEl.textContent = formatError(res?.error)
      statusEl.className = 'err'
      return
    }
    const { unlocked, entryCount } = res.data || {}
    if (!unlocked) {
      statusEl.textContent = '请先打开 PwdBook 并解锁保险库'
      statusEl.className = 'err'
      return
    }
    statusEl.textContent = `已连接本地保险库 · ${entryCount} 条记录`
    statusEl.className = 'ok'
  })
  .catch(() => {
    statusEl.textContent = '无法连接本机 PwdBook（请确认已开启浏览器集成）'
    statusEl.className = 'err'
  })
