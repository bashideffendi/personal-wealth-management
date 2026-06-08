import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ArrowRight, TrendingUp, LineChart, Wallet, Sparkles, CreditCard, Users, Shield,
  type LucideIcon,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Fitur',
  description: 'Net worth, riset saham IDX, anggaran, pencatatan AI, manajemen utang, berbagi keluarga, dan keamanan — fitur lengkap Klunting.',
}

type Feature = { icon: LucideIcon; title: string; lead: string; points: string[] }

const FEATURES: Feature[] = [
  {
    icon: LineChart,
    title: 'Net worth & seluruh akun',
    lead: 'Kumpulkan setiap rekening, e-wallet, dan aset di satu tempat, lalu lihat satu angka net worth yang diperbarui tiap hari.',
    points: [
      'Rekening bank, kas, e-wallet, kartu kredit, hingga rekening dana nasabah (RDN)',
      'Net worth = total aset − total utang, dengan riwayat dan grafik pertumbuhan',
      'Komposisi aset (kas, investasi, properti, kendaraan) dalam satu pandangan',
      'Aset non-likuid seperti properti & kendaraan, dengan penyusutan otomatis',
    ],
  },
  {
    icon: TrendingUp,
    title: 'Investasi & riset saham IDX',
    lead: 'Bukan sekadar mencatat nilai portofolio. Klunting membawa riset fundamental ke dalam aplikasi keuanganmu.',
    points: [
      'Portofolio multi-aset: saham IDX, crypto, reksa dana, emas, SBN, deposito',
      'Riset 1.000+ emiten IDX: fair value dari 8 metode valuasi (DCF, Graham, EPV, DDM, NAV, dan lainnya)',
      'Margin of safety, rasio kunci (PER, PBV, ROE, DER), dan tren 5 tahun per emiten',
      'Struktur kepemilikan (pemegang saham & anak usaha) dan kalender dividen',
      'Harga bergerak harian via Yahoo Finance untuk holding ber-ticker',
    ],
  },
  {
    icon: Wallet,
    title: 'Anggaran & arus kas',
    lead: 'Anggaran yang terasa seperti spreadsheet yang kamu kuasai, bukan formulir kaku.',
    points: [
      'Anggaran per bulan maupun setahun penuh dalam grid 12 bulan',
      'Drag-fill antar bulan dan rumus langsung di sel (mis. =12*250000)',
      'Kategori dan subkategori yang bisa diatur, diurutkan, dan dinonaktifkan',
      'Laporan arus kas bulanan + diagram alur (Sankey) dari pemasukan ke pengeluaran',
      'Bandingkan rencana vs realisasi tiap kategori',
    ],
  },
  {
    icon: Sparkles,
    title: 'Pencatatan berbantuan AI',
    lead: 'Mencatat transaksi sehemat mungkin friksinya, supaya kamu konsisten.',
    points: [
      'Foto struk → total, merchant, dan kategori terisi otomatis',
      'Catat dengan bahasa biasa: ketik "indomaret 47rb cash", langsung rapi',
      'Insight bulanan: pola pengeluaran, anomali, dan proyeksi saldo',
      'AI Playbook: rencana finansial terarah (dana darurat, lunasi paylater, DP rumah)',
      'Impor mutasi rekening dari CSV atau PDF',
    ],
  },
  {
    icon: CreditCard,
    title: 'Manajemen utang',
    lead: 'Lihat seluruh kewajibanmu dan jalur tercepat untuk bebas darinya.',
    points: [
      'KPR, KTA, kartu kredit, dan paylater dalam satu daftar',
      'Sisa pokok, bunga, jadwal pembayaran, dan estimasi tanggal lunas',
      'Strategi pelunasan (avalanche / snowball) dengan simulasi cicilan ekstra',
      'Rasio utang terhadap pendapatan (DTI) sebagai indikator kesehatan',
    ],
  },
  {
    icon: Users,
    title: 'Berbagi dengan keluarga',
    lead: 'Kelola keuangan bersama pasangan atau keluarga tanpa kehilangan privasi.',
    points: [
      'Hingga 5 anggota dalam satu rumah tangga (paket Max)',
      'Tujuan, anggaran, dan dompet bersama',
      'Rincian per anggota: siapa membelanjakan apa',
      'Pengeluaran pribadi tetap dapat dipisahkan bila diinginkan',
    ],
  },
  {
    icon: Shield,
    title: 'Keamanan & privasi',
    lead: 'Data finansial adalah data sensitif. Kami memperlakukannya seperti itu.',
    points: [
      'Enkripsi TLS di setiap koneksi; password di-hash satu arah (bcrypt)',
      'Row Level Security — data antar pengguna terisolasi di level database',
      'Autentikasi dua faktor (2FA) dan PIN/biometrik perangkat',
      'Calm Mode untuk menyembunyikan angka di tempat umum',
      'Ekspor seluruh data (CSV) dan hapus akun kapan saja. Data tidak dijual.',
    ],
  },
]

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
        <div className="max-w-3xl mx-auto">
          <p className="eyebrow">Fitur</p>
          <h1 className="mt-3 font-bold tracking-tight" style={{ fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: 1.08, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
            Semua yang dibutuhkan untuk mengelola keuangan pribadi.
          </h1>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
            Klunting menggabungkan pencatatan harian, anggaran, manajemen utang, dan riset investasi
            dalam satu aplikasi. Berikut detail tiap bagiannya.
          </p>
        </div>

        <div className="max-w-3xl mx-auto mt-14 space-y-14">
          {FEATURES.map((f) => (
            <section key={f.title}>
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--surface-2)' }}>
                  <f.icon className="size-5" style={{ color: 'var(--ink)' }} />
                </div>
                <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>{f.title}</h2>
              </div>
              <p className="mt-4 text-base leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{f.lead}</p>
              <ul className="mt-4 space-y-2.5">
                {f.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-[15px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                    <span className="size-1.5 rounded-full mt-2 shrink-0" style={{ background: 'var(--c-mint)' }} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* CTA */}
        <div className="max-w-3xl mx-auto mt-16 rounded-2xl p-8 sm:p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
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
        <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
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
