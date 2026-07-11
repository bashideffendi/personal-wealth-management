/**
 * Klunting — Landing (root /). REBUILD TOTAL v3 (2026-07-11, arahan user:
 * "redesign total, ganti konten, bebas sebebas-bebasmu, secantik-cantiknya,
 * penjelasan per fitur detil, kurangi AI slop").
 *
 * Struktur: Hero vertikal (headline → product shot penuh) · strip angka ·
 * ENAM BAB fitur berselang-seling (visual besar + copy panjang + spec-list) ·
 * keluarga+keamanan · harga (gated) · catatan pembuat · FAQ editorial ·
 * finale gelap. Long-form ala Linear/Stripe — BUKAN grid kartu.
 *
 * Aturan anti-slop yang dijaga di file ini:
 *  - TANPA kartu ber-border-warna-atas, TANPA grid ikon-kartu 2x2, TANPA emoji.
 *  - Marker list = KOTAK kecil rounded (gema mark logo), bukan dot bullet.
 *  - Visual = screenshot produk NYATA (public/features) + vignette UI yang
 *    dibangun dengan token produk (components/landing/vignettes) — tanpa
 *    browser-chrome palsu, tanpa gradient orb.
 *  - Motion tetap 3 titik (reveal sekali, count-up sekali) + reduced-motion.
 *  - Semua klaim fitur nyata & terverifikasi di kode. Jangan menambah klaim.
 */

import Link from 'next/link'
import {
  ArrowRight, Menu, ChevronDown, Shield, Lock, Database, EyeOff, Scale, Users,
} from 'lucide-react'
import { KluntingLogo, KluntingMark } from '@/components/brand/klunting-logo'
import { PricingSection } from '@/components/landing/pricing-section'
import { Reveal } from '@/components/landing/reveal'
import { CountUp } from '@/components/landing/count-up'
import { AiEntryVignette, BudgetVignette, KeyboardVignette } from '@/components/landing/vignettes'
import { BILLING_ENABLED } from '@/lib/billing-flag'

// Redirect user ber-sesi → /dashboard ditangani middleware (cek cookie sesi),
// bukan di sini — supaya '/' tetap 100% static (prerender).

// ─── Bab fitur — konten detil per fitur (permintaan user) ─────────────────
type Spec = string
interface ChapterData {
  kicker: string
  color: string      // aksen (marker, kicker dot)
  ink: string        // varian teks AA
  title: string
  lead: string
  specs: Spec[]
  shot?: { src: string; alt: string; w: number; h: number }
  vignette?: 'ai' | 'budget' | 'keyboard'
}

