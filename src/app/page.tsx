/**
 * Klunting — Landing page (root /).
 *
 * v3 — fokus produk, bukan copywriting essay.
 * - Cut: trusted-by row, cara kerja, comparison, untuk siapa, stats strip
 * - Tonjolin fitur andalan (WA, AI, multi-aset, family)
 * - Pricing inline, gak perlu navigate ke /dashboard/pricing dulu
 * - Copy hemat — orang Indonesia gak baca text panjang di landing
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  ArrowRight, MessageCircle, Camera, TrendingUp, CreditCard,
  Users, Sparkles, Check, Crown,
} from 'lucide-react'

export default async function LandingPage() {
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
          <div className="font-bold text-base tracking-tight">Klunting</div>
        </div>
        <nav className="hidden md:flex gap-7 text-sm" style={{ color: 'var(--ink-muted)' }}>
          <a href="#fitur" className="hover:text-[var(--ink)] transition-colors">Fitur</a>
          <a href="#harga" className="hover:text-[var(--ink)] transition-colors">Harga</a>
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
            Daftar gratis
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      {/* ─── HERO ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 sm:px-12 py-16 sm:py-24">
        <div
          className="absolute -top-10 -right-16 size-[480px] rounded-full opacity-50 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.18), transparent 60%)' }}
        />
        <div
          className="absolute top-[200px] -left-20 size-[360px] rounded-full opacity-40 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.10), transparent 60%)' }}
        />

        <div className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center max-w-7xl mx-auto">
          {/* LEFT — copy */}
          <div>
            <h1
              className="font-bold tracking-tight"
              style={{
                fontSize: 'clamp(40px, 6.5vw, 72px)',
                lineHeight: 1.04,
                letterSpacing: '-0.04em',
              }}
            >
              Total kekayaanmu,<br />
              <span style={{ color: 'var(--emerald-700)' }}>di satu app.</span>
            </h1>
            <p
              className="mt-6 text-lg leading-relaxed max-w-lg"
              style={{ color: 'var(--ink-muted)' }}
            >
              Saldo, investasi, dan utang dijumlahin Klunting jadi satu net worth real-time.
              Plus AI yang baca pola pengeluaran kamu.
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
              <a
                href="#fitur"
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-medium border transition hover:bg-[var(--surface-2)]"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
              >
                Lihat fitur
              </a>
            </div>
            <div
              className="mt-6 text-[13px]"
              style={{ color: 'var(--ink-muted)' }}
            >
              Gratis selamanya · Tanpa kartu kredit
            </div>
          </div>

          {/* RIGHT — dark net-worth card mockup */}
          <div className="relative">
            <div className="dark-card p-7 relative" style={{ boxShadow: '0 24px 60px -16px rgba(0,0,0,0.30)' }}>
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <p
                    className="text-[10px] uppercase font-semibold"
                    style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.16em' }}
                  >
                    Net Worth · Hari ini
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

            {/* Floating WA bubble */}
            <div
              className="hidden sm:flex absolute -bottom-6 -left-6 bg-white rounded-2xl px-4 py-3 gap-3 items-center max-w-[280px]"
              style={{ boxShadow: '0 12px 32px -8px rgba(0,0,0,0.22)' }}
            >
              <div
                className="size-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: '#DCFCE7' }}
              >
                💬
              </div>
              <div>
                <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                  &ldquo;kopi 35rb&rdquo;
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                  Tercatat lewat WhatsApp
                </p>
              </div>
            </div>

            {/* Floating receipt */}
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
                  Indomaret · 3 detik
                </p>
                <p className="num text-[12px] font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                  Rp 47.500
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FITUR ─────────────────────────────────────────────── */}
      <section
        id="fitur"
        className="px-6 sm:px-12 py-16 sm:py-20"
        style={{ background: 'var(--surface)' }}
      >
        <div className="max-w-2xl mb-10">
          <span className="caps">Fitur</span>
          <h2
            className="font-bold mt-3 tracking-tight"
            style={{ fontSize: 'clamp(28px, 4vw, 40px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}
          >
            Semua yang kamu butuh, <span style={{ color: 'var(--ink-muted)' }}>tanpa pindah app.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl">
          {[
            {
              icon: MessageCircle,
              color: '#16A34A',
              bg: '#DCFCE7',
              title: 'Catat lewat WhatsApp',
              body: 'Kirim "kopi 35rb" atau forward struk ke nomor Klunting. AI parse dan simpan ke transaksimu.',
              badge: 'Segera',
            },
            {
              icon: Sparkles,
              color: '#8B5CF6',
              bg: '#EDE9FE',
              title: 'AI Insight personal',
              body: 'Tiap awal bulan: "Kopi naik 60%." "Forecast saldo tipis Rp 200k." Bukan tips generic.',
            },
            {
              icon: Camera,
              color: 'var(--emerald-500)',
              bg: 'var(--emerald-100)',
              title: 'Foto struk auto-fill',
              body: 'Foto struk Indomaret atau Alfamart, AI baca total dan kategori dalam 3 detik.',
            },
            {
              icon: TrendingUp,
              color: 'var(--amber-500)',
              bg: 'var(--amber-100)',
              title: 'Track semua aset',
              body: 'Saham, reksa dana, crypto, emas, SBN, P2P, deposito. Net worth update otomatis tiap hari.',
            },
            {
              icon: CreditCard,
              color: 'var(--coral-500)',
              bg: 'var(--coral-100)',
              title: 'Atur utang & cicilan',
              body: 'KPR, KTA, kartu kredit. Lihat sisa, jadwal pembayaran, dan strategi pelunasan tercepat.',
            },
            {
              icon: Users,
              color: 'var(--sky-500)',
              bg: 'var(--sky-100)',
              title: 'Sharing keluarga',
              body: 'Sampai 4 anggota. Wallet & anggaran bersama. Tau pasti siapa belanja apa.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl p-5 border transition-all hover:shadow-md hover:-translate-y-0.5"
              style={{ background: 'var(--paper)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="size-10 rounded-xl flex items-center justify-center"
                  style={{ background: f.bg }}
                >
                  <f.icon className="size-5" style={{ color: f.color }} />
                </div>
                {f.badge && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                    style={{
                      background: 'var(--surface-2)',
                      color: 'var(--ink-muted)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {f.badge}
                  </span>
                )}
              </div>
              <h3
                className="text-base font-bold tracking-tight mb-1.5"
                style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}
              >
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PRICING ───────────────────────────────────────────── */}
      <section id="harga" className="px-6 sm:px-12 py-16 sm:py-20">
        <div className="max-w-2xl mb-10">
          <span className="caps">Harga</span>
          <h2
            className="font-bold mt-3 tracking-tight"
            style={{ fontSize: 'clamp(28px, 4vw, 40px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}
          >
            Pilih yang cocok buat kamu.
          </h2>
          <p className="mt-3 text-base" style={{ color: 'var(--ink-muted)' }}>
            Mulai gratis. Upgrade kapan aja.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl">
          {/* Solo */}
          <div
            className="rounded-2xl p-7 border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-5" style={{ color: 'var(--ink-muted)' }} />
              <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>Solo</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              Mulai atur keuangan tanpa biaya.
            </p>
            <div className="mt-5 mb-5">
              <span
                className="text-4xl font-bold tracking-tight"
                style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}
              >
                Rp 0
              </span>
              <span className="text-sm ml-1" style={{ color: 'var(--ink-muted)' }}>
                /selamanya
              </span>
            </div>
            <Link
              href="/register"
              className="block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-80"
              style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
            >
              Mulai gratis
            </Link>
            <ul className="mt-6 space-y-2.5 text-sm" style={{ color: 'var(--ink-muted)' }}>
              {[
                'Catat transaksi unlimited',
                'Anggaran bulanan',
                'Net worth dashboard',
                '10 kredit AI/bulan',
              ].map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro — popular */}
          <div
            className="rounded-2xl p-7 border-2 relative"
            style={{
              background: 'linear-gradient(135deg, #FFFBEB, var(--surface))',
              borderColor: '#F59E0B',
            }}
          >
            <span
              className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold uppercase"
              style={{
                background: '#F59E0B',
                color: '#FFFFFF',
                letterSpacing: '0.08em',
              }}
            >
              Paling populer
            </span>
            <div className="flex items-center gap-2 mb-3">
              <Crown className="size-5" style={{ color: '#D97706' }} />
              <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>Pro</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              Kontrol penuh kekayaanmu.
            </p>
            <div className="mt-5 mb-5">
              <span
                className="text-4xl font-bold tracking-tight"
                style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}
              >
                Rp 79rb
              </span>
              <span className="text-sm ml-1" style={{ color: 'var(--ink-muted)' }}>
                /bulan
              </span>
              <p className="text-xs mt-1" style={{ color: '#92400E' }}>
                Diskon 47% dari Rp 149rb
              </p>
            </div>
            <Link
              href="/register"
              className="block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90"
              style={{ background: '#D97706', color: '#FFFFFF' }}
            >
              Pilih Pro
            </Link>
            <ul className="mt-6 space-y-2.5 text-sm" style={{ color: 'var(--ink-muted)' }}>
              {[
                'Semua fitur Solo',
                'AI Receipt Scanner',
                'AI Advisor unlimited',
                'Track investasi lengkap',
                'Goal & laporan detail',
                '100 kredit AI/bulan',
              ].map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Family */}
          <div
            className="rounded-2xl p-7 border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Users className="size-5" style={{ color: 'var(--sky-500)' }} />
              <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>Family</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              Atur bareng pasangan & keluarga.
            </p>
            <div className="mt-5 mb-5">
              <span
                className="text-4xl font-bold tracking-tight"
                style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}
              >
                Rp 199rb
              </span>
              <span className="text-sm ml-1" style={{ color: 'var(--ink-muted)' }}>
                /bulan
              </span>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
                Up to 4 anggota
              </p>
            </div>
            <Link
              href="/register"
              className="block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-80"
              style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
            >
              Pilih Family
            </Link>
            <ul className="mt-6 space-y-2.5 text-sm" style={{ color: 'var(--ink-muted)' }}>
              {[
                'Semua fitur Pro',
                'Sampai 4 anggota',
                'Wallet & budget bersama',
                'Tracking per-anggota',
                'Notifikasi sinkron',
                '250 kredit AI/bulan',
              ].map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ─── CTA STRIP ──────────────────────────────────────────── */}
      <section className="px-6 sm:px-12 pb-20">
        <div
          className="max-w-5xl mx-auto rounded-3xl p-10 sm:p-14 relative overflow-hidden text-center"
          style={{
            background: 'linear-gradient(135deg, var(--emerald-600), var(--emerald-800))',
            boxShadow: '0 24px 48px -16px rgba(16,185,129,0.40)',
          }}
        >
          <div
            className="absolute -top-20 -right-20 size-80 rounded-full opacity-40 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.20), transparent 60%)' }}
          />
          <div className="relative">
            <h2
              className="font-bold tracking-tight"
              style={{
                color: '#FFFFFF',
                fontSize: 'clamp(28px, 4vw, 40px)',
                letterSpacing: '-0.025em',
                lineHeight: 1.15,
              }}
            >
              Mulai atur uangmu hari ini.
            </h2>
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
            <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.70)' }}>
              Gratis selamanya · Tanpa kartu kredit
            </p>
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
              style={{ background: 'linear-gradient(135deg, var(--emerald-500), var(--emerald-700))' }}
            >
              K
            </div>
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              <span className="font-semibold" style={{ color: 'var(--ink)' }}>Klunting</span>
              {' '}— Wealth Management App · © {new Date().getFullYear()}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
            <a href="#harga" className="hover:text-[var(--ink)] transition-colors">Harga</a>
            <a href="mailto:support@klunting.com" className="hover:text-[var(--ink)] transition-colors">Support</a>
            <span>Built in Indonesia 🇮🇩</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
