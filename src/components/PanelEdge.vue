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

const showToggle = computed(() => props.collapsed || hovered.value || props.resizing)

const toggleTitle = computed(() =>
  props.collapsed ? props.expandLabel : props.collapseLabel,
)

function onMouseDown(event: MouseEvent): void {
  if (props.collapsed || event.button !== 0) return
  const target = event.target as HTMLElement | null
  if (target?.closest('.panel-edge-toggle')) return
  emit('resize-start', event)
}
</script>

<template>
  <div
    class="panel-edge"
    :class="[
      `panel-edge--${placement}`,
      { collapsed, resizing, hovered: hovered || resizing },
    ]"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @mousedown="onMouseDown"
  >
    <div class="panel-edge-sash" aria-hidden="true" />
    <button
      type="button"
      class="panel-edge-toggle"
      :class="{ visible: showToggle }"
      :title="toggleTitle"
      :aria-label="toggleTitle"
      @click.stop="emit('toggle')"
    >
      <template v-if="placement === 'after'">
        <ChevronLeft v-if="!collapsed" :size="14" :stroke-width="2" />
        <ChevronRight v-else :size="14" :stroke-width="2" />
      </template>
      <template v-else>
        <ChevronRight v-if="!collapsed" :size="14" :stroke-width="2" />
        <ChevronLeft v-else :size="14" :stroke-width="2" />
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

.panel-edge.hovered .panel-edge-sash,
.panel-edge.resizing .panel-edge-sash {
  width: 2px;
  background: var(--accent-primary);
  box-shadow: 0 0 6px rgba(var(--accent-rgb), 0.35);
}

.panel-edge-toggle {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: 5px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -50%);
  box-shadow: var(--shadow-popover);
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

.panel-edge-toggle:hover {
  color: var(--text-primary);
  border-color: var(--border-accent);
  background: var(--bg-elevated);
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
}
</style>
