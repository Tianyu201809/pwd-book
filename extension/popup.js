const statusEl = document.getElementById('status')
const quickAddBtn = document.getElementById('quick-add')
const addCard = document.getElementById('add-card')
const addForm = document.getElementById('add-form')
const addError = document.getElementById('add-error')
const addSubmit = document.getElementById('add-submit')
const titleInput = document.getElementById('field-title')
const urlInput = document.getElementById('field-url')
const categorySelect = document.getElementById('field-category')
const passwordInput = document.getElementById('field-password')
const togglePasswordBtn = document.getElementById('toggle-password')

const ERROR_HINTS = {
  BRIDGE_NOT_RUNNING:
    '未找到本机桥接：请运行 PwdBook，在 设置→安全 开启「浏览器自动填充」，并保持应用未退出。',
  BROWSER_BRIDGE_DISABLED: '请在 PwdBook 设置→安全 中开启「浏览器自动填充」。',
  VAULT_LOCKED: '保险库已锁定，请先在 PwdBook 中解锁。',
  NATIVE_ERROR: '无法连接 Native Host，请重新执行 npm run register-native-host 并重启浏览器。',
  TITLE_REQUIRED: '请填写标题。',
  TITLE_TOO_LONG: '标题过长。',
  PASSWORD_REQUIRED: '请填写密码。',
  PASSWORD_TOO_LONG: '密码过长。',
  USERNAME_TOO_LONG: '用户名过长。',
  NOTE_TOO_LONG: '备注过长。',
  URL_TOO_LONG: '网址过长。',
  ENTRY_CREATE_FAILED: '添加失败，请稍后重试。',
  CATEGORY_NOT_FOUND: '所选分类不存在，请重新选择。',
}

function formatError(code) {
  return ERROR_HINTS[code] || code || '无法连接 PwdBook'
}

function showAddError(message) {
  addError.hidden = !message
  addError.textContent = message || ''
}

function setConnected(connected) {
  quickAddBtn.hidden = !connected
  if (!connected) addCard.hidden = true
}

async function bridge(message) {
  const res = await chrome.runtime.sendMessage(message)
  if (!res?.ok) throw new Error(res?.error || 'OPERATION_FAILED')
  return res.data
}

async function currentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return {
    url: tab?.url && /^https?:/i.test(tab.url) ? tab.url : '',
    title: tab?.title?.trim() || '',
  }
}

function fillCategoryOptions(categories) {
  categorySelect.replaceChildren()
  const fallback = document.createElement('option')
  fallback.value = ''
  fallback.textContent = categories.length ? '默认分类' : '未分类'
  categorySelect.append(fallback)
  for (const category of categories) {
    const option = document.createElement('option')
    option.value = category.id
    option.textContent = category.name
    categorySelect.append(option)
  }
}

async function openAddCard() {
  showAddError('')
  addCard.hidden = false
  quickAddBtn.hidden = true
  const page = await currentPage()
  titleInput.value = page.title
  urlInput.value = page.url
  try {
    const data = await bridge({ action: 'listCategories' })
    fillCategoryOptions(data?.categories || [])
  } catch (error) {
    fillCategoryOptions([])
    showAddError(formatError(error instanceof Error ? error.message : ''))
  }
  titleInput.focus()
  titleInput.select()
}

function closeAddCard() {
  addCard.hidden = true
  addForm.reset()
  showAddError('')
  if (statusEl.classList.contains('ok')) quickAddBtn.hidden = false
}

quickAddBtn.addEventListener('click', () => {
  void openAddCard()
})
document.getElementById('add-close').addEventListener('click', closeAddCard)
document.getElementById('add-cancel').addEventListener('click', closeAddCard)
togglePasswordBtn.addEventListener('click', () => {
  const visible = passwordInput.type === 'text'
  passwordInput.type = visible ? 'password' : 'text'
  togglePasswordBtn.textContent = visible ? '显示' : '隐藏'
  togglePasswordBtn.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码')
})

addForm.addEventListener('submit', (event) => {
  event.preventDefault()
  void submitEntry()
})

async function submitEntry() {
  showAddError('')
  const payload = {
    title: titleInput.value.trim(),
    url: urlInput.value.trim(),
    username: addForm.username.value.trim(),
    password: passwordInput.value,
    note: addForm.note.value.trim(),
    categoryId: categorySelect.value,
  }
  if (!payload.title) {
    showAddError(formatError('TITLE_REQUIRED'))
    titleInput.focus()
    return
  }
  if (!payload.password) {
    showAddError(formatError('PASSWORD_REQUIRED'))
    passwordInput.focus()
    return
  }

  addSubmit.disabled = true
  addSubmit.textContent = '添加中…'
  try {
    await bridge({ action: 'createEntry', entry: payload })
    closeAddCard()
    statusEl.textContent = `已添加「${payload.title}」`
    statusEl.className = 'ok'
    const status = await bridge({ action: 'status' })
    if (typeof status?.entryCount === 'number') {
      statusEl.textContent = `已添加「${payload.title}」 · ${status.entryCount} 条记录`
    }
  } catch (error) {
    showAddError(formatError(error instanceof Error ? error.message : ''))
  } finally {
    addSubmit.disabled = false
    addSubmit.textContent = '添加'
  }
}

void chrome.runtime
  .sendMessage({ action: 'status' })
  .then((res) => {
    if (!res?.ok) {
      statusEl.textContent = formatError(res?.error)
      statusEl.className = 'err'
      setConnected(false)
      return
    }
    const { unlocked, entryCount } = res.data || {}
    if (!unlocked) {
      statusEl.textContent = '请先打开 PwdBook 并解锁保险库'
      statusEl.className = 'err'
      setConnected(false)
      return
    }
    statusEl.textContent = `已连接本地保险库 · ${entryCount} 条记录`
    statusEl.className = 'ok'
    setConnected(true)
  })
  .catch(() => {
    statusEl.textContent = '无法连接本机 PwdBook（请确认已开启浏览器集成）'
    statusEl.className = 'err'
    setConnected(false)
  })
