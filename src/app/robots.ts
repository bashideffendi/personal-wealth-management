import type { MetadataRoute } from 'next'

// Robots directives — App Router file convention, served at /robots.txt.
// Public marketing/legal/auth pages are crawlable; the authenticated app
// (/dashboard), API routes, OAuth callback, and print views are disallowed.
// Base URL mirrors layout.tsx metadataBase (NEXT_PUBLIC_SITE_URL override).
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://klunting.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/api/', '/auth/', '/print/'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
