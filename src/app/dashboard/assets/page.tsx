'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { AssetLiquid, AssetNonLiquid, Investment } from '@/types'

import { Loader2, ArrowUpRight } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const INVESTMENT_CATEGORY_LABELS: Record<string, string> = {
  stock: 'Saham', mutual_fund: 'Reksa Dana', crypto: 'Crypto',
  gold: 'Emas', bond: 'Obligasi', time_deposit: 'Deposito',
  p2p: 'P2P Lending', business: 'Bisnis',
}

export default function AssetsOverviewPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [liquid, setLiquid] = useState<AssetLiquid[]>([])
  const [nonLiquid, setNonLiquid] = useState<AssetNonLiquid[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [liqR, nlqR, invR] = await Promise.all([
      supabase.from('assets_liquid').select('*').eq('user_id', user.id),
      supabase.from('assets_non_liquid').select('*').eq('user_id', user.id),
      supabase.from('investments').select('*').eq('user_id', user.id),
    ])
    setLiquid((liqR.data ?? []) as AssetLiquid[])
    setNonLiquid((nlqR.data ?? []) as AssetNonLiquid[])
    setInvestments((invR.data ?? []) as Investment[])
    setLoading(false)
  }

  const totals = useMemo(() => {
    const liq = liquid.reduce((s, a) => s + a.balance, 0)
    const nlq = nonLiquid.reduce((s, a) => s + a.current_value, 0)
    const inv = investments.reduce((s, i) => s + (i.total_value || 0), 0)
    return { liq, nlq, inv, total: liq + nlq + inv }
  }, [liquid, nonLiquid, investments])

  const compositionBuckets = useMemo(() => [
    { label: 'Aset Likuid',     value: totals.liq, href: '/dashboard/assets/liquid' },
    { label: 'Aset Non-Likuid', value: totals.nlq, href: '/dashboard/assets/non-liquid' },
    { label: 'Investasi',       value: totals.inv, href: '/dashboard/assets/investment' },
  ], [totals])

  const nonLiquidByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of nonLiquid) map[a.category] = (map[a.category] || 0) + a.current_value
    return map
  }, [nonLiquid])

  const investmentByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const i of investments) map[i.category] = (map[i.category] || 0) + (i.total_value || 0)
    return map
  }, [investments])

  const allocation = useMemo(() => {
    return Object.entries(investmentByCategory)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: INVESTMENT_CATEGORY_LABELS[k] ?? k, value: v }))
  }, [investmentByCategory])

  const categoryColors: Record<string, string> = {
    property: '#0A0A0A', vehicle: '#737373', personal_item: '#14B8A6',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--indigo-600)' }} />
        <span className="ml-3 text-sm" style={{ color: 'var(--ink-muted)' }}>Memuat aset...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="dark-card p-6 sm:p-8">
        <p className="caps">Total Kekayaan Tercatat</p>
        <p className="num tabular mt-4 text-white text-4xl sm:text-5xl lg:text-6xl font-semibold">
          {formatCurrency(totals.total)}
        </p>
        <div className="mt-7 grid grid-cols-3 gap-3">
          {compositionBuckets.map((b) => {
            const pct = totals.total > 0 ? (b.value / totals.total) * 100 : 0
            return (
              <Link
                key={b.label}
                href={b.href}
                className="block rounded-lg p-4 transition border"
                style={{ background: 'var(--black-2)', borderColor: 'var(--black-line)' }}
              >
                <p className="caps">{b.label}</p>
                <p className="num mt-2 text-white text-lg sm:text-xl font-semibold">
                  {formatCurrency(b.value)}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--lime-400)' }} />
                  </div>
                  <span className="text-[11px] num" style={{ color: 'var(--on-black-mut)' }}>{pct.toFixed(0)}%</span>
                </div>
                <div className="mt-2 flex items-center gap-0.5 text-[11px]" style={{ color: 'var(--on-black-mut)' }}>
                  Lihat detail
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Row: Investment allocation + Non-liquid breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="glass-card p-6 lg:col-span-2">
          <p className="caps">Investasi</p>
          <h3 className="font-display text-xl mt-0.5">Alokasi per Kategori</h3>
          {allocation.length === 0 ? (
            <div className="flex h-[240px] items-center justify-center text-sm" style={{ color: 'var(--ink-soft)' }}>
              Belum ada investasi.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={allocation} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="transparent">
                    {allocation.map((_, i) => (
                      <Cell key={i} fill={['#6366F1','#10B981','#06B6D4','#8B5CF6','#F59E0B','#F43F5E','#0EA5E9','#14B8A6'][i % 8]} />
                    ))}
                  </Pie>
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => formatCurrency(Number(v) || 0)}
                    contentStyle={{ background: '#fff', border: '1px solid var(--border-soft)', borderRadius: 10, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {allocation.map((row, i) => {
                  const color = ['#6366F1','#10B981','#06B6D4','#8B5CF6','#F59E0B','#F43F5E','#0EA5E9','#14B8A6'][i % 8]
                  const pct = totals.inv > 0 ? (row.value / totals.inv) * 100 : 0
                  return (
                    <div key={row.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2" style={{ color: 'var(--ink-muted)' }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                        {row.name}
                      </span>
                      <span className="tabular font-medium" style={{ color: 'var(--ink)' }}>{pct.toFixed(1)}%</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="glass-card p-6 lg:col-span-3">
          <p className="caps">Aset Non-Likuid</p>
          <h3 className="font-display text-xl mt-0.5">Breakdown per Tipe</h3>
          {Object.keys(nonLiquidByCategory).length === 0 ? (
            <div className="flex h-[240px] items-center justify-center text-sm" style={{ color: 'var(--ink-soft)' }}>
              Belum ada aset non-likuid.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={Object.entries(nonLiquidByCategory).map(([k, v]) => ({ name: ({ property: 'Properti', vehicle: 'Kendaraan', personal_item: 'Barang Pribadi' } as Record<string, string>)[k] ?? k, value: v, color: categoryColors[k] ?? '#6366F1' }))}>
                <defs>
                  <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0A0A0A" stopOpacity={1} />
                    <stop offset="100%" stopColor="#0A0A0A" stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                <XAxis dataKey="name" fontSize={11} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => formatCurrency(Number(v) || 0)}
                  contentStyle={{ background: '#fff', border: '1px solid var(--border-soft)', borderRadius: 10, fontSize: 12 }}
                />
                <Bar dataKey="value" fill="url(#bar-grad)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuickLink href="/dashboard/assets/liquid" title="Aset Likuid" note={`${liquid.length} rekening & kas`} />
        <QuickLink href="/dashboard/assets/non-liquid" title="Aset Non-Likuid" note={`${nonLiquid.length} aset`} />
        <QuickLink href="/dashboard/assets/investment" title="Investasi" note={`${investments.length} posisi`} />
      </div>
    </div>
  )
}

function QuickLink({
  href, title, note,
}: {
  href: string
  title: string
  note: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-lg p-4 bg-[var(--surface)] border border-[var(--border-soft)] hover:border-[var(--ink)] transition-colors"
    >
      <div>
        <p className="font-semibold" style={{ color: 'var(--ink)' }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>{note}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
    </Link>
  )
}
