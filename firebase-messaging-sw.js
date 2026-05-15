// ═══════════════════════════════════════════════
// firebase-messaging-sw.js — FCM Service Worker
// MaintainPro — Push Notifications
// Must be in the ROOT folder (same level as index.html)
// ═══════════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyAU5pYiisi4gUdcdN0jG7sA5KQ7Ud35M38",
  authDomain:        "maintainpro-87ed1.firebaseapp.com",
  projectId:         "maintainpro-87ed1",
  storageBucket:     "maintainpro-87ed1.firebasestorage.app",
  messagingSenderId: "698895099207",
  appId:             "1:698895099207:web:6218d86624dc33425cd862",
});

const messaging = firebase.messaging();

// ── Handle background notifications ─────────────
// This fires when the app is in the background or closed
messaging.onBackgroundMessage(payload => {
  console.log('[SW] Background message received:', payload);

  const { title, body, icon, data } = payload.notification || {};

  self.registration.showNotification(title || 'MaintainPro', {
    body:    body  || 'You have a new notification.',
    icon:    icon  || '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     data?.jobId || 'maintainpro',
    data:    data  || {},
    actions: [
      { action: 'view', title: '👁 View task' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    requireInteraction: true, // keeps notification visible until user acts
  });
});

// ── Notification click handler ───────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // Open/focus the app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes('maintainpro') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