const CHAPTERS: ChapterData[] = [
  {
    kicker: 'Net worth', color: 'var(--c-mint)', ink: 'var(--c-mint-ink)',
    title: 'Satu angka yang merangkum semuanya.',
    lead: 'Rekening bank, e-wallet, saham, reksa dana, emas, properti, kendaraan, sampai piutang — dikurangi utang dan tagihan kartu kredit. Klunting menghitungnya jadi satu angka net worth, menyimpan riwayatnya setiap hari, dan menunjukkan ke mana arahnya.',
    specs: [
      'Enam kelas aset dan liabilitas dalam satu perhitungan — bukan lima tab spreadsheet yang lupa di-update',
      'Snapshot otomatis harian: bandingkan sebulan lalu, setahun lalu, atau sejak awal mencatat',
      'Properti tampil di peta dengan apresiasi nilainya; kendaraan terdepresiasi otomatis',
      'Delta “vs bulan lalu” dihitung dari snapshot sungguhan — bukan perkiraan',
    ],
    shot: { src: '/features/networth.webp', alt: 'Halaman Net Worth Klunting: angka kekayaan bersih besar dengan grafik riwayat dan rincian aset-liabilitas', w: 1600, h: 900 },
  },
  {
    kicker: 'Riset saham IDX', color: 'var(--c-blue)', ink: 'var(--c-blue-ink)',
    title: 'Riset yang biasanya ada di terminal mahal.',
    lead: '1.004 emiten Bursa Efek Indonesia dengan data fundamental multi-tahun. Setiap saham dinilai lewat 13 metode valuasi — DCF, Graham, EPV, DDM, sampai relative valuation — lalu dirangkum jadi satu fair value konsensus dan margin of safety yang bisa kamu screening.',
    specs: [
      'Screener seluruh bursa: saring PER, PBV, ROE, dividend yield, market cap, margin of safety — semua kolom bisa diurutkan, hasilnya bisa diekspor',
      'Bandingkan sampai 4 emiten berdampingan: valuasi per metode, skor Piotroski, tren pendapatan & laba 10 tahun',
      'Struktur kepemilikan sampai pemegang akhir, plus kalender dividen',
      'Watchlist dengan target harga — dapat notifikasi begitu tersentuh',
    ],
    shot: { src: '/features/research.webp', alt: 'Halaman riset saham Klunting: fair value konsensus, margin of safety, dan rincian metode valuasi sebuah emiten IDX', w: 1600, h: 900 },
  },
  {
    kicker: 'Anggaran & arus kas', color: 'var(--c-violet)', ink: 'var(--c-violet-ink)',
    title: 'Anggaran setahun, digarap seperti spreadsheet.',
    lead: 'Grid 12 bulan yang diisi langsung di sel, di-drag-fill seperti Excel, atau disalin dari bulan lalu. Di sampingnya: diagram arus kas yang menunjukkan ke mana setiap rupiah pergi — dari total pemasukan sampai kategori terkecil, termasuk yang belum terpakai.',
    specs: [
      'Rencana vs realisasi dalam satu grid — kategori yang jebol langsung kelihatan',
      'Diagram alir Sankey: pemasukan masuk satu pool, mengalir ke belanja, tabungan, dan investasi',
      'Auto-kategorisasi yang belajar dari koreksimu — makin dipakai makin jarang salah',
      'Laporan bulanan siap cetak, rapi untuk arsip',
    ],
    vignette: 'budget',
  },
  {
    kicker: 'Catat dengan AI', color: 'var(--c-coral)', ink: 'var(--c-coral-ink)',
    title: 'Mencatat itu tiga detik, bukan tiga menit.',
    lead: 'Ketik seperti kamu bicara — “kopi 25rb pake gopay” — dan AI mengerti jumlah, kategori, sekaligus akunnya. Atau foto struknya: total, tanggal, dan merchant terbaca sendiri. Kebiasaan mencatat gagal karena ribet; ini menghilangkan ribetnya.',
    specs: [
      'Bahasa Indonesia sehari-hari, bukan format yang harus dihafal',
      'Foto struk → transaksi terisi otomatis, strukturnya tersimpan sebagai bukti',
      'Impor mutasi bank (PDF/CSV) dengan deteksi duplikat sebelum masuk',
      'Tetap bisa mencatat saat offline — tersinkron begitu kembali online',
    ],
    vignette: 'ai',
  },
  {
    kicker: 'Utang & tujuan', color: 'var(--c-mint)', ink: 'var(--c-mint-ink)',
    title: 'Utang dilunasi dengan strategi. Tujuan dikejar dengan probabilitas.',
    lead: 'Semua cicilan dan kartu kredit dalam satu daftar, lengkap dengan meter debt-to-income. Klunting menghitung urutan pelunasan tercepat dan memproyeksikan tanggal bebas utangmu. Untuk tujuan finansial, setiap target disimulasikan ribuan kali — angkanya kejujuran, bukan harapan.',
    specs: [
      'Proyeksi bebas-utang dua strategi — avalanche vs snowball — lengkap dengan selisih bunganya',
      'Probabilitas tercapai per tujuan (simulasi Monte Carlo), berdasarkan setoran dan profil risiko',
      'Piramida prioritas: amankan dana darurat dulu, baru kejar yang ambisius',
      'Pengingat tagihan H-1 lewat notifikasi',
    ],
    shot: { src: '/features/debts.webp', alt: 'Halaman Utang Klunting: daftar cicilan dengan proyeksi pelunasan dan meter debt-to-income', w: 1600, h: 900 },
  },
  {
    kicker: 'Dibangun untuk desktop', color: 'var(--ink)', ink: 'var(--ink)',
    title: 'Serius di layar besar.',
    lead: 'Aplikasi keuangan di Indonesia berhenti di ponsel. Klunting tidak. Di desktop dia berperilaku seperti perkakas kerja: pintasan keyboard di mana-mana, tabel yang bisa diurutkan dan disimpan tampilannya, panel detail tanpa pindah halaman — hal yang belum dilakukan aplikasi keuangan mana pun di sini.',
    specs: [
      'Command palette ⌘K: lompat halaman, cari transaksi, tambah data — tanpa menyentuh mouse',
      'Saved views di tabel transaksi: kombinasi filter favoritmu, sekali klik',
      'Peek panel: telusuri baris dengan j/k, tekan Space untuk detail — posisi tidak hilang',
      'Ekspor CSV dari transaksi, holdings, dan screener — datamu selalu portabel',
    ],
    vignette: 'keyboard',
  },
]

