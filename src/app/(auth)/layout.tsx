import Link from 'next/link'
import { Shield } from 'lucide-react'

/**
 * Shared auth shell — YNAB composition, minimalist premium.
 * ONE unified dark canvas with subtle flowing curve art. Logo top-left,
 * a single brand line vertically centered on the left, the form card centered
 * on the right, one quiet trust line bottom-left. No feature copy, no stat
 * chips — just the sentence. Mobile: logo top-left + card centered.
 */

const SERIF = { fontFamily: 'var(--font-instrument-serif)', fontStyle: 'italic' } as const

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #07070B 0%, #0E0E14 52%, #16161E 100%)', color: '#F5F5F7' }}
    >
      <style>{`
        @keyframes authGlow { 0%,100%{opacity:.45} 50%{opacity:.9} }
        @keyframes authDraw { to { stroke-dashoffset:0 } }
        @media (prefers-reduced-motion: reduce){ .auth-anim{animation:none!important} }
      `}</style>

      {/* soft glows */}
      <div className="auth-anim absolute pointer-events-none" style={{ top: '-10%', right: '6%', width: 560, height: 560, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.16), transparent 64%)', animation: 'authGlow 8s ease-in-out infinite' }} />
      <div className="auth-anim absolute pointer-events-none" style={{ bottom: '-14%', left: '-8%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,211,252,0.09), transparent 64%)', animation: 'authGlow 11s ease-in-out infinite 1.5s' }} />

      {/* subtle flowing curve art — minimal, no dots */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="sweep" x1="0" x2="1" y1="1" y2="0"><stop offset="0%" stopColor="#34D399" stopOpacity="0" /><stop offset="55%" stopColor="#34D399" stopOpacity="0.45" /><stop offset="100%" stopColor="#6EE7B7" stopOpacity="0.7" /></linearGradient>
          <linearGradient id="ground" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity="0.07" /><stop offset="100%" stopColor="#10B981" stopOpacity="0" /></linearGradient>
        </defs>
        <path d="M0,706 C300,668 600,716 900,682 C1050,664 1150,682 1200,676 L1200,760 L0,760 Z" fill="url(#ground)" />
        <path d="M-60,300 C300,250 600,344 950,256 C1110,216 1200,238 1260,222" stroke="rgba(255,255,255,0.045)" strokeWidth="1.5" fill="none" />
        <path d="M-60,430 C260,386 540,452 840,360 C1020,304 1130,322 1260,288" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" fill="none" />
        <path className="auth-anim" d="M-60,628 C260,556 470,592 720,452 C920,340 1080,356 1260,238" stroke="url(#sweep)" strokeWidth="2.25" fill="none" strokeLinecap="round" strokeDasharray="1700" strokeDashoffset="1700" style={{ animation: 'authDraw 2.6s ease-out 0.25s forwards' }} />
      </svg>

      {/* content (positioned relative to the centered container) */}
      <div className="relative z-10 mx-auto max-w-6xl min-h-screen px-6 sm:px-10 lg:px-16">
        {/* logo — top-left */}
        <Link
          href="/"
          aria-label="Klunting"
          className="absolute top-9 left-6 sm:left-10 lg:left-16 inline-flex items-center gap-2.5"
        >
          <span className="grid place-items-center" style={{ width: 34, height: 34, borderRadius: 10, background: '#FFFFFF', color: '#0A0A0F', fontWeight: 800, fontSize: 17, letterSpacing: '-0.04em' }}>K</span>
          <span style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-0.02em' }}>Klunting</span>
        </Link>

        {/* trust — bottom-left (desktop) */}
        <p className="hidden lg:inline-flex absolute bottom-9 left-16 items-center gap-2 text-[13px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <Shield className="size-3.5" style={{ color: '#34D399' }} /> Datamu dienkripsi, gak dijual.
        </p>

        {/* centered row: brand line (left) + form card (right) */}
        <div className="grid lg:grid-cols-2 items-center min-h-screen lg:gap-16">
          <div className="hidden lg:block max-w-md">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase" style={{ color: '#A1A1AA' }}>Atur uang tanpa drama</p>
            <h2 className="mt-4 font-bold" style={{ fontSize: 'clamp(40px, 4.4vw, 58px)', lineHeight: 1.08, letterSpacing: '-0.035em', color: '#FFFFFF' }}>
              Akhirnya, <span style={{ ...SERIF, color: '#6EE7B7', fontWeight: 400 }}>tenang</span> soal uang.
            </h2>
          </div>

          <div className="w-full max-w-md mx-auto lg:mx-0 lg:justify-self-end py-24 lg:py-0">
            <div
              className="rounded-3xl p-7 sm:p-8"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 30px 80px -24px rgba(0,0,0,0.6)' }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
