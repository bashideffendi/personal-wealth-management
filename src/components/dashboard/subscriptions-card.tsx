'use client'

/**
 * SubscriptionsCard — "Langganan & Rutin": total komitmen pengeluaran rutin per
 * bulan (langganan + cicilan + tagihan tetap) + daftarnya. Beda angle dari
 * Tagihan (yg date-sorted "jatuh tempo") — ini awareness biaya tetap bulanan.
 */

import Link from 'next/link'
import { ChevronRight, Repeat } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'

type Rec = { id: string; name: string; type: string; amount: number; frequency: string; day_of_period: number }

const FREQ_KEY: Record<string, string> = { monthly: 'recurring.freq_monthly', weekly: 'recurring.freq_weekly', yearly: 'recurring.freq_yearly', daily: 'recurring.freq_daily' }
const monthlyEq = (r: Rec) =>
  r.frequency === 'monthly' ? r.amount
  : r.frequency === 'weekly' ? r.amount * 52 / 12
  : r.frequency === 'yearly' ? r.amount / 12
  : r.amount * 365 / 12

export function SubscriptionsCard({ recurring }: { recurring: Rec[] }) {
  const t = useT()
  // Non-income (expense + saving + investment rutin) — definisi 'pembayaran'
  // yang sama dengan stat halaman Recurring.
  const items = recurring.filter((r) => r.type !== 'income').sort((a, b) => monthlyEq(b) - monthlyEq(a))
  const total = items.reduce((s, r) => s + monthlyEq(r), 0)

  return (
    <article className="s-card flex flex-col h-full" style={{ padding: 24 }}>
      <div className="flex items-start justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <p className="eyebrow">{t('subs_card.title')}</p>
          <p className="num tabular mt-1 truncate" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
            {formatCurrency(total)}<span className="text-[12px] font-normal" style={{ color: 'var(--text-mute)' }}> /bln</span>
          </p>
        </div>
        <Link href="/dashboard/recurring" className="btn-outline shrink-0" style={{ fontSize: 11, padding: '6px 10px' }}>
          {t('subs_card.view_all')} <ChevronRight className="size-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--text-mute)' }}>{t('subs_card.empty')}</p>
      ) : (
        <div className="flex flex-col mt-3 flex-1 min-h-0 overflow-y-auto">
          {items.map((r, i) => (
            <div key={r.id} className="grid items-center gap-3 py-2.5" style={{ gridTemplateColumns: '36px 1fr auto', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <div className="grid place-items-center" style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--c-violet-soft)', color: 'var(--c-violet)' }}>
                <Repeat className="size-[15px]" />
              </div>
              <div className="min-w-0">
                <p className="truncate" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{r.name}</p>
                <p className="truncate" style={{ fontSize: 11.5, color: 'var(--text-mute)' }}>
                  {FREQ_KEY[r.frequency] ? t(FREQ_KEY[r.frequency]) : r.frequency}{r.frequency === 'monthly' ? ` · tgl ${r.day_of_period}` : ''}
                </p>
              </div>
              <p className="num tabular text-right" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{formatCurrency(r.amount)}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
