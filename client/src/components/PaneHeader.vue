<script setup lang="ts">
import Icon from './Icon.vue'
import { state } from '../lib/store'
defineProps<{ title: string }>()
</script>

<template>
  <header class="pane-header">
    <button class="text-btn mobile-only back" @click="state.depth = 'folders'">
      <Icon name="chevronLeft" :size="20" /> Folders
    </button>
    <h1 class="large-title">{{ title }}</h1>
    <slot />
  </header>
</template>

<style scoped>
.pane-header { padding: 4px 16px 8px; }
.back { margin-left: -8px; }
@media (min-width: 900px) { .pane-header { padding-top: 16px; } }
</style>
