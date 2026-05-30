'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// Global error boundary — the last line of defense. Renders INSTEAD of the
// root layout when the layout itself (or Providers) throws, so it must supply
// its own <html>/<body> and cannot rely on the theme tokens / CSS vars or the
// FOUC theme script (those live in the failed root layout). Hardcoded brand
// colors (dark canvas + emerald) keep it rendering correctly standalone.
// `error` is reported to Sentry in a useEffect, then this standalone fallback renders.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: '0 16px',
          textAlign: 'center',
          background: '#0A0A0F',
          color: '#FAFAF9',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'var(--c-primary)',
            color: 'var(--c-primary-foreground)',
            fontWeight: 800,
            fontSize: 24,
            letterSpacing: '-0.04em',
          }}
        >
          K
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Aplikasi bermasalah
        </h1>
        <p
          style={{
            fontSize: 14,
            color: '#A8A29E',
            maxWidth: 360,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Terjadi error yang nggak terduga. Coba muat ulang halaman ini.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            onClick={() => reset()}
            style={{
              border: 'none',
              cursor: 'pointer',
              borderRadius: 12,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              color: '#FFFFFF',
              background: 'var(--c-primary)',
            }}
          >
            Coba lagi
          </button>
          {/* Hard navigation (not next/link) — after a root-layout crash a
              full document reload re-initializes everything cleanly. */}
          <button
            onClick={() => {
              window.location.href = '/'
            }}
            style={{
              cursor: 'pointer',
              borderRadius: 12,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              color: '#FAFAF9',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.14)',
            }}
          >
            Beranda
          </button>
        </div>
      </body>
    </html>
  )
}
