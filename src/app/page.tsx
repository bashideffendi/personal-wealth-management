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
  Receipt, TrendingUp, LineChart, ChevronDown,
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

  // Outcome-led clusters — each a verb, then terse capabilities. Deep detail
  // lives on /features; this section is meant to be scanned, not read.
  const CLUSTERS = [
    { icon: LineChart, title: 'Lihat gambaran utuh', points: [
      'Net worth otomatis, diperbarui tiap hari',
      'Semua rekening, e-wallet, dan kartu di satu tempat',
      'Portofolio saham, crypto, reksa dana, emas, SBN',
      'Aset non-likuid seperti properti & kendaraan',
    ] },
    { icon: Receipt, title: 'Pahami ke mana uang pergi', points: [
      'Anggaran bulanan & tahunan bergaya spreadsheet',
      'Laporan arus kas dan diagram alur',
      'Foto struk atau catat dengan bahasa biasa',
      'Insight pengeluaran bulanan dari AI',
    ] },
    { icon: TrendingUp, title: 'Ambil keputusan dengan data', points: [
      'Riset 1.000+ emiten IDX dengan 8 metode valuasi',
      'Rasio kunci, struktur kepemilikan, kalender dividen',
      'Manajemen utang & strategi pelunasan tercepat',
      'Playbook finansial yang disusun AI',
    ] },
    { icon: Shield, title: 'Tenang dan terkendali', points: [
      'Berbagi keluarga hingga 5 anggota',
      'Multi-mata uang (IDR, USD, SGD, EUR)',
      'Enkripsi, 2FA, dan Calm Mode',
      'Ekspor CSV & hapus akun kapan saja',
    ] },
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

      {/* ─── HERO ─── product-first, two-column ─── */}
      <section className="px-6 sm:px-12 pt-12 sm:pt-16 pb-12 sm:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-14 items-center max-w-7xl mx-auto">
          {/* Copy */}
          <div className="max-w-xl">
            <h1 className="tracking-tight" style={{ fontSize: 'clamp(34px, 4.6vw, 54px)', lineHeight: 1.05, letterSpacing: '-0.03em', fontWeight: 700, color: 'var(--ink)' }}>
              Seluruh keuanganmu, dalam satu tampilan yang jelas.
            </h1>
            <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              Klunting menyatukan rekening, investasi, dan utang menjadi satu angka net worth yang
              diperbarui tiap hari — lengkap dengan anggaran, riset saham IDX, dan pencatatan berbantuan AI.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 items-center">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold transition hover:opacity-90" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
                Coba gratis 21 hari <ArrowRight className="size-4" />
              </Link>
              <Link href="/features" className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-medium border transition hover:bg-[var(--surface-2)]" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}>
                Lihat fitur
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-x-4 gap-y-2 flex-wrap text-[12px]" style={{ color: 'var(--ink-soft)' }}>
              {['Akses penuh 21 hari', 'Tanpa kartu kredit', 'Data dienkripsi, tidak dijual'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5"><Check className="size-3.5" style={{ color: 'var(--c-mint-ink)' }} /> {t}</span>
              ))}
            </div>
          </div>

          {/* Real product screenshot — visible immediately */}
          <div className="relative lg:-mr-6">
            <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border)', boxShadow: 'var(--card-shadow)', background: 'var(--surface)' }}>
              <div className="flex items-center gap-2 px-4 h-9 border-b" style={{ borderColor: 'var(--border-soft)', background: 'var(--surface-2)' }}>
                <span className="size-2.5 rounded-full" style={{ background: '#ED7385' }} />
                <span className="size-2.5 rounded-full" style={{ background: '#E3A93C' }} />
                <span className="size-2.5 rounded-full" style={{ background: '#5CCB9F' }} />
                <div className="ml-3 hidden sm:flex items-center rounded-md px-3 py-0.5 text-[11px] font-medium" style={{ background: 'var(--bg)', color: 'var(--ink-soft)' }}>klunting.com/dashboard</div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hero-dashboard.webp"
                alt="Dashboard Klunting: net worth Rp 2,42 M, grafik pertumbuhan, ringkasan harian, dan skor kesehatan finansial"
                width={1760}
                height={1226}
                fetchPriority="high"
                className="w-full h-auto block"
              />
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
                <p.icon className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--c-mint-ink)' }} />
                <span className="t-sm" style={{ color: 'var(--ink-muted)' }}>{p.t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FITUR (outcome clusters → /features) ─── */}
      <section id="fitur" className="px-6 sm:px-12 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-12">
            <p className="eyebrow">Fitur</p>
            <h2 className="mt-3 font-bold tracking-tight" style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 1.12, letterSpacing: '-0.025em', color: 'var(--ink)' }}>
              Satu tempat untuk gambaran utuh keuanganmu.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-12">
            {CLUSTERS.map((c) => (
              <div key={c.title}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--surface-2)' }}>
                    <c.icon className="size-5" style={{ color: 'var(--ink)' }} />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>{c.title}</h3>
                </div>
                <ul className="space-y-2.5">
                  {c.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-[15px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                      <span className="size-1.5 rounded-full mt-2 shrink-0" style={{ background: 'var(--c-mint)' }} />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <Link href="/features" className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--c-mint-ink)' }}>
              Lihat semua fitur secara detail <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── HIGHLIGHT: arus kas / Sankey (fitur favorit) ─── */}
      <section className="px-6 sm:px-12 py-16 sm:py-20" style={{ background: 'var(--bg-2)' }}>
        <div className="grid grid-cols-1 lg:grid-cols-[0.82fr_1.18fr] gap-10 lg:gap-14 items-center max-w-6xl mx-auto">
          <div>
            <p className="eyebrow">Arus kas</p>
            <h2 className="mt-3 font-bold tracking-tight" style={{ fontSize: 'clamp(26px, 3.4vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.025em', color: 'var(--ink)' }}>
              Lihat persis ke mana uangmu mengalir.
            </h2>
            <p className="mt-4 text-base leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              Setiap rupiah — dari tiap sumber pemasukan sampai ke kategori pengeluaran, tabungan, dan
              investasi — dalam satu diagram aliran. Langsung kelihatan apa yang menyerap uangmu, dan
              berapa yang tersisa.
            </p>
            <Link href="/features/anggaran" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--c-mint-ink)' }}>
              Pelajari anggaran &amp; arus kas <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="rounded-2xl overflow-hidden border p-3 sm:p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)', boxShadow: 'var(--card-shadow)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/features/sankey.webp"
              alt="Diagram aliran uang Klunting: dari Gaji & Side Hustle ke total pemasukan, lalu mengalir ke Tempat Tinggal, Makanan, Saham, dan kategori lain"
              width={1600}
              height={557}
              className="w-full h-auto block rounded-lg"
            />
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
              { q: 'Seberapa aman data finansialku?', a: 'Seluruh komunikasi browser ke server dienkripsi TLS. Password disimpan sebagai hash satu-arah (bcrypt) sehingga tim Klunting pun tidak dapat membacanya. Database memakai Row Level Security, jadi data antar pengguna terisolasi di level engine. Foto struk hanya dapat diakses pemiliknya. Tidak ada iklan dan data tidak dijual. Tersedia juga 2FA dan PIN perangkat di pengaturan Keamanan.' },
              { q: 'Apakah aku perlu memberi password mobile banking?', a: 'Tidak. Klunting tidak terhubung langsung ke rekening bank. Kami hanya menyimpan data yang kamu input atau unggah manual: foto struk (dibaca AI), input bahasa biasa, atau unggah PDF mutasi untuk diproses.' },
              { q: 'AI-nya memakai apa, dan ke mana data dikirim?', a: 'Fitur AI memakai Claude dari Anthropic. Yang dikirim hanya teks atau gambar struk yang kamu berikan; Anthropic tidak menyimpannya untuk melatih model. Detail ada di Kebijakan Privasi.' },
              { q: 'Apa yang terjadi pada dataku jika berhenti berlangganan?', a: 'Trial dapat dihentikan kapan saja tanpa potongan. Setelah berhenti, akun beralih ke mode hanya-baca hingga akhir periode. Kamu dapat mengekspor seluruh data ke CSV, lalu menghapus akun dari Profil; data disimpan 30 hari sebelum dihapus permanen.' },
              { q: 'Bisakah aku mengekspor seluruh transaksi?', a: 'Bisa. Di halaman Transaksi, pilih Export CSV — berkas terunduh langsung dan bisa dibuka di Excel, Google Sheets, atau aplikasi lain. Datamu milikmu.' },
              { q: 'Apa bedanya dengan aplikasi keuangan lain?', a: 'Tiga hal: konteks Indonesia (kategori, Rupiah, IDX); kedalaman investasi (riset 1.000+ emiten dengan 8 metode valuasi dan struktur kepemilikan) yang jarang ada di aplikasi pencatatan; serta berbagi keluarga hingga 5 anggota.' },
              { q: 'Aku tinggal di luar negeri tapi punya rekening Indonesia, bisa?', a: 'Bisa. Klunting berbasis web dan dapat diakses dari mana saja, mendukung multi-mata uang (IDR, USD, SGD, EUR), dan pembacaan struk dalam Bahasa Indonesia maupun Inggris.' },
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
