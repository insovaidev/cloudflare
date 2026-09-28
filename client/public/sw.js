// Service worker: shows Web Push notifications for newly generated project repos.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data?.text() } }

  const actions = data.dashboardUrl
    ? [{ action: 'repo', title: 'Open repo' }, { action: 'dashboard', title: 'Dashboard' }]
    : []

  event.waitUntil(self.registration.showNotification(data.title || 'Skill Gap', {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.tag,
    data: { url: data.url || '/', dashboardUrl: data.dashboardUrl },
    actions,
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { url, dashboardUrl } = event.notification.data || {}
  const target = event.action === 'dashboard' && dashboardUrl ? dashboardUrl : url || '/'
  event.waitUntil(self.clients.openWindow(target))
})
