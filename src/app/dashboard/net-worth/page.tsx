'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { fetchLiquidEntries, sumCashEquivalent, sumReceivable } from '@/lib/liquid'
import type { NetWorthSnapshot } from '@/types'
import { projectNetWorth } from '@/lib/net-worth-projection'
import type { PayoffDebt } from '@/lib/debt-payoff'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Loader2, TrendingUp, TrendingDown, Camera, Sparkles, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/context'

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

export default function NetWorthPage() {
  const supabase = createClient()
  const t = useT()
  const [loading, setLoading] = useState(true)
  const [snapshotting, setSnapshotting] = useState(false)
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([])
  const [period, setPeriod] = useState<'3m' | '6m' | '12m' | 'all'>('12m')
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [data, setData] = useState<NetWorthData>({
    cashAndEquivalent: 0, receivable: 0, property: 0, vehicle: 0, personalItem: 0,
    longTermInvestment: 0, consumerDebt: 0, creditCard: 0, cashLoan: 0, longTermDebt: 0,
  })
  const [debtCount, setDebtCount] = useState(0)
  const [payoffDebts, setPayoffDebts] = useState<PayoffDebt[]>([])
  const [nwStrategy, setNwStrategy] = useState<'snowball' | 'avalanche'>('avalanche')

  useEffect(() => { void fetchData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90)
    const [liquidEntries, nonLiquidRes, investmentRes, debtRes, ccRes, snapshotRes, txRes] = await Promise.all([
      fetchLiquidEntries(supabase, user.id),
      supabase.from('assets_non_liquid').select('category, current_value').eq('user_id', user.id),
      supabase.from('investments').select('total_value').eq('user_id', user.id),
      supabase.from('debts').select('id, name, category, remaining, interest_rate, monthly_payment').eq('user_id', user.id).eq('is_active', true),
      supabase.from('credit_cards').select('id, name, current_balance, interest_rate').eq('user_id', user.id).eq('is_active', true),
      supabase.from('net_worth_snapshots').select('*').eq('user_id', user.id).order('snapshot_date'),
      supabase.from('transactions').select('amount').eq('user_id', user.id).eq('type', 'income').gte('date', cutoff.toISOString().slice(0, 10)),
    ])

    type NonLiquidRow = { category: string; current_value: number }
    type DebtRow = { id: string; name: string; category: string; remaining: number; interest_rate: number; monthly_payment: number }
    const nonLiquidAssets = (nonLiquidRes.data ?? []) as NonLiquidRow[]
    const investments = (investmentRes.data ?? []) as { total_value: number }[]
    const debts = (debtRes.data ?? []) as DebtRow[]
    // Kartu kredit = utang revolving → ikut liabilitas
    const cards = (ccRes.data ?? []) as { id: string; name: string; current_balance: number; interest_rate: number }[]
    const creditCardDebt = cards.reduce((s, c) => s + (c.current_balance || 0), 0)
    setDebtCount(debts.filter((d) => d.remaining > 0).length + cards.filter((c) => (c.current_balance || 0) > 0).length)
    // PayoffDebt[] buat proyeksi — mapping CC persis kayak halaman Utang (interest ×12, min payment).
    setPayoffDebts([
      ...debts.filter((d) => d.remaining > 0).map((d) => ({ id: d.id, name: d.name, remaining: d.remaining, interest_rate: d.interest_rate || 0, monthly_payment: d.monthly_payment || 0 })),
      ...cards.filter((c) => (c.current_balance || 0) > 0).map((c) => ({ id: `cc:${c.id}`, name: c.name, remaining: c.current_balance, interest_rate: (c.interest_rate || 0) * 12, monthly_payment: ccMinPaymentNW(c.current_balance) })),
    ])

    const incomeRows = (txRes.data ?? []) as { amount: number }[]
    setMonthlyIncome(incomeRows.length > 0 ? incomeRows.reduce((s, t) => s + (t.amount || 0), 0) / 3 : 0)

    const sumCat = (rows: NonLiquidRow[], cat: string) => rows.filter((a) => a.category === cat).reduce((s, a) => s + (a.current_value || 0), 0)
    const sumDebt = (cat: string) => debts.filter((d) => d.category === cat).reduce((s, d) => s + (d.remaining || 0), 0)

    const next: NetWorthData = {
      cashAndEquivalent: sumCashEquivalent(liquidEntries),
      receivable: sumReceivable(liquidEntries),
      property: sumCat(nonLiquidAssets, 'property'),
      vehicle: sumCat(nonLiquidAssets, 'vehicle'),
      personalItem: sumCat(nonLiquidAssets, 'personal_item'),
      longTermInvestment: investments.reduce((s, inv) => s + (inv.total_value || 0), 0),
      consumerDebt: sumDebt('consumer'),
      creditCard: creditCardDebt,
      cashLoan: sumDebt('cash_loan'),
      longTermDebt: sumDebt('long_term'),
    }
    setData(next)

    const totalAssetsNow = next.cashAndEquivalent + next.receivable + next.property + next.vehicle + next.personalItem + next.longTermInvestment
    const totalDebtsNow = next.consumerDebt + next.creditCard + next.cashLoan + next.longTermDebt
    const todayISO = new Date().toISOString().split('T')[0]
    await supabase.from('net_worth_snapshots').upsert(
      { user_id: user.id, snapshot_date: todayISO, total_assets: totalAssetsNow, total_debts: totalDebtsNow, net_worth: totalAssetsNow - totalDebtsNow },
      { onConflict: 'user_id,snapshot_date' },
    )
    const refreshed = await supabase.from('net_worth_snapshots').select('*').eq('user_id', user.id).order('snapshot_date')
    setSnapshots((refreshed.data ?? []) as NetWorthSnapshot[])
    setLoading(false)
  }

  async function takeManualSnapshot() { setSnapshotting(true); await fetchData(); setSnapshotting(false) }

  const totalCurrentAssets = data.cashAndEquivalent + data.receivable
  const totalNonCurrentAssets = data.property + data.vehicle + data.personalItem + data.longTermInvestment
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets
  const totalCurrentDebt = data.consumerDebt + data.creditCard + data.cashLoan
  const totalDebt = totalCurrentDebt + data.longTermDebt
  const netWorth = totalAssets - totalDebt
  const isPositive = netWorth >= 0
  const projection = useMemo(() => projectNetWorth(totalAssets, payoffDebts, nwStrategy), [totalAssets, payoffDebts, nwStrategy])
  const projAccent = nwStrategy === 'snowball' ? '#10B981' : '#8B5CF6'
  const projChartData = useMemo(() => projection.points.map((p) => ({ label: nwMonthLabel(p.month), netWorth: p.netWorth })), [projection])

  const assetClasses = useMemo(() => ([
    { label: t('networth.class_investment'), value: data.longTermInvestment, color: '#8B5CF6' },
    { label: t('networth.class_cash'), value: data.cashAndEquivalent, color: '#10B981' },
    { label: t('networth.class_property'), value: data.property, color: '#F59E0B' },
    { label: t('networth.class_vehicle'), value: data.vehicle, color: '#6366F1' },
    { label: t('networth.class_personal_item'), value: data.personalItem, color: '#F43F5E' },
    { label: t('networth.class_receivable'), value: data.receivable, color: '#14B8A6' },
  ].filter((c) => c.value > 0)), [data, t])

  const heroStats = useMemo(() => {
    if (snapshots.length < 2) return null
    const last = snapshots[snapshots.length - 1]
    const findClosest = (target: Date) => {
      let best: NetWorthSnapshot | null = null, bestDist = Infinity
      for (const s of snapshots) { const d = Math.abs(new Date(s.snapshot_date).getTime() - target.getTime()); if (d < bestDist) { bestDist = d; best = s } }
      return best
    }
    const now = new Date()
    const d = (from: NetWorthSnapshot | null) => (from && from.snapshot_date !== last.snapshot_date)
      ? { delta: last.net_worth - from.net_worth, pct: from.net_worth ? (last.net_worth - from.net_worth) / Math.abs(from.net_worth) * 100 : 0 } : null
    return {
      vs1mo: d(findClosest(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()))),
      vsYtd: d(findClosest(new Date(now.getFullYear(), 0, 1))),
    }
  }, [snapshots])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin" /></div>
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
          <Button onClick={takeManualSnapshot} disabled={snapshotting}>
            {snapshotting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {t('networth.manual_snapshot')}
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
        <NetWorthHistoryCard snapshots={snapshots} period={period} onPeriodChange={setPeriod} onSnapshot={takeManualSnapshot} snapshotting={snapshotting} />
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
                  style={{ background: nwStrategy === s ? (s === 'snowball' ? '#10B981' : '#8B5CF6') : 'var(--surface-2)', color: nwStrategy === s ? '#FFF' : 'var(--ink)' }}>{s}</button>
              ))}
            </div>
          </div>
          {projection.feasible ? (
            <>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('networth.debt_free_by')}</p><p className="num text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{nwMonthLabel(projection.months)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('networth.net_worth_becomes')}</p><p className="num text-sm font-semibold mt-0.5" style={{ color: '#10B981' }}>{formatCurrency(projection.endNetWorth)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('networth.increase')}</p><p className="num text-sm font-semibold mt-0.5" style={{ color: '#10B981' }}>+{formatCurrency(projection.endNetWorth - projection.startNetWorth)}</p></div>
              </div>
              <div className="mt-4" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projChartData} margin={{ top: 6, right: 10, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--ink-soft)' }} interval="preserveStartEnd" minTickGap={28} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => formatCompactCurrency(Number(v))} tick={{ fontSize: 10, fill: 'var(--ink-soft)' }} width={62} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', fontSize: 12 }} />
                    <ReferenceLine y={0} stroke="var(--border)" />
                    <Line type="monotone" dataKey="netWorth" name={t('networth.net_worth')} stroke={projAccent} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
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
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: '#10B981' }}>{t('networth.asset_breakdown')}</p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>{t('networth.current_assets')}</p>
              <Row label={t('networth.cash_and_equivalent')} value={data.cashAndEquivalent} />
              <Row label={t('networth.receivable')} value={data.receivable} />
              <SubtotalRow label={t('networth.subtotal_current_assets')} value={totalCurrentAssets} color="#10B981" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>{t('networth.non_current_assets')}</p>
              <Row label={t('networth.long_term_investment')} value={data.longTermInvestment} />
              <Row label={t('networth.property')} value={data.property} />
              <Row label={t('networth.vehicle_equipment')} value={data.vehicle} />
              <Row label={t('networth.personal_item')} value={data.personalItem} />
              <SubtotalRow label={t('networth.subtotal_non_current_assets')} value={totalNonCurrentAssets} color="#10B981" />
            </div>
            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border-soft)' }}>
              <span className="font-semibold" style={{ color: 'var(--ink)' }}>{t('networth.total_assets')}</span>
              <span className="num font-bold" style={{ color: '#10B981' }}>{formatCurrency(totalAssets)}</span>
            </div>
          </div>
        </div>

        <div className="s-card p-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: '#F43F5E' }}>{t('networth.liabilities_breakdown')}</p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>{t('networth.current_debt')}</p>
              <Row label={t('networth.consumer_debt')} value={data.consumerDebt} neg />
              <Row label={t('networth.credit_card')} value={data.creditCard} neg />
              <Row label={t('networth.cash_loan')} value={data.cashLoan} neg />
              <SubtotalRow label={t('networth.subtotal_current_debt')} value={totalCurrentDebt} color="#F43F5E" neg />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--ink-soft)' }}>{t('networth.long_term_debt')}</p>
              <Row label={t('networth.mortgage_long_term')} value={data.longTermDebt} neg />
              <SubtotalRow label={t('networth.subtotal_long_term')} value={data.longTermDebt} color="#F43F5E" neg />
            </div>
            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border-soft)' }}>
              <span className="font-semibold" style={{ color: 'var(--ink)' }}>{t('networth.total_debt')}</span>
              <span className="num font-bold" style={{ color: '#F43F5E' }}>{totalDebt > 0 ? `−${formatCurrency(totalDebt)}` : formatCurrency(0)}</span>
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
        />
      </div>
    </div>
  )
}

