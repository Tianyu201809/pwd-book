<script setup lang="ts">
import { usePanelContentMotion } from '@/composables/usePanelContentMotion'

const props = defineProps<{ side: 'left' | 'right'; collapsed: boolean; fill?: boolean }>()
const motion = usePanelContentMotion(props.side)
</script>

<template>
  <div
    class="panel-content-viewport"
    :class="{ 'align-right': props.side === 'right', fill: props.fill }"
    :inert="props.collapsed"
  >
    <Transition
      :css="false"
      @enter="motion.onEnter"
      @leave="motion.onLeave"
      @enter-cancelled="motion.onEnterCancelled"
      @after-leave="motion.onAfterLeave"
    >
      <slot />
    </Transition>
  </div>
</template>

<style scoped>
.panel-content-viewport {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: clip;
}

.panel-content-viewport > :deep(*) {
  position: absolute;
  inset-block: 0;
  width: max(0px, calc(var(--panel-expanded-width, 0px) - var(--panel-edge-width, 4px)));
}

.panel-content-viewport:not(.align-right):not(.fill) > :deep(*) {
  inset-inline-start: 0;
}

.align-right {
  justify-content: flex-end;
}

.align-right:not(.fill) > :deep(*) {
  inset-inline-end: 0;
}

.fill > :deep(*) {
  inset: 0;
  width: 100%;
}
</style>
