const ROOT_ID = 'pwdbook-fill-root'
const SCAN_DEBOUNCE_MS = 250

const KEY_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M11.5 11.5 21 2"/><path d="M16 2h5v5"/></svg>`
const CHEVRON_SVG = `<svg class="pwdbook-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`

function createBrand() {
  const brand = document.createElement('div')
  brand.className = 'pwdbook-brand'
  const mark = document.createElement('span')
  mark.className = 'pwdbook-mark'
  mark.innerHTML = KEY_ICON_SVG
  const title = document.createElement('span')
  title.className = 'pwdbook-title'
  title.textContent = 'PwdBook'
  brand.append(mark, title)
  return brand
}

function createPrimaryButton(label, onClick) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'pwdbook-btn pwdbook-btn-primary'
  btn.textContent = label
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
  })
  return btn
}

let scanTimer = null
let lastMatchSignature = ''

function findPasswordField() {
  const fields = document.querySelectorAll('input[type="password"]')
  return fields.length ? fields[0] : null
}

function findUsernameField(passwordField) {
  const form = passwordField.closest('form')
  const scope = form || document
  const candidates = scope.querySelectorAll(
    'input[type="text"], input[type="email"], input:not([type]), input[type="tel"]',
  )
  let best = null
  for (const input of candidates) {
    if (input === passwordField) continue
    const name = (input.name || input.id || '').toLowerCase()
    if (name.includes('user') || name.includes('email') || name.includes('login')) {
      return input
    }
    if (!best) best = input
  }
  return best
}

function fillInput(el, value) {
  if (!el || value == null) return
  el.focus()
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function removeUi() {
  document.getElementById(ROOT_ID)?.remove()
  lastMatchSignature = ''
}

function matchSignature(matches) {
  return matches.map((m) => m.id).join('\u0001')
}

function isOurUiNode(node) {
  const root = document.getElementById(ROOT_ID)
  if (!root || !node) return false
  return node === root || root.contains(node)
}

function shouldIgnoreMutation(record) {
  if (isOurUiNode(record.target)) return true
  if (record.addedNodes) {
    for (const n of record.addedNodes) {
      if (isOurUiNode(n)) return true
    }
  }
  if (record.removedNodes) {
    for (const n of record.removedNodes) {
      if (isOurUiNode(n)) return true
    }
  }
  return false
}

function createUi(matches, pageUrl) {
  const signature = matchSignature(matches)
  if (!matches.length) {
    removeUi()
    return
  }
  if (signature === lastMatchSignature && document.getElementById(ROOT_ID)) {
    return
  }

  removeUi()
  lastMatchSignature = signature

  const root = document.createElement('div')
  root.id = ROOT_ID
  root.addEventListener('mousedown', (e) => e.stopPropagation())
  root.addEventListener('click', (e) => e.stopPropagation())

  const actions = document.createElement('div')
  actions.className = 'pwdbook-actions'

  root.appendChild(createBrand())
  root.appendChild(actions)

  const fillOne = async (entryId) => {
    const res = await chrome.runtime.sendMessage({
      action: 'getCredential',
      entryId,
      pageUrl,
    })
    if (!res?.ok) {
      alert(res?.error || 'Fill failed')
      return
    }
    const pwd = findPasswordField()
    if (!pwd) return
    const user = findUsernameField(pwd)
    fillInput(user, res.data.username)
    fillInput(pwd, res.data.password)
    removeUi()
  }

  if (matches.length === 1) {
    const label = matches[0].title || matches[0].username || '登录'
    actions.appendChild(
      createPrimaryButton(`填充 · ${label}`, () => void fillOne(matches[0].id)),
    )
  } else {
    let selectedId = matches[0].id

    const picker = document.createElement('div')
    picker.className = 'pwdbook-picker'

    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'pwdbook-btn pwdbook-btn-ghost pwdbook-picker-toggle'
    const toggleLabel = document.createElement('span')
    toggleLabel.textContent = formatMatchTitle(matches[0])
    toggle.append(toggleLabel)
    toggle.insertAdjacentHTML('beforeend', CHEVRON_SVG)

    const menu = document.createElement('div')
    menu.className = 'pwdbook-picker-menu'
    menu.hidden = true

    for (const m of matches) {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'pwdbook-picker-item'
      const titleEl = document.createElement('span')
      titleEl.className = 'pwdbook-picker-item-title'
      titleEl.textContent = formatMatchTitle(m)
      item.appendChild(titleEl)
      if (m.username) {
        const userEl = document.createElement('span')
        userEl.className = 'pwdbook-picker-item-user'
        userEl.textContent = m.username
        item.appendChild(userEl)
      }
      item.addEventListener('click', (e) => {
        e.stopPropagation()
        selectedId = m.id
        toggleLabel.textContent = formatMatchTitle(m)
        menu.hidden = true
        picker.classList.remove('is-open')
      })
      menu.appendChild(item)
    }

    toggle.addEventListener('click', (e) => {
      e.stopPropagation()
      const willOpen = menu.hidden
      menu.hidden = !willOpen
      picker.classList.toggle('is-open', willOpen)
      if (willOpen) {
        const closeMenu = () => {
          menu.hidden = true
          picker.classList.remove('is-open')
          document.removeEventListener('click', closeMenu, true)
        }
        setTimeout(() => document.addEventListener('click', closeMenu, true), 0)
      }
    })

    picker.append(toggle, menu)
    actions.appendChild(picker)
    actions.appendChild(
      createPrimaryButton('填充', () => {
        if (selectedId) void fillOne(selectedId)
      }),
    )
  }

  document.documentElement.appendChild(root)
}

function formatMatchTitle(m) {
  return m.title || m.username || '登录'
}

async function scan() {
  const pwd = findPasswordField()
  if (!pwd) {
    removeUi()
    return
  }
  const pageUrl = location.href
  const res = await chrome.runtime.sendMessage({ action: 'matchLogins', pageUrl })
  if (!res?.ok) {
    removeUi()
    return
  }
  const matches = res.data?.matches ?? []
  createUi(matches, pageUrl)
}

function scheduleScan() {
  clearTimeout(scanTimer)
  scanTimer = setTimeout(() => void scan(), SCAN_DEBOUNCE_MS)
}

void scan()

const observer = new MutationObserver((records) => {
  if (records.every(shouldIgnoreMutation)) return
  scheduleScan()
})
observer.observe(document.documentElement, { childList: true, subtree: true })
