const CACHE = 'kartuingat-v1';
const FILES = ['./', './index.html', './style.css', './app.js',
               './manifest.json', './icon.svg'];

// Saat dipasang: simpan semua file ke cache
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

// Saat aktif: hapus cache versi lama
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Network-first: coba internet dulu (supaya hasil editanmu langsung terlihat),
// kalau offline barulah ambil dari cache
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const salinan = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, salinan));
      return res;
    }).catch(() => caches.match(e.request))
  );
});