function HealthRatiosCard({ liquidAssets, totalAssets, totalDebt, currentDebt, investmentValue, netWorth, monthlyIncome }: {
  liquidAssets: number; totalAssets: number; totalDebt: number; currentDebt: number; investmentValue: number; netWorth: number; monthlyIncome: number
}) {
  const t = useT()
  const liquidity = currentDebt > 0 ? liquidAssets / currentDebt : null
  const solvency = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : null
  const dti = monthlyIncome > 0 ? (totalDebt / (monthlyIncome * 12)) * 100 : null
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
          const c = r.value === '—' ? 'var(--ink-soft)' : r.ok ? '#10B981' : '#F59E0B'
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
function SubtotalRow({ label, value, color, neg = false }: { label: string; value: number; color: string; neg?: boolean }) {
  return (
    <div className="flex items-center justify-between mt-1.5 rounded-md px-2 py-1.5" style={{ background: `${color}0F` }}>
      <span className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>{label}</span>
      <span className="num text-[12px] font-semibold" style={{ color }}>{neg && value > 0 ? '−' : ''}{formatCurrency(value)}</span>
    </div>
  )
}

interface HistoryProps {
  snapshots: NetWorthSnapshot[]
  period: '3m' | '6m' | '12m' | 'all'
  onPeriodChange: (p: '3m' | '6m' | '12m' | 'all') => void
  onSnapshot: () => void
  snapshotting: boolean
}

function NetWorthHistoryCard({ snapshots, period, onPeriodChange, onSnapshot, snapshotting }: HistoryProps) {
  const t = useT()
  const filtered = useMemo(() => {
    if (period === 'all' || snapshots.length === 0) return snapshots
    const now = new Date()
    const months = period === '3m' ? 3 : period === '6m' ? 6 : 12
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    return snapshots.filter((s) => new Date(s.snapshot_date) >= cutoff)
  }, [snapshots, period])

  const stats = useMemo(() => {
    if (snapshots.length === 0) return null
    const last = snapshots[snapshots.length - 1]
    const findClosest = (target: Date) => {
      let best: NetWorthSnapshot | null = null, bestDist = Infinity
      for (const s of snapshots) { const dist = Math.abs(new Date(s.snapshot_date).getTime() - target.getTime()); if (dist < bestDist) { bestDist = dist; best = s } }
      return best
    }
    const now = new Date()
    const delta = (from: NetWorthSnapshot | null) => {
      if (!from || from.snapshot_date === last.snapshot_date) return null
      const d = last.net_worth - from.net_worth
      return { delta: d, pct: from.net_worth !== 0 ? (d / Math.abs(from.net_worth)) * 100 : 0 }
    }
    return {
      vs1mo: delta(findClosest(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()))),
      vs3mo: delta(findClosest(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()))),
      vsYtd: delta(findClosest(new Date(now.getFullYear(), 0, 1))),
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
          <Button variant="outline" size="sm" onClick={onSnapshot} disabled={snapshotting} className="ml-1">
            {snapshotting ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
          </Button>
        </div>
      </div>

      {snapshots.length <= 1 ? (
        <div className="rounded-xl border-2 border-dashed p-8 text-center" style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-soft)' }}>
          <Sparkles className="size-7 mx-auto mb-2 opacity-50" style={{ color: '#10B981' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('networth.first_snapshot_today')}</p>
          <p className="text-xs mt-1.5">{t('networth.first_snapshot_hint')}</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="g-assets" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity={0.85} /><stop offset="100%" stopColor="#10B981" stopOpacity={0.55} /></linearGradient>
                <linearGradient id="g-debts" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#F43F5E" stopOpacity={0.85} /><stop offset="100%" stopColor="#F43F5E" stopOpacity={0.55} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
              <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
              <XAxis dataKey="date" fontSize={11} tick={{ fill: 'var(--ink-muted)' }} axisLine={{ stroke: 'var(--border-soft)' }} tickLine={false} />
              <YAxis fontSize={11} tickFormatter={(v: number) => formatCompactCurrency(v)} tick={{ fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} width={70} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as { rawDate: string; assets: number; debts: number; net: number }
                return (
                  <div className="rounded-md border px-3 py-2 text-xs shadow-md" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}>
                    <p className="font-semibold mb-1.5">{new Date(p.rawDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <p className="num tabular flex justify-between gap-3"><span style={{ color: '#10B981' }}>● {t('networth.assets')}</span><span>{formatCurrency(p.assets)}</span></p>
                    <p className="num tabular flex justify-between gap-3"><span style={{ color: '#F43F5E' }}>● {t('networth.debt')}</span><span>{formatCurrency(Math.abs(p.debts))}</span></p>
                    <p className="num tabular flex justify-between gap-3 font-semibold mt-1 pt-1 border-t" style={{ borderColor: 'var(--border-soft)' }}><span style={{ color: '#8B5CF6' }}>● {t('networth.net_worth')}</span><span>{formatCurrency(p.net)}</span></p>
                  </div>
                )
              }} />
              <Bar dataKey="assets" name={t('networth.assets')} fill="url(#g-assets)" stackId="a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="debts" name={t('networth.debt')} fill="url(#g-debts)" stackId="a" radius={[0, 0, 4, 4]} />
              <Line type="monotone" dataKey="net" name={t('networth.net_worth')} stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 3, fill: '#8B5CF6', stroke: 'var(--surface)', strokeWidth: 2 }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
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
  const color = positive ? '#10B981' : '#F43F5E'
  const Icon = positive ? TrendingUp : TrendingDown
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{label}</p>
      <p className="num tabular text-base font-semibold mt-0.5 flex items-center gap-1" style={{ color }}><Icon className="size-3.5" />{positive ? '+' : ''}{formatCurrency(change.delta)}</p>
      <p className="text-[11px] mt-0.5" style={{ color }}>{positive ? '+' : ''}{change.pct.toFixed(1)}%</p>
    </div>
  )
}
