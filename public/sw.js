const CACHE_NAME = 'servitium-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-48x48.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-167x167.png',
  '/icons/icon-180x180.png',
  '/icons/icon-192x192.png',
  '/icons/icon-256x256.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/icon-512x512-maskable.png',
  '/favicon.png',
  '/favicon.svg'
];

// Install Event - Pre-cache essential static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Handle caching strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip requests that are not http or https (e.g., chrome-extension, extension, data, about)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Skip dev server WebSockets or HMR connections
  if (url.pathname.includes('ws') || url.pathname.includes('hmr') || (url.hostname === 'localhost' && url.port === '5173')) {
    return;
  }

  // 1. APIs / Sheets Fetch - Network First
  if (url.pathname.startsWith('/api') || url.hostname.includes('googleapis.com') || url.hostname.includes('google.com')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 2. HTML Document Requests - Network First
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/index.html'));
    return;
  }

  // 3. CSS, Fonts, Static Files & Images - Cache First
  const isCSS = request.destination === 'style' || url.pathname.endsWith('.css');
  const isFont = request.destination === 'font' || url.pathname.endsWith('.woff') || url.pathname.endsWith('.woff2') || url.pathname.endsWith('.ttf');
  const isImage = request.destination === 'image' || url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.jpeg') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.ico');
  
  if (isCSS || isFont || isImage) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 4. JS Assets - Stale While Revalidate
  const isJS = request.destination === 'script' || url.pathname.endsWith('.js') || url.pathname.endsWith('.ts') || url.pathname.endsWith('.tsx');
  if (isJS) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default fallback strategy - Stale While Revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// Strategic cache helper: Network First
async function networkFirst(request, fallbackUrl) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      try {
        await cache.put(request, networkResponse.clone());
      } catch (cacheErr) {
        console.warn('[Service Worker] Failed to write to cache:', cacheErr);
      }
    }
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Fetch failed, returning cached version if available', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    if (fallbackUrl) {
      const fallbackCacheResponse = await caches.match(fallbackUrl);
      if (fallbackCacheResponse) {
        return fallbackCacheResponse;
      }
    }
    throw error;
  }
}

// Strategic cache helper: Cache First
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      try {
        await cache.put(request, networkResponse.clone());
      } catch (cacheErr) {
        console.warn('[Service Worker] Failed to write to cache:', cacheErr);
      }
    }
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Cache First fallback error for', request.url, error);
    throw error;
  }
}

// Strategic cache helper: Stale While Revalidate
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse && networkResponse.status === 200) {
      try {
        cache.put(request, networkResponse.clone());
      } catch (cacheErr) {
        console.warn('[Service Worker] Failed to write to cache:', cacheErr);
      }
    }
    return networkResponse;
  }).catch((err) => {
    console.log('[Service Worker] Background fetch failed for', request.url, err);
  });

  return cachedResponse || fetchPromise;
}
