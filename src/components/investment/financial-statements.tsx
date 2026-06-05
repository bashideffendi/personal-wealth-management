'use client'

/**
 * FinancialStatements — full IDX laporan keuangan view (4 sub-tab):
 *   1. Laba Rugi (income statement) — annual + quarterly switch
 *   2. Neraca (balance sheet)
 *   3. Arus Kas (cash flow)
 *   4. Market (price/cap/PER/PBV)
 *
 * Plus IDR scale switcher (T/M/Jt/Rupiah) untuk readability — Stockbit style.
 *
 * Diport dari kelolainvestasi/invest dengan adaptasi:
 *   - Klunting theme tokens (var(--surface), var(--ink), emerald accent)
 *   - Reuse Klunting shadcn components (Tabs, Table, Button)
 *   - Drop cn() helper (pakai conditional className inline)
 *
 * Stock metrics dari stocks.json (~12MB bundled). Quarterly dari
 * quarterly-financials.json.
 */

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  formatNumber,
  formatPercentValue,
  formatRatio,
} from '@/lib/invest/format'

interface StockData {
  ticker: string
  metrics: Record<string, Record<string, number>>
}

type LineFormat = 'idr' | 'pct' | 'ratio' | 'number' | 'share'
type IdrScale = 'T' | 'M' | 'Jt' | 'rupiah'

const SCALE_ORDER: IdrScale[] = ['T', 'M', 'Jt', 'rupiah']
const SCALE_DIVISOR: Record<IdrScale, number> = {
  T: 1e12,
  M: 1e9,
  Jt: 1e6,
  rupiah: 1,
}
const SCALE_LABEL: Record<IdrScale, string> = {
  T: 'Triliun IDR',
  M: 'Miliar IDR',
  Jt: 'Juta IDR',
  rupiah: 'IDR',
}

interface Line {
  label: string
  key?: string
  format: LineFormat
  bold?: boolean
  indent?: 0 | 1 | 2
  negate?: boolean
  subtle?: boolean
}

function fmt(v: number | null | undefined, format: LineFormat): string {
  if (v == null || isNaN(v)) return '—'
  if (format === 'pct') return formatPercentValue(v)
  if (format === 'ratio') return formatRatio(v)
  if (format === 'share') {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(v)
  }
  return formatNumber(v, 2)
}

