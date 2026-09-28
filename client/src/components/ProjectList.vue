<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import { state, selectAnalysis, runAll } from '../lib/store'
import { noteDate } from '../lib/format'
import type { Analysis } from '../lib/api'

const query = ref('')
const tag = ref<string | null>(null)

// Most frequent gaps across all analyses become the tag strip.
const topGaps = computed(() => {
  const counts = new Map<string, number>()
  for (const a of state.analyses) for (const g of a.missing_skills) counts.set(g.skill, (counts.get(g.skill) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([s]) => s)
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return state.analyses.filter((a) => {
    if (tag.value && !a.missing_skills.some((g) => g.skill === tag.value)) return false
    if (!q) return true
    return [a.project_title, a.job_title, a.company, a.project_summary, ...a.missing_skills.map((g) => g.skill)]
      .some((v) => v?.toLowerCase().includes(q))
  })
})
const pinned = computed(() => filtered.value.filter((a) => a.pinned))
const others = computed(() => filtered.value.filter((a) => !a.pinned))

const title = (a: Analysis) => a.project_title || a.job_title || a.url
const preview = (a: Analysis) => {
  if (a.status === 'failed') return a.error || 'Analysis failed'
  if (a.status === 'pending') return 'Analyzing…'
  const gaps = a.missing_skills.map((g) => g.skill).join(', ')
  return [a.job_title, a.company].filter(Boolean).join(' · ') + (gaps ? ` — ${gaps}` : '')
}
</script>

<template>
  <section class="list-pane">
    <header class="nav">
      <button class="text-btn back mobile-only" @click="state.depth = 'folders'">
        <Icon name="chevronLeft" :size="20" /> Folders
      </button>
      <h1 class="large-title">Projects</h1>
    </header>

    <label class="search">
      <Icon name="search" :size="16" />
      <span class="sr-only">Search projects</span>
      <input v-model="query" type="search" placeholder="Search" />
    </label>

    <div v-if="topGaps.length" class="chip-row" role="toolbar" aria-label="Filter by skill gap">
      <button
        v-for="g in topGaps"
        :key="g"
        class="chip"
        :class="{ selected: tag === g }"
        :aria-pressed="tag === g"
        @click="tag = tag === g ? null : g"
      >#{{ g }}</button>
    </div>

    <div class="scroll">
      <p v-if="state.loading" class="empty">Loading from D1…</p>
      <p v-else-if="!state.analyses.length" class="empty">
        No projects yet.<br />Add job URLs in <strong>Job Targets</strong>, then tap
        <Icon name="compose" :size="14" /> to analyze them now — or wait for the cron run.
      </p>
      <p v-else-if="!filtered.length" class="empty">No matches.</p>

      <template v-for="group in [{ name: 'Pinned', items: pinned }, { name: pinned.length ? 'Projects' : '', items: others }]" :key="group.name">
        <template v-if="group.items.length">
          <h2 v-if="group.name" class="section-header">{{ group.name }}</h2>
          <ul class="notes">
            <li v-for="a in group.items" :key="a.id">
              <button
                class="note-row"
                :class="{ pinned: a.pinned, active: state.selectedId === a.id }"
                @click="selectAnalysis(a.id)"
              >
                <span class="note-title">
                  <Icon v-if="a.pinned" name="pin" :size="11" class="pin" />
                  <span v-if="a.status === 'failed'" class="dot failed" />
                  <span v-else-if="a.status === 'pending'" class="dot pending" />
                  {{ title(a) }}
                </span>
                <span class="note-preview">{{ preview(a) }}</span>
                <span class="note-date">
                  {{ noteDate(a.created_at) }}
                  <template v-if="a.repo_full_name"> · <Icon name="github" :size="11" /> {{ a.repo_full_name }}</template>
                </span>
              </button>
            </li>
          </ul>
        </template>
      </template>
      <div class="fab-space" />
    </div>

    <button
      class="fab"
      :disabled="state.running"
      :aria-label="state.running ? 'Analyzing job targets' : 'Analyze all job targets now'"
      title="Analyze all job targets now"
      @click="runAll"
    >
      <Icon :name="state.running ? 'refresh' : 'compose'" :size="24" :class="{ spin: state.running }" />
    </button>
  </section>
</template>

<style scoped>
.list-pane { position: relative; height: 100%; display: flex; flex-direction: column; }
.nav { padding: 4px 16px 4px; }
@media (min-width: 900px) { .nav { padding-top: 16px; } }
.back { margin-left: -8px; }
.scroll { flex: 1; overflow-y: auto; }
.notes { list-style: none; margin: 0; padding: 0; }
.note-row {
  width: 100%;
  min-height: 84px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 14px 16px 12px;
  background: var(--canvas);
  border: 0;
  border-bottom: 0.5px solid var(--divider);
  text-align: left;
  transition: transform 0.1s;
}
.note-row:active { transform: scale(0.99); background: var(--surface-2); }
.note-row.pinned { background: var(--surface-1); }
.note-row.active { background: var(--orange-tint); }
.note-title {
  font-size: 16px; font-weight: 600; letter-spacing: -0.1px; line-height: 1.3;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.note-preview {
  margin-top: 4px; font-size: 14px; line-height: 1.35; color: var(--slate);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.note-date {
  margin-top: 2px; font-size: 12px; color: var(--slate);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.note-date .icon { vertical-align: -1px; }
.pin { color: var(--orange); margin-right: 2px; vertical-align: 0; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: 1px; }
.dot.failed { background: var(--red); }
.dot.pending { background: var(--orange); }
.empty .icon { vertical-align: -2px; color: var(--orange); }
.fab-space { height: 88px; }
</style>
