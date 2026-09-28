<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Sidebar from './components/Sidebar.vue'
import ProjectList from './components/ProjectList.vue'
import ProjectDetail from './components/ProjectDetail.vue'
import StackPane from './components/StackPane.vue'
import TargetsPane from './components/TargetsPane.vue'
import SettingsPane from './components/SettingsPane.vue'
import LockScreen from './components/LockScreen.vue'
import Icon from './components/Icon.vue'
import { state, loadAll, selectAnalysis } from './lib/store'
import { registerServiceWorker } from './lib/push'

const stack = ref<InstanceType<typeof StackPane>>()
const targets = ref<InstanceType<typeof TargetsPane>>()

onMounted(async () => {
  registerServiceWorker().catch((err) => console.warn('Service worker registration failed', err))
  if (state.locked) {
    state.loading = false
    return
  }
  await loadAll()
  // Deep link from a push notification: /?analysis=42
  const id = Number(new URLSearchParams(location.search).get('analysis'))
  if (Number.isInteger(id) && id > 0) {
    await selectAnalysis(id)
    history.replaceState(null, '', location.pathname)
  }
})
</script>

<template>
  <LockScreen v-if="state.locked" />

  <div v-else class="shell" :data-folder="state.folder" :data-depth="state.depth">
    <aside class="pane sidebar-pane"><Sidebar /></aside>

    <template v-if="state.folder === 'projects'">
      <div class="pane list-pane"><ProjectList /></div>
      <main class="pane detail-pane"><ProjectDetail /></main>
    </template>
    <main v-else class="pane wide-pane">
      <StackPane v-if="state.folder === 'stack'" ref="stack" />
      <TargetsPane v-else-if="state.folder === 'targets'" ref="targets" />
      <SettingsPane v-else />
      <button
        v-if="state.folder !== 'settings'"
        class="fab"
        :aria-label="state.folder === 'stack' ? 'Add a skill' : 'Add a job URL'"
        @click="(state.folder === 'stack' ? stack : targets)?.focus()"
      >
        <Icon name="plus" :size="26" />
      </button>
    </main>

    <div v-if="state.error" class="banner error floating" role="alert">
      {{ state.error }}
      <button class="text-btn" @click="state.error = ''">Dismiss</button>
    </div>
    <Transition name="toast">
      <div v-if="state.toast" class="toast" role="status">{{ state.toast }}</div>
    </Transition>
  </div>
</template>

<style>
.shell {
  height: 100%;
  display: grid;
  grid-template-columns: 1fr;
  background: var(--canvas);
  padding-top: env(safe-area-inset-top);
}
.pane { position: relative; min-width: 0; height: 100%; overflow: hidden; background: var(--canvas); }

/* Phone: hierarchical push navigation — one pane at a time. */
@media (max-width: 899px) {
  .pane { display: none; animation: push-in 0.35s var(--ease); }
  .shell[data-depth='folders'] .sidebar-pane,
  .shell[data-depth='list'] .list-pane,
  .shell[data-depth='list'] .wide-pane,
  .shell[data-depth='detail'] .detail-pane,
  .shell[data-depth='detail'] .wide-pane { display: block; }
}
@keyframes push-in { from { transform: translateX(24px); opacity: 0.6; } to { transform: none; opacity: 1; } }

/* iPad / desktop: split view — folders | notes | editor. */
@media (min-width: 900px) {
  .shell { grid-template-columns: 280px 340px 1fr; }
  .shell:not([data-folder='projects']) { grid-template-columns: 280px 1fr; }
  .sidebar-pane { background: var(--surface-1); border-right: 0.5px solid var(--divider); }
  .sidebar-pane .row::after { display: none; }
  .sidebar-pane .row:active, .sidebar-pane .row.active { background: var(--surface-2); }
  .list-pane { border-right: 0.5px solid var(--divider); }
  .mobile-only { display: none !important; }
}

.floating {
  position: fixed; left: 50%; top: calc(12px + env(safe-area-inset-top)); transform: translateX(-50%);
  z-index: 20; max-width: min(560px, calc(100% - 32px)); margin: 0;
  display: flex; align-items: center; gap: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.toast {
  position: fixed; left: 50%; bottom: calc(88px + env(safe-area-inset-bottom)); transform: translateX(-50%);
  z-index: 20; max-width: calc(100% - 32px);
  padding: 10px 16px; border-radius: 16px; font-size: 14px; font-weight: 500;
  background: var(--ink); color: var(--canvas); box-shadow: var(--shadow-sheet);
}
.toast-enter-active, .toast-leave-active { transition: opacity 0.25s, transform 0.25s var(--ease); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>
