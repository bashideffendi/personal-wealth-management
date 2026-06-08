/**
 * Klunting — Landing page (root /).
 *
 * v4 — YNAB playbook (empathy reframe · single repeated free-trial CTA + friction
 * killer · savings-first pricing · methodology-as-philosophy · honest proof) wearing
 * Klunting's brand (ink quiet-luxury + emerald accent + .dark-card anchor + Instrument
 * Serif italic moments-only). NOL social proof palsu — trust = verifiable facts +
 * marked placeholders. Copy aku/kamu, nominal penuh, trial 21 hari konsisten.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  ArrowRight, Menu, Check, Shield, Lock, Database, EyeOff,
  Wallet, Receipt, LineChart, Sparkles, CreditCard, MessageCircle,
  TrendingUp, PiggyBank, Users, ChevronDown,
} from 'lucide-react'
import { PricingSection } from '@/components/landing/pricing-section'

// Instrument Serif italic — moments-only accent (var wired in root layout).
const SERIF = { fontFamily: 'var(--font-instrument-serif)', fontStyle: 'italic' } as const

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

  const navLinks = [
    { href: '#cara-kerja', label: 'Cara kerja' },
    { href: '#fitur', label: 'Fitur' },
    { href: '#harga', label: 'Harga' },
    { href: '#faq', label: 'FAQ' },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      {/* ─── NAV ───────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 sm:px-12 py-4 border-b backdrop-blur"
        style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}
      >
        <Link href="/" className="flex items-center gap-2.5" aria-label="Klunting">
          <div
            className="grid place-items-center"
            style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.04em' }}
          >
            K
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Klunting</span>
        </Link>

        <nav className="hidden md:flex gap-7 text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-[var(--ink)] transition-colors">{l.label}</a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <Link href="/login" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-[var(--surface-2)] transition-colors" style={{ color: 'var(--ink)' }}>
              Masuk
            </Link>
            <Link href="/register" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
              Coba gratis <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {/* Mobile hamburger — zero-JS <details>, a11y labelled */}
          <details className="md:hidden relative">
            <summary aria-label="Buka menu" className="list-none cursor-pointer grid place-items-center size-9 rounded-md" style={{ color: 'var(--ink)' }}>
              <Menu className="size-5" aria-hidden="true" />
            </summary>
            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-xl border p-2 z-50 flex flex-col"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: '0 16px 40px -12px rgba(0,0,0,0.22)' }}
            >
              {navLinks.map((l) => (
                <a key={l.href} href={l.href} className="px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--surface-2)] transition-colors" style={{ color: 'var(--ink)' }}>{l.label}</a>
              ))}
              <div className="rule my-1.5" />
              <Link href="/login" className="px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--surface-2)] transition-colors" style={{ color: 'var(--ink)' }}>Masuk</Link>
              <Link href="/register" className="mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
                Coba gratis <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </details>
        </div>
      </header>

      {/* ─── HERO ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 sm:px-12 py-16 sm:py-24">
        <div className="absolute pointer-events-none" style={{ top: -80, right: -60, width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.06), transparent 65%)' }} />
        <div className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center max-w-7xl mx-auto">
          {/* LEFT — copy */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-6" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)', border: '1px solid var(--border)' }}>
              <span className="size-1.5 rounded-full" style={{ background: 'var(--c-mint)' }} />
              <span className="text-xs font-semibold tracking-tight">Atur uang tanpa drama</span>
            </div>

            <h1 className="tracking-tight" style={{ fontSize: 'clamp(36px, 5vw, 58px)', lineHeight: 1.06, letterSpacing: '-0.03em', fontWeight: 700, color: 'var(--ink)' }}>
              Berantakan soal uang?{' '}
              <span style={{ ...SERIF, color: 'var(--c-mint)' }}>Tenang,</span>{' '}
              kamu cuma belum punya alatnya.
            </h1>
            <p className="mt-6 text-lg leading-relaxed max-w-lg" style={{ color: 'var(--ink-muted)' }}>
              Bukan kamu yang payah ngatur duit — kamu cuma belum lihat semuanya di satu tempat.
              Klunting satuin saldo, investasi, sama utang jadi satu angka net worth yang update
              sendiri, plus AI yang nyolek kamu sebelum saldo tipis.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 items-center">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold transition hover:opacity-90" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
                Coba gratis 21 hari <ArrowRight className="size-4" />
              </Link>
              <a href="#cara-kerja" className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-medium border transition hover:bg-[var(--surface-2)]" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}>
                Lihat cara kerjanya
              </a>
            </div>
            <div className="mt-6 flex items-center gap-4 flex-wrap text-[12px]" style={{ color: 'var(--ink-soft)' }}>
              {['Akses penuh 21 hari', 'Tanpa kartu kredit', 'Datamu dienkripsi, gak dijual'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5" style={{ color: 'var(--c-mint)' }} /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* RIGHT — dark net-worth card mockup */}
          <div className="relative">
            <div className="dark-card p-7 relative" style={{ boxShadow: '0 24px 60px -16px rgba(0,0,0,0.30)' }}>
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <p className="text-[10px] uppercase font-semibold" style={{ color: 'var(--on-black-mut)', letterSpacing: '0.16em' }}>
                    Net Worth · Hari ini
                  </p>
                  <p className="num tabular font-bold mt-2 leading-none" style={{ color: 'var(--on-black)', fontSize: 44, letterSpacing: '-0.03em' }}>
                    Rp 72.480.000
                  </p>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold mt-3" style={{ background: 'rgba(16,185,129,0.18)', color: '#6EE7B7' }}>
                    ↑ Rp 1.240.000 bulan ini
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: '#FB7185' }} />
                  <span className="size-2 rounded-full" style={{ background: '#FBBF24' }} />
                  <span className="size-2 rounded-full" style={{ background: '#34D399' }} />
                </div>
              </div>

              <svg viewBox="0 0 320 80" className="w-full" style={{ height: 80 }} aria-hidden="true">
                <defs>
                  <linearGradient id="hg-landing" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.40" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,60 L40,55 L80,58 L120,40 L160,45 L200,30 L240,28 L280,18 L320,12 L320,80 L0,80 Z" fill="url(#hg-landing)" />
                <path d="M0,60 L40,55 L80,58 L120,40 L160,45 L200,30 L240,28 L280,18 L320,12" stroke="#34D399" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>

              <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                {[
                  { label: 'Aset Cair', value: 'Rp 24.310.000', color: '#34D399' },
                  { label: 'Investasi', value: 'Rp 51.310.000', color: '#7DD3FC' },
                  { label: 'Utang', value: 'Rp 3.140.000', color: '#FB7185' },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--on-black-mut)', letterSpacing: '0.10em' }}>{s.label}</p>
                    <p className="num text-base font-semibold mt-1" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating chip — LIVE action only (natural-language entry), not foto auto-capture */}
            <div
              className="hidden sm:flex absolute -bottom-6 -left-6 rounded-2xl px-4 py-3 gap-3 items-center border max-w-[280px]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)', boxShadow: '0 12px 32px -8px rgba(0,0,0,0.22)' }}
            >
              <div className="size-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>
                <Receipt className="size-4" />
              </div>
              <div>
                <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>Indomaret · Rp 47.500</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>Kamu ketik, langsung rapi.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST BAR (honest security facts) ──────────────────── */}
      <section className="px-6 sm:px-12 py-8" style={{ background: 'var(--bg-2)' }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-[13px] mb-5" style={{ color: 'var(--ink-soft)' }}>
            Kamu nyerahin data uang ke kami — ini cara kami jagain.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Shield, t: 'Enkripsi TLS di tiap koneksi' },
              { icon: Lock, t: 'Password di-hash, tim kami pun gak bisa baca' },
              { icon: Database, t: 'Data tiap user terisolasi (Row Level Security)' },
              { icon: EyeOff, t: 'Gak ada iklan, gak jual data kamu' },
            ].map((p) => (
              <div key={p.t} className="flex items-start gap-2.5">
                <p.icon className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--c-mint)' }} />
                <span className="t-sm" style={{ color: 'var(--ink-muted)' }}>{p.t}</span>
              </div>
            ))}
          </div>
          {/* SOCIAL PROOF (logo media / rating / jumlah user): sengaja dikosongin —
              isi HANYA setelah ada data riil. JANGAN render dummy. */}
        </div>
      </section>

      {/* ─── CARA KERJA ────────────────────────────────────────── */}
      <section id="cara-kerja" className="px-6 sm:px-12 py-16 sm:py-20" style={{ background: 'var(--surface)' }}>
        <div className="max-w-6xl mx-auto">
          <p className="eyebrow">Cara kerja</p>
          <h2 className="display mt-3" style={{ fontSize: 'clamp(28px, 4vw, 46px)', lineHeight: 1.1 }}>
            Tiga langkah, terus kamu tinggal jalan.
          </h2>
          <p className="mt-3 text-base max-w-xl" style={{ color: 'var(--ink-muted)' }}>
            Gak ada kurva belajar curam. Lima menit setup, sisanya Klunting yang kerja.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
            {[
              { n: '01', icon: Wallet, title: 'Masukin yang kamu punya', body: 'Tambah rekening, e-wallet, saham, emas, sampai utang. Gak perlu kasih password m-banking — kamu yang isi, datanya tetap punya kamu.' },
              { n: '02', icon: Receipt, title: 'Catat secepat kamu jajan', body: 'Ketik "kopi 35.000" pakai bahasa sehari-hari, kategori ke-tebak otomatis. Gak ada spreadsheet, gak ada kolom bikin males.' },
              { n: '03', icon: LineChart, title: 'Lihat gambaran utuhnya', body: 'Net worth, arus kas, sama forecast saldo muncul real-time. AI nyolek kamu sebelum tanggal tua jadi masalah.' },
            ].map((s) => (
              <div key={s.n} className="s-card s-card-pad-lg">
                <div className="flex items-center justify-between">
                  <span className="num font-bold" style={{ color: 'var(--c-mint)', fontSize: 32 }}>{s.n}</span>
                  <s.icon className="size-5" style={{ color: 'var(--ink-soft)' }} />
                </div>
                <h3 className="t-title mt-3" style={{ color: 'var(--ink)' }}>{s.title}</h3>
                <p className="t-body mt-1.5" style={{ color: 'var(--ink-muted)' }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FILOSOFI (dark band, serif moment) ─────────────────── */}
      <section className="px-6 sm:px-12 py-8">
        <div className="dark-card p-6 sm:p-10 max-w-4xl mx-auto" style={{ boxShadow: '0 24px 60px -20px rgba(0,0,0,0.40)' }}>
          <p className="eyebrow">Prinsip Klunting</p>
          <p className="mt-4 text-white" style={{ ...SERIF, fontSize: 'clamp(26px, 4vw, 44px)', lineHeight: 1.15 }}>
            Setiap rupiah harusnya tau mau ke mana.
          </p>
          <p className="mt-5 max-w-2xl" style={{ color: 'var(--on-black-mut)' }}>
            Bukan soal pelit atau berhenti jajan. Soal kamu yang pegang kendali, bukan saldo yang
            ngagetin kamu tiap akhir bulan. Klunting bikin tiap rupiah kelihatan — biar kamu bisa
            milih sadar, bukan nyesel belakangan.
          </p>
          <a href="#cara-kerja" className="inline-flex items-center gap-1.5 mt-6 text-sm font-semibold" style={{ color: 'var(--c-mint)' }}>
            Pelajari cara Klunting <ArrowRight className="size-3.5" />
          </a>
        </div>
      </section>

      {/* ─── FITUR (outcome-led) ────────────────────────────────── */}
      <section id="fitur" className="px-6 sm:px-12 py-16 sm:py-20" style={{ background: 'var(--bg-2)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-10">
            <p className="eyebrow">Fitur</p>
            <h2 className="display mt-3" style={{ fontSize: 'clamp(28px, 4vw, 46px)', lineHeight: 1.1 }}>
              Semua uangmu, akhirnya nyambung.
            </h2>
            <p className="mt-3 text-base" style={{ color: 'var(--ink-muted)' }}>
              Satu app buat lihat, catat, dan ngerti — dari kopi 35 ribu sampai portofolio saham.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: TrendingUp, color: 'var(--c-mint)', bg: 'var(--c-mint-soft)', title: 'Investasi + riset saham IDX', body: 'Pantau saham IDX, crypto, reksa dana, emas, SBN, deposito — plus riset 1.000+ emiten: 8 metode valuasi, fair value, struktur kepemilikan. Bukan cuma nyatet, tapi ngerti.' },
              { icon: LineChart, color: 'var(--c-mint)', bg: 'var(--c-mint-soft)', title: 'Net worth otomatis', body: 'Semua aset dikurangi semua utang jadi satu angka net worth yang update tiap hari. Akhirnya tau kekayaanmu yang sebenarnya, bukan kira-kira.' },
              { icon: Users, color: 'var(--c-violet)', bg: 'var(--c-violet-soft)', title: 'Kelola bareng keluarga', body: 'Satu akun buat sekeluarga — goal, anggaran, & wallet bersama sampai 5 anggota. Atur uang bareng pasangan, nol drama.' },
              { icon: Sparkles, color: 'var(--c-violet)', bg: 'var(--c-violet-soft)', title: 'AI yang ngerti keuanganmu', body: 'Foto struk → transaksi otomatis. Catat pakai bahasa sehari-hari. Insight bulanan jujur. AI Playbook yang nyusun rencana finansial buatmu.' },
              { icon: Wallet, color: 'var(--c-amber)', bg: 'var(--c-amber-soft)', title: 'Anggaran & arus kas', body: 'Anggaran bulanan/tahunan gaya spreadsheet (drag-fill antar bulan + rumus di sel) + laporan arus kas + Sankey ke mana uangmu ngalir.' },
              { icon: CreditCard, color: 'var(--c-coral)', bg: 'var(--c-coral-soft)', title: 'Utang yang kelihatan ujungnya', body: 'KPR, KTA, kartu kredit. Lihat sisa, jadwal bayar, jalur pelunasan tercepat, dan tanggal lunas yang jelas. Lega pas tau kapan kelar.' },
              { icon: Shield, color: 'var(--info)', bg: 'var(--info-bg)', title: 'Privasi & keamanan', body: 'Enkripsi, 2FA, Calm Mode (blur angka di tempat umum), no auto-renew, export & hapus data kapan aja. Datamu, kendalimu.' },
              { icon: MessageCircle, color: 'var(--c-amber)', bg: 'var(--c-amber-soft)', title: 'Catat lewat WhatsApp', body: 'Nanti: forward struk atau kirim "kopi 35rb" ke WhatsApp Klunting, langsung kecatat.', badge: true },
            ].map((f) => (
              <div key={f.title} className="s-card p-5 relative transition-all hover:shadow-lg hover:-translate-y-0.5">
                <div className="flex items-start justify-between mb-3">
                  <div className="size-10 rounded-xl flex items-center justify-center" style={{ background: f.bg }}>
                    <f.icon className="size-5" style={{ color: f.color }} />
                  </div>
                  {f.badge && <span className="chip chip-amber">Segera</span>}
                </div>
                <h3 className="t-title mb-1.5" style={{ color: 'var(--ink)' }}>{f.title}</h3>
                <p className="t-body" style={{ color: 'var(--ink-muted)' }}>{f.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-2">
            <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold transition hover:opacity-90" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
              Coba semua gratis 21 hari <ArrowRight className="size-4" />
            </Link>
            <span className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>Tanpa kartu kredit</span>
          </div>
        </div>
      </section>

      {/* ─── PEMILIH TUJUAN (self-route) ────────────────────────── */}
      <section className="px-6 sm:px-12 py-16 sm:py-20" style={{ background: 'var(--surface)' }}>
        <div className="max-w-5xl mx-auto">
          <p className="eyebrow">Mau mulai dari mana?</p>
          <h2 className="display mt-3" style={{ fontSize: 'clamp(28px, 4vw, 46px)', lineHeight: 1.1 }}>
            Kamu lagi ngejar yang mana?
          </h2>
          <p className="mt-3 text-base" style={{ color: 'var(--ink-muted)' }}>Pilih satu. Klunting bantu dari situ.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-10">
            {[
              { icon: PiggyBank, title: 'Berhenti bocor tiap akhir bulan', body: 'Lihat ke mana perginya, sebelum hilang.' },
              { icon: CreditCard, title: 'Lunasin utang lebih cepat', body: 'Satu rencana, urutan tercepat, tanggal lunas yang jelas.' },
              { icon: Shield, title: 'Punya dana darurat beneran', body: 'Tau persis berapa bulan kamu aman.' },
              { icon: TrendingUp, title: 'Lihat semua aset dalam satu angka', body: 'Net worth yang update sendiri.' },
              { icon: Users, title: 'Atur uang bareng pasangan', body: 'Satu gambar, nol drama.' },
              { icon: LineChart, title: 'Mulai investasi tanpa bingung', body: 'Pantau semua portofolio di satu layar.' },
            ].map((g) => (
              <Link key={g.title} href="/register" className="s-card p-5 group block transition-all hover:shadow-lg hover:-translate-y-0.5">
                <g.icon className="size-5" style={{ color: 'var(--ink)' }} />
                <h3 className="t-title mt-3 flex items-center justify-between gap-2" style={{ color: 'var(--ink)' }}>
                  {g.title}
                  <ArrowRight className="size-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--ink-soft)' }} />
                </h3>
                <p className="t-sm mt-1" style={{ color: 'var(--ink-muted)' }}>{g.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── BUKTI & KETENANGAN (honest) ────────────────────────── */}
      <section className="px-6 sm:px-12 py-16 sm:py-20" style={{ background: 'var(--bg-2)' }}>
        <div className="max-w-5xl mx-auto">
          <p className="eyebrow">Kenapa bisa dipercaya</p>
          <h2 className="display mt-3" style={{ fontSize: 'clamp(28px, 4vw, 46px)', lineHeight: 1.1 }}>
            Datamu soal hidupmu. Kami jaga beneran.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            {[
              { big: 'AES-256 + TLS', label: 'Enkripsi di transit & saat disimpan', mono: false },
              { big: 'Row Level Security', label: 'Data antar-user terisolasi di level database', mono: false },
              { big: 'Rp 0', label: 'Yang kami dapat dari jual datamu — kami gak jualan data', mono: true },
            ].map((s) => (
              <div key={s.label} className="stat-tile">
                <p className={s.mono ? 'num font-bold' : 'font-bold'} style={{ color: 'var(--ink)', fontSize: 22, letterSpacing: '-0.01em' }}>{s.big}</p>
                <p className="t-sm mt-1.5" style={{ color: 'var(--ink-soft)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          <div className="s-card s-card-pad-lg mt-6">
            <div className="flex flex-col gap-2.5">
              {[
                'Gak perlu kasih password m-banking',
                'Export semua datamu ke CSV kapan aja',
                'Hapus akun = data dihapus permanen (ada masa tenggang 30 hari)',
              ].map((b) => (
                <div key={b} className="flex items-start gap-2.5">
                  <Shield className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--c-mint)' }} />
                  <span className="t-body" style={{ color: 'var(--ink-muted)' }}>{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* TESTIMONI ASLI: isi setelah ada user + izin tertulis. JANGAN render quote
              fiktif di production. Block ini sengaja TIDAK dirender sampai ada data riil. */}

          <div className="mt-8 text-center">
            <p className="text-base" style={{ color: 'var(--ink-muted)' }}>Mau jadi salah satu cerita pertama?</p>
            <Link href="/register" className="inline-flex items-center gap-2 mt-3 px-6 py-3 rounded-xl text-sm font-semibold transition hover:opacity-90" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
              Coba gratis 21 hari <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── PRICING (toggle bulanan/tahunan — client island) ─── */}
      <PricingSection />

      {/* ─── FAQ ───────────────────────────────────────────────── */}
      <section id="faq" className="px-6 sm:px-12 py-16 sm:py-20" style={{ background: 'var(--surface)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="mb-10">
            <p className="eyebrow">Pertanyaan</p>
            <h2 className="display mt-3" style={{ fontSize: 'clamp(28px, 4vw, 46px)', lineHeight: 1.1 }}>Yang wajar kamu ragukan.</h2>
            <p className="mt-3 text-base" style={{ color: 'var(--ink-muted)' }}>
              Belum kejawab? Email aku di{' '}
              <a href="mailto:support@klunting.com" className="font-medium underline" style={{ color: 'var(--ink)' }}>support@klunting.com</a>.
            </p>
          </div>

          <div className="space-y-2">
            {[
              {
                q: 'Datanya beneran aman? Aku takut data finansial bocor.',
                a: 'Wajar khawatir. Yang kami lakukan: (1) Semua komunikasi browser ke server dienkripsi TLS (HTTPS). (2) Password kamu disimpan dalam bentuk hash satu-arah pakai bcrypt — bahkan tim Klunting tidak bisa baca. (3) Database pakai Row Level Security — data antar-user terisolasi di level engine, bukan filter aplikasi. (4) Foto struk disimpan dengan akses cuma untuk pemilik. (5) Tidak ada iklan, tidak jual data ke pihak ketiga. Buat proteksi tambahan, aktifin PIN device-level di setting Keamanan.',
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
                a: 'Trial 21 hari bisa cancel kapan saja, tidak ada potongan. Setelah cancel, akun kamu tetap aktif di mode read-only sampai akhir periode billing. Kalau ingin hapus akun permanen, kamu bisa export semua data ke CSV dulu, lalu hapus akun dari Profil. Setelah dihapus, data disimpan 30 hari sebelum dihapus permanen — jaga-jaga kalau berubah pikiran.',
              },
              {
                q: 'Bisa export semua transaksi saya?',
                a: 'Bisa. Buka menu Transaksi, klik "Export CSV" — file diunduh langsung ke device kamu. Format CSV bisa dibuka di Excel, Google Sheets, atau diimport ke app lain. Data finansial kamu milik kamu.',
              },
              {
                q: 'Bedanya sama Money Lover / Wallet by BudgetBakers / Spendee?',
                a: 'Tiga hal: (1) Bahasa & konteks Indonesia — kategori, format Rupiah, integrasi nantinya ke e-wallet lokal. (2) AI yang ngerti merchant lokal (Indomaret, GoPay, BCA, Tokopedia) bukan harus manual kategorisasi. (3) Family sharing sampai 5 anggota built-in (banyak kompetitor cuma 1 user). Tapi kalau kamu sudah nyaman di app lain, tidak masalah — kami tidak ngotot pindah.',
              },
              {
                q: 'Aku tinggal di luar negeri tapi punya rekening Indonesia, bisa?',
                a: 'Bisa. Klunting web-based jadi akses dari negara mana saja. Multi-currency support — bisa tambah rekening USD/SGD/EUR di samping IDR. Foto struk AI bisa baca struk Indonesia + bahasa Inggris.',
              },
              {
                q: 'Ada free tier?',
                a: 'Belum. Sekarang fokusnya trial 21 hari akses penuh — bisa coba semua tanpa kartu dulu, lalu pilih paket: Pro Rp 149.000/tahun (atau Rp 19.000/bulan) dan Max Rp 299.000/tahun (atau Rp 35.000/bulan). Paket gratis permanen masih dievaluasi, belum ada tanggal pasti — pengen pastikan dulu unit economics sustainable.',
              },
              {
                q: 'Bisa pakai bareng pasangan / keluarga?',
                a: 'Bisa, fitur Family sharing di paket Max. Sampai 5 anggota keluarga bisa akses akun, transaksi, dan budget bersama. Tetap ada split personal vs family — pengeluaran pribadi tetap private kalau kamu mau.',
              },
              {
                q: 'Mobile app-nya kapan?',
                a: 'Klunting adalah PWA — bisa di-install sebagai app di home screen iPhone/Android tanpa download dari store. Caranya: buka klunting.com di Safari/Chrome → menu → "Tambah ke Layar Utama". Punya pengalaman seperti native app, akses kamera buat foto struk, dan bisa offline view.',
              },
            ].map((item, i) => (
              <details key={i} className="group rounded-xl border overflow-hidden transition-colors" style={{ background: 'var(--paper)', borderColor: 'var(--border)' }}>
                <summary className="flex items-center justify-between gap-4 p-4 sm:p-5 cursor-pointer list-none select-none" style={{ color: 'var(--ink)' }}>
                  <span className="t-title pr-2">{item.q}</span>
                  <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" style={{ color: 'var(--ink-muted)' }} />
                </summary>
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 t-body" style={{ color: 'var(--ink-muted)' }}>{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA STRIP (closing) ────────────────────────────────── */}
      <section className="px-6 sm:px-12 pb-20">
        <div
          className="max-w-5xl mx-auto rounded-3xl p-10 sm:p-14 relative overflow-hidden text-center"
          style={{ background: 'linear-gradient(135deg, #0A0A0F 0%, #14141A 50%, #1C1C24 100%)', color: '#F5F5F7', boxShadow: '0 24px 60px -20px rgba(0,0,0,0.40)' }}
        >
          <div className="absolute pointer-events-none" style={{ top: -80, right: -60, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.05), transparent 65%)' }} />
          <div className="absolute pointer-events-none" style={{ bottom: -80, left: -60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.05), transparent 65%)' }} />
          <div className="relative">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: '#A1A1AA' }}>Mulai pelan-pelan</p>
            <h2 className="font-bold tracking-tight mt-3" style={{ color: '#FFFFFF', fontSize: 'clamp(30px, 4.2vw, 50px)', lineHeight: 1.08, letterSpacing: '-0.03em' }}>
              Bulan depan, kamu bakal{' '}
              <span style={{ ...SERIF, color: '#6EE7B7', fontWeight: 400 }}>seneng</span>{' '}
              udah mulai hari ini.
            </h2>
            <Link href="/register" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-base font-semibold mt-7 transition hover:opacity-90" style={{ background: '#FFFFFF', color: '#0A0A0F', boxShadow: '0 10px 28px -10px rgba(255,255,255,0.30)' }}>
              Coba gratis 21 hari <ArrowRight className="size-4" />
            </Link>
            <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Akses penuh 21 hari · Tanpa kartu kredit · Cancel kapan aja</p>
            <p className="mt-2 text-xs num" style={{ color: 'rgba(255,255,255,0.55)' }}>Setelahnya cuma sekitar Rp 408/hari — itu pun kalau kamu mau lanjut.</p>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────────── */}
      <footer className="border-t px-6 sm:px-12 py-12" style={{ borderColor: 'var(--border-soft)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="grid place-items-center" style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', fontWeight: 800, fontSize: 14, letterSpacing: '-0.04em' }}>K</div>
                <span className="font-bold" style={{ color: 'var(--ink)', fontSize: 16 }}>Klunting</span>
              </div>
              <p className="text-[13px] mt-3 leading-relaxed max-w-xs" style={{ color: 'var(--ink-muted)' }}>
                Lihat, catat, dan ngerti semua uangmu di satu tempat. Beroperasi di Indonesia 🇮🇩
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>Produk</p>
              <div className="mt-3 flex flex-col gap-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
                <a href="#cara-kerja" className="hover:text-[var(--ink)] transition-colors">Cara kerja</a>
                <a href="#fitur" className="hover:text-[var(--ink)] transition-colors">Fitur</a>
                <a href="#harga" className="hover:text-[var(--ink)] transition-colors">Harga</a>
                <a href="#faq" className="hover:text-[var(--ink)] transition-colors">FAQ</a>
                <Link href="/register" className="hover:text-[var(--ink)] transition-colors">Coba gratis</Link>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>Bantuan</p>
              <div className="mt-3 flex flex-col gap-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
                <Link href="/contact" className="hover:text-[var(--ink)] transition-colors">Hubungi Kami</Link>
                <a href="mailto:support@klunting.com" className="hover:text-[var(--ink)] transition-colors">support@klunting.com</a>
                <a href="https://wa.me/628558829500" className="hover:text-[var(--ink)] transition-colors">WA/Telp: 0855-8829-500</a>
                <span className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>Sen–Jum, 09.00–18.00 WIB</span>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>Legal</p>
              <div className="mt-3 flex flex-col gap-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
                <Link href="/terms" className="hover:text-[var(--ink)] transition-colors">Syarat &amp; Ketentuan</Link>
                <Link href="/privacy" className="hover:text-[var(--ink)] transition-colors">Kebijakan Privasi</Link>
                <Link href="/refund" className="hover:text-[var(--ink)] transition-colors">Pengembalian Dana</Link>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" style={{ borderColor: 'var(--border-soft)' }}>
            <p className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>© {new Date().getFullYear()} Klunting · Atur uang tanpa drama</p>
            <p className="text-[11px] max-w-md sm:text-right" style={{ color: 'var(--ink-soft)' }}>
              Klunting adalah alat bantu pencatatan keuangan, <strong>bukan</strong> lembaga jasa keuangan atau penasihat investasi berlisensi.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
