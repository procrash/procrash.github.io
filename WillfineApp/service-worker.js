/**
 * Service Worker für die Wildkamera SMS-Steuerung PWA
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/sms-commands.js',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js',
  'https://fonts.googleapis.com/icon?family=Material+Icons'
];

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


// Service Worker Installation
self.addEventListener('install', event => {
  // Führe die Installation vollständig durch, bevor der Service Worker aktiviert wird
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache geöffnet');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Service Worker Aktivierung
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Lösche alte Caches
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Netzwerkanfragen abfangen
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache-Hit - gib die gecachte Antwort zurück
        if (response) {
          return response;
        }

        // Erstelle eine Kopie der Anfrage, da sie nur einmal verwendet werden kann
        const fetchRequest = event.request.clone();

        // Wenn kein Cache-Hit vorliegt, hole die Antwort vom Netzwerk
        return fetch(fetchRequest)
          .then(response => {
            // Prüfe, ob die Antwort gültig ist
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Erstelle eine Kopie der Antwort, da sie nur einmal verwendet werden kann
            const responseToCache = response.clone();

            // Speichere die Antwort im Cache
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Wenn Netzwerk fehlschlägt und es eine Navigationsanfrage ist, versuche, offline.html zu liefern
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            
            // Ansonsten kann keine Antwort geliefert werden
            return new Response('Network offline and no cached response available.');
          });
      })
  );
});

// Background Sync für SMS-Versand
self.addEventListener('sync', event => {
  if (event.tag === 'sync-sms') {
    event.waitUntil(syncPendingSMS());
  }
});

// Funktion zum Synchronisieren ausstehender SMS
async function syncPendingSMS() {
  try {
    // Hier würden wir ausstehende SMS aus dem IndexedDB abrufen
    // und versuchen, sie zu senden, wenn wir wieder online sind
    
    // Beispielhafte Implementierung:
    const db = await openDatabase();
    const pendingSMS = await getPendingSMS(db);
    
    for (const sms of pendingSMS) {
      try {
        // Versuche, die SMS zu senden
        const sent = await sendSMS(sms);
        
        if (sent) {
          // Bei Erfolg aus der Datenbank löschen
          await deletePendingSMS(db, sms.id);
        }
      } catch (error) {
        console.error('Fehler beim Senden der SMS:', error);
        // SMS bleibt in der Datenbank für einen weiteren Versuch
      }
    }
  } catch (error) {
    console.error('Fehler bei der SMS-Synchronisation:', error);
  }
}

// Hilfsfunktionen für IndexedDB
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('wildkamera-db', 1);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-sms')) {
        db.createObjectStore('pending-sms', { keyPath: 'id', autoIncrement: true });
      }
    };
    
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.target.error);
  });
}

function getPendingSMS(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-sms'], 'readonly');
    const store = transaction.objectStore('pending-sms');
    const request = store.getAll();
    
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.target.error);
  });
}

function deletePendingSMS(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-sms'], 'readwrite');
    const store = transaction.objectStore('pending-sms');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve(true);
    request.onerror = event => reject(event.target.error);
  });
}

// Funktion zum Senden einer SMS
// In der Realität würden wir hier eine API verwenden
function sendSMS(sms) {
  return new Promise((resolve, reject) => {
    // Simuliere einen erfolgreichen SMS-Versand
    setTimeout(() => {
      // 80% Erfolgswahrscheinlichkeit
      if (Math.random() < 0.8) {
        resolve(true);
      } else {
        reject(new Error('SMS konnte nicht gesendet werden'));
      }
    }, 1000);
  });
}

// Push-Benachrichtigungen
self.addEventListener('push', event => {
  let notification = {
    title: 'Wildkamera Benachrichtigung',
    body: 'Neue Aktivität erkannt.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: {}
  };
  
  // Wenn die Nachricht Daten enthält, verwende diese
  if (event.data) {
    try {
      const data = event.data.json();
      notification = { ...notification, ...data };
    } catch (error) {
      console.error('Fehler beim Parsen der Push-Daten:', error);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: notification.icon,
      badge: notification.badge,
      data: notification.data
    })
  );
});

// Klick auf Benachrichtigung
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  // Öffne die App oder eine bestimmte Seite
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(windowClients => {
        // Wenn die App bereits geöffnet ist, fokussiere sie
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Ansonsten öffne die App
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
