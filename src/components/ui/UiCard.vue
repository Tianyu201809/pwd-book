<script setup lang="ts">
import { Card } from 'animal-island-vue'
import type { CardColor, CardType } from 'animal-island-vue'
import { useTheme } from '@/composables/useTheme'

withDefaults(
  defineProps<{
    type?: CardType
    color?: CardColor
    padding?: boolean
  }>(),
  {
    type: 'default',
    color: 'default',
    padding: true,
  },
)

const { isAnimalIsland } = useTheme()
</script>

<template>
  <Card
    v-if="isAnimalIsland"
    :type="type"
    :color="color"
  >
    <slot />
  </Card>
  <div
    v-else
    class="surface-card"
    :class="[$attrs.class, { 'ui-card-padded': padding }]"
  >
    <slot />
  </div>
</template>

<style scoped>
.ui-card-padded {
  padding: 16px 20px;
}
</style>
