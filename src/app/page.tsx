/**
 * Klunting — Landing page (root /).
 *
 * Reference: design-references/screens/landing-refine.jsx
 * Direction: soft minimalism × emerald, witty Indonesian microcopy.
 *
 * Server component. If user is already authenticated we redirect them
 * straight to /dashboard; otherwise we render the marketing page.
 *
 * Structure (top → bottom):
 *   1. Nav (logo + nav links + Masuk / Coba gratis CTAs)
 *   2. Hero (eyebrow chip + h1 + sub + 2 CTAs + benefits + dark hero card)
 *   3. Trusted-by row (Indonesian platforms)
 *   4. Feature grid (3 cards)
 *   5. CTA strip
 *   6. Footer
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sparkles, ArrowRight, Camera, Wallet, TrendingUp, Brain, Shield, Zap } from 'lucide-react'

export default async function LandingPage() {
  // If logged in, skip the landing page. Wrap in try/catch because
  // supabase.auth.getUser() can throw on anonymous requests when there
  // are no auth cookies (the AuthSessionMissingError → "forbidden" page).
  // Anonymous = render landing.
  let isAuthed = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    isAuthed = !!user
  } catch {
    isAuthed = false
  }
  if (isAuthed) redirect('/dashboard')

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
      {/* ─── NAV ───────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-6 sm:px-12 py-5 border-b"
        style={{ borderColor: 'var(--border-soft)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="size-8 rounded-[9px] flex items-center justify-center font-extrabold text-base text-white"
            style={{
              background: 'linear-gradient(135deg, var(--emerald-500), var(--emerald-700))',
              letterSpacing: '-0.04em',
              boxShadow: '0 8px 24px -8px rgba(16,185,129,0.45)',
            }}
          >
            K
          </div>
          <div className="font-bold text-base tracking-tight">
            Klunting
          </div>
        </div>
        <nav className="hidden md:flex gap-7 text-sm" style={{ color: 'var(--ink-muted)' }}>
          <a href="#fitur" className="hover:text-[var(--ink)] transition-colors">Fitur</a>
          <a href="#cara-kerja" className="hover:text-[var(--ink)] transition-colors">Cara kerja</a>
          <Link href="/dashboard/pricing" className="hover:text-[var(--ink)] transition-colors">Harga</Link>
        </nav>
        <div className="flex gap-2 items-center">
          <Link
            href="/login"
            className="px-3 py-2 text-sm font-medium hover:bg-[var(--surface-2)] rounded-md transition-colors"
            style={{ color: 'var(--ink)' }}
          >
            Masuk
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] text-sm font-semibold transition hover:opacity-90"
            style={{ background: 'var(--ink)', color: 'var(--surface)' }}
          >
            Coba gratis
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      {/* ─── HERO ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 sm:px-12 py-16 sm:py-24">
        {/* Ambient blobs */}
        <div
          className="absolute -top-10 -right-16 size-[480px] rounded-full opacity-50 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.18), transparent 60%)' }}
        />
        <div
          className="absolute top-[200px] -left-20 size-[360px] rounded-full opacity-40 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.10), transparent 60%)' }}
        />

        <div className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center max-w-7xl mx-auto">
          {/* LEFT — copy + CTA */}
          <div>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold mb-6"
              style={{ background: 'var(--emerald-100)', color: 'var(--emerald-800)' }}
            >
              <span className="size-1.5 rounded-full" style={{ background: 'var(--emerald-500)' }} />
              Sekarang dengan AI Receipt Scanner
            </span>
            <h1
              className="font-bold tracking-tight"
              style={{
                fontSize: 'clamp(40px, 6.5vw, 72px)',
                lineHeight: 1.04,
                letterSpacing: '-0.04em',
              }}
            >
              Uangmu, jelas.<br />
              <span style={{ color: 'var(--emerald-700)' }}>
                Tanpa drama.
              </span>
            </h1>
            <p
              className="mt-6 text-lg leading-relaxed max-w-lg"
              style={{ color: 'var(--ink-muted)' }}
            >
              Catat transaksi pakai bahasa natural, scan struk dari kamera, track aset & utang
              dalam satu tempat. Plus AI yang ngingetin kamu kalau bakal kehabisan duit akhir bulan.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 items-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold transition hover:opacity-90"
                style={{
                  background: 'var(--ink)',
                  color: 'var(--surface)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                }}
              >
                Mulai gratis
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-medium border transition hover:bg-[var(--surface-2)]"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
              >
                Masuk ke akun
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-1.5 text-[13px]" style={{ color: 'var(--ink-muted)' }}>
              <span>✓ Gratis selamanya</span>
              <span>✓ Tanpa kartu kredit</span>
              <span>✓ Data terenkripsi</span>
            </div>
          </div>

          {/* RIGHT — dark hero card mockup */}
          <div className="relative">
            <div className="dark-card p-7 relative" style={{ boxShadow: '0 24px 60px -16px rgba(0,0,0,0.30)' }}>
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <p
                    className="text-[10px] uppercase font-semibold"
                    style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.16em' }}
                  >
                    Net Worth
                  </p>
                  <p
                    className="num tabular font-bold mt-2 leading-none"
                    style={{ color: 'var(--on-black)', fontSize: 44, letterSpacing: '-0.03em' }}
                  >
                    Rp 487,3<span style={{ color: 'rgba(255,255,255,0.55)' }}>jt</span>
                  </p>
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold mt-3"
                    style={{ background: 'rgba(16,185,129,0.18)', color: '#6EE7B7' }}
                  >
                    ↑ 12,4% bulan ini
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: '#FB7185' }} />
                  <span className="size-2 rounded-full" style={{ background: '#FBBF24' }} />
                  <span className="size-2 rounded-full" style={{ background: '#34D399' }} />
                </div>
              </div>

              {/* Sparkline */}
              <svg viewBox="0 0 320 80" className="w-full" style={{ height: 80 }}>
                <defs>
                  <linearGradient id="hg-landing" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.40" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,60 L40,55 L80,58 L120,40 L160,45 L200,30 L240,28 L280,18 L320,12 L320,80 L0,80 Z" fill="url(#hg-landing)" />
                <path d="M0,60 L40,55 L80,58 L120,40 L160,45 L200,30 L240,28 L280,18 L320,12" stroke="#34D399" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>

              <div
                className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                {[
                  { label: 'Aset Cair', value: 'Rp 84jt', color: '#34D399' },
                  { label: 'Investasi', value: 'Rp 312jt', color: '#7DD3FC' },
                  { label: 'Utang', value: 'Rp 45jt', color: '#FB7185' },
                ].map((s) => (
                  <div key={s.label}>
                    <p
                      className="text-[10px] font-semibold uppercase"
                      style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.10em' }}
                    >
                      {s.label}
                    </p>
                    <p className="num text-base font-semibold mt-1" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating notif: hemat */}
            <div
              className="hidden sm:flex absolute -bottom-6 -left-6 bg-white rounded-2xl px-4 py-3 gap-3 items-center max-w-[280px]"
              style={{ boxShadow: '0 12px 32px -8px rgba(0,0,0,0.22)' }}
            >
              <div
                className="size-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: 'var(--emerald-100)' }}
              >
                🎉
              </div>
              <div>
                <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                  Hemat Rp 480k bulan ini!
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                  Pengeluaran kopi turun 60%
                </p>
              </div>
            </div>

            {/* Floating notif: struk */}
            <div
              className="hidden sm:flex absolute -top-4 -right-4 bg-white rounded-xl px-3 py-2.5 gap-2.5 items-center border"
              style={{ borderColor: 'var(--border-soft)', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.15)' }}
            >
              <div
                className="size-7 rounded-lg flex items-center justify-center text-sm"
                style={{ background: 'var(--amber-100)' }}
              >
                📸
              </div>
              <div>
                <p className="text-[10px] font-medium" style={{ color: 'var(--ink-muted)' }}>
                  Struk dari Indomaret
                </p>
                <p className="num text-[12px] font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                  Rp 47.500 · 4 item
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUSTED BY ────────────────────────────────────────── */}
      <section className="px-6 sm:px-12 pb-16">
        <p
          className="text-center text-[11px] uppercase font-semibold mb-6"
          style={{ color: 'var(--ink-soft)', letterSpacing: '0.18em' }}
        >
          Track investasi dari banyak platform
        </p>
        <div
          className="flex justify-center flex-wrap gap-x-8 sm:gap-x-12 gap-y-3 font-bold text-base opacity-60"
          style={{ color: 'var(--ink-muted)' }}
        >
          <span>BIBIT</span>
          <span>Bareksa</span>
          <span>Stockbit</span>
          <span>Pluang</span>
          <span>Pintu</span>
          <span>IPOT</span>
          <span>Mirae</span>
        </div>
      </section>

      {/* ─── FEATURES ──────────────────────────────────────────── */}
      <section id="fitur" className="px-6 sm:px-12 py-16 sm:py-24" style={{ background: 'var(--surface)' }}>
        <div className="max-w-3xl mb-12">
          <span className="caps">Fitur</span>
          <h2
            className="font-bold mt-3 tracking-tight"
            style={{ fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}
          >
            Semua yang kamu butuhin buat ngerti uangmu sendiri.
          </h2>
          <p className="mt-4 text-lg" style={{ color: 'var(--ink-muted)' }}>
            Bukan cuma tracker — Klunting kasih kamu konteks, insight, dan rekomendasi yang
            bener-bener actionable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              icon: Camera, color: 'var(--emerald-500)', bg: 'var(--emerald-100)',
              title: 'Scan Struk → Auto-fill',
              body: 'Foto struk Indomaret/Alfamart, AI ekstrak merchant, tanggal, total, kategori dalam 3 detik.',
            },
            {
              icon: Brain, color: 'var(--sky-500)', bg: 'var(--sky-100)',
              title: 'Quick Add via Bahasa Natural',
              body: 'Ketik "indomaret 47rb" atau "gaji 8jt" — AI parse, kategorize, simpan. Voice juga support.',
            },
            {
              icon: TrendingUp, color: 'var(--amber-500)', bg: 'var(--amber-100)',
              title: 'Track Investasi Multi-Platform',
              body: 'Saham IDX (live IDX harga), reksa dana, crypto (Binance), emas, SBN, P2P — satu dashboard.',
            },
            {
              icon: Wallet, color: 'var(--coral-500)', bg: 'var(--coral-100)',
              title: 'Anggaran 12 Bulan',
              body: 'Plan pemasukan, pengeluaran, tabungan & investasi sepanjang tahun. Mode 50/30/20 atau ZBB.',
            },
            {
              icon: Sparkles, color: '#8B5CF6', bg: '#EDE9FE',
              title: 'AI Insights Personal',
              body: 'Insight per bulan: pattern pengeluaran, anomali, forecast saldo, rekomendasi spesifik.',
            },
            {
              icon: Shield, color: 'var(--emerald-700)', bg: 'var(--emerald-100)',
              title: 'Mode Privasi & Kalem',
              body: 'Blur angka di publik (1 klik). Mode kalem buat investor yang takut liat saham merah.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl p-6 border transition-all hover:shadow-md hover:-translate-y-0.5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div
                className="size-11 rounded-xl flex items-center justify-center mb-4"
                style={{ background: f.bg }}
              >
                <f.icon className="size-5" style={{ color: f.color }} />
              </div>
              <h3 className="text-lg font-bold tracking-tight mb-2" style={{ color: 'var(--ink)' }}>
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA STRIP ──────────────────────────────────────────── */}
      <section className="px-6 sm:px-12 py-16 sm:py-24">
        <div
          className="max-w-5xl mx-auto rounded-3xl p-10 sm:p-16 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, var(--emerald-600), var(--emerald-800))',
            boxShadow: '0 24px 48px -16px rgba(16,185,129,0.40)',
          }}
        >
          <div
            className="absolute -top-20 -right-20 size-80 rounded-full opacity-40 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.20), transparent 60%)' }}
          />
          <div className="relative text-center">
            <Zap className="size-12 mx-auto text-white fill-white opacity-90" />
            <h2
              className="font-bold mt-5 tracking-tight"
              style={{
                color: '#FFFFFF',
                fontSize: 'clamp(28px, 4vw, 40px)',
                letterSpacing: '-0.025em',
                lineHeight: 1.15,
              }}
            >
              Mulai atur uangmu hari ini.
            </h2>
            <p
              className="mt-3 text-base sm:text-lg max-w-xl mx-auto"
              style={{ color: 'rgba(255,255,255,0.85)' }}
            >
              Gratis selamanya. Setup 2 menit. Nggak perlu kartu kredit.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-base font-semibold mt-7 transition hover:opacity-90"
              style={{
                background: '#FFFFFF',
                color: 'var(--emerald-700)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              }}
            >
              Daftar gratis
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────────── */}
      <footer
        className="border-t px-6 sm:px-12 py-10"
        style={{ borderColor: 'var(--border-soft)' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="size-7 rounded-[8px] flex items-center justify-center font-extrabold text-sm text-white"
              style={{
                background: 'linear-gradient(135deg, var(--emerald-500), var(--emerald-700))',
              }}
            >
              K
            </div>
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              <span className="font-semibold" style={{ color: 'var(--ink)' }}>Klunting</span>
              {' '}— Wealth Management App · © {new Date().getFullYear()}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
            <Link href="/dashboard/pricing" className="hover:text-[var(--ink)] transition-colors">Harga</Link>
            <a href="mailto:support@klunting.com" className="hover:text-[var(--ink)] transition-colors">Support</a>
            <span>Built in Indonesia 🇮🇩</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
