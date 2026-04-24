'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { Transaction } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Gift, TrendingUp, Calendar, Trophy } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

export default function WrappedPage() {
  const supabase = createClient()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [loading, setLoading] = useState(true)
  const [txs, setTxs] = useState<Transaction[]>([])

  useEffect(() => { void load() }, [year]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', `${year}-01-01`)
      .lt('date', `${year + 1}-01-01`)
    setTxs((data ?? []) as Transaction[])
    setLoading(false)
  }

  const recap = useMemo(() => {
    const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const saving = txs.filter((t) => t.type === 'saving').reduce((s, t) => s + t.amount, 0)
    const investment = txs.filter((t) => t.type === 'investment').reduce((s, t) => s + t.amount, 0)
    const net = income - expense - saving - investment
    const savingRate = income > 0 ? ((saving + investment) / income) * 100 : 0

    // Top category by expense
    const byCat: Record<string, number> = {}
    for (const t of txs.filter((t) => t.type === 'expense')) {
      byCat[t.category] = (byCat[t.category] || 0) + t.amount
    }
    const topCats = Object.entries(byCat).sort(([, a], [, b]) => b - a).slice(0, 5)

    // Monthly expense
    const monthlyExp: number[] = Array(12).fill(0)
    const monthlyInc: number[] = Array(12).fill(0)
    for (const t of txs) {
      const m = new Date(t.date).getMonth()
      if (t.type === 'expense') monthlyExp[m] += t.amount
      else if (t.type === 'income') monthlyInc[m] += t.amount
    }
    const biggestExpMonth = monthlyExp.indexOf(Math.max(...monthlyExp))
    const bestSaveMonth = monthlyInc
      .map((inc, i) => ({ i, net: inc - monthlyExp[i] }))
      .sort((a, b) => b.net - a.net)[0]?.i ?? 0

    // Biggest single expense
    const biggestExp = txs.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount)[0]

    return {
      income, expense, saving, investment, net, savingRate,
      topCats, monthlyExp, monthlyInc,
      biggestExpMonth, bestSaveMonth, biggestExp,
      txCount: txs.length,
    }
  }, [txs])

  const yearOpts = Array.from({ length: 5 }, (_, i) => currentYear - i)

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Title bar */}
      <div className="flex items-end justify-between">
        <div>
          <p className="caps">Rekap Tahunan</p>
          <h2 className="text-3xl font-semibold tracking-tight mt-1" style={{ color: 'var(--ink)' }}>
            Wrapped {year}
          </h2>
        </div>
        <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {yearOpts.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Hero Card */}
      <div className="dark-card p-8 sm:p-12 relative overflow-hidden">
        <div className="absolute top-4 right-4">
          <Gift className="h-12 w-12" style={{ color: 'rgba(255,255,255,0.1)' }} />
        </div>
        <p className="caps">Your {year} in Review</p>
        <div className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <p className="caps" style={{ fontSize: '0.625rem' }}>Pemasukan Total</p>
            <p className="num tabular text-3xl sm:text-4xl font-semibold mt-1" style={{ color: 'var(--ink)' }}>
              {formatCurrency(recap.income)}
            </p>
          </div>
          <div>
            <p className="caps" style={{ fontSize: '0.625rem' }}>Pengeluaran Total</p>
            <p className="num tabular text-3xl sm:text-4xl font-semibold mt-1" style={{ color: 'var(--ink)' }}>
              {formatCurrency(recap.expense)}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'var(--black)', color: 'var(--lime-400)' }}>
            Saving Rate {recap.savingRate.toFixed(1)}%
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'var(--black-2)', color: 'var(--ink)', border: '1px solid var(--black-line)' }}>
            {recap.txCount} transaksi
          </span>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Top category */}
        <div className="s-card p-6">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4" style={{ color: 'var(--ink-muted)' }} />
            <p className="caps">Paling Boros</p>
          </div>
          <h3 className="text-lg font-semibold mt-1" style={{ color: 'var(--ink)' }}>Top 5 Kategori Pengeluaran</h3>
          <ul className="mt-4 space-y-2">
            {recap.topCats.map(([cat, amt], i) => (
              <li key={cat} className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 text-sm">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold"
                    style={{
                      background: i === 0 ? 'var(--lime-400)' : 'var(--surface-2)',
                      color: i === 0 ? 'var(--ink)' : 'var(--ink-muted)',
                    }}
                  >
                    {i + 1}
                  </span>
                  {cat}
                </span>
                <span className="num font-semibold tabular text-sm" style={{ color: 'var(--ink)' }}>
                  {formatCurrency(amt)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Monthly highlights */}
        <div className="s-card p-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" style={{ color: 'var(--ink-muted)' }} />
            <p className="caps">Highlight Bulanan</p>
          </div>
          <h3 className="text-lg font-semibold mt-1" style={{ color: 'var(--ink)' }}>Bulan Terbaik & Terboros</h3>
          <div className="mt-4 space-y-3">
            <div className="p-3 rounded-lg border" style={{ background: 'var(--lime-50)', borderColor: 'var(--lime-200)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--lime-700)' }}>
                💚 Bulan Terbaik (Saving)
              </p>
              <p className="font-semibold mt-1" style={{ color: 'var(--ink)' }}>
                {MONTHS[recap.bestSaveMonth]} {year}
              </p>
              <p className="num text-sm mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                Net: <span className="font-semibold" style={{ color: 'var(--lime-700)' }}>
                  +{formatCurrency(recap.monthlyInc[recap.bestSaveMonth] - recap.monthlyExp[recap.bestSaveMonth])}
                </span>
              </p>
            </div>
            <div className="p-3 rounded-lg border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-soft)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>
                💸 Bulan Paling Boros
              </p>
              <p className="font-semibold mt-1" style={{ color: 'var(--ink)' }}>
                {MONTHS[recap.biggestExpMonth]} {year}
              </p>
              <p className="num text-sm mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                Keluar: <span className="font-semibold" style={{ color: 'var(--ink)' }}>
                  {formatCurrency(recap.monthlyExp[recap.biggestExpMonth])}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Biggest expense */}
      {recap.biggestExp && (
        <div className="s-card p-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" style={{ color: 'var(--ink-muted)' }} />
            <p className="caps">Pengeluaran Terbesar</p>
          </div>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <p className="font-semibold text-lg" style={{ color: 'var(--ink)' }}>
                {recap.biggestExp.description || recap.biggestExp.category}
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                {recap.biggestExp.category} · {new Date(recap.biggestExp.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <p className="num tabular text-3xl font-semibold" style={{ color: 'var(--danger)' }}>
              {formatCurrency(recap.biggestExp.amount)}
            </p>
          </div>
        </div>
      )}

      <div className="text-center pt-4">
        <Button variant="outline" onClick={() => window.print()}>
          Cetak / Screenshot untuk share
        </Button>
      </div>
    </div>
  )
}
