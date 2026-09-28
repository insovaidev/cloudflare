<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import { state, togglePin, deleteAnalysis, runTarget } from '../lib/store'
import { fullDate, hostOf } from '../lib/format'
import { renderMarkdown } from '../lib/markdown'

const a = computed(() => state.detail)
const readmeHtml = computed(() => (a.value?.readme ? renderMarkdown(a.value.readme) : ''))
const missing = computed(() => new Set(a.value?.missing_skills.map((g) => g.skill.toLowerCase()) ?? []))

const confirmDelete = () => {
  if (a.value && confirm(`Delete “${a.value.project_title || a.value.job_title || 'this analysis'}” from the dashboard? The GitHub repo is kept.`)) {
    deleteAnalysis(a.value)
  }
}
</script>

<template>
  <section class="detail-pane">
    <header class="nav">
      <button class="text-btn mobile-only" @click="state.depth = 'list'">
        <Icon name="chevronLeft" :size="20" /> Projects
      </button>
      <span class="spacer" />
      <template v-if="a">
        <a v-if="a.repo_url" class="icon-btn" :href="a.repo_url" target="_blank" rel="noopener" title="Open GitHub repo" aria-label="Open GitHub repo">
          <Icon name="github" />
        </a>
        <a class="icon-btn" :href="a.url" target="_blank" rel="noopener noreferrer" title="Open job posting" aria-label="Open job posting">
          <Icon name="globe" />
        </a>
      </template>
    </header>

    <article v-if="a" class="paper">
      <p class="stamp">{{ fullDate(a.created_at) }}</p>
      <h1 class="note-title">{{ a.project_title || a.job_title || 'Untitled analysis' }}</h1>
      <p class="byline">
        For <strong>{{ a.job_title || 'this role' }}</strong><template v-if="a.company"> at {{ a.company }}</template>
        · <a :href="a.url" target="_blank" rel="noopener noreferrer">{{ hostOf(a.url) }}</a>
      </p>

      <p v-if="a.status === 'failed'" class="banner error">{{ a.error || 'Analysis failed.' }}</p>
      <p v-else-if="a.status === 'pending'" class="banner">Claude is still working on this one…</p>

      <p v-if="a.project_summary" class="summary">{{ a.project_summary }}</p>

      <a v-if="a.repo_url" class="repo-card" :href="a.repo_url" target="_blank" rel="noopener">
        <Icon name="github" :size="22" />
        <span>
          <strong>{{ a.repo_full_name }}</strong>
          <small>Repository created with README as the initial commit</small>
        </span>
        <Icon name="chevronRight" :size="14" />
      </a>

      <template v-if="a.missing_skills.length">
        <h2 class="heading">Skill gaps</h2>
        <ul class="checklist">
          <li v-for="g in a.missing_skills" :key="g.skill">
            <span class="check-circle" aria-hidden="true" />
            <div>
              <div class="gap-name">{{ g.skill }}</div>
              <div class="gap-reason">{{ g.reason }}</div>
            </div>
          </li>
        </ul>
      </template>

      <template v-if="a.required_skills.length">
        <h2 class="heading">What the role asks for</h2>
        <div class="chips">
          <span
            v-for="s in a.required_skills"
            :key="s"
            class="chip static"
            :class="{ neutral: !missing.has(s.toLowerCase()) }"
          >#{{ s }}</span>
        </div>
      </template>

      <template v-if="readmeHtml">
        <h2 class="heading">README.md</h2>
        <div class="markdown" v-html="readmeHtml" />
      </template>
    </article>

    <div v-else class="empty-detail">
      <p class="empty">Select a project to read its skill gaps and README.</p>
    </div>

    <footer v-if="a" class="toolbar">
      <button class="icon-btn ink" :title="a.pinned ? 'Unpin' : 'Pin'" :aria-label="a.pinned ? 'Unpin' : 'Pin'" @click="togglePin(a)">
        <Icon name="pin" :class="{ pinned: a.pinned }" />
      </button>
      <button
        v-if="a.target_id"
        class="icon-btn ink"
        title="Re-analyze this job posting"
        aria-label="Re-analyze this job posting"
        :disabled="state.runningTargetId !== null"
        @click="runTarget(a.target_id, true)"
      >
        <Icon name="refresh" :class="{ spin: state.runningTargetId === a.target_id }" />
      </button>
      <a v-if="a.repo_url" class="icon-btn ink" :href="a.repo_url" target="_blank" rel="noopener" aria-label="Open repo">
        <Icon name="link" />
      </a>
      <button class="icon-btn danger" title="Delete" aria-label="Delete" @click="confirmDelete">
        <Icon name="trash" />
      </button>
    </footer>
  </section>
