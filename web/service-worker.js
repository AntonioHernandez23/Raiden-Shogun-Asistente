const CACHE_NAME = 'raiden-v1.1';
const urlsToCache = [
  '/',
  '/static/icon-192.png',
  '/static/icon-512.png'
];

// Instalación - cachea archivos básicos
self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker v1.1...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Archivos cacheados');
        return cache.addAll(urlsToCache).catch(err => {
          console.log('[SW] Error al cachear archivos:', err);
          // No fallar si algunos archivos no se pueden cachear
        });
      })
  );
  self.skipWaiting(); // Activa inmediatamente
});

// Activación - limpia cachés antiguos
self.addEventListener('activate', event => {
  console.log('[SW] Activando Service Worker v1.1...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Eliminando caché antiguo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service Worker activado y listo');
      return self.clients.claim();
    })
  );
});

// Fetch - estrategia Network First (siempre intenta red primero)
self.addEventListener('fetch', event => {
  // Ignorar chrome-extension y otras URLs no HTTP/HTTPS
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Solo cachear respuestas exitosas
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone).catch(() => {
              // Ignorar errores de cache
            });
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, intenta desde caché
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si no hay caché, devolver respuesta básica
          return new Response('Sin conexión', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});

// Mensaje del cliente
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker cargado');