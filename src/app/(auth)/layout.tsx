import Link from 'next/link'
import { Shield, TrendingUp } from 'lucide-react'

/**
 * Shared auth shell — GRAPHIC brand scene (YNAB-style "graphic play", not a
 * flat colour split). LEFT (desktop): a composed "net-worth growing" scene —
 * layered hills + flowing ribbons + a glowing growth line with nodes + floating
 * glass data chips, with subtle motion. The graphic IS the product (your money
 * climbing). Honest demo numbers, no fabricated stat. RIGHT: themed form.
 * Mobile: form + compact logo only.
 */

const SERIF = { fontFamily: 'var(--font-instrument-serif)', fontStyle: 'italic' } as const

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* LEFT — graphic brand scene (desktop only) */}
      <div
        className="hidden lg:flex flex-col justify-between relative overflow-hidden p-12 xl:p-16"
        style={{ background: 'linear-gradient(160deg, #07070B 0%, #0E0E14 52%, #17171F 100%)', color: '#F5F5F7' }}
      >
        <style>{`
          @keyframes authGlow { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }
          @keyframes authFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
          @keyframes authDraw { to { stroke-dashoffset:0 } }
          @media (prefers-reduced-motion: reduce){ .auth-anim{animation:none!important} }
        `}</style>

        {/* glow orbs */}
        <div className="auth-anim absolute pointer-events-none" style={{ top: '6%', right: '-14%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.22), transparent 65%)', animation: 'authGlow 7s ease-in-out infinite' }} />
        <div className="auth-anim absolute pointer-events-none" style={{ bottom: '2%', left: '-16%', width: 440, height: 440, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,211,252,0.13), transparent 65%)', animation: 'authGlow 9s ease-in-out infinite 1.2s' }} />

        {/* composed graphic scene */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 600 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <linearGradient id="hillA" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.10" /><stop offset="100%" stopColor="#7DD3FC" stopOpacity="0" /></linearGradient>
            <linearGradient id="hillB" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#34D399" stopOpacity="0.13" /><stop offset="100%" stopColor="#34D399" stopOpacity="0" /></linearGradient>
            <linearGradient id="hillC" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity="0.22" /><stop offset="100%" stopColor="#10B981" stopOpacity="0" /></linearGradient>
            <linearGradient id="lineG" x1="0" x2="1" y1="1" y2="0"><stop offset="0%" stopColor="#34D399" stopOpacity="0.25" /><stop offset="55%" stopColor="#34D399" stopOpacity="0.95" /><stop offset="100%" stopColor="#A7F3D0" stopOpacity="1" /></linearGradient>
            <linearGradient id="areaG" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity="0.26" /><stop offset="100%" stopColor="#10B981" stopOpacity="0" /></linearGradient>
          </defs>

          {/* layered hills — depth */}
          <path d="M0,540 C120,500 260,580 380,520 C480,470 560,520 600,495 L600,760 L0,760 Z" fill="url(#hillA)" />
          <path d="M0,612 C140,560 280,632 420,566 C512,524 566,566 600,548 L600,760 L0,760 Z" fill="url(#hillB)" />
          <path d="M0,678 C160,636 320,692 470,642 C546,616 582,642 600,634 L600,760 L0,760 Z" fill="url(#hillC)" />

          {/* flowing ribbons */}
          <path d="M-20,252 C150,212 320,302 500,236 C582,210 632,236 654,226" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
          <path d="M-20,158 C170,118 342,206 540,150 C612,131 652,150 674,143" stroke="rgba(255,255,255,0.045)" strokeWidth="1.5" fill="none" />

          {/* hero growth: area + line + nodes */}
          <path d="M60,560 C150,540 215,486 300,440 C390,392 452,300 560,180 L560,634 L60,634 Z" fill="url(#areaG)" />
          <path className="auth-anim" d="M60,560 C150,540 215,486 300,440 C390,392 452,300 560,180" stroke="url(#lineG)" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="900" strokeDashoffset="900" style={{ animation: 'authDraw 2.2s ease-out 0.2s forwards' }} />
          <circle cx="300" cy="440" r="17" fill="#34D399" opacity="0.16" />
          <circle cx="300" cy="440" r="4.5" fill="#6EE7B7" />
          <circle className="auth-anim" cx="560" cy="180" r="26" fill="#34D399" opacity="0.18" style={{ transformOrigin: '560px 180px', animation: 'authGlow 4.5s ease-in-out infinite' }} />
          <circle cx="560" cy="180" r="6" fill="#A7F3D0" />
        </svg>

        {/* floating glass data chips — product hint + composition depth */}
        <div
          className="auth-anim absolute z-10 rounded-2xl px-4 py-3"
          style={{ top: '40%', right: '9%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.6)', animation: 'authFloat 6s ease-in-out infinite' }}
        >
          <p className="text-[9px] uppercase font-semibold" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.16em' }}>Net Worth</p>
          <p className="num font-bold leading-none mt-1" style={{ color: '#FFFFFF', fontSize: 22, letterSpacing: '-0.02em' }}>Rp 72.480.000</p>
        </div>
        <div
          className="auth-anim absolute z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{ top: '62%', right: '24%', background: 'rgba(16,185,129,0.16)', border: '1px solid rgba(52,211,153,0.3)', color: '#6EE7B7', backdropFilter: 'blur(6px)', animation: 'authFloat 5s ease-in-out infinite 0.6s' }}
        >
          <TrendingUp className="size-3.5" />
          <span className="num text-[13px] font-semibold">+Rp 1.240.000</span>
        </div>

        {/* logo (top) */}
        <Link href="/" aria-label="Klunting" className="relative z-10 inline-flex items-center gap-2.5 w-fit">
          <span className="grid place-items-center" style={{ width: 34, height: 34, borderRadius: 10, background: '#FFFFFF', color: '#0A0A0F', fontWeight: 800, fontSize: 17, letterSpacing: '-0.04em' }}>K</span>
          <span style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-0.02em' }}>Klunting</span>
        </Link>

        {/* headline (just under logo) */}
        <div className="relative z-10 max-w-md -mt-24">
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: '#A1A1AA' }}>Atur uang tanpa drama</p>
          <h2 className="mt-3 font-bold" style={{ fontSize: 'clamp(30px, 3vw, 44px)', lineHeight: 1.12, letterSpacing: '-0.03em', color: '#FFFFFF' }}>
            Akhirnya, <span style={{ ...SERIF, color: '#6EE7B7', fontWeight: 400 }}>tenang</span> soal uang.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed max-w-sm" style={{ color: 'rgba(255,255,255,0.68)' }}>
            Saldo, investasi, sampai utang — jadi satu angka yang naik pelan-pelan. Tinggal masuk.
          </p>
        </div>

        {/* trust line (bottom) */}
        <p className="relative z-10 inline-flex items-center gap-2 text-[13px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <Shield className="size-4" style={{ color: '#34D399' }} /> Datamu dienkripsi, password di-hash, gak dijual.
        </p>
      </div>

      {/* RIGHT — themed form area */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-12" style={{ background: 'var(--bg)' }}>
        <div className="w-full" style={{ maxWidth: 400 }}>
          <div className="flex justify-center mb-7 lg:hidden">
            <Link
              href="/"
              aria-label="Klunting"
              className="grid place-items-center"
              style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', boxShadow: '0 8px 24px -8px rgba(16,24,40,0.18)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.04em' }}
            >
              K
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
