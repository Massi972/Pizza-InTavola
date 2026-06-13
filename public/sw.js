// Service Worker - App Pizza InTavola
const CACHE_NAME = 'pizza-intavola-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Gestione notifiche push in arrivo
self.addEventListener('push', (event) => {
  let data = { title: '🍕 App Pizza', body: 'Hai un nuovo messaggio.' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: 'https://akifadjnpedvwesxzbsw.supabase.co/storage/v1/object/public/Branding/App%20Icon%20Pizza2.png?v=2',
    badge: 'https://akifadjnpedvwesxzbsw.supabase.co/storage/v1/object/public/Branding/App%20Icon%20Pizza2.png?v=2',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Click sulla notifica → apre/focus l'app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
