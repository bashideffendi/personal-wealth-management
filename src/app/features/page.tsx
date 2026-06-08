import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ArrowRight, TrendingUp, LineChart, Wallet, PieChart, LayoutGrid, Waypoints,
  Receipt, MessageSquareText, Brain, FileUp, CreditCard, Users, Globe, Target,
  Shield, Download, Check, type LucideIcon,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Fitur',
  description: 'Net worth, riset saham IDX, anggaran, pencatatan AI, manajemen utang, berbagi keluarga, dan keamanan — fitur lengkap Klunting.',
}

type Feature = { icon: LucideIcon; title: string; desc: string }

// Terse, one-line-each — depth lives in the app, not on the page.
const FEATURES: Feature[] = [
  { icon: LineChart, title: 'Net worth otomatis', desc: 'Seluruh aset dikurangi utang menjadi satu angka yang diperbarui tiap hari.' },
  { icon: Wallet, title: 'Semua akun di satu tempat', desc: 'Rekening bank, kas, e-wallet, kartu kredit, hingga rekening dana nasabah (RDN).' },
  { icon: PieChart, title: 'Portofolio multi-aset', desc: 'Saham, crypto, reksa dana, emas, SBN, dan deposito dalam satu pandangan.' },
  { icon: LayoutGrid, title: 'Anggaran bulanan & tahunan', desc: 'Grid 12 bulan bergaya spreadsheet — drag-fill antar bulan dan rumus di sel.' },
  { icon: Waypoints, title: 'Arus kas & diagram alur', desc: 'Laporan kas bulanan plus diagram Sankey dari pemasukan ke pengeluaran.' },
  { icon: Receipt, title: 'Foto struk, terbaca otomatis', desc: 'Total, merchant, dan kategori terisi sendiri dari foto struk.' },
  { icon: MessageSquareText, title: 'Catat dengan bahasa biasa', desc: 'Ketik "indomaret 47rb cash" — langsung tercatat rapi dan terkategori.' },
  { icon: Brain, title: 'Insight & playbook AI', desc: 'Pola pengeluaran, anomali, dan rencana finansial yang disusun berdasar datamu.' },
  { icon: FileUp, title: 'Impor mutasi rekening', desc: 'Tarik transaksi dari berkas CSV atau PDF mutasi bank.' },
  { icon: CreditCard, title: 'Manajemen utang', desc: 'KPR, KTA, dan kartu kredit: sisa, jadwal bayar, dan strategi pelunasan tercepat.' },
  { icon: Users, title: 'Berbagi dengan keluarga', desc: 'Hingga 5 anggota berbagi tujuan, anggaran, dan dompet (paket Max).' },
  { icon: Globe, title: 'Multi-mata uang', desc: 'Lacak IDR, USD, SGD, dan EUR; semua dijumlahkan ke mata uang utamamu.' },
  { icon: Target, title: 'Tujuan keuangan', desc: 'Tetapkan target dan pantau progres dana darurat, DP rumah, atau liburan.' },
  { icon: Shield, title: 'Keamanan & privasi', desc: 'Enkripsi, Row Level Security, 2FA, dan Calm Mode untuk menyembunyikan angka.' },
  { icon: Download, title: 'Ekspor & kendali data', desc: 'Unduh seluruh data ke CSV dan hapus akun kapan saja. Data tidak dijual.' },
]

// The moat — given a bit more room than a one-liner deserves.
const VALUATIONS = ['DCF', 'Graham', 'EPV', 'DDM', 'NAV', 'PER relatif', 'PBV relatif', 'Dividend']

