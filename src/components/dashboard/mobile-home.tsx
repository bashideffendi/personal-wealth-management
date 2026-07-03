'use client'

/**
 * MobileHome — Beranda mobile F12: redesign total ala app "Budget" iOS
 * (mockup di-approve 2026-07-03). Menggantikan Beranda 6-modul F9/F10.
 *
 * STRUKTUR (jangan ditambah-tambah):
 *   1. Header: logo mark kecil · navigator bulan ‹ › · eye + bell
 *   2. "Pengeluaran Rp X"  → grid 3 kolom kartu pastel per kategori
 *   3. "Pemasukan Rp X"    → grid sama
 *   4. Baris kekayaan bersih (1 baris, link ke /net-worth) — pola
 *      "Est. Net Worth" Lunch Money; grafik & modul lain TIDAK ada di HP.
 * Tap kartu kategori → halaman Transaksi. Aksi tambah = FAB dock.
 * Desktop tetap bento penuh (komponen ini md:hidden dari pemanggil).
 */

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Bell, Eye, EyeOff, ChevronRightIcon } from 'lucide-react'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { CategoryIcon } from '@/components/transactions/category-icon'
import { categoryHue } from '@/lib/category-hue'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/lib/constants'
import { SUB_SEP } from '@/lib/budget-categories'
import { monthLong } from '@/lib/i18n/dates'
import { useI18n } from '@/lib/i18n/context'
import type { Transaction } from '@/types'

interface CatSum { category: string; amount: number }

/**
 * Kartu kategori ala Budget: SEMUA kategori kanonik selalu tampil (Rp0
 * pun tampil — bulan kosong tetap keliatan hidup, ronde-8 user bingung
 * "tidak ada card card"), urutan kanonik tetap; kategori custom user
 * yang ada nominalnya nyusul di belakang (sort desc). Sub "Induk::Sub"
 * di-roll-up ke induknya.
 */
