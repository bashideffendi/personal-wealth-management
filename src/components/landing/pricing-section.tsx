'use client'

import { useState } from 'react'
import { PLANS, type Billing } from '@/components/pricing/plans'
import { PlanCard } from '@/components/pricing/plan-card'

export function PricingSection() {
  const [billing, setBilling] = useState<Billing>('annual')

  return (
    <section id="harga" className="px-6 sm:px-12 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl mb-8">
          <p className="eyebrow">Harga</p>
          <h2 className="display mt-3" style={{ fontSize: 'clamp(28px, 4vw, 46px)', lineHeight: 1.1 }}>
            Satu langganan, seluruh fitur. Tanpa biaya tersembunyi.
          </h2>
          <p className="mt-3 text-base" style={{ color: 'var(--ink-muted)' }}>
            Coba 21 hari gratis, tanpa kartu kredit. Batalkan kapan saja sebelum trial berakhir, tanpa potongan.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center mb-8">
          <div className="inline-flex items-center rounded-xl p-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            {([['annual', 'Tahunan'], ['monthly', 'Bulanan']] as const).map(([key, label]) => {
              const on = billing === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBilling(key)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold motion-safe:transition-colors inline-flex items-center gap-2"
                  style={{ background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-soft)', boxShadow: on ? '0 1px 3px rgba(16,24,40,0.10)' : undefined }}
                >
                  {label}
                  {key === 'annual' && (
                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'var(--c-mint-soft)', color: 'var(--c-mint-ink)' }}>HEMAT</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billing={billing}
              ctaLabel="Coba gratis 21 hari"
              ctaHref="/register"
            />
          ))}
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: 'var(--ink-soft)' }}>
          Tanpa auto-renew — langganan tidak diperpanjang otomatis. Trial 21 hari akses penuh tanpa
          kartu kredit. Belum ada paket gratis permanen.
        </p>
      </div>
    </section>
  )
}
