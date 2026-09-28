<script setup lang="ts">
// The iconic yellow tab-folder: Folder Yellow fill, Notes Orange stroke, warm inner highlight.
defineProps<{ size?: number; tilt?: boolean }>()
</script>

<template>
  <svg
    class="folder-glyph"
    :class="{ tilt }"
    :width="size ?? 24"
    :height="size ?? 24"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M2.5 6.5a2 2 0 0 1 2-2h5l2 2.2h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z"
      fill="var(--folder)"
      stroke="var(--orange)"
      stroke-width="1"
      stroke-linejoin="round"
    />
    <path d="M3.2 9.2h17.6" stroke="var(--folder-hi)" stroke-width="0.8" />
  </svg>
</template>

<style scoped>
.folder-glyph { flex: none; filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.06)); }
.tilt { transform: perspective(200px) rotateX(2deg); }
</style>