export default function FeaturesPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 sm:px-12 py-4 border-b backdrop-blur" style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}>
        <Link href="/" className="flex items-center gap-2.5" aria-label="Klunting">
          <div className="grid place-items-center" style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.04em' }}>K</div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Klunting</span>
        </Link>
        <nav className="hidden md:flex gap-7 text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>
          <Link href="/features" className="text-[var(--ink)]">Fitur</Link>
          <Link href="/#harga" className="hover:text-[var(--ink)] transition-colors">Harga</Link>
          <Link href="/#faq" className="hover:text-[var(--ink)] transition-colors">FAQ</Link>
          <Link href="/about" className="hover:text-[var(--ink)] transition-colors">Tentang</Link>
        </nav>
        <Link href="/register" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
          Coba gratis <ArrowRight className="size-3.5" />
        </Link>
      </header>

      <main className="px-6 sm:px-12 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="eyebrow">Fitur</p>
          <h1 className="mt-3 font-bold tracking-tight" style={{ fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: 1.08, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
            Semua yang dibutuhkan untuk mengelola keuangan pribadi.
          </h1>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
            Pencatatan harian, anggaran, manajemen utang, dan riset investasi dalam satu aplikasi.
          </p>
        </div>

        {/* Featured: IDX research moat */}
        <section className="mt-12 rounded-2xl p-6 sm:p-8 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-7 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <TrendingUp className="size-3.5" style={{ color: 'var(--c-mint)' }} />
                <span className="text-[11px] font-semibold tracking-tight" style={{ color: 'var(--ink-muted)' }}>Yang jarang ada di aplikasi pencatatan</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>Riset saham IDX, di dalam aplikasi keuanganmu</h2>
              <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                Bukan sekadar mencatat nilai portofolio. Klunting menghitung fair value 1.000+ emiten
                IDX dari delapan metode valuasi, lengkap dengan rasio kunci, struktur kepemilikan, dan
                kalender dividen.
              </p>
              <ul className="mt-4 space-y-2">
                {[
                  'Margin of safety per emiten dari konsensus valuasi',
                  'Rasio kunci (PER, PBV, ROE, DER) dan tren 5 tahun',
                  'Pemegang saham, anak usaha, dan jadwal dividen',
                ].map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-[14px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                    <Check className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--c-mint)' }} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl p-5 border" style={{ background: 'var(--bg-2)', borderColor: 'var(--border-soft)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: 'var(--ink-soft)' }}>8 metode valuasi</p>
              <div className="flex flex-wrap gap-2">
                {VALUATIONS.map((v) => (
                  <span key={v} className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium tabular-nums" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}>{v}</span>
                ))}
              </div>
              <p className="mt-4 text-[13px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                Harga bergerak harian via Yahoo Finance untuk setiap holding ber-ticker.
              </p>
            </div>
          </div>
        </section>

        {/* Grid: one line each */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="s-card p-5">
              <div className="size-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--surface-2)' }}>
                <f.icon className="size-5" style={{ color: 'var(--ink)' }} />
              </div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--ink)', fontSize: 15, letterSpacing: '-0.01em' }}>{f.title}</h3>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl p-8 sm:p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="font-bold tracking-tight" style={{ color: 'var(--ink)', fontSize: 'clamp(24px, 3vw, 34px)', letterSpacing: '-0.02em' }}>
            Coba semuanya gratis 21 hari.
          </h2>
          <p className="mt-2 text-base" style={{ color: 'var(--ink-muted)' }}>Tanpa kartu kredit.</p>
          <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold mt-6 transition hover:opacity-90" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
            Mulai sekarang <ArrowRight className="size-4" />
          </Link>
        </div>
      </main>

      <footer className="border-t px-6 sm:px-12 py-8" style={{ borderColor: 'var(--border-soft)' }}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
          <Link href="/" className="hover:text-[var(--ink)] transition-colors">Beranda</Link>
          <Link href="/#harga" className="hover:text-[var(--ink)] transition-colors">Harga</Link>
          <Link href="/about" className="hover:text-[var(--ink)] transition-colors">Tentang</Link>
          <Link href="/contact" className="hover:text-[var(--ink)] transition-colors">Hubungi Kami</Link>
          <Link href="/terms" className="hover:text-[var(--ink)] transition-colors">Syarat</Link>
          <Link href="/privacy" className="hover:text-[var(--ink)] transition-colors">Privasi</Link>
        </div>
      </footer>
    </div>
  )
}
