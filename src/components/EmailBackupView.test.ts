/* eslint-disable vue/one-component-per-file */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, h, nextTick, ref, type App } from 'vue'

const mocks = vi.hoisted(() => ({
  state: null as object | null,
  showToast: vi.fn(),
}))

vi.mock('@/composables/useAppState', () => ({ useAppState: () => mocks.state }))
vi.mock('@/composables/useTheme', () => ({ useTheme: () => ({ isAnimalIsland: false }) }))
vi.mock('@/composables/useToast', () => ({ showToast: mocks.showToast }))
vi.mock('@/components/MasterPasswordConfirmModal.vue', () => ({ default: { render: () => null } }))
vi.mock('@/components/ui', async () => {
  const { defineComponent, h } = await import('vue')

  const UiInput = defineComponent({
    props: {
      modelValue: { type: [String, Number], default: '' },
      type: { type: String, default: 'text' },
      placeholder: { type: String, default: undefined },
      disabled: Boolean,
      readonly: Boolean,
      maxlength: { type: Number, default: undefined },
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () => h('input', {
        ...attrs,
        type: props.type,
        value: String(props.modelValue),
        placeholder: props.placeholder,
        disabled: props.disabled,
        readonly: props.readonly,
        maxlength: props.maxlength,
        onInput: (event: { target: { value: string } }) => emit('update:modelValue', event.target.value),
      })
    },
  })

  const UiButton = defineComponent({
    props: { disabled: Boolean, loading: Boolean, htmlType: { type: String, default: 'button' } },
    emits: ['click'],
    setup(props, { attrs, emit, slots }) {
      return () => h('button', {
        ...attrs,
        type: props.htmlType,
        disabled: props.disabled || props.loading,
        onClick: (event: unknown) => emit('click', event),
      }, slots.default?.())
    },
  })

  const UiCheckbox = defineComponent({
    props: { modelValue: Boolean, label: { type: String, default: undefined }, disabled: Boolean },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () => h('input', {
        ...attrs,
        type: 'checkbox',
        checked: props.modelValue,
        disabled: props.disabled,
        onChange: (event: { target: { checked: boolean } }) => emit('update:modelValue', event.target.checked),
      })
    },
  })

  return { UiInput, UiButton, UiCheckbox }
})

interface TestNode {
  type: string
  text: string
  props: Record<string, unknown>
  style: { display: string }
  children: TestNode[]
  parent: TestNode | null
}

const createNode = (type: string, text = ''): TestNode => ({
  type,
  text,
  props: {},
  style: { display: '' },
  children: [],
  parent: null,
})

const renderer = createRenderer<TestNode, TestNode>({
  querySelector: () => null,
  createElement: (type) => createNode(type),
  createText: (text) => createNode('text', text),
  createComment: (text) => createNode('comment', text),
  setText: (node, text) => { node.text = text },
  setElementText: (node, text) => { node.text = text; node.children = [] },
  patchProp: (node, key, _previous, value) => { node.props[key] = value },
  insert(node, parent, anchor) {
    if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1)
    node.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, node)
  },
  remove(node) {
    if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1)
  },
  parentNode: (node) => node.parent,
  nextSibling: (node) => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
})

const flatten = (node: TestNode): TestNode[] => [node, ...node.children.flatMap(flatten)]
const textContent = (node: TestNode): string => node.text + node.children.map(textContent).join('')
const settle = async (): Promise<void> => {
  for (let index = 0; index < 6; index++) await nextTick()
}

let app: App
let root: TestNode
let updateSettings: ReturnType<typeof vi.fn>
let testConnection: ReturnType<typeof vi.fn>

beforeEach(async () => {
  mocks.showToast.mockReset()
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })

  const emailBackupSettings = ref({
    recipientEmail: '',
    frequency: 'manual' as const,
    smtp: {
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      username: '',
      hasPassword: false,
    },
    lastBackup: { at: null, entryCount: 0, sizeBytes: 0, status: 'never' as const },
  })
  updateSettings = vi.fn(async (partial) => {
    const current = emailBackupSettings.value
    emailBackupSettings.value = {
      ...current,
      ...partial,
      smtp: {
        ...current.smtp,
        ...partial.smtp,
        hasPassword: Boolean(partial.smtp?.password) || current.smtp.hasPassword,
      },
    }
  })
  testConnection = vi.fn(async () => { throw new Error('请先完成 SMTP 发信设置') })
  mocks.state = {
    emailBackupSettings,
    loadEmailBackupSettings: vi.fn(async () => undefined),
    updateEmailBackupSettings: updateSettings,
    testEmailBackupConnection: testConnection,
    sendEmailBackup: vi.fn(async () => undefined),
    navigateTo: vi.fn(),
  }

  const [{ default: EmailBackupView }, { i18n }] = await Promise.all([
    import('./EmailBackupView.vue'),
    import('@/i18n'),
  ])
  root = createNode('root')
  app = renderer.createApp({ render: () => h(EmailBackupView, { embedded: true }) })
  app.use(i18n)
  app.mount(root)
  await settle()
})

afterEach(() => {
  app?.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('email backup settings', () => {
  it('automatically saves changed SMTP fields', async () => {
    vi.useFakeTimers()
    const hostInput = flatten(root).find((node) => node.type === 'input' && node.props.placeholder === 'smtp.example.com')
    expect(hostInput).toBeDefined()

    ;(hostInput!.props.onInput as (event: unknown) => void)({ target: { value: 'mail.example.net' } })
    await settle()
    await vi.advanceTimersByTimeAsync(700)
    await settle()

    expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({
      smtp: expect.objectContaining({ host: 'mail.example.net' }),
    }))
  })

  it('does not save a password a second time when its field loses focus', async () => {
    vi.useFakeTimers()
    const passwordInput = flatten(root).find((node) => node.type === 'input' && node.props.placeholder === '邮箱 SMTP 授权码')
    expect(passwordInput).toBeDefined()

    let passwordField = passwordInput!.parent
    while (passwordField && typeof passwordField.props.onFocusin !== 'function') {
      passwordField = passwordField.parent
    }
    expect(passwordField).toBeDefined()
    ;(passwordField!.props.onFocusin as () => void)()
    ;(passwordInput!.props.onInput as (event: unknown) => void)({ target: { value: 'app-secret' } })
    await settle()
    await vi.advanceTimersByTimeAsync(700)
    await settle()

    expect(updateSettings).toHaveBeenCalledTimes(1)
    ;(passwordField!.props.onFocusout as () => void)()
    await settle()
    await vi.advanceTimersByTimeAsync(700)
    await settle()

    expect(updateSettings).toHaveBeenCalledTimes(1)
  })

  it('does not show a manual save button', () => {
    const buttons = flatten(root).filter((node) => node.type === 'button')
    expect(buttons.some((button) => textContent(button).trim() === '保存设置')).toBe(false)
  })

  it('shows only the connection error when testing an incomplete SMTP setup', async () => {
    const buttons = flatten(root).filter((node) => node.type === 'button')
    const testButton = buttons.find((button) => textContent(button).trim() === '测试连接')
    expect(testButton).toBeDefined()
    await (testButton!.props.onClick as (event: unknown) => Promise<void>)({ stopPropagation() {} })
    await settle()

    expect(testConnection).toHaveBeenCalledOnce()
    expect(mocks.showToast).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenCalledWith('请先完成 SMTP 发信设置', 'error')
  })
})
