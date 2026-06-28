// ══════════════════════════════════════════════════════
// 🔄 HAYAH Smart Service Worker — GitHub Live Update
// كل ما ترفع ملف على GitHub، التحديث يوصل للمتصفح فوراً
// ══════════════════════════════════════════════════════

// ⚡ يتغير تلقائياً مع كل push عبر GitHub Actions أو update-sw.sh
const CACHE_VERSION = 'v20260628200000';
const CACHE_NAME = 'hayah-' + CACHE_VERSION;

// الملفات اللي تتخزن في الكاش (Shell فقط)
const SHELL_FILES = [
  '/',
  '/index.html',
  '/login.html',
  '/manifest.json'
];

// ملفات JS — لا تُكَّش أبداً (دايماً من الشبكة)
const NO_CACHE_PATTERNS = [
  /\/js\//,
  /\.js$/
];

// ══════════════════════════════════════════
// INSTALL
// ══════════════════════════════════════════
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_FILES).catch(() => {});
    })
  );
});

// ══════════════════════════════════════════
// ACTIVATE — حذف الكاش القديم فوراً
// ══════════════════════════════════════════
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('hayah-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ══════════════════════════════════════════
// FETCH — استراتيجية ذكية حسب نوع الملف
// ══════════════════════════════════════════
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isJS = NO_CACHE_PATTERNS.some(p => p.test(url.pathname));
  if (isJS) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() =>
        caches.match(event.request)
      )
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ══════════════════════════════════════════
// MESSAGE — استقبال أوامر من الصفحة
// ══════════════════════════════════════════
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CHECK_UPDATE') {
    event.source.postMessage({ type: 'SW_VERSION', version: CACHE_VERSION });
  }
  if (event.data && event.data.type === 'GITHUB_UPDATE_FOUND') {
    // بث الإشعار لكل نوافذ النظام المفتوحة
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'GITHUB_UPDATE_AVAILABLE', sha: event.data.sha });
      });
    });
  }
});
