'use client'

/**
 * MobileHome — Beranda mobile F13 ala app "Budget" iOS (review user 2026-07-07
 * + mockup di-approve).
 *
 * STRUKTUR:
 *   1. Header 2 baris: logo kecil center → [profil] ‹ Bulan › [%+bell]
 *      (bulan BENAR-BENAR center, panah rapat — kritik review ronde-9)
 *   2. "Pengeluaran Rp X" → grid 3 kolom kartu pastel; kartu = kategori yang
 *      DIANGGARKAN bulan itu ∪ kategori ber-transaksi (bukan taksonomi statis);
 *      ikon bulat solid dapat RING progress terpakai-vs-anggaran ala Budget.
 *   3. "Pemasukan Rp X" → grid kategori pemasukan aktif.
 *   4. Baris kekayaan bersih (1 baris → /net-worth).
 * Tap kartu → MobileQuickEntry (input realisasi + sub + sisa budget).
 * Kosong total → empty state ala Budget (bukan grid Rp0).
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ChevronDown, Bell, ChevronRight as ChevRight, Target } from 'lucide-react'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { CategoryIcon } from '@/components/transactions/category-icon'
import { categoryHue } from '@/lib/category-hue'
import { MobileQuickEntry } from '@/components/dashboard/mobile-quick-entry'
import { SUB_SEP } from '@/lib/budget-categories'
import { monthLong } from '@/lib/i18n/dates'
import { useI18n } from '@/lib/i18n/context'
import type { Transaction } from '@/types'

interface BudgetRow { category: string; budget: number; actual: number; pct: number }

interface Card {
  category: string
  amount: number
  budget: number
  ringPct: number | null
}

const rootOf = (cat: string) => {
  const i = cat.indexOf(SUB_SEP)
  return i === -1 ? cat : cat.slice(0, i)
}

export function MobileHome({
  month,
  year,
  onPrevMonth,
  onNextMonth,
  netWorth,
  transactions,
  budget,
  budgetKeys,
}: {
  month: number
  year: number
  onPrevMonth: () => void
  onNextMonth: () => void
  netWorth: number
  transactions: Transaction[]
  /** rollup induk (expense) bulan terpilih: {category, budget, actual, pct} */
  budget: BudgetRow[]
  /** leaf key budget expense (komposit `Induk › Sub`) — bahan chip sub */
  budgetKeys: string[]
}) {
  const { t, locale } = useI18n()
  const [entry, setEntry] = useState<{ category: string; type: 'expense' | 'income'; budget: number; spent: number; subs: string[] } | null>(null)

  // ── Kartu pengeluaran: dianggarkan ∪ ber-transaksi, rollup ke induk ──
  const { expenseCards, incomeCards, totalExpense, totalIncome } = useMemo(() => {
    const spentByRoot = new Map<string, number>()
    const incomeByRoot = new Map<string, number>()
    for (const x of transactions) {
      if (x.category === 'Transfer') continue
      const root = rootOf(x.category)
      if (x.type === 'expense') spentByRoot.set(root, (spentByRoot.get(root) ?? 0) + x.amount)
      else if (x.type === 'income') incomeByRoot.set(root, (incomeByRoot.get(root) ?? 0) + x.amount)
    }
    const byCat = new Map<string, Card>()
    for (const b of budget) {
      byCat.set(b.category, {
        category: b.category,
        amount: spentByRoot.get(b.category) ?? 0,
        budget: b.budget,
        ringPct: b.budget > 0 ? Math.min(((spentByRoot.get(b.category) ?? 0) / b.budget) * 100, 100) : null,
      })
    }
    for (const [root, amount] of spentByRoot) {
      if (!byCat.has(root)) byCat.set(root, { category: root, amount, budget: 0, ringPct: null })
    }
    const expenseCards = [...byCat.values()].sort((a, b) => (b.budget - a.budget) || (b.amount - a.amount))
    const incomeCards: Card[] = [...incomeByRoot.entries()]
      .map(([category, amount]) => ({ category, amount, budget: 0, ringPct: null }))
      .sort((a, b) => b.amount - a.amount)
    const totalExpense = [...spentByRoot.values()].reduce((s, v) => s + v, 0)
    const totalIncome = [...incomeByRoot.values()].reduce((s, v) => s + v, 0)
    return { expenseCards, incomeCards, totalExpense, totalIncome }
  }, [transactions, budget])

  const usagePct = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : null

  const subsFor = (parent: string) =>
    budgetKeys.filter((k) => k.startsWith(parent + SUB_SEP)).map((k) => k.slice(parent.length + SUB_SEP.length))

  const openEntry = (c: Card, type: 'expense' | 'income') =>
    setEntry({ category: c.category, type, budget: c.budget, spent: c.amount, subs: type === 'expense' ? subsFor(c.category) : [] })

  const renderCard = (c: Card, type: 'expense' | 'income') => {
    const hue = categoryHue(c.category)
    const over = c.budget > 0 && c.amount > c.budget
    const ringColor = over ? 'var(--c-coral)' : hue.bar
    const CIRC = 2 * Math.PI * 19
    return (
      <button
        key={c.category}
        type="button"
        onClick={() => openEntry(c, type)}
        className="rounded-[20px] px-1.5 py-4 text-center active:opacity-70 transition-opacity"
        style={{ background: hue.soft }}
      >
        <span className="block text-[12px] font-medium leading-tight min-h-[28px] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden" style={{ color: 'var(--ink)' }}>
          {c.category}
        </span>
        <span className="relative grid place-items-center size-[44px] mx-auto my-1.5">
          {c.ringPct != null && (
            <svg width="44" height="44" viewBox="0 0 44 44" className="absolute inset-0" aria-hidden="true">
              <circle cx="22" cy="22" r="19" fill="none" stroke={ringColor} strokeOpacity="0.25" strokeWidth="2.5" />
              <circle
                cx="22" cy="22" r="19" fill="none" stroke={ringColor} strokeWidth="2.5"
                strokeDasharray={`${(c.ringPct / 100) * CIRC} ${CIRC}`} strokeLinecap="round"
                transform="rotate(-90 22 22)"
              />
            </svg>
          )}
          <span className="grid place-items-center size-[34px] rounded-full" style={{ background: hue.bar, color: '#fff' }}>
            <CategoryIcon category={c.category} className="size-4" />
          </span>
        </span>
        <span
          className="num tabular block font-semibold break-all"
          style={{ fontSize: c.amount >= 1_000_000_000 ? 11.5 : 12, color: over ? 'var(--c-coral-ink)' : 'var(--ink)' }}
        >
          {formatCurrency(c.amount)}
        </span>
      </button>
    )
  }

  const empty = expenseCards.length === 0 && incomeCards.length === 0

  const now = new Date()
  const isCurrentMonth = month - 1 === now.getMonth() && year === now.getFullYear()

  return (
    <div className="md:hidden">
      {/* 1a ── Logo kecil di atas-center (ala "Budget" di status area) */}
      <div className="flex items-center justify-center gap-1.5 pt-1 pb-2">
        <svg width="16" height="16" viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
          <rect x="35" y="3" width="30" height="30" rx="9" fill="#17b890" />
          <rect x="3" y="35" width="30" height="30" rx="9" fill="#f0664f" />
          <rect x="67" y="35" width="30" height="30" rx="9" fill="#5d6fe0" />
          <rect x="35" y="67" width="30" height="30" rx="9" fill="#8b4fb0" />
        </svg>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12.5, letterSpacing: '-0.01em', color: 'var(--ink)' }}>klunting</span>
      </div>

      {/* 1b ── [profil] ‹ Bulan › [% + bell] — sisi fixed-width biar bulan
          center optik beneran (kritik review: bulan gak center, panah kejauhan) */}
      <div className="flex items-center pb-3.5 px-0.5">
        <div className="w-[76px] flex justify-start">
          <Link
            href="/dashboard/profile"
            aria-label="Profil"
            className="inline-flex items-center gap-0.5 text-[15px] font-semibold"
            style={{ color: 'var(--c-mint-ink)' }}
          >
            BD <ChevronDown className="size-3" />
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center gap-1.5">
          <button type="button" onClick={onPrevMonth} aria-label="Bulan sebelumnya" className="grid place-items-center size-7 rounded-full active:opacity-60" style={{ color: 'var(--ink-soft)' }}>
            <ChevronLeft className="size-[15px]" />
          </button>
          <span className="text-[15px] font-semibold text-center" style={{ color: 'var(--ink)' }}>
            {isCurrentMonth ? t('common.this_month') : `${monthLong(month - 1, locale)} ${year}`}
          </span>
          <button type="button" onClick={onNextMonth} aria-label="Bulan berikutnya" className="grid place-items-center size-7 rounded-full active:opacity-60" style={{ color: 'var(--ink-soft)' }}>
            <ChevronRight className="size-[15px]" />
          </button>
        </div>
        <div className="w-[76px] flex justify-end items-center gap-1.5">
          {usagePct != null && (
            <span className="num text-[11px] font-medium" style={{ color: usagePct > 100 ? 'var(--c-coral-ink)' : 'var(--ink-soft)' }}>{usagePct}%</span>
          )}
          <button
            type="button"
            aria-label="Notifikasi"
            className="grid place-items-center size-[30px] rounded-full active:opacity-60"
            style={{ background: 'var(--surface)', color: 'var(--ink)', boxShadow: '0 1px 2px rgba(24,24,27,0.05)' }}
          >
            <Bell className="size-[14px]" />
          </button>
        </div>
      </div>

      {empty ? (
        /* Empty state ala Budget: ilustrasi pudar + ajakan, bukan grid Rp0 */
        <div className="text-center pt-14 pb-10">
          <div className="relative h-[110px] w-[130px] mx-auto opacity-40" aria-hidden="true">
            <span className="absolute top-0 left-2" style={{ color: categoryHue('Makanan').ink }}>
              <CategoryIcon category="Makanan" className="size-11" />
            </span>
            <span className="absolute top-1 right-0 rotate-6" style={{ color: categoryHue('Transportasi').ink }}>
              <CategoryIcon category="Transportasi" className="size-11" />
            </span>
            <span className="absolute bottom-0 left-6 -rotate-3" style={{ color: categoryHue('Tagihan').ink }}>
              <CategoryIcon category="Tagihan" className="size-11" />
            </span>
            <span className="absolute bottom-1 right-4 rotate-2" style={{ color: categoryHue('Belanja').ink }}>
              <CategoryIcon category="Belanja" className="size-11" />
            </span>
          </div>
          <p className="text-[13px] mt-5" style={{ color: 'var(--ink-soft)' }}>{t('dashboard.no_budget')}</p>
          <Link
            href="/dashboard/budgeting"
            className="inline-flex items-center gap-1.5 mt-3.5 rounded-full px-4 py-2 text-[12.5px] font-medium"
            style={{ background: 'var(--c-coral-soft)', color: 'var(--c-coral-ink)' }}
          >
            <Target className="size-3.5" /> {t('nav.budgeting')}
          </Link>
        </div>
      ) : (
        <>
          {/* 2 ── Pengeluaran */}
          <p className="text-center text-[16px] pb-3" style={{ color: 'var(--ink-soft)' }}>
            {t('budgeting.expense')}{' '}
            <b className="num tabular font-semibold" style={{ color: 'var(--ink)' }}>
              {formatCurrency(totalExpense)}
            </b>{' '}
            <span className="inline-grid place-items-center size-5 rounded-full align-middle" style={{ background: 'var(--c-mint-soft)' }} aria-hidden="true">
              <ChevronDown className="size-3" style={{ color: 'var(--c-mint-ink)' }} />
            </span>
          </p>
          <div className="grid grid-cols-4 gap-2">
            {expenseCards.map((c) => renderCard(c, 'expense'))}
          </div>

          {/* 3 ── Pemasukan — disembunyikan total kalau gak ada kartu (ala Budget) */}
          {incomeCards.length > 0 && (
            <>
              <p className="text-center text-[16px] pt-4 pb-3" style={{ color: 'var(--ink-soft)' }}>
                {t('budgeting.income')}{' '}
                <b className="num tabular font-semibold" style={{ color: 'var(--ink)' }}>
                  {formatCurrency(totalIncome)}
                </b>{' '}
                <span className="inline-grid place-items-center size-5 rounded-full align-middle" style={{ background: 'var(--c-mint-soft)' }} aria-hidden="true">
                  <ChevronDown className="size-3" style={{ color: 'var(--c-mint-ink)' }} />
                </span>
              </p>
              <div className="grid grid-cols-4 gap-2">
                {incomeCards.map((c) => renderCard(c, 'income'))}
              </div>
            </>
          )}
        </>
      )}

      {/* 4 ── Kekayaan bersih — satu baris ala Lunch Money */}
      <Link
        href="/dashboard/net-worth"
        className="s-card mt-4 px-3.5 py-3 flex items-center justify-between active:opacity-80 transition-opacity"
        style={{ display: 'flex' }}
      >
        <span className="text-[12.5px]" style={{ color: 'var(--ink-soft)' }}>{t('networth.net_worth')}</span>
        <span className="flex items-center gap-1">
          <span className="num tabular text-[13.5px] font-semibold" title={formatCurrency(netWorth)} style={{ color: 'var(--ink)' }}>
            {formatCompactCurrency(netWorth)}
          </span>
          <ChevRight className="size-3.5" style={{ color: 'var(--ink-soft)' }} />
        </span>
      </Link>

      {/* Input cepat — jantung pola Budget */}
      {entry && (
        <MobileQuickEntry
          open={entry != null}
          onOpenChange={(v) => { if (!v) setEntry(null) }}
          category={entry.category}
          type={entry.type}
          budget={entry.budget}
          spent={entry.spent}
          subs={entry.subs}
        />
      )}
    </div>
  )
}
