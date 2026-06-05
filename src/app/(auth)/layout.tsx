import Link from 'next/link'
import { Shield, Receipt } from 'lucide-react'

/**
 * Shared auth shell — split with a PRODUCT-PREVIEW brand panel.
 * LEFT (desktop, always dark): logo + short promise + a live-looking net-worth
 * preview card (number + sparkline + stat tiles) with a floating transaction
 * chip for depth — "see the app you're logging into", not a flat colour block.
 * Honest only (no fabricated stat). RIGHT: themed form area. Mobile collapses
 * to the form + a compact logo.
 */

const SERIF = { fontFamily: 'var(--font-instrument-serif)', fontStyle: 'italic' } as const

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* LEFT — product-preview brand panel (desktop only) */}
      <div
        className="hidden lg:flex flex-col justify-between relative overflow-hidden p-12 xl:p-16"
        style={{ background: 'linear-gradient(150deg, #0A0A0F 0%, #14141A 55%, #1C1C24 100%)', color: '#F5F5F7' }}
      >
        {/* ambient glows for depth */}
        <div className="absolute pointer-events-none" style={{ top: -140, right: -120, width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.12), transparent 65%)' }} />
        <div className="absolute pointer-events-none" style={{ bottom: -160, left: -120, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,211,252,0.08), transparent 65%)' }} />

        {/* logo */}
        <Link href="/" aria-label="Klunting" className="relative inline-flex items-center gap-2.5 w-fit">
          <span className="grid place-items-center" style={{ width: 34, height: 34, borderRadius: 10, background: '#FFFFFF', color: '#0A0A0F', fontWeight: 800, fontSize: 17, letterSpacing: '-0.04em' }}>K</span>
          <span style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-0.02em' }}>Klunting</span>
        </Link>

        {/* promise + product preview */}
        <div className="relative">
          <h2 className="font-bold max-w-md" style={{ fontSize: 'clamp(28px, 2.8vw, 40px)', lineHeight: 1.12, letterSpacing: '-0.03em', color: '#FFFFFF' }}>
            Akhirnya, <span style={{ ...SERIF, color: '#6EE7B7', fontWeight: 400 }}>tenang</span> soal uang.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed max-w-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Saldo, investasi, sampai utang — jadi satu angka yang update sendiri. Tinggal masuk.
          </p>

          {/* Net-worth preview card (glassy, elevated on the dark panel) */}
          <div className="relative mt-8 max-w-sm">
            <div
              className="rounded-3xl p-6"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 30px 70px -25px rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            >
              <p className="text-[10px] uppercase font-semibold" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.16em' }}>Net Worth · Hari ini</p>
              <p className="num tabular font-bold mt-2 leading-none" style={{ color: '#FFFFFF', fontSize: 38, letterSpacing: '-0.03em' }}>Rp 72.480.000</p>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold mt-3" style={{ background: 'rgba(16,185,129,0.18)', color: '#6EE7B7' }}>
                ↑ Rp 1.240.000 bulan ini
              </span>

              <svg viewBox="0 0 320 70" className="w-full mt-4" style={{ height: 64 }} aria-hidden="true">
                <defs>
                  <linearGradient id="auth-spark" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,52 L40,48 L80,50 L120,34 L160,38 L200,24 L240,22 L280,13 L320,8 L320,70 L0,70 Z" fill="url(#auth-spark)" />
                <path d="M0,52 L40,48 L80,50 L120,34 L160,38 L200,24 L240,22 L280,13 L320,8" stroke="#34D399" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>

              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                {[
                  { label: 'Aset Cair', value: 'Rp 24.310.000', color: '#34D399' },
                  { label: 'Investasi', value: 'Rp 51.310.000', color: '#7DD3FC' },
                  { label: 'Utang', value: 'Rp 3.140.000', color: '#FB7185' },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-[9px] font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' }}>{s.label}</p>
                    <p className="num text-[13px] font-semibold mt-1" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* floating transaction chip — light surface pops off the dark panel (depth) */}
            <div
              className="absolute -bottom-5 -right-4 flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 max-w-[230px]"
              style={{ background: '#FFFFFF', color: '#0A0A0F', boxShadow: '0 18px 40px -12px rgba(0,0,0,0.55)' }}
            >
              <span className="grid place-items-center size-8 rounded-xl shrink-0" style={{ background: '#F3EFE7' }}>
                <Receipt className="size-4" style={{ color: '#0A0A0F' }} />
              </span>
              <span>
                <span className="block text-[12px] font-semibold leading-tight">Indomaret · Rp 47.500</span>
                <span className="block text-[10.5px] mt-0.5" style={{ color: '#71717A' }}>Kamu ketik, langsung rapi.</span>
              </span>
            </div>
          </div>
        </div>

        {/* honest trust line */}
        <p className="relative inline-flex items-center gap-2 text-[13px]" style={{ color: 'rgba(255,255,255,0.62)' }}>
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
