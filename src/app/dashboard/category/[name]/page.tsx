'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction } from '@/types'
import { ArrowLeft, Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useT } from '@/lib/i18n/context'

const CategoryBarChart = dynamic(
  () => import('./category-chart').then((m) => m.CategoryBarChart),
  { ssr: false, loading: () => <div className="animate-pulse rounded-lg" style={{ height: 200, background: 'var(--surface-2)' }} aria-hidden="true" /> },
)

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

export default function CategoryDrilldownPage() {
  const params = useParams<{ name: string }>()
  const category = decodeURIComponent(params.name)
  const supabase = createClient()
  const t = useT()
  const [loading, setLoading] = useState(true)
  const [txs, setTxs] = useState<Transaction[]>([])


  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('category', category)
      .order('date', { ascending: false })
    setTxs((data ?? []) as Transaction[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [category]) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const total = txs.reduce((s, t) => s + t.amount, 0)
    const avg = txs.length > 0 ? total / txs.length : 0
    const now = new Date()
    const thisMonth = txs.filter((t) => {
      const d = new Date(t.date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).reduce((s, t) => s + t.amount, 0)
    const thisYear = txs.filter((t) => new Date(t.date).getFullYear() === now.getFullYear())
      .reduce((s, t) => s + t.amount, 0)
    return { total, avg, thisMonth, thisYear, count: txs.length }
  }, [txs])

  const monthlyData = useMemo(() => {
    const now = new Date()
    const data: { month: string; value: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const y = d.getFullYear()
      const m = d.getMonth()
      const sum = txs
        .filter((t) => {
          const td = new Date(t.date)
          return td.getFullYear() === y && td.getMonth() === m
        })
        .reduce((s, t) => s + t.amount, 0)
      data.push({ month: `${MONTHS[m]}'${String(y).slice(2)}`, value: sum })
    }
    return data
  }, [txs])

  // Merchant/description breakdown — naive: group by first 2 words
  const merchants = useMemo(() => {
    const otherLabel = t('category_detail.merchant_other')
    const map: Record<string, number> = {}
    for (const t of txs) {
      const key = (t.description || otherLabel).split(/\s+/).slice(0, 2).join(' ')
      map[key] = (map[key] || 0) + t.amount
    }
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 8)
  }, [txs, t])

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/transactions"
        className="inline-flex items-center gap-1 text-sm hover:underline"
        style={{ color: 'var(--ink-muted)' }}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t('category_detail.back_to_transactions')}
      </Link>

      <section
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, var(--hero-bg) 0%, var(--hero-mid) 50%, var(--hero-soft) 100%)', border: 'var(--outline-w) solid var(--outline)', boxShadow: 'var(--card-shadow)',
          color: 'var(--on-hero)',
          
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: -100, right: -60, width: 360, height: 360,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.05), transparent 65%)',
          }}
        />
        <div className="relative p-6 sm:p-7">
        <p
          className="text-[11px] font-semibold tracking-[0.18em] uppercase"
          style={{ color: 'var(--on-hero-mut)' }}
        >
          {t('category_detail.eyebrow_drilldown')}
        </p>
        <h1
          className="font-bold tracking-tight mt-2"
          style={{
            fontSize: 'clamp(28px, 4vw, 40px)',
            color: 'var(--on-hero)',
            letterSpacing: '-0.035em',
          }}
        >
          {category}
        </h1>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'var(--on-hero-mut)' }}>{t('category_detail.stat_total')}</p>
            <p className="num tabular font-bold mt-1" style={{ fontSize: 20, color: 'var(--on-hero)' }}>
              {formatCurrency(stats.total)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'var(--on-hero-mut)' }}>{t('category_detail.stat_ytd')}</p>
            <p className="num tabular font-bold mt-1" style={{ fontSize: 20, color: 'var(--on-hero)' }}>
              {formatCurrency(stats.thisYear)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'var(--on-hero-mut)' }}>{t('category_detail.stat_this_month')}</p>
            <p className="num tabular font-bold mt-1" style={{ fontSize: 20, color: 'var(--on-hero)' }}>
              {formatCurrency(stats.thisMonth)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'var(--on-hero-mut)' }}>{t('category_detail.stat_avg_per_tx')}</p>
            <p className="num tabular font-bold mt-1" style={{ fontSize: 20, color: 'var(--on-hero)' }}>
              {formatCurrency(stats.avg)}
            </p>
          </div>
        </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : stats.count === 0 ? (
        <div className="s-card p-12 text-center">
          <p className="font-semibold">{t('category_detail.empty_title')}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>{t('category_detail.empty_desc')}</p>
        </div>
      ) : (
        <>
          <div className="s-card p-5">
            <p className="eyebrow">{t('category_detail.chart_eyebrow_12mo')}</p>
            <h3 className="t-h2 mt-0.5">{t('category_detail.chart_title_monthly')}</h3>
            <CategoryBarChart data={monthlyData} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="s-card p-5">
              <p className="eyebrow">{t('category_detail.merchant_eyebrow')}</p>
              <h3 className="t-h2 mt-0.5">{t('category_detail.merchant_title')}</h3>
              <ul className="mt-4 space-y-2">
                {merchants.map(([name, amt]) => {
                  const pct = stats.total > 0 ? (amt / stats.total) * 100 : 0
                  return (
                    <li key={name} className="flex items-center gap-3">
                      <span className="text-sm flex-1 truncate">{name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="quest-bar w-20" style={{ ['--bar-fill' as string]: 'var(--c-mint)', ['--bar-h' as string]: '7px' }}><i style={{ width: `${pct}%` }} /></span>
                        <span className="num text-xs tabular w-24 text-right">{formatCurrency(amt)}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="s-card p-5">
              <p className="eyebrow">{t('category_detail.recent_eyebrow')}</p>
              <h3 className="t-h2 mt-0.5">{t('category_detail.recent_title')}</h3>
              <ul className="mt-4 divide-y" style={{ borderColor: 'var(--border-soft)' }}>
                {txs.slice(0, 8).map((t) => (
                  <li key={t.id} className="py-2 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--ink)' }}>{t.description || '-'}</p>
                      <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{formatDate(t.date)}</p>
                    </div>
                    <span className="num text-sm font-semibold tabular shrink-0 ml-3" style={{ color: 'var(--ink)' }}>
                      {formatCurrency(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
