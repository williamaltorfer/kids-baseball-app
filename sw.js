// sw.js — simple static-asset cache for GitHub Pages
// Scope: /kids-baseball-app/

const APP_PATH = '/kids-baseball-app';
const CACHE_NAME = 'theo-ball-static-v1';

// List the core files to precache. Update this list (and bump CACHE_NAME) when you add/change files.
const ASSETS = [
  `${APP_PATH}/`,
  `${APP_PATH}/index.html`,
  `${APP_PATH}/styles.css`,
  `${APP_PATH}/manifest.webmanifest`,
  // JS entry points
  `${APP_PATH}/js/main.js`,
  `${APP_PATH}/js/components.js`,
  `${APP_PATH}/js/api.js`,
  `${APP_PATH}/js/utils.js`,
  // Icons
  `${APP_PATH}/icons/icon.png`,
];

// ----- Install: pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ----- Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// Helper: is this request to the MLB live API? (always network-first, don’t cache)
function isLiveApi(url) {
  return url.includes('statsapi.mlb.com');
}

// Helper: is this same-origin (GitHub Pages) request?
function isSameOrigin(url) {
  try {
    const u = new URL(url);
    return self.location.origin === u.origin;
  } catch {
    return false;
  }
}

// ----- Fetch: cache-first for static assets; network-first for HTML navigations; never cache MLB API
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore non-GET
  if (request.method !== 'GET') return;

  const url = request.url;

  // Do not intercept MLB API calls
  if (isLiveApi(url)) return;

  // For navigations (index.html), prefer network then fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          // Optionally cache the latest HTML
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(`${APP_PATH}/index.html`, respClone));
          return resp;
        })
        .catch(() =>
          caches.match(`${APP_PATH}/index.html`, { ignoreSearch: true })
        )
    );
    return;
  }

  // Same-origin static assets: Cache First, then network as fallback
  if (isSameOrigin(url)) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          // Cache successful basic responses (don’t cache opaque cross-origin)
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return resp;
        });
      })
    );
  }
});
