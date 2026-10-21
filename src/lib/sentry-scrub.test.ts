import { describe, expect, it } from 'vitest'
import { scrubBreadcrumb } from './sentry-scrub'

describe('scrubBreadcrumb', () => {
  it('buang breadcrumb console', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'gagal simpan Rp 5.000.000' })).toBeNull()
  })
  it('potong query string URL fetch (filter PostgREST)', () => {
    const b = scrubBreadcrumb({ category: 'fetch', data: { url: 'https://x.supabase.co/rest/v1/transactions?description=ilike.*gaji*&user_id=eq.abc', status_code: 200 } })
    expect(b?.data).toEqual({ url: 'https://x.supabase.co/rest/v1/transactions', status_code: 200 })
  })
  it('potong query di navigasi', () => {
    const b = scrubBreadcrumb({ category: 'navigation', data: { from: '/dashboard?q=bca', to: '/dashboard/transactions#x' } })
    expect(b?.data).toEqual({ from: '/dashboard', to: '/dashboard/transactions' })
  })
})
