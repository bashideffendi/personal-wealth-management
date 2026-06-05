'use client'

/**
 * AnggaranMonthDrawer — drawer 560px kanan untuk detail per bulan, per
 * design handoff Anggaran spec.
 *
 * Isi:
 *  1. 4 SummaryTile (Pendapatan/Pengeluaran/Tabungan/Investasi) %-nya
 *  2. Bar alokasi pendapatan tersegmen (3 warna: pengeluaran/tabungan/investasi)
 *  3. Aturan 50/30/20 dengan target vs aktual
 *  4. Top 8 pengeluaran kategori dengan badge "Over"/"Hampir habis"
 *  5. Proyeksi Akhir Bulan (untuk bulan sekarang aja)
 *  6. CTA Buka di Transaksi + Salin ke bulan lain
 *
 * Keyboard nav: Esc close, ← / → navigate bulan (modulo 12).
 */

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, ExternalLink, Copy } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { formatCurrency } from '@/lib/utils'

const MONTHS_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

interface AnggaranDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 1-12 */
  month: number
  year: number
  /** Cell value getter from parent budgeting page */
  getValue: (type: 'income' | 'expense' | 'saving' | 'investment', category: string, month: number) => number
  /** Category lists yang aktif untuk user */
  visibleIncome: string[]
  visibleExpense: string[]
  visibleSaving: string[]
  visibleInvestment: string[]
  /** Navigate ke bulan lain (untuk arrow keys) */
  onPrevMonth: () => void
  onNextMonth: () => void
}

