'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/context'
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
  monthly_idr: number
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
    monthly_idr: 19000,
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
    monthly_idr: 35000,
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
    bg: 'bg-[var(--c-primary-soft)]', ring: 'ring-[var(--c-primary-ink)]', accent: 'text-[var(--c-primary-ink)]',
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
  const t = useT()
  const [billing, setBilling] = useState<'annual' | 'monthly'>('annual')

  function handleUpgrade(planId: string) {
    alert(
      `${t('pricing.upgrade_alert_prefix')} ${planId.toUpperCase()}, ${t('pricing.upgrade_alert_suffix')}`,
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4"
          style={{ background: 'var(--c-mint-soft)', color: 'var(--c-mint-ink)' }}
        >
          <span className="size-1.5 rounded-full" style={{ background: 'var(--c-mint)' }} />
          <span className="text-xs font-semibold">{t('pricing.trial_badge')}</span>
        </div>
        <h1
          className="font-bold tracking-tight"
          style={{ fontSize: 'clamp(32px, 4.5vw, 52px)', color: 'var(--ink)', lineHeight: 1.1, letterSpacing: '-0.035em' }}
        >
          {t('pricing.hero_title_before')}{' '}
          <span style={{ color: 'var(--c-mint-ink)' }}>{t('pricing.hero_title_highlight')}</span>{' '}
          {t('pricing.hero_title_after')}
        </h1>
        <p className="text-base mt-4 max-w-xl mx-auto" style={{ color: 'var(--ink-muted)' }}>
          {t('pricing.hero_subtitle2')}
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center rounded-xl p-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          {([['annual', t('pricing.bill_annual')], ['monthly', t('pricing.bill_monthly')]] as const).map(([key, label]) => {
            const on = billing === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setBilling(key as 'annual' | 'monthly')}
                className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors inline-flex items-center gap-2"
                style={{ background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-soft)', boxShadow: on ? '0 1px 3px rgba(16,24,40,0.10)' : undefined }}
              >
                {label}
                {key === 'annual' && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'var(--c-mint-soft)', color: 'var(--c-mint-ink)' }}>{t('pricing.save_badge')}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* 2-tier cards */}
      <div className="grid gap-5 md:grid-cols-2 max-w-4xl mx-auto">
        {PLANS.map((plan) => {
          const theme = THEMES[plan.id]
          const discountPct = Math.round((1 - plan.price_idr / plan.original_price_idr) * 100)
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl ${theme.bg} p-6 ring-1 ${theme.ring} ${plan.popular ? 'shadow-[var(--card-shadow)] lg:scale-105' : 'shadow-[var(--card-shadow)]'} transition`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow">
                  {t('pricing.most_popular')}
                </div>
              )}

              <div className={`flex items-center gap-2 ${theme.accent}`}>
                {plan.icon}
                <h3 className="text-xl font-bold">{plan.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>

              <div className="mt-5">
                {billing === 'annual' ? (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-muted-foreground line-through">{formatCurrency(plan.original_price_idr)}</span>
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">-{discountPct}%</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{formatCurrency(plan.price_idr)}</span>
                      <span className="text-sm text-muted-foreground">{t('pricing.per_year')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ≈ {formatCurrency(perMonth(plan.price_idr))}{t('pricing.per_month_suffix')}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{formatCurrency(plan.monthly_idr)}</span>
                      <span className="text-sm text-muted-foreground">{t('pricing.per_month_only')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t('pricing.billed_monthly_note')}</p>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleUpgrade(plan.id)}
                className={`mt-5 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${theme.cta}`}
              >
                {plan.icon}
                {t('pricing.choose_plan')} {plan.name}
              </button>

              {plan.seats > 1 && (
                <p className="text-xs text-center mt-2 text-[var(--c-mint-ink)] font-medium inline-flex items-center justify-center gap-1 w-full">
                  <Users className="size-3.5 shrink-0" /> {t('pricing.seats_before')} {plan.seats} {t('pricing.seats_after')}
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
                <p className="text-xs text-center font-medium text-[var(--c-amber-ink)] inline-flex items-center justify-center gap-1 w-full">
                  <Sparkles className="size-3" />
                  {plan.ai_credits_monthly} {t('pricing.free_credits_monthly')}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Feature comparison */}
      <section className="s-card s-card-pad-lg">
        <h3 className="font-semibold text-lg mb-4">{t('pricing.compare_title')}</h3>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 font-medium text-muted-foreground">{t('pricing.compare_feature_col')}</th>
                <th className="text-center py-3 font-medium">Pro</th>
                <th className="text-center py-3 font-medium">Max</th>
              </tr>
            </thead>
            <tbody>
              {[
                { f: t('pricing.cmp_unlimited'), pro: true, max: true },
                { f: t('pricing.cmp_dashboard'), pro: true, max: true },
                { f: t('pricing.cmp_portfolio'), pro: true, max: true },
                { f: t('pricing.cmp_ai_advisor_scan'), pro: true, max: true },
                { f: t('pricing.cmp_ai_insights'), pro: true, max: true },
                { f: t('pricing.cmp_import'), pro: true, max: true },
                { f: t('pricing.cmp_goal_forecast'), pro: true, max: true },
                { f: t('pricing.cmp_export_csv'), pro: true, max: true },
                { f: t('pricing.cmp_household'), pro: false, max: true },
                { f: t('pricing.cmp_family_members'), pro: '1', max: '5' },
                { f: t('pricing.cmp_shared_wallet'), pro: false, max: true },
                { f: t('pricing.cmp_per_member_tracking'), pro: false, max: true },
                { f: t('pricing.cmp_monthly_credits'), pro: '100', max: '300' },
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
      <section className="rounded-2xl border bg-[var(--c-amber-soft)] p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-[var(--surface)] p-2.5 border border-[var(--outline)]">
            <Sparkles className="size-5 text-[var(--c-amber-ink)]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{t('pricing.topup_title')}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('pricing.topup_subtitle')}
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.credits}
              className={`relative rounded-xl border bg-[var(--surface)] p-4 ${pack.popular ? 'ring-2 ring-[var(--c-primary)]' : ''}`}
            >
              {pack.popular && (
                <span className="absolute -top-2 right-3 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  {t('pricing.save_badge')}
                </span>
              )}
              <p className="text-sm text-muted-foreground">{pack.label}</p>
              <p className="text-2xl font-bold mt-1 tabular-nums">{formatCurrency(pack.price)}</p>
              <p className="text-xs text-muted-foreground mt-1">≈ Rp {pack.perCredit}{t('pricing.per_credit_suffix')}</p>
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-3"
                onClick={() => alert(t('pricing.topup_alert'))}
              >
                {t('pricing.buy')}
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          {t('pricing.credit_explainer')}
        </p>
      </section>

      {/* Trust signals */}
      <section className="s-card s-card-pad-lg">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="size-5 text-[var(--c-mint-ink)] mt-0.5" />
            <div>
              <p className="font-semibold text-sm">{t('pricing.trust_secure_title')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('pricing.trust_secure_desc')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RefreshCcw className="size-5 text-[var(--c-amber-ink)] mt-0.5" />
            <div>
              <p className="font-semibold text-sm">{t('pricing.trust_no_renew_title')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('pricing.trust_no_renew_desc')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="size-5 mt-0.5" style={{ color: 'var(--sky-600)' }} />
            <div>
              <p className="font-semibold text-sm">{t('pricing.trust_own_data_title')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('pricing.trust_own_data_desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="s-card s-card-pad-lg">
        <h3 className="font-semibold text-lg mb-4">{t('pricing.faq_title')}</h3>
        <div className="space-y-4 text-sm">
          <Faq q={t('pricing.faq_billing_q')} a={t('pricing.faq_billing_a')} />
          <Faq q={t('pricing.faq_trial_q')} a={t('pricing.faq_trial_a')} />
          <Faq q={t('pricing.faq_pro_max_q')} a={t('pricing.faq_pro_max_a')} />
          <Faq q={t('pricing.faq_credits_q')} a={t('pricing.faq_credits_a')} />
          <Faq q={t('pricing.faq_payment_q')} a={t('pricing.faq_payment_a')} />
          <Faq q={t('pricing.faq_upgrade_q')} a={t('pricing.faq_upgrade_a')} />
          <Faq q={t('pricing.faq_security_q')} a={t('pricing.faq_security_a')} />
        </div>
      </section>

      <p className="text-center text-sm text-muted-foreground">
        {t('pricing.contact_prompt')} <Link href="mailto:support@klunting.com" className="font-medium text-foreground hover:underline">{t('pricing.contact_cta')}</Link>
      </p>
    </div>
  )
}

function renderCell(v: boolean | string) {
  if (typeof v === 'string') return <span className="font-medium tabular-nums">{v}</span>
  return v
    ? <Check className="size-4 mx-auto text-[var(--c-mint-ink)]" />
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
