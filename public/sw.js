// Restaurant OS Service Worker
// skipWaiting is NOT called on install — new SW waits until user approves update
// This lets the UpdateBanner show and give staff control over when to refresh

self.addEventListener('install', e => {
  // Do NOT call skipWaiting() here — we want the new SW to wait
  // so the update banner can prompt the user
});

self.addEventListener('activate', e => {
  // Clean up old caches when we activate
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network first — always fetch fresh content
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/'))
    );
  }
});

// App sends this message when user taps "Update now"
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