const VIGNETTES = { ai: AiEntryVignette, budget: BudgetVignette, keyboard: KeyboardVignette } as const

// ─── Sub-komponen presentasi (server, murni) ──────────────────────────────

function ShotFrame({ src, alt, w, h, priority = false }: { src: string; alt: string; w: number; h: number; priority?: boolean }) {
  return (
    <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border)', boxShadow: 'var(--card-shadow)', background: 'var(--surface)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={w} height={h} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} className="w-full h-auto block" />
    </div>
  )
}

function Chapter({ data, flip }: { data: ChapterData; flip: boolean }) {
  const Vignette = data.vignette ? VIGNETTES[data.vignette] : null
  return (
    <section className="px-6 sm:px-12 py-14 sm:py-20">
      <Reveal className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-16 items-center">
        <div className={flip ? 'lg:order-2' : ''}>
          <p className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-[4px] shrink-0" style={{ background: data.color }} />
            <span className="text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: data.ink }}>{data.kicker}</span>
          </p>
          <h2 className="mt-4 font-bold tracking-tight" style={{ fontSize: 'clamp(26px, 3.4vw, 40px)', lineHeight: 1.12, letterSpacing: '-0.025em', color: 'var(--ink)' }}>
            {data.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{data.lead}</p>
          <ul className="mt-7">
            {data.specs.map((s) => (
              <li key={s} className="flex items-start gap-3 py-2.5 border-t" style={{ borderColor: 'var(--border-soft)' }}>
                <span className="size-1.5 rounded-[3px] mt-[8px] shrink-0" style={{ background: data.color }} />
                <span className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={flip ? 'lg:order-1' : ''}>
          {data.shot ? <ShotFrame {...data.shot} /> : Vignette ? <Vignette /> : null}
        </div>
      </Reveal>
    </section>
  )
}

// ─── Halaman ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  const navLinks = [
    { href: '#fitur', label: 'Fitur' },
    ...(BILLING_ENABLED ? [{ href: '#harga', label: 'Harga' }] : []),
    { href: '#faq', label: 'FAQ' },
    { href: '/about', label: 'Tentang' },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      {/* ─── NAV ─── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 sm:px-12 py-4 border-b backdrop-blur"
        style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}
      >
        <Link href="/" aria-label="Klunting">
          <KluntingLogo size={26} />
        </Link>

        <nav className="hidden md:flex gap-7 text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-[var(--ink)] transition-colors motion-reduce:transition-none">{l.label}</a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <Link href="/login" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-[var(--surface-2)] transition-colors motion-reduce:transition-none" style={{ color: 'var(--ink)' }}>Masuk</Link>
            <Link href="/register" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90 motion-reduce:transition-none" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
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

      {/* ─── HERO ─── vertikal: headline di atas, product shot penuh di bawah */}
      <section className="px-6 sm:px-12 pt-14 sm:pt-20 pb-0">
        <div className="max-w-3xl mx-auto text-center">
          <p className="inline-flex items-center gap-2.5 text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: 'var(--ink-soft)' }}>
            <KluntingMark size={16} />
            Aplikasi keuangan pribadi untuk Indonesia
          </p>
          <h1 className="mt-5 tracking-tight" style={{ fontSize: 'clamp(38px, 6vw, 68px)', lineHeight: 1.02, letterSpacing: '-0.035em', fontWeight: 800, color: 'var(--ink)' }}>
            Semua uangmu,<br />satu angka.
          </h1>
          <p className="mt-6 text-lg leading-relaxed max-w-xl mx-auto" style={{ color: 'var(--ink-muted)' }}>
            Rekening, saham, properti, sampai utang — dirangkum jadi net worth yang diperbarui
            tiap hari. Lalu alat untuk memahaminya: riset saham IDX, anggaran gaya spreadsheet,
            dan arus kas yang bisa ditelusuri.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 items-center justify-center">
            <Link href="/register" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-[15px] font-semibold transition hover:opacity-90 motion-reduce:transition-none" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
              Coba gratis 21 hari <ArrowRight className="size-4" />
            </Link>
            <Link href="/features" className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl text-[15px] font-medium border transition hover:bg-[var(--surface-2)] motion-reduce:transition-none" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}>
              Lihat fitur
            </Link>
          </div>
          <p className="mt-5 text-[12.5px]" style={{ color: 'var(--ink-soft)' }}>
            Tanpa kartu kredit · Berhenti kapan saja · Datamu bisa diekspor seluruhnya
          </p>
        </div>

        {/* Product shot penuh — jujur, tanpa chrome palsu */}
        <div className="max-w-6xl mx-auto mt-12 sm:mt-16">
          <ShotFrame
            src="/hero-dashboard.webp"
            alt="Dashboard Klunting: net worth Rp 2,42 M dengan grafik pertumbuhan, ringkasan harian, dan skor kesehatan finansial"
            w={1760} h={1226} priority
          />
        </div>
      </section>

      {/* ─── STRIP ANGKA ─── kapabilitas nyata (angka terverifikasi dari kode:
          valuations.json = 1.004 ticker; METHOD_ORDER = 13; net-worth = 6 kelas).
          Jangan dinaikkan tanpa cek ulang sumber. */}
      <section className="px-6 sm:px-12 mt-14 sm:mt-20 py-10 border-y" style={{ borderColor: 'var(--border-soft)' }}>
        <Reveal className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8">
          {([
            { n: 1004, label: 'emiten IDX siap diriset' },
            { n: 13, label: 'metode valuasi per saham' },
            { n: 6, label: 'kelas aset dalam satu net worth' },
          ] as const).map((s) => (
            <div key={s.label}>
              <p className="num font-bold" style={{ fontSize: 'clamp(28px, 2.8vw, 36px)', letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--ink)' }}>
                <CountUp value={s.n} />
              </p>
              <p className="text-[13.5px] mt-2" style={{ color: 'var(--ink-muted)' }}>{s.label}</p>
            </div>
          ))}
          <div>
            <p className="font-bold" style={{ fontSize: 'clamp(28px, 2.8vw, 36px)', letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--ink)' }}>CSV</p>
            <p className="text-[13.5px] mt-2" style={{ color: 'var(--ink-muted)' }}>ekspor seluruh datamu, kapan saja</p>
          </div>
        </Reveal>
      </section>

      {/* ─── ENAM BAB FITUR ─── penjelasan detil per fitur, berselang-seling */}
      <div id="fitur">
        {CHAPTERS.map((c, i) => (
          <Chapter key={c.kicker} data={c} flip={i % 2 === 1} />
        ))}
      </div>

      {/* ─── KELUARGA + KEAMANAN ─── dua hal terakhir yang orang tanyakan,
          disajikan tipografis (tanpa kartu). */}
      <section className="px-6 sm:px-12 py-14 sm:py-20" style={{ background: 'var(--bg-2)' }}>
        <Reveal className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          <div>
            <p className="flex items-center gap-2.5">
              <Users className="size-4" style={{ color: 'var(--c-violet-ink)' }} />
              <span className="text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: 'var(--c-violet-ink)' }}>Keluarga</span>
            </p>
            <h2 className="mt-4 font-bold tracking-tight" style={{ fontSize: 'clamp(22px, 2.6vw, 30px)', letterSpacing: '-0.02em', color: 'var(--ink)' }}>
              Uang keluarga, tanpa saling tanya saldo.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              Sampai 5 anggota berbagi tujuan, anggaran, dan dompet bersama — sementara pengeluaran
              pribadi tetap privat. Net worth gabungan keluarga terlihat dalam satu tempat, tanpa
              grup chat “transfer berapa tadi?”.
            </p>
          </div>
          <div>
            <p className="flex items-center gap-2.5">
              <Shield className="size-4" style={{ color: 'var(--c-mint-ink)' }} />
              <span className="text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: 'var(--c-mint-ink)' }}>Keamanan</span>
            </p>
            <h2 className="mt-4 font-bold tracking-tight" style={{ fontSize: 'clamp(22px, 2.6vw, 30px)', letterSpacing: '-0.02em', color: 'var(--ink)' }}>
              Membosankan justru di sini bagusnya.
            </h2>
            <ul className="mt-4 space-y-2.5 text-[14.5px]" style={{ color: 'var(--ink-muted)' }}>
              <li className="flex items-start gap-2.5"><Lock className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--ink-soft)' }} /> Enkripsi TLS di tiap koneksi; password di-hash — tim kami pun tak bisa membacanya</li>
              <li className="flex items-start gap-2.5"><Database className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--ink-soft)' }} /> Data antar pengguna terisolasi di level database (Row Level Security); 2FA &amp; PIN perangkat tersedia</li>
              <li className="flex items-start gap-2.5"><EyeOff className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--ink-soft)' }} /> Tanpa iklan; datamu tidak dijual — kamu membayar untuk alatnya, bukan menjadi produknya</li>
              <li className="flex items-start gap-2.5"><Scale className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--ink-soft)' }} /> Kami tidak menjual produk investasi apa pun — murni alat catat &amp; analisis, tanpa konflik kepentingan</li>
            </ul>
          </div>
        </Reveal>
      </section>

      {/* ─── HARGA ─── (beku selama billing OFF) */}
      {BILLING_ENABLED && <PricingSection />}

      {/* ─── CATATAN PEMBUAT ─── jujur, tanpa nama/foto/testimoni palsu */}
      <section className="px-6 sm:px-12 py-14 sm:py-20">
        <Reveal className="max-w-2xl mx-auto text-center">
          <KluntingMark size={22} className="mx-auto" />
          <p className="mt-6 text-lg sm:text-xl leading-relaxed font-medium" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            Klunting dibangun karena kami membutuhkannya sendiri — dan sampai sekarang dipakai
            setiap hari untuk keuangan keluarga. Tanpa iklan, tanpa menjual data, tanpa menjual
            produk investasi.
          </p>
          <p className="mt-3 text-[13px]" style={{ color: 'var(--ink-soft)' }}>— pembuat Klunting</p>
        </Reveal>
      </section>

      {/* ─── FAQ ─── editorial: daftar hairline, tanpa kartu */}
      <section id="faq" className="px-6 sm:px-12 py-14 sm:py-20" style={{ background: 'var(--surface)' }}>
        <Reveal className="max-w-3xl mx-auto">
          <h2 className="font-bold tracking-tight" style={{ fontSize: 'clamp(26px, 3.4vw, 38px)', letterSpacing: '-0.025em', color: 'var(--ink)' }}>
            Pertanyaan yang sering diajukan.
          </h2>
          <p className="mt-2 text-[14.5px]" style={{ color: 'var(--ink-muted)' }}>
            Tidak ketemu jawabannya? <a href="mailto:support@klunting.com" className="font-medium underline" style={{ color: 'var(--ink)' }}>support@klunting.com</a>
          </p>

          <div className="mt-8">
            {[
              { q: 'Seberapa aman data finansialku?', a: 'Seluruh komunikasi browser ke server dienkripsi TLS. Password disimpan sebagai hash satu-arah (bcrypt) sehingga tim Klunting pun tidak dapat membacanya. Database memakai Row Level Security, jadi data antar pengguna terisolasi di level engine. Foto struk hanya dapat diakses pemiliknya. Tidak ada iklan dan data tidak dijual. Tersedia juga 2FA dan PIN perangkat di pengaturan Keamanan.' },
              { q: 'Apakah aku perlu memberi password mobile banking?', a: 'Tidak. Klunting tidak terhubung langsung ke rekening bank. Kami hanya menyimpan data yang kamu input atau unggah manual: foto struk (dibaca AI), input bahasa biasa, atau unggah PDF mutasi untuk diproses.' },
              { q: 'AI-nya memakai apa, dan ke mana data dikirim?', a: 'Fitur AI memakai Claude dari Anthropic. Yang dikirim hanya teks atau gambar struk yang kamu berikan; Anthropic tidak menyimpannya untuk melatih model. Detail ada di Kebijakan Privasi.' },
              { q: 'Apa yang terjadi pada dataku jika berhenti berlangganan?', a: 'Trial dapat dihentikan kapan saja tanpa potongan. Setelah berhenti, akun beralih ke mode hanya-baca hingga akhir periode. Kamu dapat mengekspor seluruh data ke CSV, lalu menghapus akun dari Profil; data disimpan 30 hari sebelum dihapus permanen.' },
              { q: 'Bisakah aku mengekspor seluruh transaksi?', a: 'Bisa. Di halaman Transaksi, pilih Export CSV — berkas terunduh langsung dan bisa dibuka di Excel, Google Sheets, atau aplikasi lain. Datamu milikmu.' },
              { q: 'Apa bedanya dengan aplikasi keuangan lain?', a: 'Tiga hal: konteks Indonesia (kategori, Rupiah, IDX); kedalaman investasi (riset 1.000+ emiten dengan 13 metode valuasi dan struktur kepemilikan) yang jarang ada di aplikasi pencatatan; serta keseriusan di desktop — screener, keyboard, tabel kerja.' },
              { q: 'Aku tinggal di luar negeri tapi punya rekening Indonesia, bisa?', a: 'Bisa. Klunting berbasis web dan dapat diakses dari mana saja, mendukung multi-mata uang (IDR, USD, SGD, EUR), dan pembacaan struk dalam Bahasa Indonesia maupun Inggris.' },
              { q: 'Apakah ada paket gratis?', a: 'Belum. Saat ini fokusnya trial 21 hari akses penuh tanpa kartu, lalu pilih paket: Pro Rp 149.000/tahun (atau Rp 19.000/bulan) dan Max Rp 299.000/tahun (atau Rp 35.000/bulan).' },
              { q: 'Bisakah dipakai bersama keluarga?', a: 'Bisa, melalui paket Max. Hingga 5 anggota dapat mengakses tujuan, anggaran, dan dompet bersama, dengan tetap memisahkan pengeluaran pribadi bila diinginkan.' },
              { q: 'Kapan ada aplikasi mobile?', a: 'Klunting adalah PWA — dapat dipasang di layar utama iPhone/Android tanpa unduh dari store (buka di Safari/Chrome → "Tambah ke Layar Utama"). Pengalamannya seperti aplikasi native, termasuk akses kamera untuk foto struk.' },
            ].map((item, i) => (
              <details key={i} className="group border-t" style={{ borderColor: 'var(--border-soft)' }}>
                <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none select-none" style={{ color: 'var(--ink)' }}>
                  <span className="text-[15.5px] font-semibold pr-2" style={{ letterSpacing: '-0.01em' }}>{item.q}</span>
                  <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" style={{ color: 'var(--ink-soft)' }} />
                </summary>
                <div className="pb-6 text-[14.5px] leading-relaxed max-w-[62ch]" style={{ color: 'var(--ink-muted)' }}>{item.a}</div>
              </details>
            ))}
            <div className="border-t" style={{ borderColor: 'var(--border-soft)' }} />
          </div>
        </Reveal>
      </section>

      {/* ─── FINALE ─── satu-satunya band gelap: pernyataan penutup */}
      <section
        className="px-6 sm:px-12 py-20 sm:py-28"
        style={{ background: 'linear-gradient(165deg, var(--hero-bg) 0%, var(--hero-mid) 55%, var(--hero-soft) 100%)' }}
      >
        <Reveal className="max-w-3xl mx-auto text-center">
          <KluntingMark size={30} className="mx-auto" />
          <h2 className="mt-7 font-bold tracking-tight" style={{ fontSize: 'clamp(30px, 4.6vw, 52px)', lineHeight: 1.06, letterSpacing: '-0.03em', color: 'var(--on-hero)' }}>
            Mulai malam ini.<br />Besok pagi kamu sudah tahu angkamu.
          </h2>
          <p className="mt-5 text-base max-w-md mx-auto" style={{ color: 'var(--on-hero-mut)' }}>
            21 hari akses penuh. Tanpa kartu kredit. Berhenti kapan saja — datamu ikut kamu.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-semibold mt-8 transition hover:opacity-90 motion-reduce:transition-none"
            style={{ background: 'var(--on-hero)', color: 'var(--hero-bg)' }}
          >
            Coba gratis 21 hari <ArrowRight className="size-4" />
          </Link>
        </Reveal>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t px-6 sm:px-12 py-12" style={{ borderColor: 'var(--border-soft)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="col-span-2 lg:col-span-1">
              <KluntingLogo size={22} />
              <p className="text-[13px] mt-3 leading-relaxed max-w-xs" style={{ color: 'var(--ink-muted)' }}>
                Semua uangmu, satu angka. Dibuat dan dioperasikan di Indonesia.
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>Produk</p>
              <div className="mt-3 flex flex-col gap-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
                <Link href="/features" className="hover:text-[var(--ink)] transition-colors">Fitur</Link>
                {BILLING_ENABLED && <a href="#harga" className="hover:text-[var(--ink)] transition-colors">Harga</a>}
                <a href="#faq" className="hover:text-[var(--ink)] transition-colors">FAQ</a>
                <Link href="/about" className="hover:text-[var(--ink)] transition-colors">Tentang</Link>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>Bantuan</p>
              <div className="mt-3 flex flex-col gap-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
                <Link href="/contact" className="hover:text-[var(--ink)] transition-colors">Hubungi Kami</Link>
                <a href="mailto:support@klunting.com" className="hover:text-[var(--ink)] transition-colors">support@klunting.com</a>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>Legal</p>
              <div className="mt-3 flex flex-col gap-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
                <Link href="/terms" className="hover:text-[var(--ink)] transition-colors">Syarat Layanan</Link>
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
