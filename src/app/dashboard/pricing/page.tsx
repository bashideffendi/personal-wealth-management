'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sparkles, Crown, Users, Check, Zap, Loader2, ShieldCheck,
} from 'lucide-react'

interface Plan {
  id: string
  name: string
  description: string
  price_idr: number
  original_price_idr: number | null
  max_seats: number
  features: string[]
  ai_credits_monthly: number
  is_popular: boolean
  display_order: number
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  basic: <Sparkles className="size-5" />,
  full:  <Crown className="size-5" />,
}

const PLAN_THEMES: Record<string, { bg: string; ring: string; accent: string; price: string; cta: string; ctaHover: string }> = {
  basic: { bg: 'bg-[var(--surface)]', ring: 'ring-[var(--line)]', accent: 'text-[var(--ink-muted)]', price: 'text-[var(--ink)]', cta: 'bg-[var(--surface-2)] text-[var(--ink)]', ctaHover: 'hover:bg-[var(--surface-3)]' },
  full:  { bg: 'bg-[var(--c-primary-soft)]', ring: 'ring-[var(--c-primary)]', accent: 'text-[var(--c-primary)]', price: 'text-[var(--ink)]', cta: 'bg-[var(--c-ink)] text-[var(--bg)]', ctaHover: 'hover:opacity-90' },
}

const CREDIT_PACKS = [
  { credits: 100, price: 15000, label: '100 kredit',  perCredit: 150 },
  { credits: 300, price: 39000, label: '300 kredit',  perCredit: 130, popular: true },
  { credits: 1000, price: 99000, label: '1000 kredit', perCredit: 99 },
]

