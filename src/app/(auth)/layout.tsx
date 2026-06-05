import Link from 'next/link'
import { Shield, TrendingUp } from 'lucide-react'

/**
 * Shared auth shell — ONE unified graphic canvas, form floats on top of it
 * (YNAB: a single navy scene, white card floating on the right). NOT a two-tone
 * left/right split. Full-bleed "net-worth growing" scene (hills + ribbons +
 * glowing growth line + nodes) spans the whole viewport; brand text + glass
 * stat chips sit on the left, the form card floats on the right. Honest demo
 * numbers. Pages render their header + form straight into the floating card
 * (they no longer carry their own card). Mobile: card centered on the canvas.
 */

const SERIF = { fontFamily: 'var(--font-instrument-serif)', fontStyle: 'italic' } as const

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen overflow-hidden flex items-center"
      style={{ background: 'linear-gradient(160deg, #07070B 0%, #0E0E14 52%, #17171F 100%)', color: '#F5F5F7' }}
    >
      <style>{`
        @keyframes authGlow { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }
        @keyframes authDraw { to { stroke-dashoffset:0 } }
        @media (prefers-reduced-motion: reduce){ .auth-anim{animation:none!important} }
      `}</style>

      {/* glow orbs — unified canvas */}
      <div className="auth-anim absolute pointer-events-none" style={{ top: '-6%', right: '12%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.20), transparent 65%)', animation: 'authGlow 7s ease-in-out infinite' }} />
      <div className="auth-anim absolute pointer-events-none" style={{ bottom: '-10%', left: '-6%', width: 560, height: 560, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,211,252,0.12), transparent 65%)', animation: 'authGlow 9s ease-in-out infinite 1.2s' }} />

      {/* full-bleed graphic scene — ONE background across the whole page */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="hillA" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.10" /><stop offset="100%" stopColor="#7DD3FC" stopOpacity="0" /></linearGradient>
          <linearGradient id="hillB" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#34D399" stopOpacity="0.12" /><stop offset="100%" stopColor="#34D399" stopOpacity="0" /></linearGradient>
          <linearGradient id="hillC" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity="0.20" /><stop offset="100%" stopColor="#10B981" stopOpacity="0" /></linearGradient>
          <linearGradient id="lineG" x1="0" x2="1" y1="1" y2="0"><stop offset="0%" stopColor="#34D399" stopOpacity="0.2" /><stop offset="55%" stopColor="#34D399" stopOpacity="0.9" /><stop offset="100%" stopColor="#A7F3D0" stopOpacity="1" /></linearGradient>
          <linearGradient id="areaG" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity="0.22" /><stop offset="100%" stopColor="#10B981" stopOpacity="0" /></linearGradient>
        </defs>

        {/* layered hills */}
        <path d="M0,560 C200,510 460,600 700,540 C900,490 1080,540 1200,515 L1200,760 L0,760 Z" fill="url(#hillA)" />
        <path d="M0,628 C240,575 520,648 800,582 C980,540 1100,582 1200,562 L1200,760 L0,760 Z" fill="url(#hillB)" />
        <path d="M0,690 C280,648 600,704 900,654 C1060,628 1140,654 1200,646 L1200,760 L0,760 Z" fill="url(#hillC)" />

        {/* flowing ribbons */}
        <path d="M-40,250 C260,205 560,310 920,240 C1080,212 1180,240 1240,228" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
        <path d="M-40,150 C300,108 620,210 1000,150 C1120,128 1200,150 1260,142" stroke="rgba(255,255,255,0.04)" strokeWidth="1.5" fill="none" />

        {/* hero growth line + area + nodes */}
        <path d="M100,600 C260,572 380,500 560,448 C740,396 840,300 980,180 L980,690 L100,690 Z" fill="url(#areaG)" />
        <path className="auth-anim" d="M100,600 C260,572 380,500 560,448 C740,396 840,300 980,180" stroke="url(#lineG)" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="1400" strokeDashoffset="1400" style={{ animation: 'authDraw 2.4s ease-out 0.2s forwards' }} />
        <circle cx="560" cy="448" r="17" fill="#34D399" opacity="0.16" />
        <circle cx="560" cy="448" r="4.5" fill="#6EE7B7" />
        <circle className="auth-anim" cx="980" cy="180" r="28" fill="#34D399" opacity="0.18" style={{ transformOrigin: '980px 180px', animation: 'authGlow 4.5s ease-in-out infinite' }} />
        <circle cx="980" cy="180" r="6" fill="#A7F3D0" />
      </svg>

      {/* content overlay — brand (left) + floating form card (right), same canvas */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* LEFT — brand on the canvas */}
        <div className="hidden lg:flex flex-col gap-6 max-w-md">
          <Link href="/" aria-label="Klunting" className="inline-flex items-center gap-2.5 w-fit">
            <span className="grid place-items-center" style={{ width: 34, height: 34, borderRadius: 10, background: '#FFFFFF', color: '#0A0A0F', fontWeight: 800, fontSize: 17, letterSpacing: '-0.04em' }}>K</span>
            <span style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-0.02em' }}>Klunting</span>
          </Link>

          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: '#A1A1AA' }}>Atur uang tanpa drama</p>
            <h2 className="mt-3 font-bold" style={{ fontSize: 'clamp(30px, 3vw, 44px)', lineHeight: 1.12, letterSpacing: '-0.03em', color: '#FFFFFF' }}>
              Akhirnya, <span style={{ ...SERIF, color: '#6EE7B7', fontWeight: 400 }}>tenang</span> soal uang.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed max-w-sm" style={{ color: 'rgba(255,255,255,0.68)' }}>
              Saldo, investasi, sampai utang — jadi satu angka yang naik pelan-pelan. Tinggal masuk.
            </p>
          </div>

          {/* glass stat chips — product data on the canvas */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)' }}>
              <p className="text-[9px] uppercase font-semibold" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.16em' }}>Net Worth</p>
              <p className="num font-bold leading-none mt-1" style={{ color: '#FFFFFF', fontSize: 22, letterSpacing: '-0.02em' }}>Rp 72.480.000</p>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-2" style={{ background: 'rgba(16,185,129,0.16)', border: '1px solid rgba(52,211,153,0.3)', color: '#6EE7B7' }}>
              <TrendingUp className="size-3.5" />
              <span className="num text-[13px] font-semibold">+Rp 1.240.000</span>
            </div>
          </div>

          <p className="inline-flex items-center gap-2 text-[13px] mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <Shield className="size-4" style={{ color: '#34D399' }} /> Datamu dienkripsi, password di-hash, gak dijual.
          </p>
        </div>

        {/* RIGHT — floating form card */}
        <div className="w-full max-w-md mx-auto lg:mx-0 lg:justify-self-end">
          <div className="flex justify-center mb-6 lg:hidden">
            <Link href="/" aria-label="Klunting" className="grid place-items-center" style={{ width: 52, height: 52, borderRadius: 15, background: '#FFFFFF', color: '#0A0A0F', fontWeight: 800, fontSize: 26, letterSpacing: '-0.04em', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)' }}>K</Link>
          </div>
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
