<script setup lang="ts">
import FolderGlyph from './FolderGlyph.vue'
import Icon from './Icon.vue'
import { state, openFolder, folderCounts, type Folder } from '../lib/store'

const folders: { id: Exclude<Folder, 'settings'>; name: string }[] = [
  { id: 'projects', name: 'Projects' },
  { id: 'stack', name: 'My Stack' },
  { id: 'targets', name: 'Job Targets' },
]
</script>

<template>
  <nav class="sidebar" aria-label="Folders">
    <header class="nav">
      <h1 class="large-title">Folders</h1>
    </header>

    <div class="hero">
      <FolderGlyph :size="72" tilt />
      <div>
        <div class="hero-title">Skill Gap</div>
        <div class="hero-sub">Jobs → projects → repos</div>
      </div>
    </div>

    <h2 class="section-header">Dashboard</h2>
    <ul class="rows">
      <li v-for="f in folders" :key="f.id">
        <button class="row" :class="{ active: state.folder === f.id }" @click="openFolder(f.id)">
          <FolderGlyph />
          <span class="name">{{ f.name }}</span>
          <span class="count">{{ folderCounts[f.id] }}</span>
          <Icon name="chevronRight" :size="14" class="chev" />
        </button>
      </li>
    </ul>

    <h2 class="section-header">Smart Folders</h2>
    <ul class="rows">
      <li>
        <button class="row" :class="{ active: state.folder === 'settings' }" @click="openFolder('settings')">
          <span class="glyph"><Icon name="gear" :size="20" /></span>
          <span class="name">Settings &amp; Notifications</span>
          <Icon name="chevronRight" :size="14" class="chev" />
        </button>
      </li>
    </ul>

    <p class="status">
      <span :class="{ ok: state.status.ai }">Workers AI</span> ·
      <span :class="{ ok: state.status.github }">GitHub</span> ·
      <span :class="{ ok: state.status.push }">Web Push</span>
    </p>
  </nav>
</template>

<style scoped>
.sidebar { height: 100%; overflow-y: auto; padding-bottom: 24px; }
.nav { padding: 16px 16px 4px; min-height: 60px; display: flex; align-items: flex-end; }
.hero { display: flex; align-items: center; gap: 14px; padding: 12px 16px 4px; }
.hero-title { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
.hero-sub { font-size: 14px; color: var(--slate); margin-top: 2px; }
.rows { list-style: none; margin: 0; padding: 0; }
.row {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: none;
  border: 0;
  text-align: left;
  font-size: 17px;
  position: relative;
}
.row::after {
  content: '';
  position: absolute;
  left: 52px; right: 0; bottom: 0;
  border-bottom: 0.5px solid var(--divider);
}
.row:active, .row.active { background: var(--surface-1); }
.name { flex: 1; }
.count { color: var(--slate); }
.chev { color: var(--slate); }
.glyph { width: 24px; display: grid; place-items: center; color: var(--orange); }
.status { margin: 24px 16px 0; font-size: 12px; color: var(--mute); }
.status .ok { color: var(--green); }
</style>
