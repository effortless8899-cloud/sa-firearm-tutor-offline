/*
  Manual offline-first SW compatible with Vite build output.

  Goals:
  - Precache critical OCR vendor assets (large)
  - Precache Vite build assets (hashed) via build-time injection
  - Navigation fallback to cached index.html
*/

const CACHE = 'sa-firearm-tutor-react-v2';

// This gets replaced by scripts/postbuild.mjs
const BUILD_ASSETS = [
  "./assets/index-DBl8LtAc.js",
  "./assets/index-VWVCObga.css"
];

const PRECACHE = [
  './index.html',
  './manifest.webmanifest',
  './icon.svg',

  // OCR vendor assets
  './vendor/tesseract/tesseract.min.js',
  './vendor/tesseract/worker.min.js',

  './vendor/tesseract-core/tesseract-core.wasm.js',
  './vendor/tesseract-core/tesseract-core-simd.wasm.js',
  './vendor/tesseract-core/tesseract-core-lstm.wasm.js',
  './vendor/tesseract-core/tesseract-core-simd-lstm.wasm.js',

  './vendor/tesseract-core/tesseract-core.wasm',
  './vendor/tesseract-core/tesseract-core-simd.wasm',
  './vendor/tesseract-core/tesseract-core-lstm.wasm',
  './vendor/tesseract-core/tesseract-core-simd-lstm.wasm',

  './vendor/tessdata/eng.traineddata.gz'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll([...PRECACHE, ...BUILD_ASSETS]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE ? Promise.resolve() : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;
  if (req.method !== 'GET') return;

  // Navigation → serve cached index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match('./index.html');
        try {
          const fresh = await fetch(req);
          cache.put('./index.html', fresh.clone());
          return fresh;
        } catch {
          return cached || new Response('Offline', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }
      })()
    );
    return;
  }

  // Cache-first for everything else.
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
      return fresh;
    })()
  );
});