function fmtScaled(v: number | null | undefined, format: LineFormat, scale: IdrScale): string {
  if (v == null || isNaN(v)) return '—'
  if (format !== 'idr') return fmt(v, format)
  const divisor = SCALE_DIVISOR[scale]
  const scaled = v / divisor
  const digits = scale === 'T' ? 2 : 0
  return scaled.toLocaleString('id-ID', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

function getYears(s: StockData, keys: string[], limit = 10): string[] {
  const years = new Set<string>()
  for (const k of keys) {
    const series = s.metrics[k]
    if (!series) continue
    for (const y of Object.keys(series)) {
      const v = series[y]
      if (v != null && v !== 0) years.add(y)
    }
  }
  return Array.from(years)
    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
    .slice(0, limit)
}

function getQuarterlyPeriods(
  quarterly: Record<string, Record<string, number>>,
  keys: string[],
  limit = 12,
): string[] {
  const periods = new Set<string>()
  for (const k of keys) {
    const series = quarterly[k]
    if (!series) continue
    for (const p of Object.keys(series)) {
      const v = series[p]
      if (v != null && v !== 0) periods.add(p)
    }
  }
  return Array.from(periods)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit)
}

function Row({
  line, years, stock, scale,
}: {
  line: Line
  years: string[]
  stock: StockData
  scale: IdrScale
}) {
  const values = years.map((year) => {
    let v: number | null = null
    if (line.key) {
      v = stock.metrics[line.key]?.[year] ?? null
    }
    if (v != null && line.negate) v = -Math.abs(v)
    return v
  })

  return (
    <TableRow className={line.bold ? 'font-semibold' : ''}>
      <TableCell
        className={[
          line.indent === 1 && 'pl-8',
          line.indent === 2 && 'pl-14',
          line.bold ? 'font-semibold' : 'font-normal',
        ].filter(Boolean).join(' ')}
        style={{ color: line.subtle ? 'var(--ink-muted)' : 'var(--ink)' }}
      >
        {line.label}
      </TableCell>
      {values.map((v, i) => (
        <TableCell
          key={i}
          className="text-right tabular-nums text-xs"
          style={{
            color: v != null && v < 0 && !line.subtle
              ? 'var(--c-coral)'
              : line.subtle
                ? 'var(--ink-muted)'
                : 'var(--ink)',
          }}
        >
          {fmtScaled(v, line.format, scale)}
        </TableCell>
      ))}
    </TableRow>
  )
}

function Statement({
  title,
  lines,
  stock,
  relevantKeys,
  scale,
}: {
  title: string
  lines: Line[]
  stock: StockData
  relevantKeys: string[]
  scale: IdrScale
}) {
  const years = getYears(stock, relevantKeys)

  if (years.length === 0) {
    return (
      <div
        className="rounded-2xl border p-5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <p className="eyebrow">{title}</p>
        <p className="text-sm mt-2" style={{ color: 'var(--ink-muted)' }}>
          Data tidak tersedia untuk ticker ini.
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border-soft)' }}>
        <p className="text-base font-bold" style={{ color: 'var(--ink)' }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
          Dalam <span className="font-medium" style={{ color: 'var(--ink)' }}>{SCALE_LABEL[scale]}</span>
          {' '}(kecuali per-share, ratio, %).
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[240px]">Item</TableHead>
              {years.map((y) => (
                <TableHead key={y} className="text-right">{y}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, i) => (
              <Row key={i} line={line} years={years} stock={stock} scale={scale} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Income Statement ──────────────────────────────────────────
const INCOME_LINES: Line[] = [
  { label: 'Pendapatan (Revenue)', key: 'Revenue', format: 'idr', bold: true },
  { label: 'Growth YoY', key: 'Revenue YoY Growth', format: 'pct', subtle: true, indent: 1 },
  { label: 'Beban Pokok Penjualan (COGS)', key: 'Beban Pkk Penjualan', format: 'idr', negate: true },
  { label: 'Laba Kotor (Gross Profit)', key: 'Gross Profit', format: 'idr', bold: true },
  { label: 'Gross Margin', key: 'Gross Profit Margin', format: 'pct', subtle: true, indent: 1 },
  { label: 'Beban Operasional', key: 'Biaya Operasional', format: 'idr', negate: true },
  { label: 'Laba Operasi (EBIT)', key: 'EBIT', format: 'idr', bold: true },
  { label: 'Operating Margin', key: 'Operating Profit Margin', format: 'pct', subtle: true, indent: 1 },
  { label: 'Beban Keuangan (Interest)', key: 'Biaya Keuangan', format: 'idr', negate: true },
  { label: 'Laba Bersih (Net Profit)', key: 'Net Profit', format: 'idr', bold: true },
  { label: 'Net Margin', key: 'Net Profit Margin', format: 'pct', subtle: true, indent: 1 },
  { label: 'Net Profit Growth YoY', key: 'Net Profit YoY Growth', format: 'pct', subtle: true, indent: 1 },
  { label: 'EPS', key: 'EPS', format: 'number' },
  { label: 'EPS Growth YoY', key: 'EPS YoY Growth', format: 'pct', subtle: true, indent: 1 },
]
const INCOME_KEYS = ['Revenue', 'Net Profit', 'Gross Profit', 'EBIT', 'Beban Pkk Penjualan', 'Biaya Operasional']

// ─── Balance Sheet ─────────────────────────────────────────────
const BALANCE_LINES: Line[] = [
  { label: 'ASET', format: 'idr', bold: true },
  { label: 'Kas & Setara Kas', key: 'Cash', format: 'idr', indent: 1 },
  { label: 'Piutang', key: 'Piutang', format: 'idr', indent: 1 },
  { label: 'Persediaan', key: 'Persediaan', format: 'idr', indent: 1 },
  { label: 'Total Aset Lancar', key: 'Aset Lancar', format: 'idr', bold: true, indent: 1 },

  { label: 'LIABILITAS', format: 'idr', bold: true },
  { label: 'Liabilitas Jangka Pendek', key: 'Liab J Pndk', format: 'idr', indent: 1 },
  { label: 'Liabilitas Jangka Panjang', key: 'Liab J Pnjg', format: 'idr', indent: 1 },
  { label: 'Total Utang Berbunga', key: 'Total Debt', format: 'idr', indent: 1 },
  { label: 'Utang Bersih (Net Debt)', key: 'Net Debt', format: 'idr', indent: 1, subtle: true },

  { label: 'EKUITAS', format: 'idr', bold: true },
  { label: 'Total Ekuitas', key: 'Ekuitas', format: 'idr', indent: 1 },
  { label: 'Jumlah Saham Beredar', key: 'Jumlah Saham', format: 'share', indent: 1, subtle: true },
  { label: 'Nilai Buku per Saham (BVPS)', key: 'BVPS', format: 'number', indent: 1, subtle: true },

  { label: 'LIKUIDITAS & SOLVABILITAS', format: 'ratio', bold: true },
  { label: 'Current Ratio', key: 'Current Ratio', format: 'ratio', indent: 1, subtle: true },
  { label: 'Quick Ratio', key: 'Quick Ratio', format: 'ratio', indent: 1, subtle: true },
  { label: 'Debt to Equity', key: 'Debt to Equity', format: 'ratio', indent: 1, subtle: true },
  { label: 'Interest Coverage', key: 'Interest Coverage', format: 'ratio', indent: 1, subtle: true },

  { label: 'EFISIENSI', format: 'ratio', bold: true },
  { label: 'ROE', key: 'ROE', format: 'pct', indent: 1, subtle: true },
  { label: 'ROA', key: 'ROA', format: 'pct', indent: 1, subtle: true },
  { label: 'ROIC', key: 'ROIC', format: 'pct', indent: 1, subtle: true },
  { label: 'Asset Turnover', key: 'Asset Turnover', format: 'ratio', indent: 1, subtle: true },
  { label: 'Inventory Turnover', key: 'Inventory Turnover', format: 'ratio', indent: 1, subtle: true },
  { label: 'Receivables Turnover', key: 'Receivables Turnover', format: 'ratio', indent: 1, subtle: true },
]
const BALANCE_KEYS = ['Cash', 'Aset Lancar', 'Ekuitas', 'Total Debt', 'Liab J Pndk', 'Liab J Pnjg']

// ─── Cash Flow ─────────────────────────────────────────────────
const CASHFLOW_LINES: Line[] = [
  { label: 'Arus Kas dari Operasi (CFO)', key: 'CFO', format: 'idr', bold: true },
  { label: 'CFO / Net Profit', key: 'CFO to Net Profit', format: 'ratio', subtle: true, indent: 1 },
  { label: 'Arus Kas dari Investasi', key: 'Cash flow from investor', format: 'idr' },
  { label: 'Capital Expenditure', key: 'Capital expend', format: 'idr', indent: 1, subtle: true },
  { label: 'Arus Kas dari Pendanaan', key: 'Cash flow from finance', format: 'idr' },
  { label: 'Free Cash Flow (FCF)', key: 'Free Cash Flow', format: 'idr', bold: true },
  { label: 'FCF Margin', key: 'FCF Margin', format: 'pct', subtle: true, indent: 1 },
  { label: 'FCF per Saham', key: 'FCF per Share', format: 'number', subtle: true, indent: 1 },
  { label: 'Dividen Dibayar', key: 'Dividend', format: 'idr' },
  { label: 'Payout Ratio', key: 'Payout Ratio', format: 'pct', subtle: true, indent: 1 },
  { label: 'Working Capital', key: 'Working Capital', format: 'idr', subtle: true },
]
const CASHFLOW_KEYS = ['CFO', 'Free Cash Flow', 'Cash flow from investor', 'Cash flow from finance', 'Dividend', 'Capital expend']

// ─── Market & Valuation ────────────────────────────────────────
const MARKET_LINES: Line[] = [
  { label: 'Harga Saham', key: 'Harga Sekarang', format: 'number', bold: true },
  { label: 'Market Cap', key: 'Market Cap', format: 'idr' },
  { label: 'Enterprise Value', key: 'Enterprise Value', format: 'idr' },
  { label: 'PE Ratio', key: 'PE Ratio', format: 'ratio' },
  { label: 'PBV', key: 'PBV', format: 'ratio' },
  { label: 'Revenue per Saham', key: 'Revenue per Share', format: 'number', subtle: true },
]
const MARKET_KEYS = ['Market Cap', 'PE Ratio', 'PBV']

// ─── Quarterly view ────────────────────────────────────────────
function QuarterlyStatement({
  quarterly, scale,
}: {
  quarterly: Record<string, Record<string, number>>
  scale: IdrScale
}) {
  const periods = getQuarterlyPeriods(quarterly, ['Revenue', 'Net Income', 'EPS'], 20)

  if (periods.length === 0) {
    return (
      <div
        className="rounded-2xl border p-5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Data kuartalan tidak tersedia untuk ticker ini.
        </p>
      </div>
    )
  }

  const lines: { label: string; key: string; format: LineFormat }[] = [
    { label: 'Pendapatan (Revenue)', key: 'Revenue', format: 'idr' },
    { label: 'Laba Bersih (Net Income)', key: 'Net Income', format: 'idr' },
    { label: 'Earnings per Share (EPS)', key: 'EPS', format: 'number' },
  ]

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border-soft)' }}>
        <p className="text-base font-bold" style={{ color: 'var(--ink)' }}>Laba Rugi — Kuartalan</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
          3 metrik utama per kuartal ({periods.length} periode terakhir). Nilai per kuartal kumulatif YTD.
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">Item</TableHead>
              {periods.map((p) => (
                <TableHead key={p} className="text-right text-xs">{p}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.key}>
                <TableCell className="font-medium" style={{ color: 'var(--ink)' }}>{line.label}</TableCell>
                {periods.map((p) => {
                  const v = quarterly[line.key]?.[p] ?? null
                  return (
                    <TableCell
                      key={p}
                      className="text-right tabular-nums text-xs"
                      style={{ color: v != null && v < 0 ? 'var(--c-coral)' : 'var(--ink)' }}
                    >
                      {fmtScaled(v, line.format, scale)}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Main export ───────────────────────────────────────────────
type ViewMode = 'annual' | 'quarterly'

export interface FinancialStatementsProps {
  stock: StockData
  quarterly?: Record<string, Record<string, number>>
}

export function FinancialStatements({ stock, quarterly }: FinancialStatementsProps) {
  const [incomeView, setIncomeView] = useState<ViewMode>('annual')
  const [scale, setScale] = useState<IdrScale>('M')
  const hasQuarterly = quarterly !== undefined && Object.keys(quarterly).length > 0

  const scaleIdx = SCALE_ORDER.indexOf(scale)
  const scaleUp = () => {
    if (scaleIdx > 0) setScale(SCALE_ORDER[scaleIdx - 1])
  }
  const scaleDown = () => {
    if (scaleIdx < SCALE_ORDER.length - 1) setScale(SCALE_ORDER[scaleIdx + 1])
  }

  const toolbar = (
    <div className="mb-3">
      <div
        className="inline-flex items-center gap-0.5 rounded-lg border p-0.5"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border-soft)' }}
      >
        <Button
          size="sm"
          variant="ghost"
          onClick={scaleUp}
          disabled={scaleIdx === 0}
          className="h-7 w-7 p-0 font-mono text-base"
          title="Skala lebih besar (ringkas)"
          aria-label="Skala lebih besar (ringkas)"
        >
          −
        </Button>
        <span className="min-w-[60px] text-center text-xs font-semibold" style={{ color: 'var(--ink)' }}>
          {SCALE_LABEL[scale]}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={scaleDown}
          disabled={scaleIdx === SCALE_ORDER.length - 1}
          className="h-7 w-7 p-0 font-mono text-base"
          title="Skala lebih detail"
          aria-label="Skala lebih detail"
        >
          +
        </Button>
      </div>
    </div>
  )

  return (
    <Tabs defaultValue="income" className="w-full">
      <TabsList variant="pill">
        <TabsTrigger value="income">Laba Rugi</TabsTrigger>
        <TabsTrigger value="balance">Neraca</TabsTrigger>
        <TabsTrigger value="cashflow">Arus Kas</TabsTrigger>
        <TabsTrigger value="market">Market</TabsTrigger>
      </TabsList>

      <TabsContent value="income" className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {toolbar}
          {hasQuarterly && (
            <div className="mb-3 inline-flex rounded-lg border p-0.5" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-soft)' }}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIncomeView('annual')}
                className="h-7 px-3 text-xs rounded-md"
                style={{
                  background: incomeView === 'annual' ? 'var(--c-primary)' : 'transparent',
                  color: incomeView === 'annual' ? 'var(--on-black)' : 'var(--ink-muted)',
                }}
              >
                Tahunan
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIncomeView('quarterly')}
                className="h-7 px-3 text-xs rounded-md"
                style={{
                  background: incomeView === 'quarterly' ? 'var(--c-primary)' : 'transparent',
                  color: incomeView === 'quarterly' ? 'var(--on-black)' : 'var(--ink-muted)',
                }}
              >
                Kuartalan
              </Button>
            </div>
          )}
        </div>
        {incomeView === 'annual' ? (
          <Statement title="Laporan Laba Rugi" lines={INCOME_LINES} stock={stock} relevantKeys={INCOME_KEYS} scale={scale} />
        ) : (
          <QuarterlyStatement quarterly={quarterly!} scale={scale} />
        )}
      </TabsContent>

      <TabsContent value="balance" className="mt-4">
        {toolbar}
        <Statement title="Neraca (Balance Sheet)" lines={BALANCE_LINES} stock={stock} relevantKeys={BALANCE_KEYS} scale={scale} />
      </TabsContent>

      <TabsContent value="cashflow" className="mt-4">
        {toolbar}
        <Statement title="Laporan Arus Kas" lines={CASHFLOW_LINES} stock={stock} relevantKeys={CASHFLOW_KEYS} scale={scale} />
      </TabsContent>

      <TabsContent value="market" className="mt-4">
        {toolbar}
        <Statement title="Market & Valuation" lines={MARKET_LINES} stock={stock} relevantKeys={MARKET_KEYS} scale={scale} />
      </TabsContent>
    </Tabs>
  )
}
