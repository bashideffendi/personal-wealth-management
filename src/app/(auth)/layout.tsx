import Link from 'next/link'
import { Shield } from 'lucide-react'

/**
 * Shared auth shell — YNAB-style split panel.
 * LEFT (desktop): always-dark brand panel — logo + promise headline + honest
 * security line (NO fabricated stat). RIGHT: themed form area (respects light/
 * dark). Mobile: just the form + a compact logo (left panel hidden).
 * Login / Register / Forgot render only their header + card into the right side.
 */

const SERIF = { fontFamily: 'var(--font-instrument-serif)', fontStyle: 'italic' } as const

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* LEFT — brand panel (desktop only, always dark) */}
      <div
        className="hidden lg:flex flex-col justify-between relative overflow-hidden p-12 xl:p-16"
        style={{ background: 'linear-gradient(150deg, #0A0A0F 0%, #14141A 55%, #1C1C24 100%)', color: '#F5F5F7' }}
      >
        <div
          className="absolute pointer-events-none"
          style={{ top: -120, right: -100, width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.10), transparent 65%)' }}
        />
        <Link href="/" aria-label="Klunting" className="relative inline-flex items-center gap-2.5 w-fit">
          <span className="grid place-items-center" style={{ width: 34, height: 34, borderRadius: 10, background: '#FFFFFF', color: '#0A0A0F', fontWeight: 800, fontSize: 17, letterSpacing: '-0.04em' }}>K</span>
          <span style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-0.02em' }}>Klunting</span>
        </Link>

        <div className="relative max-w-md">
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: '#A1A1AA' }}>Atur uang tanpa drama</p>
          <h2 className="mt-4 font-bold" style={{ fontSize: 'clamp(32px, 3.2vw, 46px)', lineHeight: 1.12, letterSpacing: '-0.03em', color: '#FFFFFF' }}>
            Akhirnya, <span style={{ ...SERIF, color: '#6EE7B7', fontWeight: 400 }}>tenang</span> soal uang.
          </h2>
          <p className="mt-5 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Semua uangmu — saldo, investasi, sampai utang — di satu tempat, update sendiri.
            Tinggal masuk, semuanya udah dirapihin.
          </p>
        </div>

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
