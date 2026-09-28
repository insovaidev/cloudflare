<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'
import PaneHeader from './PaneHeader.vue'
import { state, addTarget, updateTarget, deleteTarget, runTarget } from '../lib/store'
import { noteDate, hostOf } from '../lib/format'
import type { Target } from '../lib/api'

const url = ref('')
const label = ref('')
const saving = ref(false)
const urlInput = ref<HTMLInputElement>()

const submit = async () => {
  saving.value = true
  if (await addTarget(url.value.trim(), label.value.trim())) {
    url.value = ''
    label.value = ''
  }
  saving.value = false
}

const remove = (t: Target) => {
  if (confirm(`Stop tracking ${t.label || hostOf(t.url)}? Past analyses are kept.`)) deleteTarget(t)
}

const statusText = (t: Target) => {
  if (!t.last_checked_at) return 'Not checked yet'
  const when = noteDate(t.last_checked_at)
  if (t.last_status === 'failed') return `${when} · Failed: ${t.last_error ?? 'unknown error'}`
  if (t.last_status === 'unchanged') return `${when} · No changes`
  return `${when} · Analyzed`
}
defineExpose({ focus: () => urlInput.value?.focus() })
</script>

<template>
  <section class="pane">
    <PaneHeader title="Job Targets" />
    <div class="scroll">
      <form class="add" @submit.prevent="submit">
        <input
          ref="urlInput"
          v-model="url"
          class="field"
          type="url"
          required
          placeholder="https://company.com/careers/job-123"
          aria-label="Job posting URL"
        />
        <input v-model="label" class="field" maxlength="120" placeholder="Label (optional)" aria-label="Label" />
        <button class="primary-btn" type="submit" :disabled="saving">Track</button>
      </form>
      <p class="hint">
        The cron job fetches each active URL, skips pages that haven’t changed, and turns new postings into a project repo.
        Pages that need JavaScript or a login can’t be scraped.
      </p>

      <p v-if="!state.targets.length" class="empty">No job URLs yet.</p>
      <ul class="rows">
        <li v-for="t in state.targets" :key="t.id" class="row" :class="{ inactive: !t.active }">
          <div class="main">
            <div class="title">{{ t.label || hostOf(t.url) }}</div>
            <a class="url" :href="t.url" target="_blank" rel="noopener noreferrer">{{ t.url }}</a>
            <div class="meta" :class="{ failed: t.last_status === 'failed' }">
              {{ statusText(t) }} · {{ t.analysis_count }} project{{ t.analysis_count === 1 ? '' : 's' }}
            </div>
          </div>
          <label class="switch" :title="t.active ? 'Included in cron runs' : 'Paused'">
            <input type="checkbox" :checked="t.active" @change="updateTarget(t, { active: !t.active })" />
            <span class="track" /><span class="sr-only">Active</span>
          </label>
          <button
            class="icon-btn"
            title="Analyze now"
            :aria-label="`Analyze ${t.label || t.url} now`"
            :disabled="state.runningTargetId !== null"
            @click="runTarget(t.id)"
          >
            <Icon name="refresh" :class="{ spin: state.runningTargetId === t.id }" />
          </button>
          <button class="icon-btn danger" :aria-label="`Delete ${t.label || t.url}`" @click="remove(t)">
            <Icon name="trash" :size="18" />
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.pane { height: 100%; display: flex; flex-direction: column; }
.scroll { flex: 1; overflow-y: auto; padding-bottom: 96px; }
.add { display: grid; grid-template-columns: 1fr; gap: 8px; padding: 0 16px; }
@media (min-width: 700px) { .add { grid-template-columns: 2fr 1fr auto; } }
.hint { font-size: 14px; color: var(--slate); margin: 8px 16px 16px; line-height: 1.35; }
.rows { list-style: none; margin: 0; padding: 0; }
.row {
  display: flex; align-items: center; gap: 4px;
  padding: 12px 8px 12px 16px; min-height: 84px;
  border-bottom: 0.5px solid var(--divider);
}
.row.inactive .main { opacity: 0.5; }
.main { flex: 1; min-width: 0; }
.title { font-size: 16px; font-weight: 600; }
.url, .meta { display: block; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.url { color: var(--slate); text-decoration: none; margin-top: 2px; }
.meta { font-size: 12px; color: var(--slate); margin-top: 2px; }
.meta.failed { color: var(--red); }

.switch { position: relative; width: 51px; height: 31px; flex: none; margin: 0 4px; cursor: pointer; }
.switch input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.track {
  position: absolute; inset: 0; border-radius: 16px; background: var(--surface-2); transition: background 0.2s;
}
.track::after {
  content: ''; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%;
  background: #fff; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15); transition: transform 0.2s var(--ease);
}
.switch input:checked + .track { background: var(--green); }
.switch input:checked + .track::after { transform: translateX(20px); }
.switch input:focus-visible + .track { outline: 2px solid var(--orange); outline-offset: 2px; }
</style>
