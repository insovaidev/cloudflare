<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface User {
  id: number
  name: string
  email: string
  created_at: string
}

const users = ref<User[]>([])
const loading = ref<boolean>(true)
const error = ref<string>('')
const nameInput = ref('')
const emailInput = ref('')

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

const fetchUsers = async () => {
  try {
    const res = await fetch(`${API_URL}/api/users`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    users.value = data.users || []
    error.value = ''
  } catch (err: any) {
    console.error('Fetch error:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const addUser = async () => {
  if (!nameInput.value || !emailInput.value) return

  const res = await fetch(`${API_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nameInput.value, email: emailInput.value })
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    error.value = data.error || `HTTP ${res.status}`
    return
  }

  nameInput.value = ''
  emailInput.value = ''
  await fetchUsers()
}

onMounted(() => {
  fetchUsers()
})
</script>

<template>
  <main style="max-width: 600px; margin: 2rem auto; font-family: system-ui, sans-serif;">
    <h1>Cloudflare Stack (Hono + D1 + Vue 3)</h1>

    <section style="margin-bottom: 2rem; padding: 1rem; border: 1px solid #ccc; border-radius: 8px;">
      <h3>Add New User (Saved directly to Cloudflare D1)</h3>
      <form @submit.prevent="addUser" style="display: flex; gap: 0.5rem;">
        <input v-model="nameInput" placeholder="Name" required />
        <input v-model="emailInput" type="email" placeholder="Email" required />
        <button type="submit">Add User</button>
      </form>
    </section>

    <p v-if="error" style="color: #c00;">Error: {{ error }}</p>

    <div v-if="loading">Loading from D1 edge database...</div>
    <ul v-else>
      <li v-for="user in users" :key="user.id" style="margin-bottom: 0.5rem;">
        <strong>{{ user.name }}</strong> ({{ user.email }})
      </li>
    </ul>
  </main>
</template>
