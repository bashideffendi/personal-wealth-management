'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { fetchLiquidEntries, sumLiquid } from '@/lib/liquid'
import { useT } from '@/lib/i18n/context'
import type { AssetNonLiquid, Investment } from '@/types'

import { Loader2, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

// Label kategori investasi via i18n (key di ns assets.cat_*).
const INVESTMENT_CATEGORY_KEYS: Record<string, string> = {
  stock: 'assets.cat_stock', mutual_fund: 'assets.cat_mutual_fund', crypto: 'assets.cat_crypto',
  gold: 'assets.cat_gold', bond: 'assets.cat_bond', time_deposit: 'assets.cat_time_deposit',
  p2p: 'assets.cat_p2p', business: 'assets.cat_business',
  forex: 'assets.cat_forex', sbn: 'assets.cat_sbn', pension: 'assets.cat_pension',
}

// Palet token buat pie + legend (didefinisikan di page biar lazy-boundary
// chart gak ketembus import statis).
const ALLOC_PALETTE = ['var(--c-mint)', 'var(--c-violet)', 'var(--c-amber)', 'var(--c-coral)', 'var(--ink)', 'var(--c-mint-ink)', 'var(--c-violet-ink)', 'var(--ink-soft)']

export default function AssetsOverviewPage() {
  const t = useT()
  const supabase = createClient()
  const pageQuery = useQuery({
    queryKey: ['assets-hub'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('unauthenticated')
      const [liquidEntries, nlqR, invR] = await Promise.all([
        fetchLiquidEntries(supabase, user.id, { strict: true }),
        supabase.from('assets_non_liquid').select('*').eq('user_id', user.id),
        supabase.from('investments').select('*').eq('user_id', user.id),
      ])
      if (nlqR.error) throw nlqR.error
      if (invR.error) throw invR.error
      return {
        liquidTotal: sumLiquid(liquidEntries),
        nonLiquid: (nlqR.data ?? []) as AssetNonLiquid[],
        investments: (invR.data ?? []) as Investment[],
      }
    },
  })
  const loading = pageQuery.isLoading
  const liquidTotal = pageQuery.data?.liquidTotal ?? 0
  const nonLiquid = useMemo(() => pageQuery.data?.nonLiquid ?? [], [pageQuery.data])
  const investments = useMemo(() => pageQuery.data?.investments ?? [], [pageQuery.data])

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
      .map(([k, v]) => ({ name: INVESTMENT_CATEGORY_KEYS[k] ? t(INVESTMENT_CATEGORY_KEYS[k]) : k, value: v }))
  }, [investmentByCategory, t])

  // Samain dengan halaman Aset Non-Likuid: properti=violet, kendaraan=amber, pribadi=mint.
  const categoryColors: Record<string, string> = {
    property: 'var(--c-violet)', vehicle: 'var(--c-amber)', personal_item: 'var(--c-mint)',
  }
  const nonLiquidRows = Object.entries(nonLiquidByCategory).map(([k, v]) => ({
    name: k === 'property' ? t('assets_nonliquid_cat.property') : k === 'vehicle' ? t('assets_nonliquid_cat.vehicle') : k === 'personal_item' ? t('assets_nonliquid_cat.personal_item') : k,
    value: v,
    color: categoryColors[k] ?? 'var(--c-mint)',
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--ink-soft)' }} />
        <span className="ml-3 text-sm" style={{ color: 'var(--ink-muted)' }}>{t('assets.loading')}</span>
      </div>
    )
  }

  if (pageQuery.isError) {
    return (
      <div className="s-card flex flex-col items-center text-center py-14 px-8 gap-3">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{t('common.load_failed')}</p>
        <Button variant="outline" onClick={() => pageQuery.refetch()}>{t('common.retry')}</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, #241F31 0%, #2C2640 50%, #322B45 100%)',
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
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--c-mint)' }} />
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
              <AllocationPie data={allocation} palette={ALLOC_PALETTE} />
              <div className="mt-3 space-y-1.5">
                {allocation.map((row, i) => {
                  const color = ALLOC_PALETTE[i % ALLOC_PALETTE.length]
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
            <NonLiquidBar rows={nonLiquidRows} />
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
