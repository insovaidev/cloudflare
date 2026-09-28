// Fetch wrapper for the Hono API. The admin token lives in localStorage on this device only.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

const TOKEN_KEY = 'skillgap.adminToken'

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}
export const setToken = (token: string) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* storage unavailable: token lasts for this page only */ }
  memoryToken = token
}
let memoryToken = getToken()

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export const api = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(memoryToken ? { Authorization: `Bearer ${memoryToken}` } : {}),
      ...init.headers,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || `HTTP ${res.status}`, res.status)
  return data as T
}

export const post = <T,>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
export const patch = <T,>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
export const del = <T,>(path: string) => api<T>(path, { method: 'DELETE' })

// ---- Types shared with the server ----

export interface Skill { id: number; name: string; created_at: string }

export interface Target {
  id: number
  url: string
  label: string
  active: boolean
  last_checked_at: string | null
  last_status: 'analyzed' | 'unchanged' | 'failed' | null
  last_error: string | null
  analysis_count: number
  created_at: string
}

export interface MissingSkill { skill: string; reason: string }

export interface Analysis {
  id: number
  target_id: number | null
  url: string
  status: 'pending' | 'completed' | 'failed'
  error: string | null
  job_title: string | null
  company: string | null
  required_skills: string[]
  missing_skills: MissingSkill[]
  project_name: string | null
  project_title: string | null
  project_summary: string | null
  repo_full_name: string | null
  repo_url: string | null
  pinned: boolean
  created_at: string
  readme?: string | null
}

export interface RunResult {
  targetId: number
  status: 'analyzed' | 'unchanged' | 'failed'
  analysisId?: number
  repoUrl?: string
  error?: string
}
