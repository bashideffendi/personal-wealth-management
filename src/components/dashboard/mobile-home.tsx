'use client'

/**
 * MobileHome — Beranda mobile hasil redesign F9 (mockup approved 2026-07-02).
 *
 * STRUKTUR (jangan ditambah-tambah — keputusan: Beranda ≤ 6 modul):
 *   1. Greeting row (avatar + sapaan + search/bell)
 *   2. Hero charcoal: kekayaan bersih compact + 4 aksi cepat (ala GoPay)
 *   3. "Bulan ini"   : masuk / keluar / sisa + bar komposisi
 *   4. "Anggaran"    : top-3 kategori ber-progress → /budgeting
 *   5. "Transaksi terakhir" : 3 baris → /transactions
 *   6. "Portofolio"  : nilai + P/L → /assets/investment
 * Widget dashboard lain (kalender, sankey, skor, dst) TIDAK dirender di
 * mobile — rumahnya di halaman masing-masing. Desktop tetap bento penuh.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Search, Bell, Eye, EyeOff, PencilLine, ArrowLeftRight, Upload, FileText,
  ChevronRight, TrendingUp, TrendingDown,
} from 'lucide-react'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { CategoryIcon } from '@/components/transactions/category-icon'
import { categoryHue } from '@/lib/category-hue'
import { useT } from '@/lib/i18n/context'
import type { Transaction } from '@/types'

interface BudgetRow { category: string; budget: number; actual: number; pct: number }
interface InvestSummary { totalValue: number; totalCost: number; unrealizedPL: number; unrealizedPct: number }
interface TrendPoint { net: number }

export function MobileHome({
  greeting,
  todayLabel,
  netWorth,
  trend,
  income,
  expense,
  monthLabel,
  budget,
  transactions,
  investment,
}: {
  greeting: string
  todayLabel: string
  netWorth: number
  /** net cashflow per bulan berjalan tahun ini — bahan sparkline + pill delta */
  trend: TrendPoint[]
  income: number
  expense: number
  monthLabel: string
  budget: BudgetRow[]
  transactions: Transaction[]
  investment: InvestSummary | null
}) {
  const t = useT()
  const [hidden, setHidden] = useState(false)
  const sisa = income - expense

  const money = (n: number) => (hidden ? 'Rp ••••' : formatCompactCurrency(n))

  // Sparkline hero: kumulatif disintesis mundur dari net worth sekarang
  // (resep sama dengan NetWorthHero desktop) — cukup buat bentuk tren.
  const spark = useMemo(() => {
    if (trend.length < 3) return null
    let running = netWorth
    const vals: number[] = []
    for (let i = trend.length - 1; i >= 0; i--) {
      vals.unshift(running)
      running -= trend[i].net
    }
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const range = max - min || 1
    const W = 92
    const H = 34
    const points = vals
      .map((v, i) => `${((i / (vals.length - 1)) * W).toFixed(1)},${(H - 3 - ((v - min) / range) * (H - 6)).toFixed(1)}`)
      .join(' ')
    return { points, up: vals[vals.length - 1] >= vals[0], W, H }
  }, [trend, netWorth])

  const monthDelta = trend.length > 0 ? trend[trend.length - 1].net : 0

  const txs = [...transactions]
    .filter((x) => x.category !== 'Transfer')
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 3)

  const actions = [
    { icon: PencilLine, label: t('dashboard.qa_note'), onClick: () => window.dispatchEvent(new CustomEvent('klunting:quick-add')) },
    { icon: ArrowLeftRight, label: t('transactions.transfer'), href: '/dashboard/transactions' },
    { icon: Upload, label: t('dashboard.qa_import'), href: '/dashboard/transactions/import' },
    { icon: FileText, label: t('dashboard.qa_report'), href: '/dashboard/monthly-report' },
  ]

  return (
    <div className="md:hidden">
      {/* 1 ── Brand bar + greeting (F10: logo balik ke Beranda, keputusan user) */}
      <div className="flex items-center gap-2 pt-1.5 pb-1 px-0.5">
        <div className="flex items-center gap-[7px] flex-1 min-w-0">
          <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
            <rect x="35" y="3" width="30" height="30" rx="9" fill="#17b890" />
            <rect x="3" y="35" width="30" height="30" rx="9" fill="#f0664f" />
            <rect x="67" y="35" width="30" height="30" rx="9" fill="#5d6fe0" />
            <rect x="35" y="67" width="30" height="30" rx="9" fill="#8b4fb0" />
          </svg>
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 17.5, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            klunting
          </span>
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('klunting:open-command-palette'))}
          aria-label={t('common.search')}
          className="grid place-items-center size-9 rounded-full active:opacity-70"
          style={{ background: 'var(--surface)', color: 'var(--ink)', boxShadow: '0 1px 2px rgba(24,24,27,0.05)' }}
        >
          <Search className="size-[16px]" />
        </button>
        <button
          type="button"
          aria-label="Notifikasi"
          className="grid place-items-center size-9 rounded-full active:opacity-70"
          style={{ background: 'var(--surface)', color: 'var(--ink)', boxShadow: '0 1px 2px rgba(24,24,27,0.05)' }}
        >
          <Bell className="size-[16px]" />
        </button>
      </div>
      <p className="text-[12.5px] pb-2.5 px-0.5" style={{ color: 'var(--ink-soft)' }}>
        <span className="font-medium" style={{ color: 'var(--ink)' }}>{greeting}</span> · {todayLabel}
      </p>

      {/* 2 ── Hero + aksi cepat */}
      <section
        className="rounded-[20px] px-4 pt-4 pb-3.5"
        style={{ background: 'var(--hero-bg, #15151a)', boxShadow: '0 12px 28px rgba(10, 10, 14, 0.18)' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ color: 'var(--on-hero-mut, #8d919c)' }}>
            {t('networth.net_worth')}
          </p>
          <button
            type="button"
            onClick={() => setHidden((v) => !v)}
            aria-label={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
            className="grid place-items-center size-7 -mr-1 rounded-full"
            style={{ color: 'var(--on-hero-mut, #8d919c)' }}
          >
            {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p
              className="num tabular font-semibold leading-none mt-1"
              title={hidden ? undefined : formatCurrency(netWorth)}
              style={{ fontSize: 27, letterSpacing: '-0.02em', color: 'var(--on-hero, #fff)' }}
            >
              {money(netWorth)}
            </p>
            {monthDelta !== 0 && (
              <span
                className="num inline-flex items-center gap-1 mt-2 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{
                  background: monthDelta >= 0
                    ? 'color-mix(in srgb, var(--c-mint) 16%, transparent)'
                    : 'color-mix(in srgb, var(--c-coral) 18%, transparent)',
                  color: monthDelta >= 0 ? '#3ad3a8' : '#ff9a85',
                }}
              >
                {monthDelta >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {monthDelta >= 0 ? '+' : '−'}{hidden ? '••' : formatCompactCurrency(Math.abs(monthDelta)).replace('Rp ', 'Rp')} {t('dashboard.month_summary').toLowerCase()}
              </span>
            )}
          </div>
          {spark && (
            <svg
              width={spark.W}
              height={spark.H}
              viewBox={`0 0 ${spark.W} ${spark.H}`}
              className="shrink-0 mb-0.5"
              aria-hidden="true"
            >
              <polyline
                points={spark.points}
                fill="none"
                stroke={spark.up ? '#3ad3a8' : '#ff9a85'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <div className="mt-3.5 grid grid-cols-4 gap-1 text-center">
          {actions.map((a) => {
            const inner = (
              <>
                <span className="grid place-items-center size-10 mx-auto rounded-full" style={{ background: 'rgba(255,255,255,0.09)', color: '#fff' }}>
                  <a.icon className="size-[18px]" />
                </span>
                <span className="block text-[11px] mt-1" style={{ color: 'color-mix(in srgb, var(--on-hero, #fff) 68%, transparent)' }}>{a.label}</span>
              </>
            )
            return a.href ? (
              <Link key={a.label} href={a.href} className="active:opacity-70 transition-opacity">{inner}</Link>
            ) : (
              <button key={a.label} type="button" onClick={a.onClick} className="active:opacity-70 transition-opacity">{inner}</button>
            )
          })}
        </div>
      </section>

      {/* 3 ── Bulan ini (F10: donut mini masuk-vs-keluar, ganti bar) */}
      <div className="m-sec"><span>{t('dashboard.month_summary')}</span><Link href="/dashboard/monthly-report">{monthLabel} ›</Link></div>
      <section className="s-card px-3.5 py-3 flex items-center gap-3">
        {(() => {
          const C = 2 * Math.PI * 18
          const tot = income + expense
          const inArc = tot > 0 ? (income / tot) * C : 0
          const outArc = tot > 0 ? (expense / tot) * C : 0
          return (
            <svg width="46" height="46" viewBox="0 0 46 46" className="shrink-0" aria-hidden="true">
              <circle cx="23" cy="23" r="18" fill="none" stroke="var(--surface-2)" strokeWidth="7" />
              {inArc > 0 && (
                <circle
                  cx="23" cy="23" r="18" fill="none" stroke="var(--c-mint)" strokeWidth="7"
                  strokeDasharray={`${inArc} ${C}`} strokeLinecap={outArc > 0 ? 'butt' : 'round'}
                  transform="rotate(-90 23 23)"
                />
              )}
              {outArc > 0 && (
                <circle
                  cx="23" cy="23" r="18" fill="none" stroke="var(--c-coral)" strokeWidth="7"
                  strokeDasharray={`${outArc} ${C}`} strokeDashoffset={-inArc}
                  transform="rotate(-90 23 23)"
                />
              )}
            </svg>
          )
        })()}
        <div className="flex-1 grid grid-cols-3 gap-1">
          <div className="min-w-0">
            <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('dashboard.sankey_in')}</p>
            <p className="num tabular text-[14px] font-semibold mt-0.5" title={formatCurrency(income)} style={{ color: 'var(--c-mint-ink)' }}>{money(income)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('dashboard.sankey_out')}</p>
            <p className="num tabular text-[14px] font-semibold mt-0.5" title={formatCurrency(expense)} style={{ color: 'var(--c-coral-ink)' }}>{money(expense)}</p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('dashboard.sankey_left')}</p>
            <p className="num tabular text-[14px] font-semibold mt-0.5" title={formatCurrency(sisa)} style={{ color: 'var(--ink)' }}>{sisa > 0 && !hidden ? '+' : ''}{money(sisa)}</p>
          </div>
        </div>
      </section>

      {/* 4 ── Anggaran */}
      {budget.length > 0 && (
        <>
          <div className="m-sec"><span>{t('nav.budgeting')}</span><Link href="/dashboard/budgeting">{t('dashboard.see_all')}</Link></div>
          <section className="s-card px-3.5 py-1">
            {budget.slice(0, 3).map((b, i) => {
              const hue = categoryHue(b.category)
              return (
                <div key={b.category} className="flex items-center gap-2.5 py-2.5" style={{ borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
                  <span
                    className="grid place-items-center size-7 rounded-[9px] shrink-0"
                    style={{ background: hue.soft, color: hue.ink }}
                  >
                    <CategoryIcon category={b.category} className="size-[14px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12.5px] font-medium truncate" style={{ color: 'var(--ink)' }}>{b.category}</span>
                      <span className="num tabular text-[11px] shrink-0" style={{ color: 'var(--ink-soft)' }}>
                        <b className="font-semibold" style={{ color: b.pct > 100 ? 'var(--c-coral-ink)' : 'var(--ink)' }}>{hidden ? '••' : formatCompactCurrency(b.actual)}</b>
                        {' / '}{hidden ? '••' : formatCompactCurrency(b.budget)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-[5px] rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }} aria-hidden>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(b.pct, 100)}%`, background: b.pct > 100 ? 'var(--c-coral)' : hue.bar }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </section>
        </>
      )}

      {/* 5 ── Transaksi terakhir */}
      <div className="m-sec"><span>{t('dashboard.recent_transactions')}</span><Link href="/dashboard/transactions">{t('dashboard.see_all')}</Link></div>
      <section className="s-card px-3.5 py-1">
        {txs.length === 0 ? (
          <div className="py-5 text-center">
            <span className="grid place-items-center size-10 rounded-[14px] mx-auto" style={{ background: 'var(--c-mint-soft)', color: 'var(--c-mint-ink)' }}>
              <PencilLine className="size-[18px]" />
            </span>
            <p className="text-[12.5px] mt-2 max-w-[260px] mx-auto" style={{ color: 'var(--ink-muted)' }}>{t('dashboard.sankey_empty')}</p>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('klunting:quick-add'))}
              className="mt-2.5 rounded-full px-3.5 py-1.5 text-[11.5px] font-medium active:opacity-70"
              style={{ background: 'var(--ink)', color: 'var(--surface)' }}
            >
              {t('dashboard.qa_note')}
            </button>
          </div>
        ) : (
          txs.map((x, i) => (
            <div key={x.id} className="flex items-center gap-2.5 min-h-[50px]" style={{ borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
              <span
                className="grid place-items-center size-[30px] rounded-[9px] shrink-0"
                style={{
                  background: x.type === 'income' ? 'var(--c-mint-soft)' : categoryHue(x.category).soft,
                  color: x.type === 'income' ? 'var(--c-mint-ink)' : categoryHue(x.category).ink,
                }}
              >
                <CategoryIcon category={x.category} className="size-[15px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium truncate leading-tight" style={{ color: 'var(--ink)' }}>{x.description || x.category}</p>
                <p className="text-[11px] leading-tight mt-0.5 truncate" style={{ color: 'var(--ink-soft)' }}>
                  {new Date(x.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} · {x.category}
                </p>
              </div>
              <p className="num tabular text-[12.5px] font-semibold shrink-0" style={{ color: x.type === 'income' ? 'var(--c-mint-ink)' : x.type === 'expense' ? 'var(--c-coral-ink)' : 'var(--ink)' }}>
                {hidden ? '••••' : `${x.type === 'income' ? '+' : x.type === 'expense' ? '−' : ''}${formatCurrency(x.amount).replace('Rp', '').trim()}`}
              </p>
            </div>
          ))
        )}
      </section>

      {/* 6 ── Portofolio */}
      {investment && investment.totalValue > 0 && (
        <>
          <div className="m-sec"><span>{t('dashboard.portfolio')}</span><Link href="/dashboard/assets/investment">{t('dashboard.see_all')}</Link></div>
          <Link href="/dashboard/assets/investment" className="s-card px-3.5 py-3 flex items-center gap-3 active:opacity-80 transition-opacity" style={{ display: 'flex' }}>
            <div className="min-w-0 flex-1">
              <p className="num tabular text-[16px] font-semibold" title={formatCurrency(investment.totalValue)} style={{ color: 'var(--ink)' }}>{money(investment.totalValue)}</p>
              {investment.totalCost > 0 && (
                <p className="num tabular text-[11.5px] font-medium mt-0.5" style={{ color: investment.unrealizedPL >= 0 ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
                  {investment.unrealizedPL >= 0 ? '+' : ''}{hidden ? '••' : formatCompactCurrency(investment.unrealizedPL)} ({investment.unrealizedPct >= 0 ? '+' : ''}{investment.unrealizedPct.toFixed(1)}%)
                </p>
              )}
            </div>
            <ChevronRight className="size-4 shrink-0" style={{ color: 'var(--ink-soft)' }} />
          </Link>
        </>
      )}
    </div>
  )
}
