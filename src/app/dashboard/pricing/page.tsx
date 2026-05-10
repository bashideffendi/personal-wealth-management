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
  solo:   <Sparkles className="size-5" />,
  pro:    <Crown className="size-5" />,
  family: <Users className="size-5" />,
}

const PLAN_THEMES: Record<string, { bg: string; ring: string; accent: string; price: string; cta: string; ctaHover: string }> = {
  solo:   { bg: 'bg-white',           ring: 'ring-slate-200',   accent: 'text-slate-700',   price: 'text-slate-900', cta: 'bg-slate-900',     ctaHover: 'hover:bg-slate-800' },
  pro:    { bg: 'bg-amber-50',        ring: 'ring-amber-300',   accent: 'text-amber-700',   price: 'text-amber-900', cta: 'bg-amber-600',     ctaHover: 'hover:bg-amber-700' },
  family: { bg: 'bg-blue-50',         ring: 'ring-blue-300',    accent: 'text-blue-700',    price: 'text-blue-900',  cta: 'bg-blue-700',      ctaHover: 'hover:bg-blue-800' },
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
  const [currentPlanId, setCurrentPlanId] = useState<string>('solo')

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
        supabase.from('subscriptions').select('plan_id').eq('user_id', user.id).eq('status', 'active').order('started_at', { ascending: false }).limit(1).maybeSingle(),
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
        id: 'solo', name: 'Solo', description: 'Mulai atur keuangan tanpa biaya.',
        price_idr: 0, original_price_idr: 0, max_seats: 1,
        features: ['Akun & dompet unlimited', 'Catat transaksi unlimited', 'Anggaran bulanan', 'Dashboard analitik dasar', 'Export CSV'],
        ai_credits_monthly: 10, is_popular: false, display_order: 1,
      },
      {
        id: 'pro', name: 'Pro', description: 'Kontrol penuh atas kekayaanmu.',
        price_idr: 79000, original_price_idr: 149000, max_seats: 1,
        features: ['Semua di Solo', 'Foto struk → otomatis ke transaksi (AI Vision)', 'AI Advisor — tanya apa saja', 'Tracking aset & investasi lengkap', 'Net worth real-time', 'Goal setting & tracking', 'Update harga saham otomatis', 'Laporan & analisa detail'],
        ai_credits_monthly: 100, is_popular: true, display_order: 2,
      },
      {
        id: 'family', name: 'Family', description: 'Atur keuangan bareng pasangan & keluarga.',
        price_idr: 199000, original_price_idr: 299000, max_seats: 4,
        features: ['Semua di Pro', 'Hingga 4 anggota keluarga', 'Wallet & budget bersama', 'Tracking per-anggota (siapa belanja apa)', 'Insight pengeluaran keluarga', 'Notifikasi sinkron antar anggota', 'Bonus 200 kredit AI/bulan'],
        ai_credits_monthly: 250, is_popular: false, display_order: 3,
      },
    ]
  }

  function handleUpgrade(planId: string) {
    if (planId === currentPlanId) return
    if (planId === 'solo') {
      alert('Untuk downgrade ke Solo, hubungi support.')
      return
    }
    alert(`Pembayaran via Midtrans akan segera hadir. Untuk early access ke ${planId.toUpperCase()}, hubungi support@klunting.com.`)
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
      {/* Header */}
      <div className="dark-card p-6 sm:p-7 text-center">
        <p className="caps">Pilih Paketmu</p>
        <h2 className="text-white text-3xl sm:text-4xl font-semibold tracking-tight mt-3 max-w-2xl mx-auto">
          Tingkatkan kontrol keuanganmu — sendiri atau bersama keluarga.
        </h2>
        <p className="text-sm mt-3 max-w-xl mx-auto" style={{ color: 'var(--on-black-mut)' }}>
          Tagihan tahunan. Bisa upgrade atau downgrade kapan saja. Pembayaran aman lewat Midtrans (segera hadir).
        </p>
      </div>

      {/* 3-tier cards (side-by-side comparison — clearer than tabbed UI) */}
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const theme = PLAN_THEMES[plan.id] ?? PLAN_THEMES.solo
          const isCurrent = plan.id === currentPlanId
          const isFree = plan.price_idr === 0
          const monthlyEq = plan.price_idr > 0 ? Math.round(plan.price_idr / 12) : 0
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
                      <span className="text-sm text-muted-foreground">/tahun</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Setara {formatCurrency(monthlyEq)}/bulan
                    </p>
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
                ) : isFree ? (
                  'Mulai Gratis'
                ) : plan.id === 'family' ? (
                  <>
                    <Users className="size-4" />
                    Pilih Family
                  </>
                ) : (
                  <>
                    <Zap className="size-4" />
                    Upgrade ke {plan.name}
                  </>
                )}
              </button>

              {plan.max_seats > 1 && (
                <p className="text-xs text-center mt-2 text-blue-700 font-medium">
                  👨‍👩‍👧 Hingga {plan.max_seats} anggota keluarga
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
                <th className="text-center py-3 font-medium">Solo</th>
                <th className="text-center py-3 font-medium">Pro</th>
                <th className="text-center py-3 font-medium">Family</th>
              </tr>
            </thead>
            <tbody>
              {[
                { f: 'Akun & dompet unlimited',           solo: true, pro: true, fam: true },
                { f: 'Catat transaksi unlimited',         solo: true, pro: true, fam: true },
                { f: 'Anggaran bulanan',                  solo: true, pro: true, fam: true },
                { f: 'Dashboard analitik dasar',          solo: true, pro: true, fam: true },
                { f: 'Export CSV',                        solo: true, pro: true, fam: true },
                { f: 'Foto struk → auto-input (AI)',      solo: false, pro: true, fam: true },
                { f: 'AI Advisor (chat keuangan)',        solo: false, pro: true, fam: true },
                { f: 'Tracking aset & investasi',         solo: false, pro: true, fam: true },
                { f: 'Net worth real-time',               solo: false, pro: true, fam: true },
                { f: 'Goal setting & tracking',           solo: false, pro: true, fam: true },
                { f: 'Update harga saham otomatis',       solo: false, pro: true, fam: true },
                { f: 'Anggota keluarga',                  solo: '1', pro: '1', fam: '4' },
                { f: 'Wallet & budget bersama',           solo: false, pro: false, fam: true },
                { f: 'Tracking per-anggota',              solo: false, pro: false, fam: true },
                { f: 'Notifikasi sinkron antar anggota',  solo: false, pro: false, fam: true },
                { f: 'Kredit AI bulanan',                 solo: '10', pro: '100', fam: '250' },
              ].map((row, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="py-2.5 text-foreground/90">{row.f}</td>
                  <td className="text-center">{renderCell(row.solo)}</td>
                  <td className="text-center">{renderCell(row.pro)}</td>
                  <td className="text-center">{renderCell(row.fam)}</td>
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
            <ShieldCheck className="size-5 text-emerald-600 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Pembayaran Aman</p>
              <p className="text-xs text-muted-foreground mt-0.5">Midtrans (PCI-DSS compliant). Tidak menyimpan data kartumu.</p>
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
          <Faq q="Apa beda Pro dan Family?" a="Pro untuk 1 user (kamu doang). Family untuk 4 user — pasangan & anak bisa sama-sama nyatet ke 1 budget keluarga, lihat insight bersama, tapi tetap punya tracking per-anggota (jadi tau siapa belanja apa)." />
          <Faq q="Bagaimana sistem AI credit?" a="Tiap kali kamu pakai fitur AI (scan struk, chat AI Advisor, dll), 1 kredit dipotong. Paket Pro dapat 100 kredit/bulan, Family 250/bulan. Kalau habis, bisa top-up paket terpisah." />
          <Faq q="Bisa downgrade nggak?" a="Bisa. Downgrade berlaku di akhir periode billing. Data tetap aman, fitur premium akan dimatikan setelah masa langganan habis." />
          <Faq q="Pembayarannya gimana?" a="Midtrans (segera hadir): kartu kredit/debit, transfer bank, e-wallet (GoPay/OVO/Dana), QRIS, virtual account. Sementara waktu, hubungi support untuk pembayaran manual." />
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
    ? <Check className="size-4 mx-auto text-emerald-600" />
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
