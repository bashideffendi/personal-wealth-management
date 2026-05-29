'use client'

// Route-level error boundary — replaces Next.js's bare default error page.
// Must be a client component (Next.js requirement). Gives users a recovery
// path: reset() re-renders the segment, or they bail to the landing page.
// Branded to match the auth pages (token colors, casual Indonesian copy).
// `error` is in the prop type but not destructured — Next logs it server-side
// already, and we keep the console clean.

import Link from 'next/link'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 text-center"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div
        className="grid place-items-center mb-6"
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: 'var(--c-coral-soft)',
          color: 'var(--c-coral)',
        }}
      >
        <svg
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
          />
        </svg>
      </div>

      <h1
        className="font-bold tracking-tight"
        style={{ fontSize: 28, color: 'var(--ink)', letterSpacing: '-0.025em' }}
      >
        Aduh, ada yang error
      </h1>
      <p className="mt-2 max-w-sm text-sm" style={{ color: 'var(--ink-muted)' }}>
        Coba muat ulang halaman ini. Kalau masih bermasalah, balik ke beranda
        dulu.
      </p>

      <div className="mt-7 flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, #10B981, #047857)',
            color: '#FFFFFF',
          }}
        >
          Coba lagi
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors"
          style={{ borderColor: 'var(--border-soft)', color: 'var(--ink)' }}
        >
          Beranda
        </Link>
      </div>
    </div>
  )
}
