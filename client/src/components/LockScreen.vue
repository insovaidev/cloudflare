<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'
import FolderGlyph from './FolderGlyph.vue'
import { state, unlock } from '../lib/store'

const token = ref('')
const busy = ref(false)

const submit = async () => {
  busy.value = true
  await unlock(token.value)
  busy.value = false
}
</script>

<template>
  <main class="lock">
    <FolderGlyph :size="80" tilt />
    <h1 class="large-title">Skill Gap</h1>
    <p class="locked"><Icon name="lock" :size="18" class="lock-icon" /> This dashboard is locked.</p>
    <form @submit.prevent="submit">
      <label class="sr-only" for="token">Admin token</label>
      <input
        id="token"
        v-model="token"
        class="field"
        type="password"
        autocomplete="current-password"
        placeholder="Admin token"
        required
        autofocus
      />
      <button class="primary-btn" type="submit" :disabled="busy || !token">
        {{ busy ? 'Unlocking…' : 'Unlock' }}
      </button>
    </form>
    <p v-if="state.error" class="error">{{ state.error }}</p>
    <p class="hint">Use the <code>ADMIN_TOKEN</code> secret you set on the server Worker. It’s stored only in this browser.</p>
  </main>
</template>

<style scoped>
.lock {
  min-height: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 32px 16px; text-align: center;
}
.locked { color: var(--slate); font-size: 14px; font-style: italic; margin: 0; }
.lock-icon { color: #ffcc00; vertical-align: -3px; }
form { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 320px; margin-top: 12px; }
.error { color: var(--red); font-size: 14px; margin: 0; }
.hint { color: var(--slate); font-size: 13px; max-width: 320px; }
code { font-family: var(--mono); font-size: 12px; }
</style>
