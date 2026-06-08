'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { fetchLiquidEntries, sumLiquid } from '@/lib/liquid'
import { useT } from '@/lib/i18n/context'
import type { AssetNonLiquid, Investment } from '@/types'

import { Loader2, ArrowUpRight } from 'lucide-react'
import dynamic from 'next/dynamic'

// Defer recharts out of the assets route's initial JS (loads on chart mount).
const AllocationPie = dynamic(
  () => import('./assets-charts').then((m) => m.AllocationPie),
  { ssr: false, loading: () => <div className="animate-pulse rounded-lg" style={{ height: 220, background: 'var(--surface-2)' }} aria-hidden="true" /> },
)
const NonLiquidBar = dynamic(
  () => import('./assets-charts').then((m) => m.NonLiquidBar),
  { ssr: false, loading: () => <div className="animate-pulse rounded-lg" style={{ height: 260, background: 'var(--surface-2)' }} aria-hidden="true" /> },
)

const INVESTMENT_CATEGORY_LABELS: Record<string, string> = {
  stock: 'Saham', mutual_fund: 'Reksa Dana', crypto: 'Crypto',
  gold: 'Emas', bond: 'Obligasi', time_deposit: 'Deposito',
  p2p: 'P2P Lending', business: 'Bisnis',
}

export default function AssetsOverviewPage() {
  const t = useT()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [liquidTotal, setLiquidTotal] = useState(0)
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
    const [liquidEntries, nlqR, invR] = await Promise.all([
      fetchLiquidEntries(supabase, user.id),
      supabase.from('assets_non_liquid').select('*').eq('user_id', user.id),
      supabase.from('investments').select('*').eq('user_id', user.id),
    ])
    setLiquidTotal(sumLiquid(liquidEntries))
    setNonLiquid((nlqR.data ?? []) as AssetNonLiquid[])
    setInvestments((invR.data ?? []) as Investment[])
    setLoading(false)
  }

  const totals = useMemo(() => {
    const nlq = nonLiquid.reduce((s, a) => s + a.current_value, 0)
    const inv = investments.reduce((s, i) => s + (i.total_value || 0), 0)
    return { liq: liquidTotal, nlq, inv, total: liquidTotal + nlq + inv }
  }, [liquidTotal, nonLiquid, investments])

  const compositionBuckets = useMemo(() => [
    { id: 'liquid',     label: t('assets.liquid_assets'),     value: totals.liq, href: '/dashboard/assets/liquid' },
    { id: 'non_liquid', label: t('assets.non_liquid_assets'), value: totals.nlq, href: '/dashboard/assets/non-liquid' },
    { id: 'investment', label: t('assets.investments'),       value: totals.inv, href: '/dashboard/assets/investment' },
  ], [totals, t])

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
    property: '#10B981', vehicle: '#0EA5E9', personal_item: '#F59E0B',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--c-mint)' }} />
        <span className="ml-3 text-sm" style={{ color: 'var(--ink-muted)' }}>{t('assets.loading')}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, #0A0A0F 0%, #14141A 50%, #1C1C24 100%)',
          color: '#F5F5F7',
          boxShadow: '0 24px 60px -20px rgba(0,0,0,0.40)',
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: -100, right: -60, width: 400, height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.05), transparent 65%)',
          }}
        />
        <div className="relative p-6 sm:p-8">
        <p
          className="text-[11px] font-semibold tracking-[0.18em] uppercase"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          {t('assets.total_recorded_wealth')}
        </p>
        <p
          className="num tabular font-bold mt-4 leading-none whitespace-nowrap"
          style={{
            color: '#FFFFFF',
            fontSize: 'clamp(40px, 6vw, 64px)',
            letterSpacing: '-0.04em',
          }}
        >
          {formatCurrency(totals.total)}
        </p>
        <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {compositionBuckets.map((b) => {
            const pct = totals.total > 0 ? (b.value / totals.total) * 100 : 0
            return (
              <Link
                key={b.label}
                href={b.href}
                className="block rounded-xl p-4 transition"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
              >
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'rgba(255,255,255,0.55)' }}>{b.label}</p>
                <p className="num tabular mt-2 font-bold" style={{ fontSize: 20, color: '#FFFFFF' }}>
                  {formatCurrency(b.value)}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.10)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#34D399' }} />
                  </div>
                  <span className="text-[11px] num font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>{pct.toFixed(0)}%</span>
                </div>
                <div className="mt-2 flex items-center gap-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {t('assets.view_detail')}
                </div>
              </Link>
            )
          })}
        </div>
        </div>
      </section>

      {/* Row: Investment allocation + Non-liquid breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="s-card p-6 lg:col-span-2">
          <p className="eyebrow">{t('assets.investments')}</p>
          <h3 className="text-xl font-semibold mt-0.5">{t('assets.allocation_by_category')}</h3>
          {allocation.length === 0 ? (
            <div className="flex h-[240px] items-center justify-center text-sm" style={{ color: 'var(--ink-soft)' }}>
              {t('assets.no_investments')}
            </div>
          ) : (
            <>
              <AllocationPie data={allocation} />
              <div className="mt-3 space-y-1.5">
                {allocation.map((row, i) => {
                  const color = ['#10B981','#0EA5E9','#F59E0B','#F43F5E','#8B5CF6','#34D399','#7DD3FC','#737373'][i % 8]
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

        <div className="s-card p-6 lg:col-span-3">
          <p className="eyebrow">{t('assets.non_liquid_assets')}</p>
          <h3 className="text-xl font-semibold mt-0.5">{t('assets.breakdown_by_type')}</h3>
          {Object.keys(nonLiquidByCategory).length === 0 ? (
            <div className="flex h-[240px] items-center justify-center text-sm" style={{ color: 'var(--ink-soft)' }}>
              {t('assets.no_non_liquid_assets')}
            </div>
          ) : (
            <NonLiquidBar data={nonLiquidByCategory} categoryColors={categoryColors} />
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuickLink href="/dashboard/assets/liquid" title={t('assets.liquid_assets')} note={t('assets.liquid_note')} />
        <QuickLink href="/dashboard/assets/non-liquid" title={t('assets.non_liquid_assets')} note={`${nonLiquid.length} ${t('assets.assets_unit')}`} />
        <QuickLink href="/dashboard/assets/investment" title={t('assets.investments')} note={`${investments.length} ${t('assets.positions_unit')}`} />
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
