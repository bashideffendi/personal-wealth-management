/* PWM Service Worker
 *
 * Strategy:
 *  - Static assets (Next.js _next/static/*, fonts, icons): cache-first, immutable.
 *    These have content-hashed URLs so they never need invalidation.
 *  - HTML navigations: network-first with cache fallback. If we're offline,
 *    serve the most recently visited version of the page.
 *  - Supabase API + our /api routes + auth: NEVER cached — fetch always passes
 *    through to network. Stale auth/data is worse than an error.
 *  - Cross-origin requests (analytics, anthropic, supabase storage): pass through.
 *
 * Bump CACHE_VERSION whenever this file changes substantially so old SW gets
 * activated → cleans up old caches.
 */

const CACHE_VERSION = 'v3'
const STATIC_CACHE = `pwm-static-${CACHE_VERSION}`
const PAGES_CACHE = `pwm-pages-${CACHE_VERSION}`

// Batas entry PAGES_CACHE — dulu tumbuh tanpa batas (tiap HTML yang pernah
// dikunjungi disimpan selamanya sampai bump versi).
const PAGES_CACHE_MAX = 30

// Pages worth pre-caching after install so first visit is offline-ready.
const PRECACHE_URLS = ['/', '/offline.html']

// ─── Install: pre-cache the offline fallback page ──────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {})),
  )
  // Activate this SW immediately; don't wait for old tabs to close.
  self.skipWaiting()
})

// ─── Activate: drop caches from older versions ─────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('pwm-') && !k.endsWith(CACHE_VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// ─── Fetch routing ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Only handle GET — POST/PATCH/DELETE always go to network
  if (req.method !== 'GET') return

  // Same-origin only — let cross-origin fetches go straight through
  if (url.origin !== self.location.origin) return

  // Skip caching for sensitive/dynamic endpoints. These MUST hit network.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/_next/data/') // RSC payloads
  ) {
    return
  }

  // Aset ber-hash konten (Next.js) — cache-first murni, tidak pernah basi.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req, STATIC_CACHE))
    return
  }

  // Aset TANPA hash (ikon, manifest, svg/font root) — stale-while-revalidate:
  // serve cache instan + refresh di belakang. Dulu cache-first murni: rebrand
  // ikon/manifest cuma ter-invalidate lewat bump manual CACHE_VERSION — kalau
  // lupa, user lama terjebak logo lama selamanya.
  if (
    url.pathname.startsWith('/icon') ||
    url.pathname.startsWith('/apple-icon') ||
    url.pathname === '/manifest.json' ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.ttf')
  ) {
    event.respondWith(staleWhileRevalidate(req, STATIC_CACHE))
    return
  }

  // HTML navigations — network-first, fall back to cache, then offline page
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(req, PAGES_CACHE))
    return
  }
})

// ─── Strategies ────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  try {
    const fresh = await fetch(request)
    if (fresh.ok) cache.put(request, fresh.clone())
    return fresh
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' })
  }
}

// Serve dari cache kalau ada (instan), sambil fetch versi baru di belakang
// buat request berikutnya. Gagal fetch = diam (cache lama tetap dipakai).
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  const refresh = fetch(request)
    .then((fresh) => {
      if (fresh.ok) cache.put(request, fresh.clone())
      return fresh
    })
    .catch(() => undefined)
  if (hit) return hit
  const fresh = await refresh
  return fresh ?? new Response('', { status: 504, statusText: 'Offline' })
}

// Buang entry terlama saat melewati batas (urutan keys ≈ urutan insert).
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length <= maxEntries) return
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)))
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const fresh = await fetch(request)
    if (fresh.ok) {
      cache.put(request, fresh.clone())
      void trimCache(cacheName, PAGES_CACHE_MAX)
    }
    return fresh
  } catch {
    const hit = await cache.match(request)
    if (hit) return hit
    // Last resort: bare offline page
    const fallback = await cache.match('/offline.html')
    return (
      fallback ??
      new Response(
        '<h1>Offline</h1><p>Halaman ini belum pernah dibuka. Sambungkan internet untuk melanjutkan.</p>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      )
    )
  }
}

// ─── Message channel: allow the app to ask the SW to skip waiting ──────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// ─── Web Push ──────────────────────────────────────────────────────────
// Payload JSON dari server (src/lib/push-server.ts): {title, body, url, tag}.
// tag = dedup — notif baru dengan tag sama menggantikan yang lama.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // Payload bukan JSON — tampilkan apa adanya sebagai body.
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Klunting'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || undefined,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: data.url || '/dashboard' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Kalau ada tab Klunting kebuka, fokus + arahkan ke sana.
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) return client.navigate(url)
          return
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
