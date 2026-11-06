// Service worker: caches the app shell so the dashboard opens quickly on a phone.
// API calls always go to the network, so data is never stale.
const CACHE = 'project-command-v1';
const SHELL = [
  'index.html',
  'login.html',
  'css/style.css',
  'js/app.js',
  'assets/images/icon.svg',
  'manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return; // never cache live data
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});
