// D1 CURRENT_TIMESTAMP is "YYYY-MM-DD HH:MM:SS" in UTC.
export const parseDbDate = (s: string) => new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z'))

// Apple Notes style: time today, "Yesterday", weekday this week, otherwise a date.
export const noteDate = (s: string | null) => {
  if (!s) return 'Never'
  const d = parseDbDate(s)
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (days === 0) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days > 1 && days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' })
  return d.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

export const fullDate = (s: string) =>
  parseDbDate(s).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })

export const hostOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
