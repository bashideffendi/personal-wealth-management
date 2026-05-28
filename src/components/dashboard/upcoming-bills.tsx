'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { FileText, CreditCard as CreditCardIcon, Repeat, Target } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Contract, CreditCard } from '@/types'

interface BillItem {
  source: 'contract' | 'debt' | 'cc' | 'recurring'
  title: string
  amount: number | null
  dueDate: Date
  daysUntil: number
  Icon: React.ComponentType<{ className?: string }>
  href: string
}

interface UpcomingBillsProps {
  contracts: Contract[]
  debts: Array<{ id: string; name: string; remaining: number; due_date: string | null; monthly_payment: number }>
  creditCards: CreditCard[]
  recurring: Array<{ id: string; name: string; type: string; amount: number; frequency: string; day_of_period: number }>
}

const MONTH_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function UpcomingBills({ contracts, debts, creditCards, recurring }: UpcomingBillsProps) {
  const bills = useMemo<BillItem[]>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const horizonMs = 14 * 86_400_000
    const cutoff = today.getTime() + horizonMs
    const out: BillItem[] = []

    for (const c of contracts) {
      if (!c.end_date) continue
      const dueDate = new Date(c.end_date)
      dueDate.setHours(0, 0, 0, 0)
      const days = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000)
      if (days < 0 || dueDate.getTime() > cutoff) continue
      out.push({ source: 'contract', title: c.name, amount: c.cost ?? null, dueDate, daysUntil: days, Icon: FileText, href: '/dashboard/contracts' })
    }
    for (const d of debts) {
      if (!d.due_date) continue
      const dueDate = new Date(d.due_date)
      dueDate.setHours(0, 0, 0, 0)
      const days = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000)
      if (days < 0 || dueDate.getTime() > cutoff) continue
      out.push({ source: 'debt', title: d.name, amount: d.monthly_payment > 0 ? d.monthly_payment : d.remaining, dueDate, daysUntil: days, Icon: CreditCardIcon, href: '/dashboard/debts' })
    }
    for (const c of creditCards) {
      if (c.current_balance <= 0) continue
      const y = today.getFullYear()
      const m = today.getMonth()
      let dueDate = new Date(y, m, c.due_day)
      dueDate.setHours(0, 0, 0, 0)
      if (dueDate.getTime() < today.getTime()) {
        dueDate = new Date(y, m + 1, c.due_day)
        dueDate.setHours(0, 0, 0, 0)
      }
      const days = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000)
      if (days < 0 || dueDate.getTime() > cutoff) continue
      out.push({ source: 'cc', title: `${c.name}${c.last_four ? ` ••${c.last_four}` : ''}`, amount: c.current_balance, dueDate, daysUntil: days, Icon: CreditCardIcon, href: '/dashboard/credit-cards' })
    }
    for (const r of recurring) {
      if (r.frequency !== 'monthly' || r.type === 'income') continue
      const y = today.getFullYear()
      const m = today.getMonth()
      let dueDate = new Date(y, m, r.day_of_period)
      dueDate.setHours(0, 0, 0, 0)
      if (dueDate.getTime() < today.getTime()) {
        dueDate = new Date(y, m + 1, r.day_of_period)
        dueDate.setHours(0, 0, 0, 0)
      }
      const days = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000)
      if (days < 0 || dueDate.getTime() > cutoff) continue
      out.push({ source: 'recurring', title: r.name, amount: r.amount, dueDate, daysUntil: days, Icon: r.type === 'saving' || r.type === 'investment' ? Target : Repeat, href: '/dashboard/recurring' })
    }
    return out.sort((a, b) => a.daysUntil - b.daysUntil || (b.amount ?? 0) - (a.amount ?? 0))
  }, [contracts, debts, creditCards, recurring])

  if (bills.length === 0) {
    return (
      <article className="s-card" style={{ padding: 24 }}>
        <p className="eyebrow">Tagihan Mendatang</p>
        <p className="text-sm py-6 text-center" style={{ color: 'var(--text-mute)' }}>
          Tidak ada tagihan dalam 14 hari ke depan.
        </p>
      </article>
    )
  }

  return (
    <article className="s-card" style={{ padding: 24 }}>
      <p className="eyebrow">Tagihan Mendatang</p>
      <div className="flex flex-col mt-3">
        {bills.slice(0, 6).map((b, i) => {
          const urgent = b.daysUntil <= 3
          const day = b.dueDate.getDate()
          const monthLabel = MONTH_SHORT_ID[b.dueDate.getMonth()]
          return (
            <Link
              key={`${b.source}-${i}`}
              href={b.href}
              className="grid items-center gap-2.5 py-2.5 transition-colors"
              style={{
                gridTemplateColumns: '48px 1fr auto',
                borderTop: i ? '1px solid var(--line)' : 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div
                style={{
                  width: 44,
                  borderRadius: 10,
                  background: urgent ? 'var(--c-coral-soft)' : 'var(--surface-2)',
                  color: urgent ? 'var(--c-coral)' : 'var(--text-2)',
                  textAlign: 'center',
                  padding: '4px 0',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {monthLabel}
                </div>
                <div className="num tabular" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>
                  {day}
                </div>
              </div>
              <div className="min-w-0">
                <p
                  className="truncate"
                  style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}
                >
                  {b.title}
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: urgent ? 'var(--c-coral)' : 'var(--text-mute)',
                  }}
                >
                  {urgent ? 'Mendesak' : b.daysUntil === 0 ? 'Hari ini' : `${b.daysUntil} hari lagi`}
                </p>
              </div>
              <p
                className="num tabular text-right"
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}
              >
                {b.amount && b.amount > 0 ? formatCurrency(b.amount) : '—'}
              </p>
            </Link>
          )
        })}
      </div>
      {bills.length > 6 && (
        <p
          className="text-[11px] text-center mt-2"
          style={{ color: 'var(--text-mute)' }}
        >
          +{bills.length - 6} tagihan lainnya
        </p>
      )}
    </article>
  )
}
