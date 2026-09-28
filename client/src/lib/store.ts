import { reactive, computed } from 'vue'
import { api, post, patch, del, getToken, setToken, ApiError } from './api'
import type { Analysis, Skill, Target, RunResult } from './api'

export type Folder = 'projects' | 'stack' | 'targets' | 'settings'

export const state = reactive({
  locked: !getToken(),
  loading: true,
  error: '',
  toast: '',
  folder: 'projects' as Folder,
  // Mobile navigation depth: folders → list → detail (desktop shows all panes).
  depth: 'list' as 'folders' | 'list' | 'detail',
  analyses: [] as Analysis[],
  skills: [] as Skill[],
  targets: [] as Target[],
  selectedId: null as number | null,
  detail: null as Analysis | null,
  running: false,
  runningTargetId: null as number | null,
  status: { ai: false, github: false, push: false },
})

let toastTimer: ReturnType<typeof setTimeout> | undefined
export const showToast = (msg: string) => {
  state.toast = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (state.toast = ''), 3500)
}

const handle = (err: unknown) => {
  if (err instanceof ApiError && err.status === 401) {
    state.locked = true
    state.error = 'That admin token was rejected.'
    return
  }
  state.error = err instanceof Error ? err.message : String(err)
}

/** Runs an action and surfaces failures in the banner. Returns false on error. */
export const guard = async (fn: () => Promise<unknown>) => {
  state.error = ''
  try {
    await fn()
    return true
  } catch (err) {
    handle(err)
    return false
  }
}

export const loadAll = () => guard(async () => {
  state.loading = true
  try {
    const [a, s, t, st] = await Promise.all([
      api<{ analyses: Analysis[] }>('/api/analyses'),
      api<{ skills: Skill[] }>('/api/skills'),
      api<{ targets: Target[] }>('/api/targets'),
      api<typeof state.status>('/api/status'),
    ])
    state.analyses = a.analyses
    state.skills = s.skills
    state.targets = t.targets
    state.status = st
    state.locked = false
  } finally {
    state.loading = false
  }
})

export const unlock = async (token: string) => {
  setToken(token.trim())
  const ok = await loadAll()
  if (!ok) setToken('')
  return ok
}

export const lock = () => {
  setToken('')
  Object.assign(state, { locked: true, analyses: [], skills: [], targets: [], detail: null, selectedId: null })
}

export const openFolder = (folder: Folder) => {
  state.folder = folder
  state.depth = 'list'
}

export const selectAnalysis = (id: number | null) => guard(async () => {
  state.selectedId = id
  if (id === null) {
    state.detail = null
    return
  }
  state.depth = 'detail'
  state.detail = state.analyses.find((a) => a.id === id) ?? null
  const { analysis } = await api<{ analysis: Analysis }>(`/api/analyses/${id}`)
  if (state.selectedId === id) state.detail = analysis
})

const refreshLists = async () => {
  const [a, t] = await Promise.all([
    api<{ analyses: Analysis[] }>('/api/analyses'),
    api<{ targets: Target[] }>('/api/targets'),
  ])
  state.analyses = a.analyses
  state.targets = t.targets
}

const summarize = (results: RunResult[]) => {
  const n = (s: RunResult['status']) => results.filter((r) => r.status === s).length
  if (!results.length) return 'No active job targets to check.'
  return [
    n('analyzed') && `${n('analyzed')} new project${n('analyzed') > 1 ? 's' : ''}`,
    n('unchanged') && `${n('unchanged')} unchanged`,
    n('failed') && `${n('failed')} failed`,
  ].filter(Boolean).join(' · ')
}

export const runAll = () => guard(async () => {
  state.running = true
  try {
    const { results } = await post<{ results: RunResult[] }>('/api/run')
    await refreshLists()
    showToast(summarize(results))
  } finally {
    state.running = false
  }
})

export const runTarget = (id: number, force = false) => guard(async () => {
  state.runningTargetId = id
  try {
    const { result } = await post<{ result: RunResult }>(`/api/targets/${id}/run${force ? '?force=1' : ''}`)
    await refreshLists()
    showToast(result.status === 'failed' ? `Failed: ${result.error}` : summarize([result]))
    if (result.analysisId && state.folder === 'projects') await selectAnalysis(result.analysisId)
  } finally {
    state.runningTargetId = null
  }
})

export const togglePin = (a: Analysis) => guard(async () => {
  await patch(`/api/analyses/${a.id}`, { pinned: !a.pinned })
  for (const item of [state.analyses.find((x) => x.id === a.id), state.detail?.id === a.id ? state.detail : null]) {
    if (item) item.pinned = !a.pinned
  }
})

export const deleteAnalysis = (a: Analysis) => guard(async () => {
  await del(`/api/analyses/${a.id}`)
  state.analyses = state.analyses.filter((x) => x.id !== a.id)
  if (state.selectedId === a.id) {
    state.selectedId = null
    state.detail = null
    state.depth = 'list'
  }
})

export const addSkill = (name: string) => guard(async () => {
  const { skill } = await post<{ skill: Skill }>('/api/skills', { name })
  state.skills = [...state.skills, skill].sort((a, b) => a.name.localeCompare(b.name))
})

export const deleteSkill = (s: Skill) => guard(async () => {
  await del(`/api/skills/${s.id}`)
  state.skills = state.skills.filter((x) => x.id !== s.id)
})

export const addTarget = (url: string, label: string) => guard(async () => {
  await post('/api/targets', { url, label })
  state.targets = (await api<{ targets: Target[] }>('/api/targets')).targets
})

export const updateTarget = (t: Target, changes: Partial<Pick<Target, 'label' | 'active'>>) => guard(async () => {
  await patch(`/api/targets/${t.id}`, changes)
  Object.assign(t, changes)
})

export const deleteTarget = (t: Target) => guard(async () => {
  await del(`/api/targets/${t.id}`)
  state.targets = state.targets.filter((x) => x.id !== t.id)
})

export const folderCounts = computed(() => ({
  projects: state.analyses.length,
  stack: state.skills.length,
  targets: state.targets.length,
}))
