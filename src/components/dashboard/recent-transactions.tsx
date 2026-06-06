'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  ChevronRight, Coffee, ShoppingCart, Fuel, Tv, Lightbulb, BanknoteArrowUp,
  TrendingUp, Wallet, Heart, Gamepad2, BanknoteArrowDown, Receipt,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'
import type { Transaction } from '@/types'

/**
 * Editorial category-to-icon mapping (lucide). Tone color via --c-* tokens.
 * Replaces emoji + tint pattern dengan icon + soft bg surface-2.
 */
function categoryStyle(
  category: string,
  type: string,
): { Icon: React.ComponentType<{ className?: string }>; tone: string } {
  const cat = (category || '').toLowerCase()
  if (cat.includes('makan') || cat.includes('food') || cat.includes('kopi')) return { Icon: Coffee, tone: 'amber' }
  if (cat.includes('belanja') || cat.includes('shop')) return { Icon: ShoppingCart, tone: 'primary' }
  if (cat.includes('transport') || cat.includes('bensin') || cat.includes('grab') || cat.includes('gojek')) return { Icon: Fuel, tone: 'coral' }
  if (cat.includes('langganan') || cat.includes('netflix') || cat.includes('spotify') || cat.includes('subscript')) return { Icon: Tv, tone: 'violet' }
  if (cat.includes('tagihan') || cat.includes('listrik') || cat.includes('air')) return { Icon: Lightbulb, tone: 'amber' }
  if (cat.includes('gaji') || cat.includes('bonus') || cat.includes('thr')) return { Icon: BanknoteArrowUp, tone: 'mint' }
  if (cat.includes('investasi') || cat.includes('saham')) return { Icon: TrendingUp, tone: 'primary' }
  if (cat.includes('tabung') || cat.includes('saving')) return { Icon: Wallet, tone: 'amber' }
  if (cat.includes('kesehatan') || cat.includes('rumah sakit')) return { Icon: Heart, tone: 'coral' }
  if (cat.includes('hiburan') || cat.includes('game')) return { Icon: Gamepad2, tone: 'violet' }
  if (type === 'income') return { Icon: BanknoteArrowUp, tone: 'mint' }
  if (type === 'expense') return { Icon: BanknoteArrowDown, tone: 'coral' }
  if (type === 'saving') return { Icon: Wallet, tone: 'amber' }
  if (type === 'investment') return { Icon: TrendingUp, tone: 'primary' }
  return { Icon: Receipt, tone: 'primary' }
}

function relativeTime(dateStr: string, t: (path: string) => string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return t('recent_tx.today')
  if (diffDays === 1) return t('recent_tx.yesterday')
  if (diffDays < 7) return `${diffDays} ${t('recent_tx.days_ago')}`
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  const t = useT()
  const recent = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [transactions],
  )

  return (
    <article className="s-card" style={{ padding: 24 }}>
      <div className="flex items-center justify-between">
        <p className="eyebrow">{t('recent_tx.title')}</p>
        <Link
          href="/dashboard/transactions"
          className="btn-outline"
          style={{ fontSize: 11, padding: '6px 10px' }}
        >
          {t('recent_tx.view_all')} <ChevronRight className="size-3" />
        </Link>
      </div>
      {recent.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--text-mute)' }}>
          {t('recent_tx.empty')}
        </p>
      ) : (
        <div className="flex flex-col mt-3">
          {recent.map((tx, i) => {
            const { Icon, tone } = categoryStyle(tx.category, tx.type)
            const pos = tx.type === 'income'
            const expense = tx.type === 'expense'
            return (
              <div
                key={tx.id}
                className="grid items-center gap-3 py-3"
                style={{
                  gridTemplateColumns: '36px 1fr auto',
                  borderTop: i ? '1px solid var(--line)' : 'none',
                }}
              >
                <div
                  className="grid place-items-center"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: pos ? 'var(--c-mint-soft)' : `var(--c-${tone}-soft)`,
                    color: pos ? 'var(--c-mint)' : `var(--c-${tone})`,
                  }}
                >
                  <Icon className="size-[15px]" />
                </div>
                <div className="min-w-0">
                  <p
                    className="truncate"
                    style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}
                  >
                    {tx.description || tx.category}
                  </p>
                  <p
                    className="truncate"
                    style={{ fontSize: 11.5, color: 'var(--text-mute)' }}
                  >
                    {tx.category} · {relativeTime(tx.date, t)}
                  </p>
                </div>
                <p
                  className="num tabular text-right"
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: pos ? 'var(--c-mint)' : 'var(--ink)',
                  }}
                >
                  {pos ? '+' : expense ? '−' : ''}{formatCurrency(tx.amount)}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}
