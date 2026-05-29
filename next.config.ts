import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  // Security headers applied to every route. NOTE: no enforced
  // Content-Security-Policy here — a strict CSP needs runtime testing against
  // the inline theme-init script, Supabase connections, and the external image
  // hosts above, so it's deferred to avoid silently breaking the app. The
  // headers below are all safe / non-breaking.
  async headers() {
    // Content-Security-Policy in REPORT-ONLY mode: browsers report violations
    // to the console (and any report-uri) but never block, so it's safe to ship
    // even to prod. Purpose: validate these allow-lists against real, including
    // authenticated, usage before flipping to an enforced `Content-Security-Policy`.
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
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org",
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
          // Report-only — observe violations, don't block. See note above.
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
    ]
  },
};

export default nextConfig;