export function AnggaranMonthDrawer({
  open, onOpenChange, month, year,
  getValue,
  visibleIncome, visibleExpense, visibleSaving, visibleInvestment,
  onPrevMonth, onNextMonth,
}: AnggaranDrawerProps) {
  // Compute totals for the month
  const totals = useMemo(() => {
    const income = visibleIncome.reduce((s, c) => s + getValue('income', c, month), 0)
    const expense = visibleExpense.reduce((s, c) => s + getValue('expense', c, month), 0)
    const saving = visibleSaving.reduce((s, c) => s + getValue('saving', c, month), 0)
    const investment = visibleInvestment.reduce((s, c) => s + getValue('investment', c, month), 0)
    return { income, expense, saving, investment }
  }, [month, getValue, visibleIncome, visibleExpense, visibleSaving, visibleInvestment])

  // Top 8 expense by category
  const topExpenses = useMemo(() => {
    return visibleExpense
      .map((cat) => ({ cat, val: getValue('expense', cat, month) }))
      .filter((x) => x.val > 0)
      .sort((a, b) => b.val - a.val)
      .slice(0, 8)
  }, [month, visibleExpense, getValue])

  // Pendapatan ratios
  const inc = totals.income
  const expensePct = inc > 0 ? (totals.expense / inc) * 100 : 0
  const savingPct = inc > 0 ? (totals.saving / inc) * 100 : 0
  const investPct = inc > 0 ? (totals.investment / inc) * 100 : 0
  const leftoverPct = Math.max(0, 100 - expensePct - savingPct - investPct)
  const leftover = Math.max(0, inc - totals.expense - totals.saving - totals.investment)

  // 50/30/20 rule comparison
  // 50 = needs (expense), 30 = wants (expense extra?), 20 = saving+invest
  // Simplified: compare expense vs 50%, saving+invest vs 30%
  const rule = {
    expenseTarget: inc * 0.5,
    savingTarget: inc * 0.3,
    investTarget: inc * 0.2,
  }

  // Bulan sekarang check (untuk proyeksi)
  const now = new Date()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysSoFar = isCurrentMonth ? Math.min(now.getDate(), daysInMonth) : daysInMonth
  const projection = isCurrentMonth && daysSoFar > 0
    ? {
        // Projeksi linear: spent so far / days * total days
        projectedExpense: (totals.expense / daysSoFar) * daysInMonth,
        daysLeft: daysInMonth - daysSoFar,
      }
    : null

  // Keyboard nav: Esc close (handled by Sheet), ← → navigate bulan
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onPrevMonth()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        onNextMonth()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onPrevMonth, onNextMonth])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!max-w-[560px] w-[560px] overflow-y-auto p-0"
        style={{ background: 'var(--bg)' }}
      >
        {/* Header */}
        <SheetHeader
          className="px-6 py-5 border-b sticky top-0 z-10"
          style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={onPrevMonth}
                aria-label="Bulan sebelumnya"
                className="grid place-items-center rounded-lg transition-colors"
                style={{
                  width: 32,
                  height: 32,
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                  color: 'var(--ink-muted)',
                }}
              >
                <ArrowLeft className="size-4" />
              </button>
              <div>
                <p className="eyebrow">Anggaran · {year}</p>
                {/* Visually-rich title; sr-only SheetTitle for a11y */}
                <SheetTitle className="sr-only">
                  Anggaran {MONTHS_FULL[month - 1]} {year}
                </SheetTitle>
                <h2
                  className="display"
                  style={{
                    fontSize: 28,
                    color: 'var(--ink)',
                    lineHeight: 1.1,
                  }}
                  aria-hidden="true"
                >
                  {MONTHS_FULL[month - 1]}
                  {isCurrentMonth && (
                    <span
                      className="chip ml-2"
                      style={{
                        background: 'var(--c-primary-soft)',
                        color: 'var(--c-primary)',
                        fontSize: 10,
                        height: 20,
                        padding: '0 8px',
                      }}
                    >
                      Sekarang
                    </span>
                  )}
                </h2>
              </div>
              <button
                onClick={onNextMonth}
                aria-label="Bulan berikutnya"
                className="grid place-items-center rounded-lg transition-colors ml-2"
                style={{
                  width: 32,
                  height: 32,
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                  color: 'var(--ink-muted)',
                }}
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
            <p
              className="text-[10px]"
              style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}
            >
              ← → ESC
            </p>
          </div>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* ─── 4 SummaryTile ─── */}
          <div className="grid grid-cols-2 gap-3">
            <SummaryTile
              label="Pendapatan"
              value={inc}
              tone="mint"
              pct={100}
              isReference
            />
            <SummaryTile
              label="Pengeluaran"
              value={totals.expense}
              tone="coral"
              pct={expensePct}
            />
            <SummaryTile
              label="Tabungan"
              value={totals.saving}
              tone="amber"
              pct={savingPct}
            />
            <SummaryTile
              label="Investasi"
              value={totals.investment}
              tone="primary"
              pct={investPct}
            />
          </div>

          {/* ─── Bar alokasi pendapatan tersegmen ─── */}
          {inc > 0 && (
            <div className="s-card p-5">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Alokasi Pendapatan</p>
                <p
                  className="num tabular"
                  style={{ fontSize: 11, color: 'var(--text-mute)' }}
                >
                  Sisa{' '}
                  <strong
                    style={{ color: leftover >= 0 ? 'var(--c-mint)' : 'var(--c-coral)' }}
                  >
                    {formatCurrency(leftover)}
                  </strong>{' '}
                  · {leftoverPct.toFixed(0)}%
                </p>
              </div>
              <div
                className="mt-3 h-2.5 rounded-full overflow-hidden flex"
                style={{ background: 'var(--surface-2)' }}
              >
                <div
                  style={{
                    width: `${Math.min(expensePct, 100)}%`,
                    background: 'var(--c-coral)',
                  }}
                />
                <div
                  style={{
                    width: `${Math.min(savingPct, 100)}%`,
                    background: 'var(--c-amber)',
                  }}
                />
                <div
                  style={{
                    width: `${Math.min(investPct, 100)}%`,
                    background: 'var(--c-primary)',
                  }}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <LegendItem tone="coral" label="Pengeluaran" pct={expensePct} />
                <LegendItem tone="amber" label="Tabungan" pct={savingPct} />
                <LegendItem tone="primary" label="Investasi" pct={investPct} />
              </div>
            </div>
          )}

          {/* ─── Aturan 50/30/20 ─── */}
          {inc > 0 && (
            <div className="s-card p-5">
              <p className="eyebrow">Aturan 50/30/20</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-mute)' }}>
                Pedoman alokasi pendapatan ala financial planner.
              </p>
              <div className="mt-4 space-y-3">
                <Rule50Row
                  label="Pengeluaran (kebutuhan)"
                  target={50}
                  targetAmount={rule.expenseTarget}
                  actual={expensePct}
                  actualAmount={totals.expense}
                  tone="coral"
                />
                <Rule50Row
                  label="Tabungan (dana darurat & jangka pendek)"
                  target={30}
                  targetAmount={rule.savingTarget}
                  actual={savingPct}
                  actualAmount={totals.saving}
                  tone="amber"
                />
                <Rule50Row
                  label="Investasi (wealth building)"
                  target={20}
                  targetAmount={rule.investTarget}
                  actual={investPct}
                  actualAmount={totals.investment}
                  tone="primary"
                />
              </div>
            </div>
          )}

          {/* ─── Top 8 Pengeluaran ─── */}
          {topExpenses.length > 0 && (
            <div className="s-card p-5">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Top Pengeluaran Kategori</p>
                <p
                  className="num tabular"
                  style={{ fontSize: 11, color: 'var(--text-mute)' }}
                >
                  {topExpenses.length} kategori
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {topExpenses.map((e) => {
                  const pctOfTotal = totals.expense > 0 ? (e.val / totals.expense) * 100 : 0
                  const isOver = pctOfTotal >= 40
                  const isWarn = pctOfTotal >= 25
                  return (
                    <div
                      key={e.cat}
                      className="flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="truncate"
                            style={{ fontSize: 13, color: 'var(--ink)' }}
                          >
                            {e.cat}
                          </span>
                          {isOver && (
                            <span
                              className="chip"
                              style={{
                                background: 'var(--c-coral-soft)',
                                color: 'var(--c-coral)',
                                height: 18,
                                fontSize: 9,
                                padding: '0 6px',
                              }}
                            >
                              Over
                            </span>
                          )}
                          {!isOver && isWarn && (
                            <span
                              className="chip"
                              style={{
                                background: 'var(--c-amber-soft)',
                                color: 'var(--c-amber)',
                                height: 18,
                                fontSize: 9,
                                padding: '0 6px',
                              }}
                            >
                              Hampir habis
                            </span>
                          )}
                        </div>
                        <div
                          className="kl-bar"
                          style={{
                            color: isOver ? 'var(--c-coral)' : isWarn ? 'var(--c-amber)' : 'var(--c-primary)',
                          }}
                        >
                          <i style={{ width: `${Math.min(pctOfTotal, 100)}%` }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0" style={{ minWidth: 90 }}>
                        <p
                          className="num tabular"
                          style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}
                        >
                          {formatCurrency(e.val)}
                        </p>
                        <p
                          className="num tabular"
                          style={{ fontSize: 10, color: 'var(--text-mute)' }}
                        >
                          {pctOfTotal.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── Proyeksi Akhir Bulan (current month only) ─── */}
          {projection && (
            <div
              className="s-card p-5"
              style={{ background: 'var(--c-primary-soft)' }}
            >
              <div className="flex items-center justify-between">
                <p
                  className="eyebrow"
                  style={{ color: 'var(--c-primary)' }}
                >
                  Proyeksi Akhir Bulan
                </p>
                <p
                  className="text-[11px] num tabular"
                  style={{ color: 'var(--c-primary)' }}
                >
                  {projection.daysLeft} hari lagi
                </p>
              </div>
              <p
                className="display num tabular mt-2"
                style={{ fontSize: 28, color: 'var(--ink)' }}
              >
                {formatCurrency(projection.projectedExpense)}
              </p>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-2)' }}>
                Estimasi total pengeluaran jika ritme harian saat ini berlanjut sampai akhir{' '}
                {MONTHS_FULL[month - 1]}.
              </p>
            </div>
          )}

          {/* ─── CTAs ─── */}
          <div className="flex gap-2">
            <Link
              href={`/dashboard/transactions?year=${year}&month=${month}`}
              className="btn-outline flex-1"
            >
              <ExternalLink className="size-3.5" />
              Buka di Transaksi
            </Link>
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                // Future: implement copy-to-other-month
                onOpenChange(false)
              }}
              title="Salin alokasi ke bulan lain (segera)"
              disabled
              style={{ opacity: 0.6 }}
            >
              <Copy className="size-3.5" />
              Salin
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────

function SummaryTile({
  label, value, tone, pct, isReference = false,
}: {
  label: string
  value: number
  tone: 'mint' | 'coral' | 'amber' | 'primary'
  pct: number
  isReference?: boolean
}) {
  return (
    <div className="s-card p-4">
      <div className="flex items-center gap-1.5">
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 2,
            background: `var(--c-${tone})`,
          }}
        />
        <p className="eyebrow">{label}</p>
      </div>
      <p
        className="num tabular mt-2"
        style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}
      >
        {formatCurrency(value)}
      </p>
      <p
        className="num tabular mt-0.5"
        style={{ fontSize: 11, color: `var(--c-${tone})`, fontWeight: 700 }}
      >
        {isReference ? 'Referensi' : `${pct.toFixed(0)}% dari pemasukan`}
      </p>
    </div>
  )
}

