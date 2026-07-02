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

import { useState } from 'react'
import Link from 'next/link'
import {
  Search, Bell, Eye, EyeOff, PencilLine, ArrowLeftRight, Upload, FileText,
  ChevronRight,
} from 'lucide-react'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { CategoryIcon } from '@/components/transactions/category-icon'
import { useT } from '@/lib/i18n/context'
import type { Transaction } from '@/types'

interface BudgetRow { category: string; budget: number; actual: number; pct: number }
interface InvestSummary { totalValue: number; totalCost: number; unrealizedPL: number; unrealizedPct: number }

export function MobileHome({
  greeting,
  todayLabel,
  netWorth,
  ytdPct,
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
  ytdPct: number | null
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
  const base = Math.max(income, expense, 1)

  const money = (n: number) => (hidden ? 'Rp ••••' : formatCompactCurrency(n))

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
      {/* 1 ── Greeting */}
      <div className="flex items-center gap-2.5 pt-1 pb-2.5 px-0.5">
        <Link
          href="/dashboard/profile"
          className="grid place-items-center size-8 rounded-full shrink-0 text-[13px] font-semibold"
          style={{ background: 'var(--c-mint-soft)', color: 'var(--c-mint-ink)' }}
          aria-label="Profil"
        >
          {greeting.split(', ')[1]?.[0]?.toUpperCase() ?? 'K'}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold leading-tight truncate" style={{ color: 'var(--ink)' }}>{greeting}</p>
          <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--ink-soft)' }}>{todayLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('klunting:open-command-palette'))}
          aria-label={t('common.search')}
          className="grid place-items-center size-9 rounded-full active:bg-[var(--surface-2)]"
          style={{ color: 'var(--ink-muted)' }}
        >
          <Search className="size-[19px]" />
        </button>
        <button
          type="button"
          aria-label="Notifikasi"
          className="grid place-items-center size-9 rounded-full active:bg-[var(--surface-2)]"
          style={{ color: 'var(--ink-muted)' }}
        >
          <Bell className="size-[19px]" />
        </button>
      </div>

      {/* 2 ── Hero + aksi cepat */}
      <section className="rounded-[20px] px-4 pt-4 pb-3.5" style={{ background: 'var(--hero-bg, #15151a)' }}>
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
        <p
          className="num tabular font-semibold leading-none mt-1"
          title={hidden ? undefined : formatCurrency(netWorth)}
          style={{ fontSize: 27, letterSpacing: '-0.02em', color: 'var(--on-hero, #fff)' }}
        >
          {money(netWorth)}
        </p>
        {ytdPct != null && (
          <span
            className="num inline-flex items-center mt-2 rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{
              background: 'color-mix(in srgb, var(--c-mint) 16%, transparent)',
              color: ytdPct >= 0 ? '#5dcaa5' : '#f0997b',
            }}
          >
            {ytdPct >= 0 ? '+' : ''}{ytdPct.toFixed(1)}% YTD
          </span>
        )}
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

      {/* 3 ── Bulan ini */}
      <div className="m-sec"><span>{t('dashboard.month_summary')}</span><Link href="/dashboard/monthly-report">{monthLabel} ›</Link></div>
      <section className="s-card px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('dashboard.sankey_in')}</p>
            <p className="num tabular text-[14.5px] font-semibold mt-0.5" title={formatCurrency(income)} style={{ color: 'var(--c-mint-ink)' }}>{money(income)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('dashboard.sankey_out')}</p>
            <p className="num tabular text-[14.5px] font-semibold mt-0.5" title={formatCurrency(expense)} style={{ color: 'var(--c-coral-ink)' }}>{money(expense)}</p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('dashboard.sankey_left')}</p>
            <p className="num tabular text-[14.5px] font-semibold mt-0.5" title={formatCurrency(sisa)} style={{ color: 'var(--ink)' }}>{money(sisa)}</p>
          </div>
        </div>
        <div className="mt-2.5 flex h-[5px] w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }} aria-hidden>
          <span style={{ width: `${(expense / base) * 100}%`, background: 'var(--c-coral)' }} />
          {sisa > 0 && <span style={{ width: `${(sisa / base) * 100}%`, background: 'var(--c-mint)' }} />}
        </div>
      </section>

      {/* 4 ── Anggaran */}
      {budget.length > 0 && (
        <>
          <div className="m-sec"><span>{t('nav.budgeting')}</span><Link href="/dashboard/budgeting">{t('dashboard.see_all')}</Link></div>
          <section className="s-card px-3.5 py-1">
            {budget.slice(0, 3).map((b, i) => (
              <div key={b.category} className="py-2.5" style={{ borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-medium truncate" style={{ color: 'var(--ink)' }}>{b.category}</span>
                  <span className="num tabular text-[11px] shrink-0" style={{ color: 'var(--ink-soft)' }}>
                    <b className="font-semibold" style={{ color: b.pct > 100 ? 'var(--c-coral-ink)' : 'var(--ink)' }}>{hidden ? '••' : formatCompactCurrency(b.actual)}</b>
                    {' / '}{hidden ? '••' : formatCompactCurrency(b.budget)}
                  </span>
                </div>
                <div className="mt-1.5 h-[5px] rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }} aria-hidden>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(b.pct, 100)}%`, background: b.pct > 100 ? 'var(--c-coral)' : 'var(--c-mint)' }} />
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {/* 5 ── Transaksi terakhir */}
      <div className="m-sec"><span>{t('dashboard.recent_transactions')}</span><Link href="/dashboard/transactions">{t('dashboard.see_all')}</Link></div>
      <section className="s-card px-3.5 py-1">
        {txs.length === 0 ? (
          <p className="text-[12.5px] py-3.5 text-center" style={{ color: 'var(--ink-soft)' }}>{t('dashboard.sankey_empty')}</p>
        ) : (
          txs.map((x, i) => (
            <div key={x.id} className="flex items-center gap-2.5 min-h-[50px]" style={{ borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
              <span
                className="grid place-items-center size-[30px] rounded-[9px] shrink-0"
                style={{
                  background: x.type === 'income' ? 'var(--c-mint-soft)' : x.type === 'expense' ? 'var(--c-coral-soft)' : 'var(--c-violet-soft)',
                  color: x.type === 'income' ? 'var(--c-mint-ink)' : x.type === 'expense' ? 'var(--c-coral-ink)' : 'var(--c-violet-ink)',
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
