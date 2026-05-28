'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction } from '@/types'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

export default function CategoryDrilldownPage() {
  const params = useParams<{ name: string }>()
  const category = decodeURIComponent(params.name)
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [txs, setTxs] = useState<Transaction[]>([])

  useEffect(() => { void load() }, [category]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const map: Record<string, number> = {}
    for (const t of txs) {
      const key = (t.description || 'Lainnya').split(/\s+/).slice(0, 2).join(' ')
      map[key] = (map[key] || 0) + t.amount
    }
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 8)
  }, [txs])

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/transactions"
        className="inline-flex items-center gap-1 text-sm hover:underline"
        style={{ color: 'var(--ink-muted)' }}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Transaksi
      </Link>

      <div className="dark-card p-6 sm:p-7">
        <p className="caps">Drill-Down Kategori</p>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-2" style={{ color: 'var(--ink)' }}>
          {category}
        </h2>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="caps" style={{ fontSize: '0.625rem' }}>Total</p>
            <p className="num tabular text-xl font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(stats.total)}
            </p>
          </div>
          <div>
            <p className="caps" style={{ fontSize: '0.625rem' }}>YTD</p>
            <p className="num tabular text-xl font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(stats.thisYear)}
            </p>
          </div>
          <div>
            <p className="caps" style={{ fontSize: '0.625rem' }}>Bulan Ini</p>
            <p className="num tabular text-xl font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(stats.thisMonth)}
            </p>
          </div>
          <div>
            <p className="caps" style={{ fontSize: '0.625rem' }}>Rata-rata/tx</p>
            <p className="num tabular text-xl font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(stats.avg)}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : stats.count === 0 ? (
        <div className="s-card p-12 text-center">
          <p className="font-semibold">Tidak ada transaksi</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Belum ada data di kategori ini.</p>
        </div>
      ) : (
        <>
          <div className="s-card p-5">
            <p className="caps">Trend 12 Bulan</p>
            <h3 className="text-lg font-semibold mt-0.5">Per Bulan</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                <XAxis dataKey="month" fontSize={11} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}jt`} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: unknown) => formatCurrency(Number(v) || 0)}
                  contentStyle={{ background: 'var(--black)', color: 'var(--on-black)', border: '1px solid var(--black-line)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="value" fill="#0A0A0A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="s-card p-5">
              <p className="caps">Breakdown</p>
              <h3 className="text-lg font-semibold mt-0.5">Top Merchant / Deskripsi</h3>
              <ul className="mt-4 space-y-2">
                {merchants.map(([name, amt]) => {
                  const pct = stats.total > 0 ? (amt / stats.total) * 100 : 0
                  return (
                    <li key={name} className="flex items-center gap-3">
                      <span className="text-sm flex-1 truncate">{name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="h-1 w-20 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--lime-400)' }} />
                        </div>
                        <span className="num text-xs tabular w-24 text-right">{formatCurrency(amt)}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="s-card p-5">
              <p className="caps">Transaksi Terbaru</p>
              <h3 className="text-lg font-semibold mt-0.5">Recent</h3>
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
