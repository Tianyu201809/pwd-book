import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, defineComponent, h, nextTick, type App } from 'vue'
import type { PasswordEntry } from '@/types'
import type { useAppState } from '@/composables/useAppState'
import type { vaultApi } from '@/services/vaultApi'

vi.mock('@/composables/useTheme', () => ({ useTheme: () => ({ isAnimalIsland: false }) }))
vi.mock('@/components/PanelEdge.vue', () => ({ default: { render: () => null } }))
vi.mock('@/components/IconPickerModal.vue', () => ({ default: { render: () => null } }))
vi.mock('@/components/CategoryIconView.vue', () => ({ default: { render: () => null } }))
vi.mock('@/components/ui', () => {
  const stub = (name: string) => defineComponent({
    inheritAttrs: false,
    setup: (_, { attrs, slots }) => () => h(name, attrs, slots.default?.()),
  })
  return { UiInput: stub('input'), UiSelect: stub('select'), UiButton: stub('button'), UiCheckbox: stub('checkbox'), UiModal: { render: () => null } }
})
vi.mock('@/services/vaultApi', () => ({ vaultApi: {
  listAttachments: vi.fn(async () => []),
  getSidebarCategoryOrder: vi.fn(async () => []),
  updateEntry: vi.fn(), listEntries: vi.fn(), listCategories: vi.fn(async () => []), listTags: vi.fn(async () => []),
} }))

// Render the real menu and detail component without a browser or real vault.
interface TestNode {
  type: string
  text: string
  props: Record<string, unknown>
  children: TestNode[]
  parent: TestNode | null
  addEventListener: () => void
  removeEventListener: () => void
  getBoundingClientRect: () => { width: number; height: number }
}
const node = (type: string, text = ''): TestNode => ({ type, text, props: {}, children: [], parent: null, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 400, height: 320 }) })
let teleportTarget = node('teleport-target')
const renderer = createRenderer<TestNode, TestNode>({
  querySelector: () => teleportTarget,
  createElement: (type) => node(type), createText: (text) => node('text', text), createComment: (text) => node('comment', text),
  setText: (el, text) => { el.text = text },
  setElementText: (el, text) => { el.text = text; el.children = [] },
  patchProp: (el, key, _prev, value) => { el.props[key] = value },
  insert(el, parent, anchor) {
    if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
    el.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, el)
  },
  remove(el) { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1) },
  parentNode: (el) => el.parent,
  nextSibling: (el) => el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null,
})
const flatten = (el: TestNode): TestNode[] => [el, ...el.children.flatMap(flatten)]
const content = (el: TestNode): string => el.text + el.children.map(content).join('')
const event = () => ({ stopPropagation: vi.fn(), preventDefault: vi.fn(), clientX: 100, clientY: 100 })
const settle = async () => { for (let i = 0; i < 6; i++) await nextTick() }

let app: App
let root: TestNode
let state: ReturnType<typeof useAppState>
let api: typeof vaultApi
const fixture = (id: string): PasswordEntry => ({
  id, title: `Entry ${id}`, username: `user-${id}`, password: 'secret', url: '', note: '', tags: [], categoryId: 'other', isFavorite: false,
  categoryName: 'Other', displayIcon: '', localProgramPath: '', totpSecret: '', customFields: [], attachmentCount: 0,
  createdAt: 1791763200000, updatedAt: 1791763200000, lastUsedAt: null,
})
const findButton = (label: string) => flatten(root).find((el) => el.type === 'button' && content(el).trim() === label)!
const titleInput = () => flatten(root).find((el) => el.type === 'input' && String(el.props.modelValue).startsWith('Entry'))!
const click = async (label: string) => { expect(findButton(label)).toBeDefined(); await (findButton(label).props.onClick as (e: unknown) => unknown)(event()); await settle() }