function buildCards(txs: Transaction[], type: 'expense' | 'income', canonical: readonly string[]): CatSum[] {
  const amounts = new Map<string, number>(canonical.map((c) => [c, 0]))
  const extras = new Map<string, number>()
  for (const x of txs) {
    if (x.type !== type || x.category === 'Transfer') continue
    const sep = x.category.indexOf(SUB_SEP)
    const cat = sep === -1 ? x.category : x.category.slice(0, sep)
    if (amounts.has(cat)) amounts.set(cat, (amounts.get(cat) ?? 0) + x.amount)
    else extras.set(cat, (extras.get(cat) ?? 0) + x.amount)
  }
  return [
    ...canonical.map((category) => ({ category, amount: amounts.get(category) ?? 0 })),
    ...[...extras.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
  ]
}

export function MobileHome({
  month,
  year,
  onPrevMonth,
  onNextMonth,
  netWorth,
  transactions,
}: {
  month: number
  year: number
  onPrevMonth: () => void
  onNextMonth: () => void
  netWorth: number
  transactions: Transaction[]
}) {
  const { t, locale } = useI18n()
  const [hidden, setHidden] = useState(false)
  const money = (n: number) => (hidden ? '••••' : formatCompactCurrency(n))

  const expenseCats = buildCards(transactions, 'expense', EXPENSE_CATEGORIES)
  const incomeCats = buildCards(transactions, 'income', INCOME_CATEGORIES)
  const totalExpense = expenseCats.reduce((s, c) => s + c.amount, 0)
  const totalIncome = incomeCats.reduce((s, c) => s + c.amount, 0)

  const renderGrid = (cats: CatSum[]) => (
    <div className="grid grid-cols-3 gap-2">
      {cats.map((c) => {
        const hue = categoryHue(c.category)
        const empty = c.amount === 0
        return (
          <Link
            key={c.category}
            href="/dashboard/transactions"
            className="rounded-[16px] px-2 py-3 text-center active:opacity-70 transition-opacity"
            style={{ background: hue.soft, opacity: empty ? 0.72 : 1 }}
          >
            <span className="block text-[11.5px] font-medium leading-tight min-h-[28px] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden" style={{ color: 'var(--ink)' }}>
              {c.category}
            </span>
            <span
              className="grid place-items-center size-[34px] rounded-full mx-auto my-2"
              style={{ background: hue.bar, color: '#fff' }}
            >
              <CategoryIcon category={c.category} className="size-4" />
            </span>
            <span className="num tabular block text-[12.5px] font-semibold" title={hidden ? undefined : formatCurrency(c.amount)} style={{ color: 'var(--ink)' }}>
              {money(c.amount)}
            </span>
          </Link>
        )
      })}
    </div>
  )

  return (
    <div className="md:hidden">
      {/* 1 ── Header: logo · ‹ bulan › · eye + bell */}
      <div className="flex items-center justify-between pt-1.5 pb-3 px-0.5">
        <svg width="22" height="22" viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
          <rect x="35" y="3" width="30" height="30" rx="9" fill="#17b890" />
          <rect x="3" y="35" width="30" height="30" rx="9" fill="#f0664f" />
          <rect x="67" y="35" width="30" height="30" rx="9" fill="#5d6fe0" />
          <rect x="35" y="67" width="30" height="30" rx="9" fill="#8b4fb0" />
        </svg>
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={onPrevMonth} aria-label="Bulan sebelumnya" className="grid place-items-center size-8 rounded-full active:opacity-60" style={{ color: 'var(--ink-soft)' }}>
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-[15px] font-semibold min-w-[110px] text-center" style={{ color: 'var(--ink)' }}>
            {monthLong(month - 1, locale)} {year}
          </span>
          <button type="button" onClick={onNextMonth} aria-label="Bulan berikutnya" className="grid place-items-center size-8 rounded-full active:opacity-60" style={{ color: 'var(--ink-soft)' }}>
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setHidden((v) => !v)}
            aria-label={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
            className="grid place-items-center size-8 rounded-full active:opacity-60"
            style={{ background: 'var(--surface)', color: 'var(--ink)', boxShadow: '0 1px 2px rgba(24,24,27,0.05)' }}
          >
            {hidden ? <EyeOff className="size-[14px]" /> : <Eye className="size-[14px]" />}
          </button>
          <button
            type="button"
            aria-label="Notifikasi"
            className="grid place-items-center size-8 rounded-full active:opacity-60"
            style={{ background: 'var(--surface)', color: 'var(--ink)', boxShadow: '0 1px 2px rgba(24,24,27,0.05)' }}
          >
            <Bell className="size-[14px]" />
          </button>
        </div>
      </div>

      {/* 2 ── Pengeluaran */}
      <p className="text-center text-[13.5px] pb-2.5" style={{ color: 'var(--ink-soft)' }}>
        {t('budgeting.expense')}{' '}
        <b className="num tabular font-semibold" style={{ color: 'var(--ink)' }} title={hidden ? undefined : formatCurrency(totalExpense)}>
          {hidden ? 'Rp ••••' : formatCompactCurrency(totalExpense)}
        </b>
      </p>
      {renderGrid(expenseCats)}

      {/* 3 ── Pemasukan */}
      <p className="text-center text-[13.5px] pt-4 pb-2.5" style={{ color: 'var(--ink-soft)' }}>
        {t('budgeting.income')}{' '}
        <b className="num tabular font-semibold" style={{ color: 'var(--ink)' }} title={hidden ? undefined : formatCurrency(totalIncome)}>
          {hidden ? 'Rp ••••' : formatCompactCurrency(totalIncome)}
        </b>
      </p>
      {renderGrid(incomeCats)}

      {/* 4 ── Kekayaan bersih — satu baris ala Lunch Money */}
      <Link
        href="/dashboard/net-worth"
        className="s-card mt-4 px-3.5 py-3 flex items-center justify-between active:opacity-80 transition-opacity"
        style={{ display: 'flex' }}
      >
        <span className="text-[12.5px]" style={{ color: 'var(--ink-soft)' }}>{t('networth.net_worth')}</span>
        <span className="flex items-center gap-1">
          <span className="num tabular text-[13.5px] font-semibold" title={hidden ? undefined : formatCurrency(netWorth)} style={{ color: 'var(--ink)' }}>
            {hidden ? 'Rp ••••' : formatCompactCurrency(netWorth)}
          </span>
          <ChevronRightIcon className="size-3.5" style={{ color: 'var(--ink-soft)' }} />
        </span>
      </Link>
    </div>
  )
}
