import Link from 'next/link'
import { Shield } from 'lucide-react'

/**
 * Shared auth shell — YNAB composition, minimalist premium.
 * Graphic = a precise graph-paper grid + one clean net-worth chart line (no
 * glow blobs / swooshes — those read as AI-template). Logo at the true top-left
 * viewport edge; headline + form card in a centered ~1024px band; one quiet
 * trust line bottom-left. No feature copy.
 */

const SERIF = { fontFamily: 'var(--font-instrument-serif)', fontStyle: 'italic' } as const

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: 'linear-gradient(165deg, var(--hero-bg) 0%, var(--hero-mid) 55%, var(--hero-soft) 100%)', color: 'var(--on-hero)' }}
    >
      <style>{`
        @keyframes authDraw { to { stroke-dashoffset:0 } }
        @media (prefers-reduced-motion: reduce){ .auth-anim{animation:none!important; stroke-dashoffset:0!important} }
      `}</style>

      {/* graph-paper grid + one clean chart line (precise, intentional — no glow) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <pattern id="auth-grid" width="54" height="54" patternUnits="userSpaceOnUse">
            <path d="M54 0H0V54" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
          </pattern>
          <linearGradient id="auth-fade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--hero-bg)" stopOpacity="0.85" />
            <stop offset="48%" stopColor="var(--hero-bg)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="auth-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--hero-accent)" stopOpacity="0.10" />
            <stop offset="100%" stopColor="var(--hero-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="1200" height="800" fill="url(#auth-grid)" />
        {/* fade the grid out toward the top so it sits behind the headline quietly */}
        <rect width="1200" height="800" fill="url(#auth-fade)" />
        {/* net-worth chart — realistic, trending up; precise, no glow */}
        <path d="M0,604 L130,576 L260,592 L390,520 L520,544 L650,470 L780,492 L910,406 L1040,350 L1200,300 L1200,800 L0,800 Z" fill="url(#auth-area)" />
        <polyline
          className="auth-anim"
          points="0,604 130,576 260,592 390,520 520,544 650,470 780,492 910,406 1040,350 1200,300"
          fill="none" stroke="var(--hero-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="2000" strokeDashoffset="2000" style={{ animation: 'authDraw 2.4s ease-out 0.3s forwards' }}
        />
        <circle cx="520" cy="544" r="3" fill="var(--hero-accent-2)" />
        <circle cx="780" cy="492" r="3" fill="var(--hero-accent-2)" />
        <circle cx="1040" cy="350" r="4" fill="var(--hero-chip-pos-fg)" />
      </svg>

      {/* logo — true top-left viewport edge */}
      <Link
        href="/"
        aria-label="Klunting"
        className="absolute z-20 top-8 left-8 sm:top-12 sm:left-12 inline-flex items-center gap-2.5"
      >
        <span className="grid place-items-center" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--on-hero)', color: 'var(--hero-bg)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.04em' }}>K</span>
        <span style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-0.02em' }}>Klunting</span>
      </Link>

      {/* trust — bottom-left viewport edge (desktop) */}
      <p className="hidden lg:inline-flex absolute z-20 bottom-12 left-12 items-center gap-2 text-[13px]" style={{ color: 'var(--on-hero-mut)' }}>
        <Shield className="size-3.5" style={{ color: 'var(--hero-accent-2)' }} /> Data kamu dienkripsi dan tidak dijual.
      </p>

      {/* YNAB band: headline (left-aligned) + card in a centered band (~24% margins),
          both vertically centered & aligned, sitting close together in the middle */}
      <div className="relative z-10 mx-auto max-w-5xl px-6 min-h-screen grid lg:grid-cols-2 items-center gap-8">
        <div className="hidden lg:block max-w-md">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase" style={{ color: 'var(--on-hero-mut)' }}>Keuangan pribadi</p>
          <h2 className="mt-4 font-bold" style={{ fontSize: 'clamp(32px, 2.8vw, 42px)', lineHeight: 1.16, letterSpacing: '-0.03em', color: 'var(--on-hero)' }}>
            Kelola keuanganmu dengan <span style={{ ...SERIF, color: 'var(--hero-chip-pos-fg)', fontWeight: 400 }}>tenang</span>.
          </h2>
        </div>

        <div className="w-full max-w-md mx-auto lg:mx-0 lg:justify-self-end py-12 lg:py-0">
          <div
            className="rounded-3xl p-7 sm:p-8"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 30px 80px -24px rgba(0,0,0,0.6)' }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
