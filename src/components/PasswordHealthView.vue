<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, ShieldAlert, Copy } from 'lucide-vue-next'
import { UiButton } from '@/components/ui'
import { useAppState } from '@/composables/useAppState'
import { showToast } from '@/composables/useToast'
import { analyzePasswordHealth } from '@/shared/passwordHealth'

const { navigateTo, entries, selectEntry } = useAppState()
const { t } = useI18n()

const report = computed(() => analyzePasswordHealth(entries.value))

const weakIssues = computed(() => report.value.issues.filter((item) => item.type === 'weak'))
const duplicateIssues = computed(() =>
  report.value.issues.filter((item) => item.type === 'duplicate'),
)

function goBack(): void {
  navigateTo('vault')
}

function openEntry(entryId: string): void {
  navigateTo('vault')
  selectEntry(entryId)
}

async function copyEntryTitle(title: string): Promise<void> {
  await window.electronAPI?.copySecret(title, 0)
  showToast(t('tools.passwordHealth.copiedTitle'), 'success')
}
</script>

<template>
  <div class="tool-page-view">
    <div class="tool-page-body">
      <aside class="tool-page-sidebar">
        <button type="button" class="tool-back-btn" @click="goBack">
          <ArrowLeft :size="16" :stroke-width="1.5" />
          {{ t('tools.backToVault') }}
        </button>

        <div class="tool-sidebar-hero">
          <div class="tool-hero-icon tool-hero-icon--health">
            <ShieldAlert :size="22" :stroke-width="1.5" />
          </div>
          <h2 class="tool-sidebar-title font-display">{{ t('tools.passwordHealth.title') }}</h2>
          <p class="tool-sidebar-desc">{{ t('tools.passwordHealth.subtitle') }}</p>
        </div>
      </aside>

      <main class="tool-page-main">
        <div class="tool-page-content">
          <div class="summary-grid">
            <div class="summary-card surface-card">
              <p class="summary-label">{{ t('tools.passwordHealth.totalEntries') }}</p>
              <p class="summary-value">{{ report.totalEntries }}</p>
            </div>
            <div class="summary-card surface-card">
              <p class="summary-label">{{ t('tools.passwordHealth.weakCount') }}</p>
              <p class="summary-value" :class="{ danger: report.weakCount > 0 }">{{ report.weakCount }}</p>
            </div>
            <div class="summary-card surface-card">
              <p class="summary-label">{{ t('tools.passwordHealth.duplicateCount') }}</p>
              <p class="summary-value" :class="{ danger: report.duplicateEntryCount > 0 }">
                {{ report.duplicateEntryCount }}
              </p>
            </div>
          </div>

          <section class="issue-section surface-card">
            <h3>{{ t('tools.passwordHealth.weakSection', { count: weakIssues.length }) }}</h3>
            <p v-if="weakIssues.length === 0" class="empty-hint">{{ t('tools.passwordHealth.noWeak') }}</p>
            <ul v-else class="issue-list">
              <li v-for="item in weakIssues" :key="`weak-${item.entryId}`" class="issue-row">
                <button type="button" class="issue-title" @click="openEntry(item.entryId)">
                  {{ item.title }}
                </button>
                <span class="issue-badge">{{ t('tools.passwordHealth.weakBadge') }}</span>
              </li>
            </ul>
          </section>

          <section class="issue-section surface-card">
            <h3>{{ t('tools.passwordHealth.duplicateSection', { count: duplicateIssues.length }) }}</h3>
            <p v-if="duplicateIssues.length === 0" class="empty-hint">{{ t('tools.passwordHealth.noDuplicate') }}</p>
            <ul v-else class="issue-list">
              <li
                v-for="item in duplicateIssues"
                :key="`dup-${item.entryId}-${item.duplicateGroupId}`"
                class="issue-row"
              >
                <button type="button" class="issue-title" @click="openEntry(item.entryId)">
                  {{ item.title }}
                </button>
                <button
                  type="button"
                  class="icon-copy"
                  :title="t('tools.passwordHealth.copyTitle')"
                  @click="copyEntryTitle(item.title)"
                >
                  <Copy :size="14" :stroke-width="1.5" />
                </button>
                <span class="issue-badge warn">{{ t('tools.passwordHealth.duplicateBadge') }}</span>
              </li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.tool-hero-icon--health {
  background: rgba(5, 150, 105, 0.14);
  color: #059669;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-card {
  padding: 16px;
}

.summary-label {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.summary-value {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}

.summary-value.danger {
  color: var(--status-danger);
}

.issue-section {
  padding: 16px;
  margin-bottom: 12px;
}

.issue-section h3 {
  margin: 0 0 12px;
  font-size: 15px;
}

.empty-hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
}

.issue-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issue-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-md, 8px);
  background: var(--bg-elevated);
}

.issue-title {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  text-align: left;
  padding: 0;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
}

.issue-title:hover {
  color: var(--accent-primary);
}

.issue-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(220, 38, 38, 0.12);
  color: var(--status-danger);
}

.issue-badge.warn {
  background: rgba(202, 138, 4, 0.14);
  color: #ca8a04;
}

.icon-copy {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
}

.icon-copy:hover {
  color: var(--accent-primary);
}
</style>
