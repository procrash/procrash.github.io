/**
 * service-worker.js
 * Service Worker für die Wildkamera SMS-Steuerung PWA mit detailliertem Debug-Logging
 */

const CACHE_NAME = 'wildkamera-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/styles-css.css',
  '/styles-extensions.css',
  '/app.js',
  '/camera-settings.js',
  '/config.js',
  '/db-manager.js',
  '/offline-html.html',
  '/offline-sync-manager.js',
  '/sms-commands.js',
  '/sms-manager.js',
  '/sync-manager.js',
  '/ui-extensions.js',
  '/wildkamera-icon.svg',
  '/manifest.json',
  '/icons/favicon.png',
  '/icons/favicon.ico',
  '/icons/icon-144x144.png',
  '/icons/icon-192x192.png',
  // Externe Ressourcen zum Cachen (optional)
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js',
  'https://fonts.googleapis.com/icon?family=Material+Icons'
];

// Install-Event mit Einzelfile-Logging bei Fehlern
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.all(
          ASSETS.map(asset =>
            cache.add(asset).catch(err => {
              console.error(`[ServiceWorker] Fehler beim Cachen: ${asset}`, err);
              // Weiter mit nächsten Assets
              return Promise.resolve();
            })
          )
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Install abgeschlossen: alle Assets verarbeitet');
        return self.skipWaiting();
      })
  );
});

// Activate-Event: alte Caches entfernen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names.map(name => name !== CACHE_NAME ? caches.delete(name) : null)
      )
    ).then(() => {
      console.log('[ServiceWorker] Activate abgeschlossen');
      return self.clients.claim();
    })
  );
});

// Fetch-Event: Cache-First mit Netzwerk-Update und Offline-Fallback
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Wenn nicht im Cache, aus dem Netz holen
        return fetch(event.request).then(networkResponse => {
          // Antwort cachen (wenn gültig)
          if (networkResponse && networkResponse.ok) {
            const respClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
          }
          return networkResponse;
        });
      })
      .catch(err => {
        console.error('[ServiceWorker] Fetch-Fehler für', event.request.url, err);
        // Offline-Fallback für Navigationen
        if (event.request.mode === 'navigate') {
          return caches.match('/offline-html.html');
        }
        return new Response('Offline und keine gecachte Version verfügbar.', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
  );
});