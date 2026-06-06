<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-vue-next'
import SyncTutorialDiagram from '@/components/sync/SyncTutorialDiagram.vue'

const props = defineProps<{
  role: 'server' | 'client'
}>()

const { t, tm } = useI18n()

const expanded = ref(true)

const title = computed(() =>
  props.role === 'server'
    ? t('tools.wifiSync.tutorial.serverTitle')
    : t('tools.wifiSync.tutorial.clientTitle'),
)

const subtitle = computed(() =>
  props.role === 'server'
    ? t('tools.wifiSync.tutorial.serverSubtitle')
    : t('tools.wifiSync.tutorial.clientSubtitle'),
)

const intro = computed(() =>
  props.role === 'server'
    ? t('tools.wifiSync.tutorial.serverIntro')
    : t('tools.wifiSync.tutorial.clientIntro'),
)

const steps = computed(() => {
  const key =
    props.role === 'server'
      ? 'tools.wifiSync.tutorial.serverSteps'
      : 'tools.wifiSync.tutorial.clientSteps'
  const raw = tm(key) as Array<{ title: string; desc: string }>
  return Array.isArray(raw) ? raw : []
})
</script>

<template>
  <section class="sync-help surface-card">
    <button type="button" class="sync-help-toggle" @click="expanded = !expanded">
      <span class="sync-help-toggle__left">
        <BookOpen :size="16" :stroke-width="1.5" />
        <span>
          <strong>{{ title }}</strong>
          <small>{{ subtitle }}</small>
        </span>
      </span>
      <component :is="expanded ? ChevronUp : ChevronDown" :size="16" :stroke-width="1.5" />
    </button>

    <div v-show="expanded" class="sync-help-body">
      <p class="sync-help-intro">{{ intro }}</p>

      <SyncTutorialDiagram :highlight="role" />

      <ol class="sync-help-steps">
        <li v-for="(step, index) in steps" :key="index">
          <span class="sync-help-step-num">{{ index + 1 }}</span>
          <div>
            <strong>{{ step.title }}</strong>
            <p>{{ step.desc }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.sync-help {
  margin-bottom: 16px;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.sync-help-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
}

.sync-help-toggle__left {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.sync-help-toggle strong {
  display: block;
  font-size: 13px;
}

.sync-help-toggle small {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 400;
  line-height: 1.4;
}

.sync-help-body {
  padding: 0 14px 14px;
}

.sync-help-intro {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.sync-help-steps {
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sync-help-steps li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.sync-help-step-num {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  color: var(--accent-primary);
}

.sync-help-steps strong {
  display: block;
  font-size: 12px;
  line-height: 1.35;
  margin-bottom: 2px;
}

.sync-help-steps p {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-secondary);
}
</style>
