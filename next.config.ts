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
        ],
      },
    ]
  },
};

export default nextConfig;
