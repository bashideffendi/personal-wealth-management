'use client'

/**
 * Kartu paket langganan bersama (landing + dashboard/pricing).
 * Basis visual = versi landing: token murni, kartu populer dibedakan
 * border-2 var(--c-primary) + badge (tanpa scale).
 *
 * CTA fleksibel: kasih `ctaHref` untuk <Link> (landing) atau `onCta`
 * untuk <button> (dashboard). Perilaku CTA ditentukan pemanggil.
 */

import Link from 'next/link'
import { Crown, Users, Check } from 'lucide-react'
import { formatRupiahPlain as fmt } from '@/lib/utils'
import { perMonthIdr, savingsPct, type Billing, type Plan } from './plans'

const PLAN_ICONS = { pro: Crown, max: Users } as const

interface PlanCardProps {
  plan: Plan
  billing: Billing
  ctaLabel: string
  /** Render CTA sebagai <Link href> (dipakai landing). */
  ctaHref?: string
  /** Render CTA sebagai <button onClick> (dipakai dashboard). Menang atas ctaHref. */
  onCta?: () => void
}

export function PlanCard({ plan, billing, ctaLabel, ctaHref, onCta }: PlanCardProps) {
  const annual = billing === 'annual'
  const Icon = PLAN_ICONS[plan.id]

  const ctaClass = plan.popular
    ? 'block w-full text-center py-2.5 rounded-lg text-sm font-semibold btn-primary'
    : 'block w-full text-center py-2.5 rounded-lg text-sm font-semibold motion-safe:transition hover:opacity-80'
  const ctaStyle = plan.popular
    ? undefined
    : { background: 'var(--surface-2)', color: 'var(--ink)' }

  return (
    <div
      className={`rounded-2xl p-7 relative ${plan.popular ? 'border-2' : 'border'}`}
      style={{ background: 'var(--surface)', borderColor: plan.popular ? 'var(--c-primary)' : 'var(--border)' }}
    >
      {plan.popular && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold uppercase whitespace-nowrap"
          style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', letterSpacing: '0.08em' }}
        >
          Paling populer
        </span>
      )}

      <div className="flex items-center gap-2 mb-3">
        <Icon className="size-5" style={{ color: plan.popular ? 'var(--ink)' : 'var(--ink-muted)' }} />
        <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{plan.name}</h3>
      </div>
      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{plan.description}</p>

      <div className="mt-5 mb-0.5 flex items-baseline gap-2">
        <span className="num text-4xl font-bold tracking-tight" style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}>
          {fmt(annual ? plan.annualIdr : plan.monthlyIdr)}
        </span>
        <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>{annual ? '/tahun' : '/bulan'}</span>
      </div>
      {annual ? (
        <>
          <p className="text-xs font-medium" style={{ color: 'var(--c-mint-ink)' }}>
            ≈ {fmt(perMonthIdr(plan.annualIdr))}/bln — hemat {savingsPct(plan.annualIdr, plan.monthlyIdr)}% dari bulanan
          </p>
          <p className="text-xs mb-5 mt-0.5" style={{ color: 'var(--ink-soft)' }}>
            <span style={{ textDecoration: 'line-through' }}>{fmt(plan.originalAnnualIdr)}</span> · harga promo peluncuran
          </p>
        </>
      ) : (
        <p className="text-xs mb-5 mt-0.5" style={{ color: 'var(--ink-soft)' }}>{plan.monthlyNote}</p>
      )}

      {onCta ? (
        <button type="button" onClick={onCta} className={`${ctaClass} cursor-pointer`} style={ctaStyle}>
          {ctaLabel}
        </button>
      ) : (
        <Link href={ctaHref ?? '/register'} className={ctaClass} style={ctaStyle}>
          {ctaLabel}
        </Link>
      )}

      <ul className="mt-6 space-y-2.5 text-sm" style={{ color: 'var(--ink-muted)' }}>
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--ink)' }} />
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}
