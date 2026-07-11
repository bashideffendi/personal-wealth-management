import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Bundle hanya export yang dipake dari paket barrel berat (recharts/date-fns)
  // -> First Load JS lebih kecil, load lebih cepat. (lucide-react udah auto.)
  experimental: {
    optimizePackageImports: ['recharts', 'date-fns', 'lucide-react'],
  },
  // Data investasi dibaca via fs (lazy) — bukan static import — supaya cold
  // start gak nge-parse ~11 MB JSON yang belum tentu diminta. Tracer Next gak
  // bisa lihat fs-read dinamis, jadi tiap route konsumen lib stocks/ownership/
  // emitten harus daftar di sini — kalau nggak, file gak kebawa bundle dan
  // read-nya ENOENT diam-diam. stocks/** (split per-ticker) cuma buat dua
  // route yang manggil getStock().
  outputFileTracingIncludes: {
    '/dashboard/assets/investment/stock/research/[ticker]': [
      './src/data/invest/*.json',
      './src/data/invest/stocks/**',
      './src/data/invest/research/**',
    ],
    '/api/idx-research/[ticker]/generate': [
      './src/data/invest/*.json',
      './src/data/invest/stocks/**',
    ],
    '/api/idx-research/[ticker]': ['./src/data/invest/*.json', './src/data/invest/research/**'],
    '/api/idx-research': ['./src/data/invest/*.json'],
    // Screener: baca SEMUA file per-ticker sekali (cache module-level).
    '/api/screener': ['./src/data/invest/*.json', './src/data/invest/stocks/**'],
    '/api/idx-dividends': ['./src/data/invest/*.json'],
    '/api/idx-emiten': ['./src/data/invest/*.json'],
  },
  images: {
    // External logo sources used by CryptoLogo + future avatar fetchers.
    // CORS is open on these; we use unoptimized=true on <Image> so Next
    // doesn't try to proxy through its image optimizer (saves Vercel
    // image-transform quota and avoids cold-start latency for tiny PNGs).
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/spothq/cryptocurrency-icons/**',
      },
      {
        // HatScripts/circle-flags — open-source circular country flag SVGs
        protocol: 'https',
        hostname: 'hatscripts.github.io',
        pathname: '/circle-flags/**',
      },
    ],
  },
  // Security headers applied to every route, including an enforced
  // Content-Security-Policy. The allow-lists below were validated at runtime in
  // Report-Only mode first (authenticated browser session, 2026-05-29) — zero
  // violations against the inline theme-init script, Supabase connections, the
  // map tile CDNs, and the external image hosts above — then flipped to enforced.
  async headers() {
    // Enforced Content-Security-Policy (browsers BLOCK violations). Validated at
    // runtime in Report-Only mode first — zero violations across landing, auth,
    // dashboard, map, and investment/stock/crypto pages in an authenticated
    // session — before this flip. Revert path: rename the key below back to
    // `Content-Security-Policy-Report-Only` and `npm run build`.
    //
    // Allow-list rationale (client-side loads only — server-side fetches like
    // Binance/Yahoo/Anthropic don't touch the browser, and outbound <a> links
    // such as google.com/maps or stockbit.com aren't governed by CSP):
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      // 'unsafe-inline' covers Next's hydration scripts + our inline theme-init
      // script. Upgrade path for stricter XSS protection: nonce + strict-dynamic.
      "script-src 'self' 'unsafe-inline'",
      // React inline styles, Tailwind, Leaflet & Recharts all emit inline styles.
      "style-src 'self' 'unsafe-inline'",
      // Images: crypto icons (githubusercontent), country flags (hatscripts),
      // IDX emiten logos (stockbit), and map tiles (OSM/Esri/OpenTopoMap/Carto).
      "img-src 'self' data: blob: https://raw.githubusercontent.com https://hatscripts.github.io https://assets.stockbit.com https://*.tile.openstreetmap.org https://server.arcgisonline.com https://*.tile.opentopomap.org https://*.basemaps.cartocdn.com",
      // next/font self-hosts, so 'self' + data: (inline) is enough.
      "font-src 'self' data:",
      // Supabase REST + realtime websocket, plus Nominatim geocoding (map search).
      // Sentry error-monitoring ingest (EU region). Without this entry the
      // enforced CSP would silently block all client-side error reporting.
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org https://photon.komoot.io https://*.ingest.de.sentry.io",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          // Stop browsers from MIME-sniffing a response away from its declared type.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Don't leak full URLs (which can carry record IDs) to cross-origin sites.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Clickjacking protection — refuse to be framed by other origins.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Force HTTPS for a year. No `preload` — keeps the commitment reversible.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // Turn off APIs the app never uses + opt out of Google's Topics.
          // camera/microphone left at browser default so receipt capture and
          // voice input keep working.
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), browsing-topics=()',
          },
          // Enforced after runtime validation in Report-Only mode. See note above.
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ]
  },
};

export default withSentryConfig(nextConfig, {
  org: "klunting",
  project: "klunting",
  // Source-map upload so prod stack traces are readable (not minified).
  // Optional: set SENTRY_AUTH_TOKEN in .env.local + Vercel to enable; the build
  // works fine without it (maps just won't upload).
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  // tunnelRoute intentionally omitted — it would need an exemption in the
  // Supabase auth middleware. Client events go direct; the CSP connect-src
  // entry above allows the ingest host.
  silent: !process.env.CI,
});