</template>

<style scoped>
.detail-pane { height: 100%; display: flex; flex-direction: column; }
.nav {
  display: flex; align-items: center; min-height: 44px; padding: 4px 8px;
  position: sticky; top: 0; background: var(--material);
  backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px);
}
.spacer { flex: 1; }
.paper { flex: 1; overflow-y: auto; padding: 8px 20px 40px; }
@media (min-width: 900px) { .paper { padding: 16px 48px 48px; } }
.paper > * { max-width: 720px; margin-left: auto; margin-right: auto; }
.stamp { text-align: center; font-size: 12px; color: var(--slate); margin: 0 auto 16px; }
.note-title { font-size: 20px; font-weight: 600; letter-spacing: -0.2px; line-height: 1.3; margin: 0 auto 4px; }
.byline { font-size: 14px; color: var(--slate); margin-top: 0; }
.summary { font-size: 17px; line-height: 1.5; }
.heading { font-size: 17px; font-weight: 600; line-height: 1.4; margin: 24px auto 8px; }

.repo-card {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; border-radius: 10px;
  background: var(--surface-1); color: var(--ink); text-decoration: none;
}
.repo-card:active { background: var(--surface-2); }
.repo-card span { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.repo-card strong { font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
.repo-card small { font-size: 12px; color: var(--slate); }
.repo-card .icon:last-child { color: var(--slate); }

.checklist { list-style: none; padding: 0; }
.checklist li { display: flex; gap: 12px; padding: 6px 0; align-items: flex-start; }
.gap-name { font-size: 17px; line-height: 24px; }
.gap-reason { font-size: 14px; color: var(--slate); line-height: 1.35; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }

.markdown { font-size: 17px; line-height: 1.5; overflow-wrap: anywhere; }
.markdown :deep(h1) { font-size: 20px; font-weight: 600; letter-spacing: -0.2px; }
.markdown :deep(h2), .markdown :deep(h3), .markdown :deep(h4) { font-size: 17px; font-weight: 600; margin: 20px 0 6px; }
.markdown :deep(code) { font-family: var(--mono); font-size: 15px; background: var(--surface-1); padding: 1px 5px; border-radius: 4px; }
.markdown :deep(pre) { background: var(--surface-1); padding: 12px 14px; border-radius: 10px; overflow-x: auto; }
.markdown :deep(pre code) { background: none; padding: 0; }
.markdown :deep(ul), .markdown :deep(ol) { padding-left: 22px; }
.markdown :deep(li:has(> input[type='checkbox'])) { list-style: none; margin-left: -22px; }
.markdown :deep(input[type='checkbox']) {
  appearance: none; width: 20px; height: 20px; border-radius: 50%;
  border: 1.5px solid var(--slate); vertical-align: -4px; margin: 0 8px 0 0;
}
.markdown :deep(input[type='checkbox']:checked) { background: var(--orange); border-color: var(--orange); }
.markdown :deep(table) { border-collapse: collapse; display: block; overflow-x: auto; }
.markdown :deep(th), .markdown :deep(td) { border: 0.5px solid var(--divider); padding: 6px 10px; font-size: 15px; }
.markdown :deep(blockquote) { margin: 0; padding-left: 12px; border-left: 3px solid var(--folder); color: var(--slate); }
.markdown :deep(hr) { border: 0; border-top: 0.5px solid var(--divider); }

.empty-detail { flex: 1; display: grid; place-items: center; }
.toolbar {
  display: flex; justify-content: space-around; align-items: center;
  height: calc(56px + env(safe-area-inset-bottom)); padding-bottom: env(safe-area-inset-bottom);
  border-top: 0.5px solid var(--divider); background: var(--material);
  backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px);
}
.toolbar .pinned { color: var(--orange); }
</style>
