'use client'

/**
 * SafeToSpendCard — "Sisa Aman Bulan Ini": pemasukan − terpakai − tagihan rutin
 * belum jatuh tempo = yang masih bebas dipakai. Layout 2 kolom: angka hero + bar
 * di kiri, rincian (income/spent/upcoming) sebagai panel di kanan — biar lebar
 * 2-kolomnya kepakai (bukan angka doang + ruang kosong).
 */

import { formatCurrency } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'

function Row({ label, val, sign, color }: { label: string; val: number; sign: string; color?: string }) {
  return (
    <div className="flex items-center justify-between text-[12.5px]">
      <span style={{ color: 'var(--ink-muted)' }}>{label}</span>
      <span className="num tabular font-semibold" style={{ color: color ?? 'var(--ink)' }}>{sign}{formatCurrency(val)}</span>
    </div>
  )
}

export function SafeToSpendCard({ income, spent, upcoming }: { income: number; spent: number; upcoming: number }) {
  const t = useT()
  const safe = income - spent - upcoming
  const committed = spent + upcoming
  const pct = income > 0 ? Math.min(100, (committed / income) * 100) : 0
  const ok = safe >= 0
  const numColor = income === 0 ? 'var(--ink-soft)' : ok ? 'var(--c-mint)' : 'var(--c-coral)'
  const barColor = pct >= 90 ? 'var(--c-coral)' : pct >= 70 ? 'var(--c-amber)' : 'var(--c-mint)'

  if (income === 0 && spent === 0) {
    return (
      <article className="s-card h-full flex flex-col items-center justify-center text-center" style={{ padding: 24 }}>
        <p className="eyebrow">{t('safe_card.title')}</p>
        <p className="text-sm mt-3" style={{ color: 'var(--text-mute)' }}>{t('safe_card.empty')}</p>
      </article>
    )
  }

  return (
    <article className="s-card flex flex-col h-full" style={{ padding: 24 }}>
      <p className="eyebrow shrink-0">{t('safe_card.title')}</p>
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-5 sm:gap-7 items-center mt-1">
        {/* Kiri: angka hero + verdict + bar */}
        <div className="sm:col-span-7 flex flex-col justify-center">
          <p className="num tabular leading-none font-bold" style={{ fontSize: 46, letterSpacing: '-0.025em', color: numColor }}>
            {formatCurrency(safe)}
          </p>
          <p className="text-[13px] mt-2 font-medium" style={{ color: numColor }}>
            {income === 0 ? t('safe_card.no_income') : ok ? t('safe_card.ok') : t('safe_card.over')}
          </p>
          {income > 0 && (
            <div className="mt-5">
              <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barColor }} />
              </div>
              <p className="text-[10.5px] mt-1.5" style={{ color: 'var(--text-mute)' }}>
                {Math.round(pct)}% {t('safe_card.committed_of_income')}
              </p>
            </div>
          )}
        </div>

        {/* Kanan: rincian perhitungan */}
        <div className="sm:col-span-5 sm:border-l sm:pl-7 flex flex-col justify-center gap-3" style={{ borderColor: 'var(--border-soft)' }}>
          <Row label={t('safe_card.income')} val={income} sign="+" color="var(--c-mint)" />
          <Row label={t('safe_card.spent')} val={spent} sign="−" />
          {upcoming > 0 && <Row label={t('safe_card.upcoming')} val={upcoming} sign="−" />}
        </div>
      </div>
    </article>
  )
}
