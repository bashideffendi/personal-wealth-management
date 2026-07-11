/**
 * Klunting — Landing (root /). v4 COPY MINIMAL (2026-07-11, arahan user:
 * "copywriting bodoh semua diganti; minimalis, ringkas, informatif, cantik" —
 * pemicu: finale v3 "Mulai malam ini..." berasumsi jam akses pembaca).
 *
 * Aturan copy v4 (hasil panel 3 penulis + 2 juri):
 *  - DILARANG asumsi waktu/situasi pembaca, melodrama, metafora maksa.
 *  - Lead bab = SATU kalimat; spec 3 butir pendek; klaim = fakta produk.
 *  - Jangan ulang klaim/angka yang sama antar section.
 *
 * Struktur: Hero vertikal (headline → product shot penuh) · strip angka ·
 * ENAM BAB fitur berselang-seling (visual + lead 1 kalimat + 3 spec) ·
 * keluarga+keamanan · harga (gated) · FAQ editorial · finale gelap.
 * Long-form ala Linear/Stripe — BUKAN grid kartu.
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
import { AiEntryVignette, BudgetVignette, KeyboardVignette, NetWorthVignette } from '@/components/landing/vignettes'
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
  vignette?: 'ai' | 'budget' | 'keyboard' | 'networth'
}

const CHAPTERS: ChapterData[] = [
  {
    kicker: 'Kekayaan bersih', color: 'var(--c-mint)', ink: 'var(--c-mint-ink)',
    title: 'Naik atau turun, kamu tahu.',
    lead: 'Snapshot direkam setiap hari — selisih terhadap bulan lalu dihitung dari catatan, bukan perkiraan.',
    specs: [
      'Kas, saham, reksa dana, emas, properti, kendaraan',
      'Properti tampil di peta, lengkap dengan apresiasinya',
      'Nilai kendaraan menyusut otomatis',
    ],
    // networth.webp lama = strip 1600×317 (band hero doang, dobel dengan shot
    // hero di atasnya) — kelihatan hilang di kolom bab. Diganti vignette
    // komposisi kelas aset yang justru menggambarkan spec bab ini.
    vignette: 'networth',
  },
  {
    kicker: 'Riset saham IDX', color: 'var(--c-blue)', ink: 'var(--c-blue-ink)',
    title: 'Nilai wajar, bukan kata orang.',
    lead: 'Dari DCF sampai formula Graham — nilai wajar (fair value) konsensus dan margin of safety tiap emiten.',
    specs: [
      'Screener seluruh bursa: PER, PBV, ROE, dividend yield, market cap',
      'Bandingkan 4 emiten: valuasi, skor Piotroski, tren 10 tahun',
      'Struktur kepemilikan ditelusuri sampai pemilik akhir',
    ],
    shot: { src: '/features/research.webp', alt: 'Halaman riset saham Klunting: nilai wajar konsensus, margin of safety, dan rincian metode valuasi sebuah emiten IDX', w: 1600, h: 900 },
  },
  {
    kicker: 'Anggaran & arus kas', color: 'var(--c-violet)', ink: 'var(--c-violet-ink)',
    title: 'Isi sel, tarik sampai Desember.',
    lead: 'Grid 12 bulan dengan drag-fill ala Excel — rencana dan realisasi selalu berdampingan.',
    specs: [
      'Diagram Sankey memetakan pemasukan sampai pengeluaran',
      'Auto-kategorisasi belajar dari setiap koreksimu',
      'Laporan bulanan siap cetak',
    ],
    vignette: 'budget',
  },
  {
    kicker: 'Catat dengan AI', color: 'var(--c-coral)', ink: 'var(--c-coral-ink)',
    title: 'Ketik seperti kamu bicara.',
    lead: '“kopi 25rb pake gopay” — jumlah, kategori, dan akun terisi sendiri.',
    specs: [
      'Foto struk terbaca otomatis',
      'Impor mutasi bank PDF/CSV, duplikat terdeteksi',
      'Offline pun tetap tercatat, tersinkron saat online',
    ],
    vignette: 'ai',
  },
  {
    kicker: 'Utang & tujuan', color: 'var(--c-mint)', ink: 'var(--c-mint-ink)',
    title: 'Kapan lunas, seberapa mungkin tercapai.',
    lead: 'Semua cicilan dan kartu kredit dalam satu daftar, plus meter debt-to-income — rasio utang terhadap penghasilan.',
    specs: [
      'Proyeksi lunas avalanche vs snowball, termasuk selisih bunga',
      'Simulasi Monte Carlo menghitung peluang tiap tujuan',
      'Piramida prioritas: dana darurat lebih dulu',
    ],
    shot: { src: '/features/debts.webp', alt: 'Halaman Utang Klunting: daftar cicilan dengan proyeksi pelunasan dan meter debt-to-income', w: 1600, h: 900 },
  },
  {
    kicker: 'Desktop', color: 'var(--ink)', ink: 'var(--ink)',
    title: 'Keyboard dulu, mouse belakangan.',
    lead: 'Navigasi penuh lewat keyboard, dari command palette sampai peek panel.',
    specs: [
      'Ctrl/⌘K memanggil fitur apa pun',
      'Peek panel: periksa isi baris tanpa pindah halaman',
      'Simpan filter dan urutan kolom sebagai tampilan siap pakai',
    ],
    vignette: 'keyboard',
  },
]

const VIGNETTES = { ai: AiEntryVignette, budget: BudgetVignette, keyboard: KeyboardVignette, networth: NetWorthVignette } as const

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
            Pencatat kekayaan pribadi untuk Indonesia
          </p>
          <h1 className="mt-5 tracking-tight" style={{ fontSize: 'clamp(38px, 6vw, 68px)', lineHeight: 1.02, letterSpacing: '-0.035em', fontWeight: 800, color: 'var(--ink)' }}>
            Semua uangmu,<br />satu angka.
          </h1>
          <p className="mt-6 text-lg leading-relaxed max-w-xl mx-auto" style={{ color: 'var(--ink-muted)' }}>
            Aset, utang, anggaran, dan riset saham IDX — semuanya dalam satu aplikasi.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 items-center justify-center">
            <Link href="/register" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-[15px] font-semibold transition hover:opacity-90 motion-reduce:transition-none" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
              Coba gratis 21 hari <ArrowRight className="size-4" />
            </Link>
            <a href="#fitur" className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl text-[15px] font-medium border transition hover:bg-[var(--surface-2)] motion-reduce:transition-none" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}>
              Lihat fitur
            </a>
          </div>
          <p className="mt-5 text-[12.5px]" style={{ color: 'var(--ink-soft)' }}>
            Tanpa kartu kredit · Tanpa akses ke rekening bankmu · Berhenti kapan saja
          </p>
        </div>

        {/* Product shot penuh — jujur, tanpa chrome palsu */}
        <div className="max-w-6xl mx-auto mt-12 sm:mt-16">
          <ShotFrame
            src="/hero-dashboard.webp"
            alt="Dashboard Klunting: kekayaan bersih Rp 2,42 M dengan grafik pertumbuhan, ringkasan harian, dan skor kesehatan finansial"
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
            { n: 1004, label: 'emiten IDX dalam basis data' },
            { n: 13, label: 'metode valuasi per emiten' },
            { n: 6, label: 'kelas aset dalam satu neraca' },
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
            <p className="text-[13.5px] mt-2" style={{ color: 'var(--ink-muted)' }}>ekspor penuh, semua datamu</p>
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
              Uang bersama, catatan masing-masing.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              Sampai 5 anggota berbagi tujuan, anggaran, dan dompet — pengeluaran pribadi
              tetap privat, kekayaan bersih gabungan tetap kelihatan.
            </p>
          </div>
          <div>
            <p className="flex items-center gap-2.5">
              <Shield className="size-4" style={{ color: 'var(--c-mint-ink)' }} />
              <span className="text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: 'var(--c-mint-ink)' }}>Keamanan</span>
            </p>
            <h2 className="mt-4 font-bold tracking-tight" style={{ fontSize: 'clamp(22px, 2.6vw, 30px)', letterSpacing: '-0.02em', color: 'var(--ink)' }}>
              Datamu tetap milikmu.
            </h2>
            <ul className="mt-4 space-y-2.5 text-[14.5px]" style={{ color: 'var(--ink-muted)' }}>
              <li className="flex items-start gap-2.5"><Lock className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--ink-soft)' }} /> Enkripsi TLS; password di-hash; 2FA dan PIN perangkat</li>
              <li className="flex items-start gap-2.5"><Database className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--ink-soft)' }} /> Data antar pengguna terisolasi di level database (Row Level Security)</li>
              <li className="flex items-start gap-2.5"><EyeOff className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--ink-soft)' }} /> Tanpa iklan; datamu tidak dijual</li>
              <li className="flex items-start gap-2.5"><Scale className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--ink-soft)' }} /> Tidak menjual produk investasi apa pun</li>
            </ul>
          </div>
        </Reveal>
      </section>

      {/* ─── HARGA ─── (beku selama billing OFF) */}
      {BILLING_ENABLED && <PricingSection />}

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
              { q: 'Apakah Klunting terhubung ke rekening bank?', a: 'Tidak — semua data diinput manual atau lewat unggahan, jadi tidak ada kredensial bank yang kamu serahkan. Mutasi bank cukup diimpor sebagai PDF atau CSV.' },
              // Item harga ikut gate BILLING_ENABLED — selama billing beku,
              // halaman tidak boleh menjawab harga yang tombol belinya tak ada.
              ...(BILLING_ENABLED ? [
                { q: 'Berapa harganya?', a: 'Pro Rp 149 ribu per tahun atau Rp 19 ribu per bulan; Max Rp 299 ribu per tahun atau Rp 35 ribu per bulan. Selama masa coba 21 hari tidak ada tagihan apa pun.' },
                { q: 'Apa beda Pro dan Max?', a: 'Max membuka fitur keluarga hingga 5 anggota dengan kekayaan bersih gabungan; Pro untuk pemakaian satu orang.' },
              ] : []),
              { q: 'AI-nya pakai model apa?', a: 'Claude dari Anthropic. Inputmu tidak dipakai untuk melatih model.' },
              { q: 'Apakah hasil valuasinya rekomendasi beli?', a: 'Bukan — nilai wajar dan margin of safety adalah alat analisis, bukan saran transaksi. Keputusan tetap di tanganmu.' },
              { q: 'Bisa dipakai di iPhone dan Android?', a: 'Bisa — Klunting terpasang langsung dari browser (PWA), tanpa lewat app store, dan tetap berfungsi offline.' },
              { q: 'Mendukung mata uang selain rupiah?', a: 'Ya — USD, SGD, dan EUR, di samping IDR.' },
              { q: 'Kalau berhenti berlangganan, dataku bagaimana?', a: 'Akun beralih ke mode hanya-baca dan seluruh data bisa diekspor sebagai CSV. Kalau akun dihapus, seluruh datamu terhapus permanen setelah 30 hari.' },
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
            Ukur dulu.<br />Baru putuskan.
          </h2>
          <p className="mt-5 text-base max-w-md mx-auto" style={{ color: 'var(--on-hero-mut)' }}>
            Akses penuh sejak hari pertama.
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
                Catat, hitung, putuskan. Dibuat dan dioperasikan di Indonesia.
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
