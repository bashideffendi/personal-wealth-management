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
  Users, Sparkles, Check, Crown, Lock, Shield, ChevronDown,
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
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      {/* ─── NAV ───────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-6 sm:px-12 py-5 border-b"
        style={{ borderColor: 'var(--line)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="kl-brandmark">
            <span>k</span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
            }}
          >
            Klunting
          </div>
        </div>
        <nav className="hidden md:flex gap-7 text-sm" style={{ color: 'var(--ink-muted)' }}>
          <a href="#fitur" className="hover:text-[var(--ink)] transition-colors">Fitur</a>
          <a href="#harga" className="hover:text-[var(--ink)] transition-colors">Harga</a>
          <a href="#faq" className="hover:text-[var(--ink)] transition-colors">FAQ</a>
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
        <div className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center max-w-7xl mx-auto">
          {/* LEFT — copy */}
          <div>
            <h1
              className="kl-display"
              style={{
                fontSize: 'clamp(40px, 6.5vw, 80px)',
                lineHeight: 1.04,
                letterSpacing: '-0.03em',
              }}
            >
              Total kekayaanmu,<br />
              <em style={{ color: 'var(--c-primary)', fontStyle: 'italic' }}>di satu app.</em>
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
                Coba 14 hari gratis
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
              Trial 14 hari akses penuh · Tanpa kartu kredit
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
                    Rp 486.247.130
                  </p>
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold mt-3"
                    style={{ background: 'rgba(16,185,129,0.18)', color: '#6EE7B7' }}
                  >
                    ↑ Rp 8.247.130 bulan ini
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
                  { label: 'Aset Cair', value: 'Rp 84.310.500', color: '#34D399' },
                  { label: 'Investasi', value: 'Rp 312.080.890', color: '#7DD3FC' },
                  { label: 'Utang', value: 'Rp 45.144.260', color: '#FB7185' },
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

            {/* Floating receipt — single chip, adapts to dark mode via var(--surface) */}
            <div
              className="hidden sm:flex absolute -bottom-6 -left-6 rounded-2xl px-4 py-3 gap-3 items-center border max-w-[280px]"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border-soft)',
                boxShadow: '0 12px 32px -8px rgba(0,0,0,0.22)',
              }}
            >
              <div
                className="size-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--emerald-100)', color: 'var(--emerald-700)' }}
              >
                <Camera className="size-4" />
              </div>
              <div>
                <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                  Indomaret · Rp 47.500
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                  Tercatat dari foto, 3 detik.
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
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-10">
            <span className="caps">Fitur</span>
            <h2
              className="font-bold mt-3 tracking-tight"
              style={{ fontSize: 'clamp(28px, 4vw, 40px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}
            >
              Semua yang kamu butuh, <span style={{ color: 'var(--ink-muted)' }}>tanpa pindah app.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              body: 'Tiap awal bulan dapet 2-3 insight: "Kopi naik 60% dari biasanya." "Forecast saldo tipis tanggal 24 — Rp 200k."',
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
        </div>
      </section>

      {/* ─── PRICING ───────────────────────────────────────────── */}
      <section id="harga" className="px-6 sm:px-12 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mb-10">
            <span className="caps">Harga</span>
            <h2
              className="font-bold mt-3 tracking-tight"
              style={{ fontSize: 'clamp(28px, 4vw, 40px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}
            >
              Pilih yang cocok buat kamu.
            </h2>
            <p className="mt-3 text-base" style={{ color: 'var(--ink-muted)' }}>
              Coba dulu 14 hari, gratis. Tanpa kartu kredit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Basic */}
            <div
              className="rounded-2xl p-7 border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="size-5" style={{ color: 'var(--ink-muted)' }} />
                <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>Basic</h3>
              </div>
              <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                Pas buat kamu yang baru mulai catat-catat & atur budget.
              </p>
              <div className="mt-5 mb-5">
                <span
                  className="text-4xl font-bold tracking-tight"
                  style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}
                >
                  Rp 99rb
                </span>
                <span className="text-sm ml-1" style={{ color: 'var(--ink-muted)' }}>
                  /bulan
                </span>
              </div>
              <Link
                href="/register"
                className="block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-80"
                style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
              >
                Coba 14 hari gratis
              </Link>
              <ul className="mt-6 space-y-2.5 text-sm" style={{ color: 'var(--ink-muted)' }}>
                {[
                  { text: 'Catat transaksi unlimited', locked: false },
                  { text: 'Anggaran bulanan', locked: false },
                  { text: 'Dashboard net worth', locked: false },
                  { text: 'Foto struk AI', locked: false },
                  { text: '3 jenis aset (saham, RD, kas)', locked: false },
                  { text: '100 kredit AI/bulan', locked: false },
                  { text: 'AI Advisor (15 query/bulan)', locked: false },
                  { text: 'AI Advisor unlimited', locked: true },
                  { text: 'Multi-aset lengkap (crypto, emas, SBN, P2P)', locked: true },
                  { text: 'Family sharing', locked: true },
                  { text: 'WhatsApp catat & struk', locked: true },
                ].map((f) => (
                  <li key={f.text} className="flex gap-2">
                    {f.locked ? (
                      <Lock className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--ink-soft)' }} />
                    ) : (
                      <Check className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
                    )}
                    <span style={{ color: f.locked ? 'var(--ink-soft)' : 'var(--ink-muted)' }}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Full Service — popular */}
            <div
              className="rounded-2xl p-7 border-2 relative"
              style={{
                background: 'linear-gradient(135deg, var(--emerald-50, #ECFDF5), var(--surface))',
                borderColor: 'var(--emerald-500)',
              }}
            >
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold uppercase whitespace-nowrap"
                style={{
                  background: 'var(--emerald-600)',
                  color: '#FFFFFF',
                  letterSpacing: '0.08em',
                }}
              >
                Unlock semua fitur
              </span>
              <div className="flex items-center gap-2 mb-3">
                <Crown className="size-5" style={{ color: 'var(--emerald-700)' }} />
                <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>Full Service</h3>
              </div>
              <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                Akses penuh ke semua fitur Klunting.
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
                <p className="text-xs mt-1" style={{ color: 'var(--emerald-700)' }}>
                  Harga early access. Akan naik ke Rp 299rb setelah Q3 2026.
                </p>
              </div>
              <Link
                href="/register"
                className="block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90"
                style={{ background: 'var(--emerald-600)', color: '#FFFFFF' }}
              >
                Coba 14 hari gratis
              </Link>
              <ul className="mt-6 space-y-2.5 text-sm" style={{ color: 'var(--ink-muted)' }}>
                {[
                  'Semua fitur Basic',
                  'Multi-aset (saham, RD, crypto, emas, SBN, P2P)',
                  'AI Advisor unlimited',
                  'AI Receipt Scanner advanced',
                  'WhatsApp catat & forward struk',
                  'Family sharing sampai 4 anggota',
                  'Atur utang & cicilan',
                  'Goal setting & laporan detail',
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

          <p
            className="mt-6 text-center text-xs"
            style={{ color: 'var(--ink-soft)' }}
          >
            Trial 14 hari akses Full Service · Tanpa komitmen · Bisa cancel kapan aja
          </p>
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────────── */}
      <section id="faq" className="px-6 sm:px-12 py-16 sm:py-20" style={{ background: 'var(--surface)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="mb-10">
            <span className="caps">Pertanyaan</span>
            <h2
              className="font-bold mt-3 tracking-tight"
              style={{ fontSize: 'clamp(28px, 4vw, 40px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}
            >
              Yang sering ditanya.
            </h2>
            <p className="mt-3 text-base" style={{ color: 'var(--ink-muted)' }}>
              Belum jawab pertanyaanmu? Kirim ke{' '}
              <a href="mailto:support@klunting.com" className="font-medium underline" style={{ color: 'var(--ink)' }}>
                support@klunting.com
              </a>
              .
            </p>
          </div>

          {/* Security trust banner — visible reassurance before users dive into Q&A */}
          <div
            className="rounded-2xl p-5 mb-8 flex items-start gap-3 border"
            style={{
              background: 'var(--emerald-50)',
              borderColor: 'color-mix(in srgb, var(--emerald-500) 25%, transparent)',
            }}
          >
            <Shield
              className="size-5 shrink-0 mt-0.5"
              style={{ color: 'var(--emerald-700)' }}
            />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                Data finansialmu aman.
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
                Komunikasi enkripsi TLS, password di-hash (bukan plaintext), database isolated per user
                pakai Row Level Security, dan kami tidak jual data ke pihak ketiga. PIN device-level
                opsional buat proteksi tambahan kalau HP dipinjem.
              </p>
            </div>
          </div>

          {/* FAQ accordion — native <details>/<summary> biar SEO-friendly + zero JS */}
          <div className="space-y-2">
            {[
              {
                q: 'Datanya beneran aman? Aku takut data finansial bocor.',
                a: 'Wajar khawatir. Yang kami lakukan: (1) Semua komunikasi browser ke server dienkripsi TLS (HTTPS). (2) Password kamu disimpan dalam bentuk hash satu-arah pakai bcrypt — bahkan tim Klunting tidak bisa baca. (3) Database pakai Row Level Security — data antar-user terisolasi di level engine, bukan filter aplikasi. (4) Foto struk disimpan di Supabase Storage dengan akses cuma untuk pemilik. (5) Tidak ada iklan, tidak jual data ke pihak ketiga. Buat proteksi tambahan, aktifin PIN device-level di setting Keamanan.',
              },
              {
                q: 'Aku perlu kasih password mobile banking ke Klunting?',
                a: 'Tidak. Klunting tidak terkoneksi langsung ke rekening bank kamu — kami hanya simpan apa yang kamu input atau upload manual. Buat input cepat, pakai foto struk (AI baca) atau ketik natural language ("indomaret 47rb cash"). Buat bulk, upload PDF mutasi bank dari mobile banking — kami parse tapi tidak akses akun bank-mu.',
              },
              {
                q: 'AI nya pake apa? Datanya dikirim ke pihak ketiga?',
                a: 'Fitur AI (foto struk, parse transaksi, insight bulanan) pakai Claude dari Anthropic. Konten yang dikirim untuk diproses adalah teks atau gambar struk yang kamu kasih — Anthropic menjamin konten API tidak disimpan untuk training model mereka. Detail di Kebijakan Privasi.',
              },
              {
                q: 'Kalau aku cancel, data ku gimana?',
                a: 'Trial 14 hari bisa cancel kapan saja, tidak ada potongan. Setelah cancel, akun kamu tetap aktif di mode read-only sampai akhir periode billing. Kalau ingin hapus akun permanen, kamu bisa export semua data ke CSV dulu, lalu hapus akun dari Profil. Setelah dihapus, data disimpan 30 hari sebelum dihapus permanen — jaga-jaga kalau berubah pikiran.',
              },
              {
                q: 'Bisa export semua transaksi saya?',
                a: 'Bisa. Buka menu Transaksi, klik "Export CSV" — file diunduh langsung ke device kamu. Format CSV bisa dibuka di Excel, Google Sheets, atau diimport ke app lain. Data finansial kamu milik kamu.',
              },
              {
                q: 'Bedanya sama Money Lover / Wallet by BudgetBakers / Spendee?',
                a: 'Tiga hal: (1) Bahasa & konteks Indonesia — kategori, format Rupiah, kalender hijriyah, integrasi nantinya ke ewallet lokal. (2) AI yang ngerti merchant lokal (Indomaret, GoPay, BCA, Tokopedia) bukan harus manual kategorisasi. (3) Family sharing 4 orang built-in (banyak kompetitor cuma 1 user). Tapi kalau kamu sudah nyaman di app lain, tidak masalah — kami tidak ngotot pindah.',
              },
              {
                q: 'Aku tinggal di luar negeri tapi punya rekening Indonesia, bisa?',
                a: 'Bisa. Klunting web-based jadi akses dari negara mana saja. Multi-currency support — bisa tambah rekening USD/SGD/EUR di samping IDR. Foto struk AI bisa baca struk Indonesia + bahasa Inggris.',
              },
              {
                q: 'Ada free tier?',
                a: 'Belum. Sekarang model Coba 14 hari gratis akses penuh, lalu pilih Basic Rp 99rb atau Full Service Rp 199rb per bulan. Free tier sedang dievaluasi untuk Q4 2026 — pengen pastikan dulu unit economics sustainable sebelum kasih free forever.',
              },
              {
                q: 'Bisa pakai bareng pasangan / keluarga?',
                a: 'Bisa, fitur Family sharing di paket Full Service. Sampai 4 anggota keluarga bisa akses akun, transaksi, dan budget bersama. Tetap ada split personal vs family — pengeluaran pribadi tetap private kalau kamu mau.',
              },
              {
                q: 'Mobile app-nya kapan?',
                a: 'Klunting adalah PWA — bisa di-install sebagai app di home screen iPhone/Android tanpa download dari store. Caranya: buka klunting.com di Safari/Chrome → menu → "Tambah ke Layar Utama". Punya pengalaman seperti native app, akses kamera buat foto struk, dan bisa offline view.',
              },
            ].map((item, i) => (
              <details
                key={i}
                className="group rounded-xl border overflow-hidden transition-colors"
                style={{
                  background: 'var(--paper)',
                  borderColor: 'var(--border)',
                }}
              >
                <summary
                  className="flex items-center justify-between gap-4 p-4 sm:p-5 cursor-pointer list-none select-none"
                  style={{ color: 'var(--ink)' }}
                >
                  <span className="text-[15px] font-semibold leading-snug pr-2">
                    {item.q}
                  </span>
                  <ChevronDown
                    className="size-5 shrink-0 transition-transform group-open:rotate-180"
                    style={{ color: 'var(--ink-muted)' }}
                  />
                </summary>
                <div
                  className="px-4 sm:px-5 pb-4 sm:pb-5 text-sm leading-relaxed"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  {item.a}
                </div>
              </details>
            ))}
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
              Coba 14 hari gratis
              <ArrowRight className="size-4" />
            </Link>
            <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.70)' }}>
              Trial 14 hari akses penuh · Tanpa kartu kredit
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
            <a href="#faq" className="hover:text-[var(--ink)] transition-colors">FAQ</a>
            <Link href="/privacy" className="hover:text-[var(--ink)] transition-colors">Privasi</Link>
            <Link href="/terms" className="hover:text-[var(--ink)] transition-colors">Syarat</Link>
            <a href="mailto:support@klunting.com" className="hover:text-[var(--ink)] transition-colors">Support</a>
            <span>Built in Indonesia 🇮🇩</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
