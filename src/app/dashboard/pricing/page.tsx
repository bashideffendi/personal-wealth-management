'use client'

import { useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BILLING_ENABLED } from '@/lib/billing-flag'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/context'
import { PLANS, type Billing } from '@/components/pricing/plans'
import { PlanCard } from '@/components/pricing/plan-card'
import {
  Sparkles, Users, Check, ShieldCheck, RefreshCcw,
} from 'lucide-react'

// Paid-only, annual billing. NOTE: checkout is still a placeholder (no payment
// gateway yet) — see Roadmap Fase 2. Trial/paywall enforcement ships WITH the
// payment gateway; this page is display-only for now.
// Data plan + kartu = shared dengan landing (src/components/pricing).

const CREDIT_PACKS = [
  { credits: 100, price: 15000, label: '100 kredit', perCredit: 150 },
  { credits: 300, price: 39000, label: '300 kredit', perCredit: 130, popular: true },
  { credits: 1000, price: 99000, label: '1000 kredit', perCredit: 99 },
]

export default function PricingPage() {
  const t = useT()
  const [billing, setBilling] = useState<Billing>('annual')

  // Billing beku (src/lib/billing-flag.ts) → halaman upgrade dianggap tidak ada.
  if (!BILLING_ENABLED) notFound()

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
                onClick={() => setBilling(key as Billing)}
                className="rounded-lg px-4 py-2 text-sm font-semibold motion-safe:transition-colors inline-flex items-center gap-2"
                style={{ background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-soft)', boxShadow: on ? '0 1px 3px rgba(16,24,40,0.10)' : undefined }}
              >
                {label}
                {key === 'annual' && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'var(--c-mint-soft)', color: 'var(--c-mint-ink)' }}>{t('pricing.save_badge')}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* 2-tier cards — shared dengan landing, kartu populer = border aksen (tanpa scale) */}
      <div className="grid gap-5 md:grid-cols-2 max-w-4xl mx-auto items-start">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            billing={billing}
            ctaLabel={`${t('pricing.choose_plan')} ${plan.name}`}
            onCta={() => handleUpgrade(plan.id)}
          />
        ))}
      </div>

      {/* Feature comparison */}
      <section className="s-card s-card-pad-lg">
        <h3 className="font-semibold text-lg mb-4">{t('pricing.compare_title')}</h3>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 font-medium" style={{ color: 'var(--ink-muted)' }}>{t('pricing.compare_feature_col')}</th>
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
            <p className="text-sm mt-0.5" style={{ color: 'var(--ink-muted)' }}>
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
                <span
                  className="absolute -top-2 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: 'var(--c-amber-soft)', color: 'var(--c-amber-ink)', border: '1px solid var(--c-amber)' }}
                >
                  {t('pricing.save_badge')}
                </span>
              )}
              <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{pack.label}</p>
              <p className="text-2xl font-bold mt-1 tabular-nums">{formatCurrency(pack.price)}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>≈ Rp {pack.perCredit}{t('pricing.per_credit_suffix')}</p>
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
        <p className="text-xs mt-4 text-center" style={{ color: 'var(--ink-muted)' }}>
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
              <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>{t('pricing.trust_secure_desc')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RefreshCcw className="size-5 text-[var(--c-amber-ink)] mt-0.5" />
            <div>
              <p className="font-semibold text-sm">{t('pricing.trust_no_renew_title')}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>{t('pricing.trust_no_renew_desc')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="size-5 mt-0.5 text-[var(--c-violet-ink)]" />
            <div>
              <p className="font-semibold text-sm">{t('pricing.trust_own_data_title')}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>{t('pricing.trust_own_data_desc')}</p>
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

      <p className="text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        {t('pricing.contact_prompt')} <Link href="mailto:support@klunting.com" className="font-medium text-foreground hover:underline">{t('pricing.contact_cta')}</Link>
      </p>
    </div>
  )
}

function renderCell(v: boolean | string) {
  if (typeof v === 'string') return <span className="font-medium tabular-nums">{v}</span>
  return v
    ? <Check className="size-4 mx-auto text-[var(--c-mint-ink)]" />
    : <span style={{ color: 'var(--ink-soft)', opacity: 0.4 }}>—</span>
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-lg border border-muted bg-muted/20 p-3">
      <summary className="cursor-pointer font-medium list-none flex items-center justify-between">
        {q}
        <span className="motion-safe:transition group-open:rotate-180" style={{ color: 'var(--ink-muted)' }}>▾</span>
      </summary>
      <p className="mt-2 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{a}</p>
    </details>
  )
}
