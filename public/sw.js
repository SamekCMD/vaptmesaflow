// Service Worker for Web Push Notifications — Vapt
self.addEventListener('push', function(event) {
  let data = { title: 'Vapt', body: 'Você tem uma nova notificação', url: '/dashboard/kitchen' };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    // fallback to defaults
  }

  const options = {
    body: data.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/dashboard/kitchen' },
    tag: data.tag || 'vapt-notification',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Vapt', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const url = event.notification.data?.url || '/dashboard/kitchen';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow(url);
    })
  );
});
