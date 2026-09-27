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
const saving = ref<boolean>(false)
const error = ref<string>('')
const nameInput = ref('')
const emailInput = ref('')

const editingId = ref<number | null>(null)
const editName = ref('')
const editEmail = ref('')

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

// Shared fetch wrapper: parses JSON and throws the API's error message on failure.
const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data as T
}

// Runs a mutation, surfacing any error in the banner.
const run = async (fn: () => Promise<void>) => {
  saving.value = true
  error.value = ''
  try {
    await fn()
  } catch (err: any) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}

const fetchUsers = async () => {
  try {
    const data = await api<{ users: User[] }>('/api/users')
    users.value = data.users || []
    error.value = ''
  } catch (err: any) {
    console.error('Fetch error:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const addUser = () => run(async () => {
  await api('/api/users', {
    method: 'POST',
    body: JSON.stringify({ name: nameInput.value, email: emailInput.value }),
  })
  nameInput.value = ''
  emailInput.value = ''
  await fetchUsers()
})

const startEdit = (user: User) => {
  editingId.value = user.id
  editName.value = user.name
  editEmail.value = user.email
}

const cancelEdit = () => {
  editingId.value = null
}

const saveEdit = (id: number) => run(async () => {
  await api(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name: editName.value, email: editEmail.value }),
  })
  editingId.value = null
  await fetchUsers()
})

const deleteUser = (user: User) => {
  if (!confirm(`Delete ${user.name}?`)) return
  return run(async () => {
    await api(`/api/users/${user.id}`, { method: 'DELETE' })
    await fetchUsers()
  })
}

onMounted(() => {
  fetchUsers()
})
</script>

<template>
  <main class="page">
    <h1>Cloudflare Stack (Hono + D1 + Vue 3)</h1>

    <section class="card">
      <h3>Add New User (Saved directly to Cloudflare D1)</h3>
      <form @submit.prevent="addUser" class="row">
        <input v-model="nameInput" placeholder="Name" required />
        <input v-model="emailInput" type="email" placeholder="Email" required />
        <button type="submit" :disabled="saving">Add User</button>
      </form>
    </section>

    <p v-if="error" class="error">Error: {{ error }}</p>

    <div v-if="loading">Loading from D1 edge database...</div>
    <p v-else-if="!users.length">No users yet.</p>
    <ul v-else class="list">
      <li v-for="user in users" :key="user.id">
        <form v-if="editingId === user.id" @submit.prevent="saveEdit(user.id)" class="row">
          <input v-model="editName" placeholder="Name" required />
          <input v-model="editEmail" type="email" placeholder="Email" required />
          <button type="submit" :disabled="saving">Save</button>
          <button type="button" @click="cancelEdit">Cancel</button>
        </form>
        <div v-else class="row">
          <span class="grow"><strong>{{ user.name }}</strong> ({{ user.email }})</span>
          <button type="button" @click="startEdit(user)" :disabled="saving">Edit</button>
          <button type="button" class="danger" @click="deleteUser(user)" :disabled="saving">Delete</button>
        </div>
      </li>
    </ul>
  </main>
</template>

<style>
.page { max-width: 640px; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, sans-serif; }
.card { margin-bottom: 2rem; padding: 1rem; border: 1px solid #ccc; border-radius: 8px; }
.row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.row input { flex: 1; min-width: 120px; }
.grow { flex: 1; }
.list { list-style: none; padding: 0; }
.list li { padding: 0.5rem 0; border-bottom: 1px solid #eee; }
.error { color: #c00; }
.danger { color: #c00; }
</style>
