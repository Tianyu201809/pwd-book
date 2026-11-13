import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, h, nextTick, ref, type App } from 'vue'

const passwordFocus = vi.fn()
const unlock = vi.fn()
const loading = ref(false)
const errorMessage = ref('')
const vaultStatus = ref({
  initialized: true,
  unlocked: false,
  entryCount: 1,
  recoveryConfigured: true,
})
const bootState = ref({
  blocked: null,
  warning: null,
  accounts: [{ id: 'default', name: '默认账号' }],
  activeAccountId: 'default',
  activeAccountName: '默认账号',
  vaultFile: 'ready' as const,
  quarantinedPath: null as string | null,
})

vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({ isAnimalIsland: false }),
}))

vi.mock('@/components/ui', () => {
  const passthrough = (tag: string) => ({
    inheritAttrs: false,
    setup(_: unknown, { attrs, slots }: { attrs: Record<string, unknown>, slots: { default?: () => unknown } }) {
      return () => h(tag, attrs, slots.default?.() as never)
    },
  })
  return {
    UiCard: passthrough('div'),
    UiButton: passthrough('button'),
    UiCheckbox: passthrough('checkbox'),
    UiLoading: passthrough('div'),
    UiInput: {
      inheritAttrs: false,
      props: {
        disabled: { type: Boolean, default: false },
        modelValue: { type: String, default: '' },
      },
      emits: ['update:modelValue', 'keydown'],
      setup(props: { disabled: boolean, modelValue: string }, { emit, attrs }: {
        emit: (event: string, ...args: unknown[]) => void
        attrs: Record<string, unknown>
      }) {
        return () => h('input', {
          ...attrs,
          disabled: props.disabled,
          value: props.modelValue,
          onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
          onKeydown: (event: KeyboardEvent) => emit('keydown', event),
        })
      },
    },
  }
})

vi.mock('@/composables/useAppState', () => ({
  useAppState: () => ({
    vaultStatus,
    bootState,
    setupVault: vi.fn(async () => false),
    createAccount: vi.fn(async () => false),
    selectAccount: vi.fn(async () => false),
    rebuildVault: vi.fn(async () => false),
    unlock,
    loading,
    errorMessage,
    clearError: () => {
      errorMessage.value = ''
    },
    enterVault: vi.fn(),
    refreshVaultStatus: vi.fn(async () => {}),
    createRecoveryKey: vi.fn(),
    clearRecoveryKey: vi.fn(),
    resetMasterPasswordWithRecovery: vi.fn(),
    resetVaultFromLock: vi.fn(),
    copyUsername: vi.fn(),
  }),
}))

interface TestNode {
  type: string
  text: string
  props: Record<string, unknown>
  children: TestNode[]
  parent: TestNode | null
  addEventListener: () => void
  removeEventListener: () => void
  getBoundingClientRect: () => { width: number; height: number }
  querySelector: (selector: string) => TestNode | null
  focus: () => void
}

function createNode(type: string): TestNode {
  const el: TestNode = {
    type,
    text: '',
    props: {},
    children: [],
    parent: null,
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({ width: 400, height: 44 }),
    querySelector(selector: string) {
      return flatten(el).find((child) => child !== el && child.type === selector) ?? null
    },
    focus() {
      if (type === 'input') passwordFocus()
    },
  }
  return el
}

const renderer = createRenderer<TestNode, TestNode>({
  querySelector: () => null,
  createElement: (type) => createNode(type),
  createText: (text) => {
    const el = createNode('text')
    el.text = text
    return el
  },
  createComment: (text) => {
    const el = createNode('comment')
    el.text = text
    return el
  },
  setText: (el, text) => {
    el.text = text
  },
  setElementText: (el, text) => {
    el.text = text
    el.children = []
  },
  patchProp: (el, key, _prev, value) => {
    el.props[key] = value
  },
  insert(el, parent, anchor) {
    if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
    el.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, el)
  },
  remove(el) {
    if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
  },
  parentNode: (el) => el.parent,
  nextSibling: (el) => el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null,
})

const flatten = (el: TestNode): TestNode[] => [el, ...el.children.flatMap(flatten)]
const settle = async () => {
  for (let i = 0; i < 8; i++) await nextTick()
}

let app: App
let root: TestNode
let disabledWhileUnlocking: unknown

const passwordInput = () => flatten(root).find((el) => el.type === 'input')!

beforeEach(async () => {
  loading.value = false
  errorMessage.value = ''
  disabledWhileUnlocking = undefined
  passwordFocus.mockClear()
  unlock.mockReset()
  unlock.mockImplementation(async () => {
    loading.value = true
    await nextTick()
    disabledWhileUnlocking = passwordInput().props.disabled
    loading.value = false
    errorMessage.value = '主密码错误'
    return false
  })
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (key === 'pwdbook-locale' ? 'zh-CN' : null),
    setItem: vi.fn(),
  })
  vi.stubGlobal('navigator', { language: 'zh-CN' })
  const { i18n } = await import('@/i18n')
  const { default: LockScreen } = await import('./LockScreen.vue')
  root = createNode('root')
  app = renderer.createApp(LockScreen)
  app.use(i18n)
  app.mount(root)
  await settle()
})

afterEach(() => {
  app?.unmount()
  vi.unstubAllGlobals()
})

describe('lock screen wrong password', () => {
  it('keeps the password field editable and focused after a wrong master password', async () => {
    const input = passwordInput()
    const onInput = input.props.onInput
    const onKeydown = input.props.onKeydown
    if (typeof onInput === 'function') {
      await onInput({ target: { value: 'wrong-password' } })
    }
    await nextTick()
    if (typeof onKeydown === 'function') {
      onKeydown({ key: 'Enter' })
    }
    await settle()

    expect(unlock).toHaveBeenCalledWith('wrong-password')
    expect(disabledWhileUnlocking).not.toBe(true)
    expect(passwordFocus).toHaveBeenCalled()
    expect(passwordInput().props.disabled).not.toBe(true)
  })
})
