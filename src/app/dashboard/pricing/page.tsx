'use client'

import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sparkles, Crown, Users, Check, ShieldCheck, RefreshCcw,
} from 'lucide-react'

// Paid-only, annual billing. NOTE: checkout is still a placeholder (no payment
// gateway yet) — see Roadmap Fase 2. Trial/paywall enforcement ships WITH the
// payment gateway; this page is display-only for now.
interface Plan {
  id: 'pro' | 'max'
  name: string
  icon: React.ReactNode
  popular: boolean
  price_idr: number
  original_price_idr: number
  seats: number
  ai_credits_monthly: number
  description: string
  features: string[]
}

const PLANS: Plan[] = [
  {
    id: 'pro',
    name: 'Pro',
    icon: <Crown className="size-5" />,
    popular: true,
    price_idr: 149000,
    original_price_idr: 249000,
    seats: 1,
    ai_credits_monthly: 100,
    description: 'Buat kamu yang serius atur keuangan & investasi.',
    features: [
      'Catat transaksi & anggaran unlimited',
      'Dashboard net worth + KPI',
      'Portfolio investasi: saham IDX, crypto, reksadana, emas, properti',
      'AI Advisor — tanya apa aja soal keuanganmu',
      'Scan struk (AI Vision) → otomatis jadi transaksi',
      'AI insights & laporan bulanan',
      'Goal setting + forecast probabilitas',
      'Import mutasi rekening (CSV/PDF)',
      'Update harga saham & crypto otomatis',
      '100 kredit AI / bulan',
    ],
  },
  {
    id: 'max',
    name: 'Max',
    icon: <Users className="size-5" />,
    popular: false,
    price_idr: 299000,
    original_price_idr: 499000,
    seats: 5,
    ai_credits_monthly: 300,
    description: 'Buat keluarga — kelola keuangan bareng pasangan & anggota.',
    features: [
      'Semua fitur Pro',
      'Household sharing sampai 5 anggota',
      'Wallet & budget bersama keluarga',
      'Tracking per-anggota (siapa belanja apa)',
      'Insight pengeluaran keluarga',
      '300 kredit AI / bulan',
    ],
  },
]

const CREDIT_PACKS = [
  { credits: 100, price: 15000, label: '100 kredit', perCredit: 150 },
  { credits: 300, price: 39000, label: '300 kredit', perCredit: 130, popular: true },
  { credits: 1000, price: 99000, label: '1000 kredit', perCredit: 99 },
]

const THEMES: Record<Plan['id'], { bg: string; ring: string; accent: string; cta: string }> = {
  pro: {
    bg: 'bg-[var(--c-primary-soft)]', ring: 'ring-[var(--c-primary)]', accent: 'text-[var(--c-primary)]',
    cta: 'bg-[var(--c-primary)] text-[var(--c-primary-foreground)] hover:opacity-90',
  },
  max: {
    bg: 'bg-[var(--surface)]', ring: 'ring-[var(--line)]', accent: 'text-[var(--ink-muted)]',
    cta: 'bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--surface-3)]',
  },
}

function perMonth(annual: number) {
  return Math.round(annual / 12)
}

