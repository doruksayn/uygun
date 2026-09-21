self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch {}
  event.waitUntil(self.registration.showNotification(data.title || 'Arkadaşın uygun!', {
    body: data.body || 'Birlikte zaman geçirmek için uygulamayı aç.',
    icon: new URL('icon-192.png', self.registration.scope).href,
    tag: 'uygun-status', data: { url: self.registration.scope }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = self.registration.scope;
    for (const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})) {
      if (client.url.startsWith(url)) { await client.focus(); return; }
    }
    await self.clients.openWindow(url);
  })());
});