beforeEach(async () => {
  teleportTarget = node('teleport-target')
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })
  vi.stubGlobal('window', { innerWidth: 1200, innerHeight: 760, performance: globalThis.performance, electronAPI: { closeDetailWindow: vi.fn(), detailWindowSelectEntry: vi.fn() }, addEventListener() {}, removeEventListener() {}, setTimeout: () => 0 })
  vi.stubGlobal('document', { documentElement: { classList: { contains: () => false } }, body: { style: {} }, querySelector: () => null, addEventListener() {}, removeEventListener() {} })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }))
  const { useAppState } = await import('@/composables/useAppState')
  const { vaultApi } = await import('@/services/vaultApi')
  const { i18n } = await import('@/i18n')
  const { default: Menu } = await import('./EntryListMenu.vue')
  const { default: Detail } = await import('./PasswordDetail.vue')
  api = vaultApi
  state = useAppState()
  state.entries.value = [fixture('a'), fixture('b')]
  state.isCreating.value = false
  state.detachedDetailOpen.value = false
  state.selectEntry('a')
  vi.mocked(api.updateEntry).mockImplementation(async (id, input) => {
    const saved = { ...fixture(id), ...input }
    state.entries.value = state.entries.value.map((entry) => entry.id === id ? saved : entry)
    return saved
  })
  vi.mocked(api.listEntries).mockImplementation(async () => state.entries.value)
  root = node('root')
  app = renderer.createApp({ render: () => h('section', [h(Menu, { entry: state.entries.value[1] }), h(Detail)]) })
  app.use(i18n)
  app.mount(root)
  await settle()
})
afterEach(() => { app?.unmount(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('entry menu edit flow', () => {
  it.each([
    ['list', 'context'], ['grid', 'context'], ['list', 'more'], ['grid', 'more'],
  ] as const)('edits from %s layout via %s menu and closes the menu', async (layout, trigger) => {
    app.unmount()
    const { default: List } = await import('./PasswordList.vue')
    const { default: Detail } = await import('./PasswordDetail.vue')
    const { i18n } = await import('@/i18n')
    state.listLayoutMode.value = layout
    root = node('root')
    app = renderer.createApp({ render: () => h('section', [h(List), h(Detail)]) })
    app.use(i18n)
    app.mount(root)
    await settle()
    const target = flatten(root).filter((el) => el.props.onContextmenu)[1]
    expect(target).toBeDefined()
    if (trigger === 'context') {
      (target.props.onContextmenu as (e: unknown) => void)(event())
    } else {
      const more = flatten(target).find((el) => el.type === 'button' && /action-trigger|grid-tile-menu-btn/.test(String(el.props.class)))!
      expect(more).toBeDefined()
      ;(more.props.onClick as (e: unknown) => void)(event())
    }
    await settle()
    const menuEdit = flatten(root).find((el) => el.type === 'button' && String(el.props.class).includes('action-menu-item') && content(el).trim() === '编辑')
      ?? flatten(teleportTarget).find((el) => el.type === 'button' && content(el).trim() === '编辑')
    expect(menuEdit).toBeDefined()
    ;(menuEdit!.props.onClick as (e: unknown) => void)(event())
    await settle()
    expect(state.selectedEntryId.value).toBe('b')
    expect(titleInput().props.readonly).toBe(false)
    expect(findButton('保存')).toBeDefined()
    expect([...flatten(root), ...flatten(teleportTarget)].some((el) => el.type === 'button' && String(el.props.class).includes('action-menu-item'))).toBe(false)
  })
  it('selects another entry, expands collapsed detail and enters editing after draft reset', async () => {
    state.setDetailCollapsed(true)
    await settle()
    await click('编辑')
    expect(state.selectedEntryId.value).toBe('b')
    expect(state.detailCollapsed.value).toBe(false)
    expect(titleInput().props.modelValue).toBe('Entry b')
    expect(titleInput().props.readonly).toBe(false)
    expect(findButton('保存')).toBeDefined()
    expect(state.pendingEditEntryId.value).toBeNull()
  })

  it('can edit the already-selected entry again after cancel and discards unsaved changes', async () => {
    state.selectEntry('b')
    await settle()
    await click('编辑')
    ;(titleInput().props['onUpdate:modelValue'] as (value: string) => void)('Entry unsaved')
    await settle()
    await click('取消')
    expect(titleInput().props.modelValue).toBe('Entry b')
    expect(titleInput().props.readonly).toBe(true)
    expect(api.updateEntry).not.toHaveBeenCalled()
    await click('编辑')
    expect(titleInput().props.readonly).toBe(false)
  })

  it('saves only the requested entry and returns to read-only mode', async () => {
    await click('编辑')
    ;(titleInput().props['onUpdate:modelValue'] as (value: string) => void)('Entry updated')
    await settle()
    await click('保存')
    expect(api.updateEntry).toHaveBeenCalledWith('b', expect.objectContaining({ title: 'Entry updated' }))
    expect(state.entries.value[0].title).toBe('Entry a')
    expect(titleInput().props.readonly).toBe(true)
  })

  it('closes detached detail before editing in the main panel', async () => {
    state.detachedDetailOpen.value = true
    state.setDetailCollapsed(true)
    await click('编辑')
    expect(window.electronAPI?.closeDetailWindow).toHaveBeenCalledOnce()
    expect(state.detachedDetailOpen.value).toBe(false)
    expect(state.detailCollapsed.value).toBe(false)
    expect(titleInput().props.readonly).toBe(false)
  })

  it('ignores deleted entries and ordinary selection stays read-only', async () => {
    state.startEditEntry('deleted')
    await settle()
    expect(state.selectedEntryId.value).toBe('a')
    expect(state.pendingEditEntryId.value).toBeNull()
    expect(titleInput().props.readonly).toBe(true)
    await click('编辑')
    state.selectEntry('a')
    await settle()
    expect(titleInput().props.modelValue).toBe('Entry a')
    expect(titleInput().props.readonly).toBe(true)
  })
})