function LegendItem({
  tone, label, pct,
}: { tone: 'coral' | 'amber' | 'primary'; label: string; pct: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          background: `var(--c-${tone})`,
        }}
      />
      <span style={{ color: 'var(--text-2)' }}>{label}</span>
      <span
        className="num tabular ml-auto"
        style={{ color: `var(--c-${tone})`, fontWeight: 700 }}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

function Rule50Row({
  label, target, targetAmount, actual, actualAmount, tone,
}: {
  label: string
  target: number
  targetAmount: number
  actual: number
  actualAmount: number
  tone: 'mint' | 'coral' | 'amber' | 'primary'
}) {
  const delta = actual - target
  const onTrack = Math.abs(delta) <= 5
  const overTarget = delta > 5
  const status = onTrack ? 'on-track' : overTarget ? 'over' : 'under'
  const statusColor =
    status === 'on-track' ? 'var(--c-mint)' :
    status === 'over' && tone === 'coral' ? 'var(--c-coral)' :
    status === 'under' && tone !== 'coral' ? 'var(--c-coral)' :
    'var(--c-amber)'
  const statusLabel =
    status === 'on-track' ? 'On track' :
    status === 'over' ? 'Lewat target' :
    'Kurang dari target'

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span style={{ fontSize: 13, color: 'var(--ink)' }}>{label}</span>
        <span
          className="num tabular"
          style={{ fontSize: 11, color: 'var(--text-mute)' }}
        >
          Target <strong style={{ color: 'var(--ink)' }}>{target}%</strong>{' '}
          (~{formatCurrency(targetAmount)})
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="kl-bar flex-1"
          style={{ color: `var(--c-${tone})` }}
        >
          <i style={{ width: `${Math.min(actual, 100)}%` }} />
        </div>
        <span
          className="num tabular"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: `var(--c-${tone})`,
            minWidth: 38,
            textAlign: 'right',
          }}
        >
          {actual.toFixed(0)}%
        </span>
      </div>
      <p
        className="num tabular"
        style={{ fontSize: 10, color: statusColor, marginTop: 2 }}
      >
        {statusLabel} · aktual {formatCurrency(actualAmount)}
      </p>
    </div>
  )
}