export default function PricingPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<Plan[]>([])
  const [currentPlanId, setCurrentPlanId] = useState<string>('basic')

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    try {
      const [plansRes, subRes] = await Promise.all([
        supabase.from('plans').select('*').order('display_order', { ascending: true }),
        supabase.from('subscriptions').select('plan_id').eq('user_id', user.id).in('status', ['active', 'trialing']).order('started_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (plansRes.data && plansRes.data.length > 0) {
        setPlans(plansRes.data as Plan[])
      } else {
        // Migration 014 not applied — render hard-coded fallback so user still sees pricing
        setPlans(fallbackPlans())
      }
      if (subRes.data) setCurrentPlanId((subRes.data as { plan_id: string }).plan_id)
    } catch (err) {
      console.warn('Plans query failed (migration 014 may not be applied):', err)
      setPlans(fallbackPlans())
    }
    setLoading(false)
  }

  function fallbackPlans(): Plan[] {
    return [
      {
        id: 'basic', name: 'Basic', description: 'Atur keuangan harian dengan fitur dasar.',
        price_idr: 99000, original_price_idr: 0, max_seats: 1,
        features: [
          'Catat transaksi unlimited',
          'Anggaran bulanan',
          'Dashboard net worth',
          'Foto struk basic (OCR)',
          'Track 1 jenis aset (tabungan)',
          '50 kredit AI/bulan',
        ],
        ai_credits_monthly: 50, is_popular: false, display_order: 1,
      },
      {
        id: 'full', name: 'Full Service', description: 'Akses penuh ke semua fitur Klunting.',
        price_idr: 199000, original_price_idr: 299000, max_seats: 4,
        features: [
          'Semua fitur Basic',
          'Multi-aset (saham, RD, crypto, emas, SBN, P2P)',
          'AI Advisor unlimited',
          'AI Receipt Scanner advanced',
          'WhatsApp catat & forward struk (segera)',
          'Family sharing sampai 4 anggota',
          'Atur utang & cicilan',
          'Goal setting & laporan detail',
          '250 kredit AI/bulan',
        ],
        ai_credits_monthly: 250, is_popular: true, display_order: 2,
      },
    ]
  }

  function handleUpgrade(planId: string) {
    if (planId === currentPlanId) return
    alert(`Pembayaran via Xendit akan segera hadir. Untuk early access ke ${planId.toUpperCase()}, hubungi support@klunting.com.`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Memuat harga...
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header — clean fintech page header (no dark anchor, biar pricing
          cards yang jadi visual anchor) */}
      <div className="text-center max-w-2xl mx-auto">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4"
          style={{
            background: 'var(--c-mint-soft)',
            color: 'var(--c-mint)',
          }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: 'var(--c-mint)' }}
          />
          <span className="text-xs font-semibold">
            Trial 14 hari · Tanpa kartu kredit
          </span>
        </div>
        <h1
          className="font-bold tracking-tight"
          style={{
            fontSize: 'clamp(32px, 4.5vw, 52px)',
            color: 'var(--ink)',
            lineHeight: 1.1,
            letterSpacing: '-0.035em',
          }}
        >
          Pilih paket yang{' '}
          <span style={{ color: 'var(--c-mint)' }}>cocok</span>{' '}
          buat kebutuhanmu.
        </h1>
        <p className="text-base mt-4 max-w-xl mx-auto" style={{ color: 'var(--ink-muted)' }}>
          Tagihan bulanan. Trial 14 hari akses Full Service. Bisa upgrade kapan saja.
        </p>
      </div>

      {/* 2-tier cards */}
      <div className="grid gap-5 md:grid-cols-2 max-w-4xl mx-auto">
        {plans.map((plan) => {
          const theme = PLAN_THEMES[plan.id] ?? PLAN_THEMES.basic
          const isCurrent = plan.id === currentPlanId
          const isFree = plan.price_idr === 0
          const discountPct = plan.original_price_idr && plan.original_price_idr > plan.price_idr
            ? Math.round((1 - plan.price_idr / plan.original_price_idr) * 100)
            : 0
          const featuresList: string[] = Array.isArray(plan.features) ? plan.features : []

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl ${theme.bg} p-6 ring-1 ${theme.ring} ${plan.is_popular ? 'shadow-lg lg:scale-105' : 'shadow-sm'} transition`}
            >
              {plan.is_popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow">
                  Paling Populer
                </div>
              )}

              <div className={`flex items-center gap-2 ${theme.accent}`}>
                {PLAN_ICONS[plan.id]}
                <h3 className="text-xl font-bold">{plan.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>

              <div className="mt-5">
                {isFree ? (
                  <div className="flex items-baseline gap-2">
                    <span className={`text-4xl font-bold ${theme.price}`}>Gratis</span>
                  </div>
                ) : (
                  <>
                    {discountPct > 0 && plan.original_price_idr && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-muted-foreground line-through">{formatCurrency(plan.original_price_idr)}</span>
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">-{discountPct}%</span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-2">
                      <span className={`text-4xl font-bold tabular-nums ${theme.price}`}>{formatCurrency(plan.price_idr)}</span>
                      <span className="text-sm text-muted-foreground">/bulan</span>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrent}
                className={`mt-5 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition ${
                  isCurrent
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : `${theme.cta} ${theme.ctaHover}`
                }`}
              >
                {isCurrent ? (
                  <>
                    <Check className="size-4" />
                    Paket Saat Ini
                  </>
                ) : plan.id === 'full' ? (
                  <>
                    <Crown className="size-4" />
                    Pilih Full Service
                  </>
                ) : (
                  <>
                    <Zap className="size-4" />
                    Pilih {plan.name}
                  </>
                )}
              </button>

              {plan.max_seats > 1 && (
                <p className="text-xs text-center mt-2 text-[var(--c-mint)] font-medium">
                  👨‍👩‍👧 Sampai {plan.max_seats} anggota keluarga
                </p>
              )}

              <div className="mt-6 space-y-2.5 flex-1">
                {featuresList.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Check className={`size-4 mt-0.5 shrink-0 ${theme.accent}`} />
                    <span className="text-foreground/90">{feature}</span>
                  </div>
                ))}
              </div>

              {plan.ai_credits_monthly > 0 && (
                <div className="mt-5 pt-4 border-t border-current/10">
                  <p className="text-xs text-center font-medium text-amber-700 inline-flex items-center justify-center gap-1 w-full">
                    <Sparkles className="size-3" />
                    {plan.ai_credits_monthly} kredit AI gratis setiap bulan
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Feature comparison */}
      <section className="rounded-2xl border bg-white p-6">
        <h3 className="font-semibold text-lg mb-4">Bandingkan fitur</h3>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 font-medium text-muted-foreground">Fitur</th>
                <th className="text-center py-3 font-medium">Basic</th>
                <th className="text-center py-3 font-medium">Full Service</th>
              </tr>
            </thead>
            <tbody>
              {[
                { f: 'Catat transaksi unlimited',         basic: true,  full: true },
                { f: 'Anggaran bulanan',                  basic: true,  full: true },
                { f: 'Dashboard net worth',               basic: true,  full: true },
                { f: 'Export CSV',                        basic: true,  full: true },
                { f: 'Foto struk basic (OCR)',            basic: true,  full: true },
                { f: 'Track 1 jenis aset (tabungan)',     basic: true,  full: true },
                { f: 'Multi-aset (saham, RD, crypto, dll)', basic: false, full: true },
                { f: 'AI Advisor (chat keuangan)',        basic: false, full: true },
                { f: 'AI Receipt Scanner advanced',       basic: false, full: true },
                { f: 'WhatsApp catat & forward struk',    basic: false, full: 'Segera' },
                { f: 'Atur utang & cicilan',              basic: false, full: true },
                { f: 'Goal setting & laporan detail',     basic: false, full: true },
                { f: 'Update harga saham otomatis',       basic: false, full: true },
                { f: 'Family sharing',                    basic: false, full: true },
                { f: 'Anggota keluarga',                  basic: '1',   full: '4' },
                { f: 'Wallet & budget bersama',           basic: false, full: true },
                { f: 'Tracking per-anggota',              basic: false, full: true },
                { f: 'Kredit AI bulanan',                 basic: '50',  full: '250' },
              ].map((row, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="py-2.5 text-foreground/90">{row.f}</td>
                  <td className="text-center">{renderCell(row.basic)}</td>
                  <td className="text-center">{renderCell(row.full)}</td>
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
              className={`relative rounded-xl border bg-white p-4 ${pack.popular ? 'ring-2 ring-amber-400' : ''}`}
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
      <section className="rounded-2xl border bg-white p-6">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="size-5 text-[var(--c-mint)] mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Pembayaran Aman</p>
              <p className="text-xs text-muted-foreground mt-0.5">Xendit (PCI-DSS compliant). Tidak menyimpan data kartumu.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Crown className="size-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Garansi 14 Hari</p>
              <p className="text-xs text-muted-foreground mt-0.5">Tidak puas? Refund 100% dalam 14 hari pertama, no questions asked.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="size-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Data Tetap Milikmu</p>
              <p className="text-xs text-muted-foreground mt-0.5">Cancel kapan saja. Export semua data sebagai CSV — no lock-in.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="rounded-2xl border bg-white p-6">
        <h3 className="font-semibold text-lg mb-4">Pertanyaan Umum</h3>
        <div className="space-y-4 text-sm">
          <Faq q="Apa beda Basic dan Full Service?" a="Basic Rp 99rb/bulan untuk catat transaksi & track 1 jenis aset (tabungan). Full Service Rp 199rb/bulan unlock semua fitur: multi-aset (saham, RD, crypto, emas, dll), AI Advisor unlimited, family sharing sampai 4 anggota, WhatsApp catat (segera), goal & laporan detail." />
          <Faq q="Trial 14 hari itu gimana?" a="Setiap user baru otomatis dapat akses penuh Full Service selama 14 hari, tanpa kartu kredit. Setelah trial habis, kamu pilih plan Basic atau Full Service untuk lanjut." />
          <Faq q="Bagaimana sistem AI credit?" a="Tiap kali pakai fitur AI (scan struk advanced, chat AI Advisor, dll), 1 kredit dipotong. Basic dapat 50 kredit/bulan, Full Service 250/bulan. Kalau habis, bisa top-up terpisah (paket di bawah)." />
          <Faq q="Bisa downgrade dari Full ke Basic?" a="Bisa. Downgrade berlaku di akhir periode billing. Data tetap aman, fitur Full Service akan dimatikan setelah masa langganan habis." />
          <Faq q="Pembayarannya gimana?" a="Xendit (segera hadir): kartu kredit/debit, transfer bank, e-wallet (GoPay/OVO/Dana), QRIS, virtual account. Sementara waktu, hubungi support untuk pembayaran manual." />
          <Faq q="Data saya aman?" a="Aman. Database di Supabase (Asia Pacific), enkripsi at-rest dan in-transit, isolasi per-user via Row Level Security. Tidak dijual ke pihak ketiga, tidak ada iklan." />
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
