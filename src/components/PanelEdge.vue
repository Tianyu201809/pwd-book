<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    collapsed?: boolean
    /** 主内容在拖拽条左侧（详情面板）或右侧（侧栏） */
    placement?: 'before' | 'after'
    resizing?: boolean
    expandLabel?: string
    collapseLabel?: string
  }>(),
  {
    collapsed: false,
    placement: 'after',
    resizing: false,
    expandLabel: '',
    collapseLabel: '',
  },
)

const emit = defineEmits<{
  toggle: []
  'resize-start': [event: MouseEvent]
}>()

const hovered = ref(false)
const toggleHovered = ref(false)

const edgeActive = computed(
  () => props.collapsed || hovered.value || toggleHovered.value || props.resizing,
)

const showToggle = computed(() => edgeActive.value)

const toggleTitle = computed(() =>
  props.collapsed ? props.expandLabel : props.collapseLabel,
)

function onMouseDown(event: MouseEvent): void {
  if (props.collapsed || event.button !== 0) return
  const target = event.target as HTMLElement | null
  if (target?.closest('.panel-edge-toggle')) return
  emit('resize-start', event)
}

function onEdgeMouseLeave(event: MouseEvent): void {
  const related = event.relatedTarget
  const current = event.currentTarget
  if (
    related instanceof Node
    && current instanceof HTMLElement
    && current.contains(related)
  ) {
    return
  }
  hovered.value = false
}

function onToggleMouseEnter(): void {
  toggleHovered.value = true
}

function onToggleMouseLeave(): void {
  toggleHovered.value = false
}
</script>

<template>
  <div
    class="panel-edge"
    :class="[
      `panel-edge--${placement}`,
      { collapsed, resizing, hovered: edgeActive },
    ]"
    @mouseenter="hovered = true"
    @mouseleave="onEdgeMouseLeave"
    @mousedown="onMouseDown"
  >
    <div
      class="panel-edge-sash"
      aria-hidden="true"
    />
    <button
      type="button"
      class="panel-edge-toggle"
      :class="{ visible: showToggle }"
      :title="toggleTitle"
      :aria-label="toggleTitle"
      @mouseenter="onToggleMouseEnter"
      @mouseleave="onToggleMouseLeave"
      @click.stop="emit('toggle')"
    >
      <template v-if="placement === 'after'">
        <ChevronLeft
          v-if="!collapsed"
          :size="13"
          :stroke-width="2.5"
        />
        <ChevronRight
          v-else
          :size="13"
          :stroke-width="2.5"
        />
      </template>
      <template v-else>
        <ChevronRight
          v-if="!collapsed"
          :size="13"
          :stroke-width="2.5"
        />
        <ChevronLeft
          v-else
          :size="13"
          :stroke-width="2.5"
        />
      </template>
    </button>
  </div>
</template>

<style scoped>
.panel-edge {
  --edge-width: var(--panel-edge-width, 4px);
  position: relative;
  z-index: 2;
  flex-shrink: 0;
  align-self: stretch;
  width: var(--edge-width);
  cursor: col-resize;
  touch-action: none;
}

.panel-edge::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -3px;
  right: -3px;
  z-index: 0;
}

.panel-edge-sash {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  z-index: 1;
  width: 1px;
  transform: translateX(-50%);
  background: transparent;
  transition:
    width 0.12s ease,
    background-color 0.12s ease,
    box-shadow 0.12s ease;
}

.panel-edge.hovered::before,
.panel-edge.resizing::before,
.panel-edge.collapsed::before,
.panel-edge:has(.panel-edge-toggle.visible)::before {
  left: -14px;
  right: -14px;
}

.panel-edge.hovered .panel-edge-sash,
.panel-edge.resizing .panel-edge-sash {
  width: 2px;
  background: var(--accent-primary);
  box-shadow: 0 0 6px rgba(var(--accent-rgb), 0.35);
}

.panel-edge:has(.panel-edge-toggle.visible) .panel-edge-sash {
  -webkit-mask-image: linear-gradient(
    to bottom,
    #000 0,
    #000 calc(50% - 14px),
    transparent calc(50% - 14px),
    transparent calc(50% + 14px),
    #000 calc(50% + 14px),
    #000 100%
  );
  mask-image: linear-gradient(
    to bottom,
    #000 0,
    #000 calc(50% - 14px),
    transparent calc(50% - 14px),
    transparent calc(50% + 14px),
    #000 calc(50% + 14px),
    #000 100%
  );
}

.panel-edge.hovered,
.panel-edge.resizing,
.panel-edge.collapsed {
  z-index: 10;
}

.panel-edge-toggle {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1.5px solid var(--accent-primary);
  border-radius: 50%;
  appearance: none;
  background-color: var(--bg-surface);
  background-image: none;
  color: var(--accent-primary);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -50%);
  box-shadow: none;
  isolation: isolate;
  transition:
    opacity 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.panel-edge-toggle.visible {
  opacity: 1;
  pointer-events: auto;
}

.panel-edge-toggle:hover,
.panel-edge-toggle:focus-visible {
  color: var(--accent-hover);
  border-color: var(--accent-hover);
  background-color: color-mix(in srgb, var(--accent-primary) 14%, var(--bg-surface));
}

.panel-edge-toggle :deep(svg) {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.panel-edge.collapsed {
  width: 100%;
  cursor: default;
}

.panel-edge.collapsed::before {
  display: none;
}

.panel-edge.collapsed .panel-edge-sash {
  display: none;
}

.panel-edge.collapsed .panel-edge-toggle {
  opacity: 1;
  pointer-events: auto;
  background-color: var(--bg-app);
}

.panel-edge.collapsed .panel-edge-toggle:hover,
.panel-edge.collapsed .panel-edge-toggle:focus-visible {
  background-color: color-mix(in srgb, var(--accent-primary) 14%, var(--bg-app));
}
</style>
