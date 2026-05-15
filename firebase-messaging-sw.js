// ═══════════════════════════════════════════════
// firebase-messaging-sw.js — FCM Service Worker + PWA
// MaintainPro — Push Notifications + Offline Support
// ═══════════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const CACHE_NAME = 'maintainpro-v1';
const OFFLINE_ASSETS = [
  '/MaintainProRayan/',
  '/MaintainProRayan/index.html',
  '/MaintainProRayan/styles.css',
  '/MaintainProRayan/script.js',
  '/MaintainProRayan/firebase.js',
  '/MaintainProRayan/dashboard.js',
  '/MaintainProRayan/reports.js',
  '/MaintainProRayan/rooms.js',
  '/MaintainProRayan/icon-192.png',
  '/MaintainProRayan/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_ASSETS).catch(e => console.warn('[SW] Cache failed:', e)))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('firestore') || event.request.url.includes('googleapis') || event.request.url.includes('firebase')) return;
  event.respondWith(
    fetch(event.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      return res;
    }).catch(() => caches.match(event.request))
  );
});

firebase.initializeApp({
  apiKey:            "AIzaSyAU5pYiisi4gUdcdN0jG7sA5KQ7Ud35M38",
  authDomain:        "maintainpro-87ed1.firebaseapp.com",
  projectId:         "maintainpro-87ed1",
  storageBucket:     "maintainpro-87ed1.firebasestorage.app",
  messagingSenderId: "698895099207",
  appId:             "1:698895099207:web:6218d86624dc33425cd862",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'MaintainPro', {
    body:    body || 'You have a new notification.',
    icon:    '/MaintainProRayan/icon-192.png',
    badge:   '/MaintainProRayan/icon-192.png',
    tag:     'maintainpro-notification',
    requireInteraction: true,
    actions: [
      { action: 'view',    title: '👁 View task' },
      { action: 'dismiss', title: 'Dismiss'      },
    ],
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('MaintainProRayan') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/MaintainProRayan/');
    })
  );
});
