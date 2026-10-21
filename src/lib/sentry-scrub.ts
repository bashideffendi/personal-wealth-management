import type { Breadcrumb } from '@sentry/nextjs'

/**
 * Breadcrumb Sentry tidak lewat beforeSend. URL fetch/XHR ke PostgREST memuat
 * nilai filter (deskripsi transaksi, tanggal, id, ticker portofolio) dan
 * breadcrumb console bisa berisi pesan error berisi data → potong query string
 * dan buang console. Dipakai client, server, dan edge.
 */
export function scrubBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  if (b.category === 'console') return null
  if (b.data && typeof b.data.url === 'string') {
    b.data = { ...b.data, url: b.data.url.split(/[?#]/)[0] }
  }
  if (b.category === 'navigation' && b.data) {
    for (const k of ['from', 'to'] as const) {
      if (typeof b.data[k] === 'string') b.data[k] = (b.data[k] as string).split(/[?#]/)[0]
    }
  }
  return b
}
