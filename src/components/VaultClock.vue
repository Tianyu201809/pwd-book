<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Time } from 'animal-island-vue'
import { useTheme } from '@/composables/useTheme'
import { useLocale } from '@/composables/useLocale'

const { isAnimalIsland } = useTheme()
const { locale } = useLocale()

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

const localeTag = computed(() => (locale.value === 'zh-CN' ? 'zh-CN' : 'en-US'))

const weekday = computed(() =>
  new Intl.DateTimeFormat(localeTag.value, { weekday: 'long' }).format(now.value),
)

const dateLine = computed(() =>
  new Intl.DateTimeFormat(localeTag.value, { month: 'long', day: 'numeric' }).format(now.value),
)

const timeLine = computed(() =>
  new Intl.DateTimeFormat(localeTag.value, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now.value),
)

onMounted(() => {
  if (!isAnimalIsland.value) {
    timer = setInterval(() => {
      now.value = new Date()
    }, 1000)
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="vault-clock" :class="{ 'vault-clock--animal': isAnimalIsland }">
    <Time v-if="isAnimalIsland" />
    <template v-else>
      <p class="vault-clock__weekday font-display">{{ weekday }}</p>
      <p class="vault-clock__date">{{ dateLine }}</p>
      <p class="vault-clock__time">{{ timeLine }}</p>
    </template>
  </div>
</template>

<style scoped>
.vault-clock {
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  text-align: center;
}

.vault-clock--animal {
  margin-bottom: 8px;
  padding: 0;
  background: transparent;
  border: none;
}

.vault-clock__weekday {
  margin: 0 0 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.vault-clock__date {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.vault-clock__time {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--accent-primary);
  letter-spacing: 0.04em;
}
</style>
