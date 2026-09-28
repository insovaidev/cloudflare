<script setup lang="ts">
// Minimal SF Symbols-style line icons.
defineProps<{ name: keyof typeof PATHS; size?: number }>()
</script>

<script lang="ts">
const PATHS = {
  compose: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4M13 4H5a2 2 0 0 0-2 2v13',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  pin: 'M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1-2 3.4-1.8-.7a7.6 7.6 0 0 1-2 1.2L15 20.5h-4l-.2-2.1a7.6 7.6 0 0 1-2-1.2l-1.8.7-2-3.4 1.6-1a7.7 7.7 0 0 1 0-3l-1.6-1 2-3.4 1.8.7a7.6 7.6 0 0 1 2-1.2L11 3.5h4l.2 2.1a7.6 7.6 0 0 1 2 1.2l1.8-.7 2 3.4-1.6 1a7.7 7.7 0 0 1 0 3z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  plus: 'M12 5v14M5 12h14',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  github: 'M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  ellipsis: 'M6 12h.01M12 12h.01M18 12h.01',
} as const
</script>

<template>
  <svg
    class="icon"
    :width="size ?? 22"
    :height="size ?? 22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="name === 'ellipsis' ? 3 : 1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="PATHS[name]" />
  </svg>
</template>
