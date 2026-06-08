/**
 * Klunting — Landing (root /).
 * Minimal, professional, informative. Sections: Hero · Trust · Fitur (ringkas →
 * /features) · Harga · FAQ. Deep feature detail lives on /features, the story on
 * /about. No how-it-works fluff, no decorative glow, no try-hard copy.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  ArrowRight, Menu, Check, Shield, Lock, Database, EyeOff,
  Receipt, TrendingUp, LineChart, Users, Sparkles, Wallet, CreditCard, ChevronDown,
} from 'lucide-react'
import { PricingSection } from '@/components/landing/pricing-section'

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
    { href: '/features', label: 'Fitur' },
    { href: '#harga', label: 'Harga' },
    { href: '#faq', label: 'FAQ' },
    { href: '/about', label: 'Tentang' },
  ]

  const FEATURES = [
    { icon: TrendingUp, title: 'Investasi & riset saham IDX', body: 'Pantau saham, crypto, reksa dana, emas, SBN, dan deposito dalam satu portofolio. Plus riset 1.000+ emiten IDX: fair value dari 8 metode valuasi, rasio kunci, dan struktur kepemilikan.' },
    { icon: LineChart, title: 'Net worth otomatis', body: 'Seluruh aset dikurangi seluruh utang menjadi satu angka net worth yang diperbarui tiap hari, lengkap dengan riwayat dan komposisinya.' },
    { icon: Wallet, title: 'Anggaran & arus kas', body: 'Anggaran bulanan maupun tahunan bergaya spreadsheet (drag-fill antar bulan, rumus di sel), laporan arus kas, dan diagram alur pemasukan ke pengeluaran.' },
    { icon: Sparkles, title: 'Pencatatan berbantuan AI', body: 'Foto struk untuk dibaca otomatis, catat dengan bahasa biasa, insight bulanan, dan rencana finansial yang disusun AI berdasar datamu.' },
    { icon: CreditCard, title: 'Manajemen utang', body: 'KPR, KTA, dan kartu kredit dalam satu tempat. Lihat sisa, jadwal bayar, strategi pelunasan tercepat, dan estimasi tanggal lunas.' },
    { icon: Users, title: 'Berbagi dengan keluarga', body: 'Kelola keuangan bersama pasangan atau keluarga hingga 5 anggota: tujuan, anggaran, dan dompet bersama, dengan rincian per anggota.' },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      {/* ─── NAV ─── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 sm:px-12 py-4 border-b backdrop-blur"
        style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}
      >
        <Link href="/" className="flex items-center gap-2.5" aria-label="Klunting">
          <div className="grid place-items-center" style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.04em' }}>K</div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Klunting</span>
        </Link>

        <nav className="hidden md:flex gap-7 text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-[var(--ink)] transition-colors">{l.label}</a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <Link href="/login" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-[var(--surface-2)] transition-colors" style={{ color: 'var(--ink)' }}>Masuk</Link>
            <Link href="/register" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
              Coba gratis <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <details className="md:hidden relative">
            <summary aria-label="Buka menu" className="list-none cursor-pointer grid place-items-center size-9 rounded-md" style={{ color: 'var(--ink)' }}>
              <Menu className="size-5" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border p-2 z-50 flex flex-col" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: '0 16px 40px -12px rgba(0,0,0,0.22)' }}>
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

      {/* ─── HERO ─── */}
      <section className="px-6 sm:px-12 py-16 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center max-w-7xl mx-auto">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-6" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)', border: '1px solid var(--border)' }}>
              <span className="size-1.5 rounded-full" style={{ background: 'var(--c-mint)' }} />
              <span className="text-xs font-semibold tracking-tight">Manajemen keuangan pribadi</span>
            </div>

            <h1 className="tracking-tight" style={{ fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.08, letterSpacing: '-0.03em', fontWeight: 700, color: 'var(--ink)' }}>
              Seluruh keuanganmu, dalam satu tampilan yang jelas.
            </h1>
            <p className="mt-6 text-lg leading-relaxed max-w-lg" style={{ color: 'var(--ink-muted)' }}>
              Klunting menyatukan rekening, investasi, dan utang menjadi satu angka net worth yang
              diperbarui tiap hari. Lengkap dengan anggaran, riset saham IDX, dan pencatatan transaksi
              berbantuan AI.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 items-center">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold transition hover:opacity-90" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
                Coba gratis 21 hari <ArrowRight className="size-4" />
              </Link>
              <Link href="/features" className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-medium border transition hover:bg-[var(--surface-2)]" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}>
                Lihat fitur
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-4 flex-wrap text-[12px]" style={{ color: 'var(--ink-soft)' }}>
              {['Akses penuh 21 hari', 'Tanpa kartu kredit', 'Data dienkripsi, tidak dijual'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5"><Check className="size-3.5" style={{ color: 'var(--c-mint)' }} /> {t}</span>
              ))}
            </div>
          </div>

          {/* Net-worth card mockup */}
          <div className="relative">
            <div className="dark-card p-7 relative" style={{ boxShadow: '0 24px 60px -16px rgba(0,0,0,0.30)' }}>
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <p className="text-[10px] uppercase font-semibold" style={{ color: 'var(--on-black-mut)', letterSpacing: '0.16em' }}>Net Worth · Hari ini</p>
                  <p className="num tabular font-bold mt-2 leading-none" style={{ color: 'var(--on-black)', fontSize: 44, letterSpacing: '-0.03em' }}>Rp 72.480.000</p>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold mt-3" style={{ background: 'rgba(16,185,129,0.18)', color: '#6EE7B7' }}>↑ Rp 1.240.000 bulan ini</span>
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

            <div className="hidden sm:flex absolute -bottom-6 -left-6 rounded-2xl px-4 py-3 gap-3 items-center border max-w-[280px]" style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)', boxShadow: '0 12px 32px -8px rgba(0,0,0,0.22)' }}>
              <div className="size-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>
                <Receipt className="size-4" />
              </div>
              <div>
                <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>Indomaret · Rp 47.500</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>Diketik singkat, tercatat rapi.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST ─── */}
      <section className="px-6 sm:px-12 py-8" style={{ background: 'var(--bg-2)' }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-[13px] mb-5 font-medium" style={{ color: 'var(--ink-soft)' }}>Keamanan data finansialmu, sejak awal.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Shield, t: 'Enkripsi TLS di setiap koneksi' },
              { icon: Lock, t: 'Password di-hash; tim kami pun tidak bisa membacanya' },
              { icon: Database, t: 'Data tiap pengguna terisolasi (Row Level Security)' },
              { icon: EyeOff, t: 'Tanpa iklan, data tidak dijual' },
            ].map((p) => (
              <div key={p.t} className="flex items-start gap-2.5">
                <p.icon className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--c-mint)' }} />
                <span className="t-sm" style={{ color: 'var(--ink-muted)' }}>{p.t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FITUR (ringkas → /features) ─── */}
      <section id="fitur" className="px-6 sm:px-12 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-10">
            <p className="eyebrow">Fitur</p>
            <h2 className="mt-3 font-bold tracking-tight" style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 1.12, letterSpacing: '-0.025em', color: 'var(--ink)' }}>
              Satu tempat untuk gambaran utuh keuanganmu.
            </h2>
            <p className="mt-3 text-base" style={{ color: 'var(--ink-muted)' }}>
              Mencatat, memantau, dan memahami seluruh keuangan pribadi — dari transaksi harian sampai portofolio investasi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="s-card p-5">
                <div className="size-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--surface-2)' }}>
                  <f.icon className="size-5" style={{ color: 'var(--ink)' }} />
                </div>
                <h3 className="t-title mb-1.5" style={{ color: 'var(--ink)' }}>{f.title}</h3>
                <p className="t-body" style={{ color: 'var(--ink-muted)' }}>{f.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link href="/features" className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--c-mint)' }}>
              Lihat semua fitur secara detail <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── HARGA ─── */}
      <PricingSection />

      {/* ─── FAQ ─── */}
      <section id="faq" className="px-6 sm:px-12 py-16 sm:py-20" style={{ background: 'var(--surface)' }}>
        <div className="max-w-3xl mx-auto">
          <p className="eyebrow">FAQ</p>
          <h2 className="mt-3 font-bold tracking-tight" style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 1.12, letterSpacing: '-0.025em', color: 'var(--ink)' }}>
            Pertanyaan yang sering diajukan.
          </h2>
          <p className="mt-3 mb-8 text-base" style={{ color: 'var(--ink-muted)' }}>
            Tidak ketemu jawabannya? Hubungi <a href="mailto:support@klunting.com" className="font-medium underline" style={{ color: 'var(--ink)' }}>support@klunting.com</a>.
          </p>

          <div className="space-y-2">
            {[
              { q: 'Seberapa aman data finansial saya?', a: 'Seluruh komunikasi browser ke server dienkripsi TLS. Password disimpan sebagai hash satu-arah (bcrypt) sehingga tim Klunting pun tidak dapat membacanya. Database memakai Row Level Security, jadi data antar pengguna terisolasi di level engine. Foto struk hanya dapat diakses pemiliknya. Tidak ada iklan dan data tidak dijual. Tersedia juga 2FA dan PIN perangkat di pengaturan Keamanan.' },
              { q: 'Apakah saya perlu memberi password mobile banking?', a: 'Tidak. Klunting tidak terhubung langsung ke rekening bank. Kami hanya menyimpan data yang kamu input atau unggah manual: foto struk (dibaca AI), input bahasa biasa, atau unggah PDF mutasi untuk diproses.' },
              { q: 'AI-nya memakai apa, dan ke mana data dikirim?', a: 'Fitur AI memakai Claude dari Anthropic. Yang dikirim hanya teks atau gambar struk yang kamu berikan; Anthropic tidak menyimpannya untuk melatih model. Detail ada di Kebijakan Privasi.' },
              { q: 'Apa yang terjadi pada data saya jika berhenti berlangganan?', a: 'Trial dapat dihentikan kapan saja tanpa potongan. Setelah berhenti, akun beralih ke mode hanya-baca hingga akhir periode. Kamu dapat mengekspor seluruh data ke CSV, lalu menghapus akun dari Profil; data disimpan 30 hari sebelum dihapus permanen.' },
              { q: 'Bisakah saya mengekspor seluruh transaksi?', a: 'Bisa. Di halaman Transaksi, pilih Export CSV — berkas terunduh langsung dan bisa dibuka di Excel, Google Sheets, atau aplikasi lain. Datamu milikmu.' },
              { q: 'Apa bedanya dengan aplikasi keuangan lain?', a: 'Tiga hal: konteks Indonesia (kategori, Rupiah, IDX); kedalaman investasi (riset 1.000+ emiten dengan 8 metode valuasi dan struktur kepemilikan) yang jarang ada di aplikasi pencatatan; serta berbagi keluarga hingga 5 anggota.' },
              { q: 'Saya tinggal di luar negeri tapi punya rekening Indonesia — bisa?', a: 'Bisa. Klunting berbasis web dan dapat diakses dari mana saja, mendukung multi-mata uang (IDR, USD, SGD, EUR), dan pembacaan struk dalam Bahasa Indonesia maupun Inggris.' },
              { q: 'Apakah ada paket gratis?', a: 'Belum. Saat ini fokusnya trial 21 hari akses penuh tanpa kartu, lalu pilih paket: Pro Rp 149.000/tahun (atau Rp 19.000/bulan) dan Max Rp 299.000/tahun (atau Rp 35.000/bulan).' },
              { q: 'Bisakah dipakai bersama keluarga?', a: 'Bisa, melalui paket Max. Hingga 5 anggota dapat mengakses tujuan, anggaran, dan dompet bersama, dengan tetap memisahkan pengeluaran pribadi bila diinginkan.' },
              { q: 'Kapan ada aplikasi mobile?', a: 'Klunting adalah PWA — dapat dipasang di layar utama iPhone/Android tanpa unduh dari store (buka di Safari/Chrome → "Tambah ke Layar Utama"). Pengalamannya seperti aplikasi native, termasuk akses kamera untuk foto struk.' },
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

      {/* ─── CTA ─── */}
      <section className="px-6 sm:px-12 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto rounded-3xl p-10 sm:p-14 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="font-bold tracking-tight" style={{ color: 'var(--ink)', fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 1.1, letterSpacing: '-0.025em' }}>
            Mulai lihat keuanganmu dengan jelas.
          </h2>
          <p className="mt-3 text-base max-w-lg mx-auto" style={{ color: 'var(--ink-muted)' }}>
            Coba seluruh fitur gratis 21 hari, tanpa kartu kredit.
          </p>
          <Link href="/register" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-base font-semibold mt-7 transition hover:opacity-90" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
            Coba gratis 21 hari <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t px-6 sm:px-12 py-12" style={{ borderColor: 'var(--border-soft)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="grid place-items-center" style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', fontWeight: 800, fontSize: 14, letterSpacing: '-0.04em' }}>K</div>
                <span className="font-bold" style={{ color: 'var(--ink)', fontSize: 16 }}>Klunting</span>
              </div>
              <p className="text-[13px] mt-3 leading-relaxed max-w-xs" style={{ color: 'var(--ink-muted)' }}>
                Kelola seluruh keuangan pribadi di satu tempat. Beroperasi di Indonesia.
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>Produk</p>
              <div className="mt-3 flex flex-col gap-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
                <Link href="/features" className="hover:text-[var(--ink)] transition-colors">Fitur</Link>
                <a href="#harga" className="hover:text-[var(--ink)] transition-colors">Harga</a>
                <a href="#faq" className="hover:text-[var(--ink)] transition-colors">FAQ</a>
                <Link href="/about" className="hover:text-[var(--ink)] transition-colors">Tentang</Link>
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
            <p className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>© {new Date().getFullYear()} Klunting</p>
            <p className="text-[11px] max-w-md sm:text-right" style={{ color: 'var(--ink-soft)' }}>
              Klunting adalah alat bantu pencatatan keuangan, <strong>bukan</strong> lembaga jasa keuangan atau penasihat investasi berlisensi.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
