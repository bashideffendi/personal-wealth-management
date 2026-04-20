'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { RecurringTransaction } from '@/types'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, Pause } from 'lucide-react'

export default function SubscriptionsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<RecurringTransaction[]>([])

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .order('amount', { ascending: false })
    setItems((data ?? []) as RecurringTransaction[])
    setLoading(false)
  }

  async function toggle(r: RecurringTransaction) {
    await supabase.from('recurring_transactions').update({ is_active: !r.is_active }).eq('id', r.id)
    void load()
  }

  // Subscription candidates = recurring expenses category='Langganan' OR name pattern
  const subscriptions = useMemo(() => {
    return items.filter((r) =>
      r.category === 'Langganan' ||
      /netflix|spotify|youtube|disney|hbo|apple|google|prime|indihome|biznet|premium|subscription/i.test(r.name),
    )
  }, [items])

  const totals = useMemo(() => {
    const active = subscriptions.filter((s) => s.is_active)
    const monthly = active
      .filter((s) => s.frequency === 'monthly')
      .reduce((s, r) => s + r.amount, 0)
    const yearly = active
      .filter((s) => s.frequency === 'yearly')
      .reduce((s, r) => s + r.amount, 0)
    const monthEquivalent = monthly + yearly / 12
    const yearEquivalent = monthly * 12 + yearly
    return { count: active.length, monthEquivalent, yearEquivalent }
  }, [subscriptions])

  function monthsOld(startDate: string): number {
    const start = new Date(startDate)
    const now = new Date()
    return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  }

  return (
    <div className="space-y-6">
      <div className="dark-card p-6 sm:p-7">
        <p className="caps">Audit Subscription</p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="caps" style={{ fontSize: '0.625rem' }}>Total / bulan</p>
            <p className="num tabular text-3xl sm:text-4xl font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(totals.monthEquivalent)}
            </p>
          </div>
          <div>
            <p className="caps" style={{ fontSize: '0.625rem' }}>Total / tahun</p>
            <p className="num tabular text-3xl sm:text-4xl font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(totals.yearEquivalent)}
            </p>
          </div>
        </div>
        <p className="text-sm mt-3" style={{ color: 'var(--on-black-mut)' }}>
          {totals.count} subscription aktif — review yang mana yang masih kepakai.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : subscriptions.length === 0 ? (
        <div className="s-card p-12 text-center">
          <p className="font-semibold">Tidak ada subscription terdeteksi</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
            Tambahkan recurring dengan kategori &ldquo;Langganan&rdquo;.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map((s) => {
            const age = monthsOld(s.start_date)
            const stale = age >= 6 && s.is_active
            const annualCost =
              s.frequency === 'monthly' ? s.amount * 12
              : s.frequency === 'yearly' ? s.amount
              : s.frequency === 'weekly' ? s.amount * 52
              : s.amount * 365
            return (
              <div
                key={s.id}
                className="rounded-lg p-5 bg-white border transition-colors"
                style={{
                  borderColor: stale ? 'var(--warning)' : 'var(--border-soft)',
                  opacity: s.is_active ? 1 : 0.5,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{s.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                      {s.frequency === 'monthly' ? 'Bulanan' : s.frequency === 'yearly' ? 'Tahunan' : s.frequency}
                      {' · '}
                      {age} bulan berjalan
                    </p>
                  </div>
                  {stale && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                      <AlertCircle className="h-3 w-3" /> stale
                    </span>
                  )}
                </div>
                <p className="num text-2xl mt-3 tabular font-semibold" style={{ color: 'var(--ink)' }}>
                  {formatCurrency(s.amount)}
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>
                  = <span className="num">{formatCurrency(annualCost)}</span>/tahun
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggle(s)}
                  className="mt-3 w-full"
                >
                  <Pause className="h-3.5 w-3.5" />
                  {s.is_active ? 'Pause / Review' : 'Resume'}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
