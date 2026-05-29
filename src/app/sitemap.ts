import type { MetadataRoute } from 'next'

// Sitemap — App Router file convention, served at /sitemap.xml. Lists the
// public, indexable pages only: the landing, auth entry points, and legal
// pages. The authenticated app under /dashboard (plus /api, /print, the OAuth
// callback, and the /forgot-password utility) is intentionally excluded —
// see robots.ts. Base URL mirrors layout.tsx metadataBase.
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://klunting.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: `${BASE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/register`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/login`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
