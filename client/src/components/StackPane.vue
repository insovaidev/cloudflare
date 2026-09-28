<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'
import PaneHeader from './PaneHeader.vue'
import { state, addSkill, deleteSkill } from '../lib/store'

const name = ref('')
const input = ref<HTMLInputElement>()
const saving = ref(false)

const submit = async () => {
  if (!name.value.trim()) return
  saving.value = true
  if (await addSkill(name.value.trim())) name.value = ''
  saving.value = false
  input.value?.focus()
}
defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <section class="pane">
    <PaneHeader title="My Stack" />
    <div class="paper">
      <p class="intro">
        Your baseline tech stack. Claude compares every job posting against this list to find what you’re missing.
      </p>

      <ul class="checklist">
        <li v-for="s in state.skills" :key="s.id">
          <span class="check-circle filled" aria-hidden="true"><Icon name="check" :size="14" /></span>
          <span class="name">{{ s.name }}</span>
          <button class="icon-btn danger" :aria-label="`Remove ${s.name}`" @click="deleteSkill(s)">
            <Icon name="trash" :size="18" />
          </button>
        </li>
        <li class="add">
          <span class="check-circle" aria-hidden="true" />
          <form @submit.prevent="submit">
            <label class="sr-only" for="new-skill">New skill</label>
            <input id="new-skill" ref="input" v-model="name" maxlength="60" placeholder="Add a skill, e.g. Rust" />
            <button v-if="name.trim()" class="text-btn" type="submit" :disabled="saving">Add</button>
          </form>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.pane { height: 100%; display: flex; flex-direction: column; }
.paper { flex: 1; overflow-y: auto; padding: 0 16px 96px; }
.paper > * { max-width: 720px; }
.intro { font-size: 17px; line-height: 1.5; color: var(--slate); margin-top: 0; }
.checklist { list-style: none; padding: 0; margin: 0; }
.checklist li {
  display: flex; align-items: center; gap: 12px; min-height: 48px;
  border-bottom: 0.5px solid var(--divider);
}
.name { flex: 1; font-size: 17px; }
.checklist li .icon-btn { opacity: 0; transition: opacity 0.15s; }
.checklist li:hover .icon-btn, .checklist li .icon-btn:focus-visible { opacity: 1; }
@media (hover: none) { .checklist li .icon-btn { opacity: 1; } }
.add form { flex: 1; display: flex; align-items: center; }
.add input { flex: 1; border: 0; outline: 0; background: transparent; font-size: 17px; min-height: 44px; }
.add input::placeholder { color: var(--mute); }
</style>