export default function PricingPage() {
  function handleUpgrade(planId: string) {
    alert(
      `Pembayaran via Xendit/Midtrans akan segera hadir. Untuk early access ke ${planId.toUpperCase()}, hubungi support@klunting.com.`,
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4"
          style={{ background: 'var(--c-mint-soft)', color: 'var(--c-mint)' }}
        >
          <span className="size-1.5 rounded-full" style={{ background: 'var(--c-mint)' }} />
          <span className="text-xs font-semibold">Trial 14 hari · Tanpa kartu kredit</span>
        </div>
        <h1
          className="font-bold tracking-tight"
          style={{ fontSize: 'clamp(32px, 4.5vw, 52px)', color: 'var(--ink)', lineHeight: 1.1, letterSpacing: '-0.035em' }}
        >
          Pilih paket yang{' '}
          <span style={{ color: 'var(--c-mint)' }}>cocok</span>{' '}
          buat kebutuhanmu.
        </h1>
        <p className="text-base mt-4 max-w-xl mx-auto" style={{ color: 'var(--ink-muted)' }}>
          Billing <strong>tahunan</strong>, tanpa auto-renew. Coba 14 hari gratis dulu — tanpa kartu kredit.
        </p>
      </div>

      {/* 2-tier cards */}
      <div className="grid gap-5 md:grid-cols-2 max-w-4xl mx-auto">
        {PLANS.map((plan) => {
          const theme = THEMES[plan.id]
          const discountPct = Math.round((1 - plan.price_idr / plan.original_price_idr) * 100)
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl ${theme.bg} p-6 ring-1 ${theme.ring} ${plan.popular ? 'shadow-lg lg:scale-105' : 'shadow-sm'} transition`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow">
                  Paling Populer
                </div>
              )}

              <div className={`flex items-center gap-2 ${theme.accent}`}>
                {plan.icon}
                <h3 className="text-xl font-bold">{plan.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>

              <div className="mt-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-muted-foreground line-through">{formatCurrency(plan.original_price_idr)}</span>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">-{discountPct}%</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{formatCurrency(plan.price_idr)}</span>
                  <span className="text-sm text-muted-foreground">/tahun</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ {formatCurrency(perMonth(plan.price_idr))}/bulan · ditagih tahunan
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleUpgrade(plan.id)}
                className={`mt-5 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${theme.cta}`}
              >
                {plan.icon}
                Pilih {plan.name}
              </button>

              {plan.seats > 1 && (
                <p className="text-xs text-center mt-2 text-[var(--c-mint)] font-medium inline-flex items-center justify-center gap-1 w-full">
                  <Users className="size-3.5 shrink-0" /> Sampai {plan.seats} anggota keluarga
                </p>
              )}

              <div className="mt-6 space-y-2.5 flex-1">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Check className={`size-4 mt-0.5 shrink-0 ${theme.accent}`} />
                    <span className="text-foreground/90">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-4 border-t border-current/10">
                <p className="text-xs text-center font-medium text-amber-700 inline-flex items-center justify-center gap-1 w-full">
                  <Sparkles className="size-3" />
                  {plan.ai_credits_monthly} kredit AI gratis setiap bulan
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Feature comparison */}
      <section className="rounded-2xl border bg-[var(--surface)] p-6">
        <h3 className="font-semibold text-lg mb-4">Bandingkan paket</h3>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 font-medium text-muted-foreground">Fitur</th>
                <th className="text-center py-3 font-medium">Pro</th>
                <th className="text-center py-3 font-medium">Max</th>
              </tr>
            </thead>
            <tbody>
              {[
                { f: 'Catat transaksi & anggaran unlimited', pro: true, max: true },
                { f: 'Dashboard net worth + KPI', pro: true, max: true },
                { f: 'Portfolio investasi (saham, crypto, dll)', pro: true, max: true },
                { f: 'AI Advisor + scan struk', pro: true, max: true },
                { f: 'AI insights & laporan bulanan', pro: true, max: true },
                { f: 'Import mutasi rekening', pro: true, max: true },
                { f: 'Goal setting & forecast', pro: true, max: true },
                { f: 'Export CSV', pro: true, max: true },
                { f: 'Household sharing', pro: false, max: true },
                { f: 'Anggota keluarga', pro: '1', max: '5' },
                { f: 'Wallet & budget bersama', pro: false, max: true },
                { f: 'Tracking per-anggota', pro: false, max: true },
                { f: 'Kredit AI bulanan', pro: '100', max: '300' },
              ].map((row, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="py-2.5 text-foreground/90">{row.f}</td>
                  <td className="text-center">{renderCell(row.pro)}</td>
                  <td className="text-center">{renderCell(row.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* AI Credits Top-up (separate from subscription) */}
      <section className="rounded-2xl border bg-gradient-to-br from-amber-50 to-orange-50 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-white p-2.5 shadow-sm">
            <Sparkles className="size-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Top Up Kredit AI</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Habis kredit di tengah bulan? Beli ekstra. Berlaku selamanya, ga expired.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.credits}
              className={`relative rounded-xl border bg-[var(--surface)] p-4 ${pack.popular ? 'ring-2 ring-amber-400' : ''}`}
            >
              {pack.popular && (
                <span className="absolute -top-2 right-3 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  HEMAT
                </span>
              )}
              <p className="text-sm text-muted-foreground">{pack.label}</p>
              <p className="text-2xl font-bold mt-1 tabular-nums">{formatCurrency(pack.price)}</p>
              <p className="text-xs text-muted-foreground mt-1">≈ Rp {pack.perCredit}/kredit</p>
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-3"
                onClick={() => alert('Top-up via Midtrans akan segera hadir.')}
              >
                Beli
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          1 kredit = 1 percakapan AI Advisor atau 1 scan struk.
        </p>
      </section>

      {/* Trust signals */}
      <section className="rounded-2xl border bg-[var(--surface)] p-6">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="size-5 text-[var(--c-mint)] mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Pembayaran Aman</p>
              <p className="text-xs text-muted-foreground mt-0.5">Lewat Xendit/Midtrans. Kami tidak menyimpan data kartumu.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RefreshCcw className="size-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Tanpa Auto-Renew</p>
              <p className="text-xs text-muted-foreground mt-0.5">Kamu pegang kendali. Kami kirim notif sebelum masa langganan habis.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="size-5 mt-0.5" style={{ color: 'var(--sky-600)' }} />
            <div>
              <p className="font-semibold text-sm">Data Tetap Milikmu</p>
              <p className="text-xs text-muted-foreground mt-0.5">Export semua data sebagai CSV kapan saja — no lock-in.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="rounded-2xl border bg-[var(--surface)] p-6">
        <h3 className="font-semibold text-lg mb-4">Pertanyaan Umum</h3>
        <div className="space-y-4 text-sm">
          <Faq q="Kenapa billing tahunan?" a="Lebih hemat (Pro setara ~Rp 12rb/bulan) dan kamu nggak perlu mikirin tagihan tiap bulan. Tanpa auto-renew — kami kirim notifikasi sebelum masa langganan habis, dan kamu yang putuskan untuk perpanjang." />
          <Faq q="Trial 14 hari itu gimana?" a="Setiap user baru otomatis dapat akses penuh selama 14 hari, tanpa kartu kredit. Setelah trial habis, kamu pilih paket Pro atau Max untuk lanjut." />
          <Faq q="Apa beda Pro dan Max?" a="Pro untuk individu — semua fitur tracking, portfolio investasi, AI Advisor, scan struk, dan laporan. Max untuk keluarga — semua fitur Pro + household sharing sampai 5 anggota, wallet & budget bersama, dan kredit AI lebih banyak (300/bulan vs 100/bulan)." />
          <Faq q="Bagaimana sistem AI credit?" a="Setiap kali pakai fitur AI (scan struk, chat AI Advisor, generate insight/laporan), kredit dipotong. Pro dapat 100 kredit/bulan, Max 300/bulan. Kalau habis, bisa top-up terpisah (paket di atas) — berlaku selamanya." />
          <Faq q="Pembayarannya gimana?" a="Segera hadir lewat Xendit/Midtrans: QRIS, e-wallet (GoPay/OVO/DANA), transfer bank, virtual account, dan kartu. Sementara ini, hubungi support untuk early access." />
          <Faq q="Bisa upgrade dari Pro ke Max?" a="Bisa kapan saja. Kamu cuma bayar selisihnya, dihitung proporsional dari sisa hari langganan." />
          <Faq q="Data saya aman?" a="Aman. Database di Supabase (Asia Pacific), enkripsi at-rest & in-transit, isolasi per-user via Row Level Security. Tidak ada iklan, tidak dijual ke pihak ketiga." />
        </div>
      </section>

      <p className="text-center text-sm text-muted-foreground">
        Ada pertanyaan? <Link href="mailto:support@klunting.com" className="font-medium text-foreground hover:underline">Hubungi kami</Link>
      </p>
    </div>
  )
}

function renderCell(v: boolean | string) {
  if (typeof v === 'string') return <span className="font-medium tabular-nums">{v}</span>
  return v
    ? <Check className="size-4 mx-auto text-[var(--c-mint)]" />
    : <span className="text-muted-foreground/40">—</span>
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-lg border border-muted bg-muted/20 p-3">
      <summary className="cursor-pointer font-medium list-none flex items-center justify-between">
        {q}
        <span className="text-muted-foreground transition group-open:rotate-180">▾</span>
      </summary>
      <p className="mt-2 text-muted-foreground leading-relaxed">{a}</p>
    </details>
  )
}
