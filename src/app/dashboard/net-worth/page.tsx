'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { fetchLiquidEntries, sumCashEquivalent, sumReceivable } from '@/lib/liquid'
import type { NetWorthSnapshot } from '@/types'
import { projectNetWorth } from '@/lib/net-worth-projection'
import type { PayoffDebt } from '@/lib/debt-payoff'
import dynamic from 'next/dynamic'
import { Loader2, TrendingUp, TrendingDown, RefreshCw, Sparkles, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/context'

// Defer recharts out of the net-worth route's initial JS (loads on chart mount).
const ProjectionChart = dynamic(
  () => import('./net-worth-charts').then((m) => m.ProjectionChart),
  { ssr: false, loading: () => <div className="animate-pulse rounded-lg" style={{ height: '100%', background: 'var(--surface-2)' }} aria-hidden="true" /> },
)
const HistoryChart = dynamic(
  () => import('./net-worth-charts').then((m) => m.HistoryChart),
  { ssr: false, loading: () => <div className="animate-pulse rounded-lg" style={{ height: 300, background: 'var(--surface-2)' }} aria-hidden="true" /> },
)

interface NetWorthData {
  cashAndEquivalent: number
  receivable: number
  property: number
  vehicle: number
  personalItem: number
  longTermInvestment: number
  consumerDebt: number
  creditCard: number
  cashLoan: number
  longTermDebt: number
}

const todayLong = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

function nwMonthLabel(monthsAhead: number): string {
  const d = new Date(); d.setMonth(d.getMonth() + monthsAhead)
  return d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
}
function ccMinPaymentNW(balance: number): number {
  if (balance <= 0) return 0
  return Math.min(balance, Math.max(50_000, Math.round(balance * 0.1)))
}

/** Delta net worth vs snapshot terdekat ke tanggal target — SATU util buat
 *  hero & kartu riwayat (dulu logika ini di-copy-paste dua kali). Toleransi
 *  45 hari: kalau riwayat belum nyampe (snapshot tertua baru kemarin),
 *  tampil "—" daripada banding ke kemarin dan ngaku "vs bulan lalu". */
function snapshotDelta(snapshots: NetWorthSnapshot[], target: Date): { delta: number; pct: number } | null {
  if (snapshots.length < 2) return null
  const last = snapshots[snapshots.length - 1]
  let best: NetWorthSnapshot | null = null
  let bestDist = Infinity
  for (const s of snapshots) {
    const d = Math.abs(new Date(s.snapshot_date).getTime() - target.getTime())
    if (d < bestDist) { bestDist = d; best = s }
  }
  if (!best || best.snapshot_date === last.snapshot_date) return null
  if (bestDist > 45 * 86_400_000) return null
  const delta = last.net_worth - best.net_worth
  return { delta, pct: best.net_worth !== 0 ? (delta / Math.abs(best.net_worth)) * 100 : 0 }
}

export default function NetWorthPage() {
  const supabase = createClient()
  const t = useT()
  const qc = useQueryClient()
  const [period, setPeriod] = useState<'3m' | '6m' | '12m' | 'all'>('12m')
  const [nwStrategy, setNwStrategy] = useState<'snowball' | 'avalanche'>('avalanche')

  // react-query READ-ONLY — upsert snapshot dipisah ke efek di bawah.
  // Dulu fetchData nyampur read+write (buka halaman = nulis DB) dan nge-query
  // snapshots DUA kali (hasil pertama dibuang).
  const pageQuery = useQuery({
    queryKey: ['net-worth'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('unauthenticated')
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90)
      const [liquidEntries, nonLiquidRes, investmentRes, debtRes, ccRes, snapshotRes, txRes] = await Promise.all([
        fetchLiquidEntries(supabase, user.id, { strict: true }),
        supabase.from('assets_non_liquid').select('category, current_value').eq('user_id', user.id),
        supabase.from('investments').select('total_value').eq('user_id', user.id),
        supabase.from('debts').select('id, name, category, remaining, interest_rate, monthly_payment').eq('user_id', user.id).eq('is_active', true),
        supabase.from('credit_cards').select('id, name, current_balance, interest_rate').eq('user_id', user.id).eq('is_active', true),
        supabase.from('net_worth_snapshots').select('*').eq('user_id', user.id).order('snapshot_date'),
        supabase.from('transactions').select('amount, date').eq('user_id', user.id).eq('type', 'income').gte('date', cutoff.toISOString().slice(0, 10)),
      ])
      if (nonLiquidRes.error) throw nonLiquidRes.error
      if (debtRes.error) throw debtRes.error
      if (snapshotRes.error) throw snapshotRes.error

      type NonLiquidRow = { category: string; current_value: number }
      type DebtRow = { id: string; name: string; category: string; remaining: number; interest_rate: number; monthly_payment: number }
      const nonLiquidAssets = (nonLiquidRes.data ?? []) as NonLiquidRow[]
      const investments = (investmentRes.data ?? []) as { total_value: number }[]
      const debts = (debtRes.data ?? []) as DebtRow[]
      // Kartu kredit = utang revolving → ikut liabilitas
      const cards = (ccRes.data ?? []) as { id: string; name: string; current_balance: number; interest_rate: number }[]

      // Rata-rata income pakai jumlah bulan DISTINCT (cap 3, lantai 1) —
      // SAMA dengan halaman Utang, biar DTI konsisten antar halaman.
      const incomeRows = (txRes.data ?? []) as { amount: number; date: string }[]
      const totalIncome = incomeRows.reduce((s, r) => s + (r.amount || 0), 0)
      const incomeMonths = new Set(incomeRows.map((r) => (r.date || '').slice(0, 7)).filter(Boolean)).size

      const sumCat = (rows: NonLiquidRow[], cat: string) => rows.filter((a) => a.category === cat).reduce((s, a) => s + (a.current_value || 0), 0)
      const sumDebt = (cat: string) => debts.filter((d) => d.category === cat).reduce((s, d) => s + (d.remaining || 0), 0)
      const data: NetWorthData = {
        cashAndEquivalent: sumCashEquivalent(liquidEntries),
        receivable: sumReceivable(liquidEntries),
        property: sumCat(nonLiquidAssets, 'property'),
        vehicle: sumCat(nonLiquidAssets, 'vehicle'),
        personalItem: sumCat(nonLiquidAssets, 'personal_item'),
        longTermInvestment: investments.reduce((s, inv) => s + (inv.total_value || 0), 0),
        consumerDebt: sumDebt('consumer'),
        creditCard: cards.reduce((s, c) => s + (c.current_balance || 0), 0),
        cashLoan: sumDebt('cash_loan'),
        longTermDebt: sumDebt('long_term'),
      }
      return {
        data,
        snapshots: (snapshotRes.data ?? []) as NetWorthSnapshot[],
        monthlyIncome: incomeRows.length > 0 ? totalIncome / Math.min(3, Math.max(1, incomeMonths)) : 0,
        debtCount: debts.filter((d) => d.remaining > 0).length + cards.filter((c) => (c.current_balance || 0) > 0).length,
        // PayoffDebt[] buat proyeksi — mapping CC persis kayak halaman Utang.
        payoffDebts: [
          ...debts.filter((d) => d.remaining > 0).map((d) => ({ id: d.id, name: d.name, remaining: d.remaining, interest_rate: d.interest_rate || 0, monthly_payment: d.monthly_payment || 0 })),
          ...cards.filter((c) => (c.current_balance || 0) > 0).map((c) => ({ id: `cc:${c.id}`, name: c.name, remaining: c.current_balance, interest_rate: (c.interest_rate || 0) * 12, monthly_payment: ccMinPaymentNW(c.current_balance) })),
        ] as PayoffDebt[],
      }
    },
  })
  const loading = pageQuery.isLoading
  const data = pageQuery.data?.data ?? {
    cashAndEquivalent: 0, receivable: 0, property: 0, vehicle: 0, personalItem: 0,
    longTermInvestment: 0, consumerDebt: 0, creditCard: 0, cashLoan: 0, longTermDebt: 0,
  }
  const snapshots = useMemo(() => pageQuery.data?.snapshots ?? [], [pageQuery.data])
  const monthlyIncome = pageQuery.data?.monthlyIncome ?? 0
  const debtCount = pageQuery.data?.debtCount ?? 0
  const payoffDebts = useMemo(() => pageQuery.data?.payoffDebts ?? [], [pageQuery.data])

  // WRITE terpisah: snapshot harian di-upsert SETELAH data kebaca, dan cuma
  // kalau nilai hari ini belum tercatat / berubah — buka halaman gak lagi
  // selalu nulis DB.
  useEffect(() => {
    const d = pageQuery.data
    if (!d) return
    const totals = d.data
    const assets = totals.cashAndEquivalent + totals.receivable + totals.property + totals.vehicle + totals.personalItem + totals.longTermInvestment
    const debtsTotal = totals.consumerDebt + totals.creditCard + totals.cashLoan + totals.longTermDebt
    const todayISO = new Date().toISOString().split('T')[0]
    const last = d.snapshots[d.snapshots.length - 1]
    if (last && last.snapshot_date === todayISO && last.total_assets === assets && last.total_debts === debtsTotal) return
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('net_worth_snapshots').upsert(
        { user_id: user.id, snapshot_date: todayISO, total_assets: assets, total_debts: debtsTotal, net_worth: assets - debtsTotal },
        { onConflict: 'user_id,snapshot_date' },
      )
      if (!error) qc.invalidateQueries({ queryKey: ['net-worth'] })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageQuery.data])

  const totalCurrentAssets = data.cashAndEquivalent + data.receivable
  const totalNonCurrentAssets = data.property + data.vehicle + data.personalItem + data.longTermInvestment
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets
  const totalCurrentDebt = data.consumerDebt + data.creditCard + data.cashLoan
  const totalDebt = totalCurrentDebt + data.longTermDebt
  const netWorth = totalAssets - totalDebt
  const isPositive = netWorth >= 0
  const projection = useMemo(() => projectNetWorth(totalAssets, payoffDebts, nwStrategy), [totalAssets, payoffDebts, nwStrategy])
  const projAccent = nwStrategy === 'snowball' ? 'var(--c-mint)' : 'var(--c-violet)'
  const projChartData = useMemo(() => projection.points.map((p) => ({ label: nwMonthLabel(p.month), netWorth: p.netWorth })), [projection])

  const assetClasses = useMemo(() => ([
    { label: t('networth.class_investment'), value: data.longTermInvestment, color: 'var(--c-violet)' },
    { label: t('networth.class_cash'), value: data.cashAndEquivalent, color: 'var(--c-mint)' },
    { label: t('networth.class_property'), value: data.property, color: 'var(--c-amber)' },
    { label: t('networth.class_vehicle'), value: data.vehicle, color: 'var(--ink)' },
    { label: t('networth.class_personal_item'), value: data.personalItem, color: 'var(--ink-soft)' },
    { label: t('networth.class_receivable'), value: data.receivable, color: 'var(--c-mint-ink)' },
  ].filter((c) => c.value > 0)), [data, t])

  const heroStats = useMemo(() => {
    const now = new Date()
    return {
      vs1mo: snapshotDelta(snapshots, new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())),
      vsYtd: snapshotDelta(snapshots, new Date(now.getFullYear(), 0, 1)),
    }
  }, [snapshots])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin" /></div>
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
      {/* Slim header — judul gak diulang (ada di hero card di bawah) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: 'var(--ink-soft)' }}>
          {t('networth.eyebrow')} · {todayLong}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => document.getElementById('nw-history')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            <History className="h-4 w-4" /> {t('networth.history')}
          </Button>
          <Button onClick={() => pageQuery.refetch()} disabled={pageQuery.isFetching}>
            {pageQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {t('networth.refresh')}
          </Button>
        </div>
      </div>

      {/* Dark hero — 3 cell */}
      <section className="relative overflow-hidden rounded-2xl grid sm:grid-cols-[1.6fr_1fr_1fr]"
        style={{ background: 'linear-gradient(135deg, #0A0A0F 0%, #14141A 50%, #1C1C24 100%)', boxShadow: '0 24px 60px -20px rgba(0,0,0,0.40)' }}>
        <div className="absolute pointer-events-none" style={{ top: -80, left: -40, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.20), transparent 65%)' }} />
        <div className="absolute pointer-events-none" style={{ bottom: -80, right: -40, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.16), transparent 65%)' }} />
        <div className="relative p-6 sm:p-7 sm:border-r" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('networth.net_worth')}</p>
          <p className="num tabular font-bold mt-2 leading-none whitespace-nowrap" style={{ fontSize: 'clamp(40px,6vw,64px)', letterSpacing: '-0.04em', color: isPositive ? '#FFFFFF' : '#FDA4AF' }}>{formatCurrency(netWorth)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {heroStats?.vs1mo && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.08)', color: heroStats.vs1mo.delta >= 0 ? '#6EE7B7' : '#FDA4AF' }}>
                {heroStats.vs1mo.delta >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {heroStats.vs1mo.delta >= 0 ? '+' : ''}{formatCurrency(heroStats.vs1mo.delta)} {t('networth.vs_last_month_short')}
              </span>
            )}
            {heroStats?.vsYtd && (
              <span className="num rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.08)', color: heroStats.vsYtd.delta >= 0 ? '#6EE7B7' : '#FDA4AF' }}>
                YTD {heroStats.vsYtd.delta >= 0 ? '+' : ''}{heroStats.vsYtd.pct.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="relative p-6 sm:p-7 sm:border-r border-t sm:border-t-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('networth.total_assets')}</p>
          <p className="num tabular font-bold mt-2 leading-none" style={{ fontSize: 'clamp(20px,2.4vw,26px)', color: '#6EE7B7' }}>{formatCurrency(totalAssets)}</p>
          <p className="text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{assetClasses.length} {t('networth.asset_classes')}</p>
        </div>
        <div className="relative p-6 sm:p-7 border-t sm:border-t-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('networth.total_debt')}</p>
          <p className="num tabular font-bold mt-2 leading-none" style={{ fontSize: 'clamp(20px,2.4vw,26px)', color: totalDebt > 0 ? '#FDA4AF' : '#6EE7B7' }}>{totalDebt > 0 ? `−${formatCurrency(totalDebt)}` : formatCurrency(0)}</p>
          <p className="text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{debtCount} {t('networth.active_debts')}</p>
        </div>
      </section>

      <div id="nw-history">
        <NetWorthHistoryCard snapshots={snapshots} period={period} onPeriodChange={setPeriod} />
      </div>

      {/* Proyeksi net worth saat utang lunas — pakai engine payoff yg sama dgn halaman Utang */}
      {payoffDebts.length > 0 && totalDebt > 0 && (
        <section className="s-card p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="max-w-md">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('networth.debt_free_projection')}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>{t('networth.debt_free_projection_desc')}</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {(['snowball', 'avalanche'] as const).map((s) => (
                <button key={s} onClick={() => setNwStrategy(s)} aria-pressed={nwStrategy === s} aria-label={`${t('networth.strategy')} ${s}`} className="rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition"
                  style={{ background: nwStrategy === s ? (s === 'snowball' ? 'var(--c-mint)' : 'var(--c-violet)') : 'var(--surface-2)', color: nwStrategy === s ? '#FFF' : 'var(--ink)' }}>{s}</button>
              ))}
            </div>
          </div>
          {projection.feasible ? (
            <>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('networth.debt_free_by')}</p><p className="num text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{nwMonthLabel(projection.months)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('networth.net_worth_becomes')}</p><p className="num text-sm font-semibold mt-0.5" style={{ color: 'var(--c-mint-ink)' }}>{formatCurrency(projection.endNetWorth)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('networth.increase')}</p><p className="num text-sm font-semibold mt-0.5" style={{ color: 'var(--c-mint-ink)' }}>+{formatCurrency(projection.endNetWorth - projection.startNetWorth)}</p></div>
              </div>
              <div className="mt-4" style={{ height: 200 }}>
                <ProjectionChart data={projChartData} accent={projAccent} />
              </div>
              <p className="mt-2 text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('networth.projection_cta_prefix')} <a href="/dashboard/debts" className="underline" style={{ color: 'var(--ink-muted)' }}>{t('networth.projection_cta_link')}</a>.</p>
            </>
          ) : (
            <p className="mt-3 text-[12px]" style={{ color: 'var(--c-amber)' }}>{t('networth.projection_not_feasible')}</p>
          )}
        </section>
      )}

      {/* Rincian aset & liabilitas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="s-card p-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--c-mint-ink)' }}>{t('networth.asset_breakdown')}</p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>{t('networth.current_assets')}</p>
              <Row label={t('networth.cash_and_equivalent')} value={data.cashAndEquivalent} />
              <Row label={t('networth.receivable')} value={data.receivable} />
              <SubtotalRow label={t('networth.subtotal_current_assets')} value={totalCurrentAssets} color="var(--c-mint)" ink="var(--c-mint-ink)" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>{t('networth.non_current_assets')}</p>
              <Row label={t('networth.long_term_investment')} value={data.longTermInvestment} />
              <Row label={t('networth.property')} value={data.property} />
              <Row label={t('networth.vehicle_equipment')} value={data.vehicle} />
              <Row label={t('networth.personal_item')} value={data.personalItem} />
              <SubtotalRow label={t('networth.subtotal_non_current_assets')} value={totalNonCurrentAssets} color="var(--c-mint)" ink="var(--c-mint-ink)" />
            </div>
            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border-soft)' }}>
              <span className="font-semibold" style={{ color: 'var(--ink)' }}>{t('networth.total_assets')}</span>
              <span className="num font-bold" style={{ color: 'var(--c-mint-ink)' }}>{formatCurrency(totalAssets)}</span>
            </div>
          </div>
        </div>

        <div className="s-card p-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--c-coral-ink)' }}>{t('networth.liabilities_breakdown')}</p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>{t('networth.current_debt')}</p>
              <Row label={t('networth.consumer_debt')} value={data.consumerDebt} neg />
              <Row label={t('networth.credit_card')} value={data.creditCard} neg />
              <Row label={t('networth.cash_loan')} value={data.cashLoan} neg />
              <SubtotalRow label={t('networth.subtotal_current_debt')} value={totalCurrentDebt} color="var(--c-coral)" ink="var(--c-coral-ink)" neg />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>{t('networth.long_term_debt')}</p>
              <Row label={t('networth.mortgage_long_term')} value={data.longTermDebt} neg />
              <SubtotalRow label={t('networth.subtotal_long_term')} value={data.longTermDebt} color="var(--c-coral)" ink="var(--c-coral-ink)" neg />
            </div>
            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border-soft)' }}>
              <span className="font-semibold" style={{ color: 'var(--ink)' }}>{t('networth.total_debt')}</span>
              <span className="num font-bold" style={{ color: 'var(--c-coral-ink)' }}>{totalDebt > 0 ? `−${formatCurrency(totalDebt)}` : formatCurrency(0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Komposisi + Rasio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="s-card p-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('networth.asset_composition')}</p>
          {totalAssets > 0 ? (
            <>
              <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                {assetClasses.map((c) => (<div key={c.label} style={{ width: `${(c.value / totalAssets) * 100}%`, background: c.color }} />))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
                {assetClasses.map((c) => (
                  <div key={c.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 min-w-0"><span className="size-2 rounded-full shrink-0" style={{ background: c.color }} /><span className="truncate" style={{ color: 'var(--ink-muted)' }}>{c.label}</span></span>
                    <span className="num font-semibold shrink-0" style={{ color: 'var(--ink)' }}>{((c.value / totalAssets) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-sm mt-3" style={{ color: 'var(--ink-soft)' }}>{t('networth.no_assets')}</p>}
        </div>

        <HealthRatiosCard
          liquidAssets={totalCurrentAssets}
          totalAssets={totalAssets}
          totalDebt={totalDebt}
          currentDebt={totalCurrentDebt}
          investmentValue={data.longTermInvestment}
          netWorth={netWorth}
          monthlyIncome={monthlyIncome}
          monthlyDebtPayment={payoffDebts.reduce((s, d) => s + (d.monthly_payment || 0), 0)}
        />
      </div>
    </div>
  )
}

function HealthRatiosCard({ liquidAssets, totalAssets, totalDebt, currentDebt, investmentValue, netWorth, monthlyIncome, monthlyDebtPayment }: {
  liquidAssets: number; totalAssets: number; totalDebt: number; currentDebt: number; investmentValue: number; netWorth: number; monthlyIncome: number; monthlyDebtPayment: number
}) {
  const t = useT()
  const liquidity = currentDebt > 0 ? liquidAssets / currentDebt : null
  const solvency = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : null
  // DTI yang bener: CICILAN bulanan / penghasilan bulanan (konsisten dgn
  // halaman Utang). Rumus lama (total utang / penghasilan setahun) itu metrik
  // beda yang dipajang pakai label & ambang DTI.
  const dti = monthlyIncome > 0 ? (monthlyDebtPayment / monthlyIncome) * 100 : null
  const investRatio = netWorth > 0 ? (investmentValue / netWorth) * 100 : null
  const rows = [
    { label: t('networth.ratio_liquidity'), ideal: t('networth.ratio_liquidity_ideal'), value: liquidity != null ? `${liquidity >= 99 ? '∞' : liquidity.toFixed(0)}x` : '—', ok: liquidity == null || liquidity >= 1 },
    { label: t('networth.ratio_solvency'), ideal: t('networth.ratio_solvency_ideal'), value: solvency != null ? `${solvency.toFixed(1)}%` : '—', ok: solvency != null && solvency < 50 },
    { label: t('networth.ratio_dti'), ideal: t('networth.ratio_dti_ideal'), value: dti != null ? `${dti.toFixed(1)}%` : '—', ok: dti != null && dti < 36 },
    { label: t('networth.ratio_investment'), ideal: t('networth.ratio_investment_ideal'), value: investRatio != null ? `${investRatio.toFixed(1)}%` : '—', ok: investRatio != null && investRatio >= 30 },
  ]
  return (
    <div className="s-card p-5">
      <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('networth.balance_health_ratios')}</p>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5">
        {rows.map((r) => {
          const c = r.value === '—' ? 'var(--ink-soft)' : r.ok ? 'var(--c-mint-ink)' : 'var(--c-amber-ink)'
          return (
            <div key={r.label}>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full shrink-0" style={{ background: c }} />
                <p className="text-[11px] truncate" style={{ color: 'var(--ink-muted)' }}>{r.label}</p>
              </div>
              <p className="num tabular font-bold mt-1.5 leading-none" style={{ fontSize: 26, color: c }}>{r.value}</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--ink-soft)' }}>{r.ideal}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Row({ label, value, neg = false }: { label: string; value: number; neg?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>{label}</span>
      <span className="num text-sm" style={{ color: 'var(--ink-muted)' }}>{neg && value > 0 ? '−' : ''}{formatCurrency(value)}</span>
    </div>
  )
}
function SubtotalRow({ label, value, color, ink, neg = false }: { label: string; value: number; color: string; ink: string; neg?: boolean }) {
  return (
    <div className="flex items-center justify-between mt-1.5 rounded-md px-2 py-1.5" style={{ background: `color-mix(in srgb, ${color} 6%, transparent)` }}>
      <span className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>{label}</span>
      <span className="num text-[12px] font-semibold" style={{ color: ink }}>{neg && value > 0 ? '−' : ''}{formatCurrency(value)}</span>
    </div>
  )
}

interface HistoryProps {
  snapshots: NetWorthSnapshot[]
  period: '3m' | '6m' | '12m' | 'all'
  onPeriodChange: (p: '3m' | '6m' | '12m' | 'all') => void
}

function NetWorthHistoryCard({ snapshots, period, onPeriodChange }: HistoryProps) {
  const t = useT()
  const filtered = useMemo(() => {
    if (period === 'all' || snapshots.length === 0) return snapshots
    const now = new Date()
    const months = period === '3m' ? 3 : period === '6m' ? 6 : 12
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    return snapshots.filter((s) => new Date(s.snapshot_date) >= cutoff)
  }, [snapshots, period])

  const stats = useMemo(() => {
    const now = new Date()
    return {
      vs1mo: snapshotDelta(snapshots, new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())),
      vs3mo: snapshotDelta(snapshots, new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())),
      vsYtd: snapshotDelta(snapshots, new Date(now.getFullYear(), 0, 1)),
    }
  }, [snapshots])

  const chartData = useMemo(() => filtered.map((s) => ({
    date: new Date(s.snapshot_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }),
    rawDate: s.snapshot_date, assets: s.total_assets, debts: -s.total_debts, net: s.net_worth,
  })), [filtered])

  const periodLabels = { '3m': t('networth.period_3m'), '6m': t('networth.period_6m'), '12m': t('networth.period_12m'), all: t('networth.period_all') }

  return (
    <div className="s-card p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('networth.history')}</p>
          <h3 className="text-lg mt-0.5" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>{t('networth.history_heading')}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {(['3m', '6m', '12m', 'all'] as const).map((p) => (
            <button key={p} type="button" onClick={() => onPeriodChange(p)} className="text-[11px] font-medium px-2.5 py-1 rounded-md transition"
              style={{ background: period === p ? 'var(--ink)' : 'var(--surface-2)', color: period === p ? 'var(--surface)' : 'var(--ink-muted)' }}>
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {snapshots.length <= 1 ? (
        <div className="rounded-xl border-2 border-dashed p-8 text-center" style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-soft)' }}>
          <Sparkles className="size-7 mx-auto mb-2 opacity-50" style={{ color: 'var(--c-mint)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('networth.first_snapshot_today')}</p>
          <p className="text-xs mt-1.5">{t('networth.first_snapshot_hint')}</p>
        </div>
      ) : (
        <>
          <HistoryChart data={chartData} />
          {stats && (
            <div className="mt-5 pt-4 border-t grid grid-cols-3 gap-3" style={{ borderColor: 'var(--border-soft)' }}>
              <ChangeStat label={t('networth.vs_last_month')} change={stats.vs1mo} />
              <ChangeStat label={t('networth.vs_3_months_ago')} change={stats.vs3mo} />
              <ChangeStat label={t('networth.ytd_start_of_year')} change={stats.vsYtd} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ChangeStat({ label, change }: { label: string; change: { delta: number; pct: number } | null }) {
  if (!change) {
    return <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{label}</p><p className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>—</p></div>
  }
  const positive = change.delta >= 0
  const color = positive ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)'
  const Icon = positive ? TrendingUp : TrendingDown
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{label}</p>
      <p className="num tabular text-base font-semibold mt-0.5 flex items-center gap-1" style={{ color }}><Icon className="size-3.5" />{positive ? '+' : ''}{formatCurrency(change.delta)}</p>
      <p className="text-[11px] mt-0.5" style={{ color }}>{positive ? '+' : ''}{change.pct.toFixed(1)}%</p>
    </div>
  )
}
