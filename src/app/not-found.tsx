import Link from 'next/link'
import type { Metadata } from 'next'

// Custom 404 — replaces Next.js's bare default. Server component (static),
// branded to match the auth pages: emerald "K" lockup, token-based colors,
// casual Indonesian copy. Single CTA back to the landing page (works for both
// signed-in and signed-out visitors since this renders statically).
export const metadata: Metadata = {
  title: 'Halaman nggak ketemu',
}

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 text-center"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <Link href="/" aria-label="Klunting" className="mb-8">
        <div
          className="grid place-items-center"
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #10B981, #047857)',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: 24,
            letterSpacing: '-0.04em',
          }}
        >
          K
        </div>
      </Link>

      <p
        className="font-mono"
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: 'var(--c-mint)',
        }}
      >
        404
      </p>
      <h1
        className="mt-2 font-bold tracking-tight"
        style={{ fontSize: 28, color: 'var(--ink)', letterSpacing: '-0.025em' }}
      >
        Halaman nggak ketemu
      </h1>
      <p className="mt-2 max-w-sm text-sm" style={{ color: 'var(--ink-muted)' }}>
        Halaman yang kamu cari mungkin udah dipindah atau memang nggak pernah
        ada.
      </p>

      <Link
        href="/"
        className="mt-7 inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
        style={{
          background: 'linear-gradient(135deg, #10B981, #047857)',
          color: '#FFFFFF',
        }}
      >
        Balik ke beranda
      </Link>
    </div>
  )
}
