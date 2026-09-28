<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Icon from './Icon.vue'
import PaneHeader from './PaneHeader.vue'
import { state, lock, guard, showToast } from '../lib/store'
import { post, API_URL } from '../lib/api'
import { getPushState, enablePush, disablePush, type PushState } from '../lib/push'

const push = ref<PushState>('off')
const busy = ref(false)

onMounted(async () => { push.value = await getPushState() })

const toggle = async () => {
  busy.value = true
  await guard(async () => {
    push.value = push.value === 'on' ? await disablePush() : await enablePush()
  })
  busy.value = false
}

const test = () => guard(async () => {
  const r = await post<{ sent: number; failed: number }>('/api/push/test')
  showToast(`Test sent to ${r.sent} browser${r.sent === 1 ? '' : 's'}${r.failed ? `, ${r.failed} failed` : ''}`)
})

const pushLabel: Record<PushState, string> = {
  on: 'On for this browser',
  off: 'Off',
  denied: 'Blocked in browser settings',
  unsupported: 'Not supported in this browser',
}
</script>

<template>
  <section class="pane">
    <PaneHeader title="Settings" />
    <div class="scroll">
      <h2 class="section-header">Notifications</h2>
      <div class="group">
        <div class="row">
          <span class="glyph"><Icon name="bell" :size="20" /></span>
          <span class="text">
            <span>Web Push</span>
            <small>{{ pushLabel[push] }}</small>
          </span>
          <label class="switch">
            <input
              type="checkbox"
              :checked="push === 'on'"
              :disabled="busy || push === 'unsupported' || push === 'denied' || !state.status.push"
              @change="toggle"
            />
            <span class="track" /><span class="sr-only">Enable Web Push</span>
          </label>
        </div>
        <button class="row action" :disabled="push !== 'on'" @click="test">
          <span class="glyph"><Icon name="sparkles" :size="20" /></span>
          <span class="text">Send a test notification</span>
        </button>
      </div>
      <p class="foot">
        You’ll get a native notification with the project summary and a link to the new GitHub repo whenever the pipeline
        creates one.
        <template v-if="!state.status.push"> The server has no VAPID keys yet — see the README.</template>
      </p>

      <h2 class="section-header">Server</h2>
      <div class="group">
        <div class="row">
          <span class="text"><span>API</span><small>{{ API_URL }}</small></span>
        </div>
        <div class="row" v-for="(ok, key) in { 'Workers AI binding': state.status.ai, 'GitHub token': state.status.github, 'VAPID keys': state.status.push }" :key="key">
          <span class="text"><span>{{ key }}</span></span>
          <span :class="ok ? 'ok' : 'missing'">{{ ok ? 'Configured' : 'Missing' }}</span>
        </div>
      </div>

      <h2 class="section-header">Access</h2>
      <div class="group">
        <button class="row action" @click="lock">
          <span class="glyph"><Icon name="lock" :size="20" /></span>
          <span class="text danger">Lock dashboard on this device</span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pane { height: 100%; display: flex; flex-direction: column; }
.scroll { flex: 1; overflow-y: auto; padding-bottom: 48px; }
.scroll > * { max-width: 680px; }
.group { margin: 0 16px; border-radius: 10px; background: var(--surface-1); overflow: hidden; }
.row {
  width: 100%; display: flex; align-items: center; gap: 12px;
  min-height: 52px; padding: 6px 14px; background: none; border: 0; text-align: left;
}
.row + .row { border-top: 0.5px solid var(--divider); }
.row.action:active:not(:disabled) { background: var(--surface-2); }
.glyph { color: var(--orange); display: grid; place-items: center; }
.text { flex: 1; display: flex; flex-direction: column; font-size: 17px; min-width: 0; }
.text small { font-size: 12px; color: var(--slate); overflow: hidden; text-overflow: ellipsis; }
.text.danger { color: var(--red); }
.ok { color: var(--green); font-size: 15px; }
.missing { color: var(--red); font-size: 15px; }
.foot { font-size: 13px; color: var(--slate); margin: 8px 32px 0 32px; line-height: 1.35; }

.switch { position: relative; width: 51px; height: 31px; flex: none; cursor: pointer; }
.switch input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.switch input:disabled { cursor: default; }
.track { position: absolute; inset: 0; border-radius: 16px; background: var(--surface-2); transition: background 0.2s; }
.track::after {
  content: ''; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%;
  background: #fff; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15); transition: transform 0.2s var(--ease);
}
.switch input:checked + .track { background: var(--green); }
.switch input:checked + .track::after { transform: translateX(20px); }
.switch input:disabled + .track { opacity: 0.5; }
.switch input:focus-visible + .track { outline: 2px solid var(--orange); outline-offset: 2px; }
</style>
