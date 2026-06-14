/**
 * KeyStatsGrid — Overview / Key Statistics untuk halaman research saham.
 * Diport dari kelolainvestasi/invest, di-restyle ke Klunting LIGHT theme.
 *
 * Semua rasio dihitung real-time dari laporan keuangan (stocks.json) +
 * emitten-stats (market cap / EV / shares) + quarterly-financials (TTM).
 * Baris & section yang datanya kosong di-hide otomatis.
 */

import type { Stock } from '@/lib/invest/stocks'
import { canonicalYear, computeTTM } from '@/lib/invest/valuation'
import { computePiotroski } from '@/lib/invest/piotroski'
import { formatRupiahPlain as fmtFullIDR } from '@/lib/utils'
import { reverseDCF } from '@/lib/invest/reverse-dcf'

// ─── Prop shapes (decoupled — research-tabs feeds plain objects) ──────

interface EmittenStatLike {
  freeFloatPct: number | null
  marketCap: number | null
  enterpriseValue: number | null
  currentShareOutstanding: number | null
}

interface DividendEventLike {
  exDate: string | null
  dividend: number | null
}

interface PricePerfPeriod {
  high: number | null
  low: number | null
  percentage: number | null
}

type PricePerfLike = Partial<
  Record<'1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y', PricePerfPeriod>
>

/** Stock-shaped object the grid needs (sector + currentPrice + metrics). */
interface StockLike {
  sector: string | null
  currentPrice: number | null
  metrics: Record<string, Record<string, number>>
}

// ─── Helpers ─────────────────────────────────────────────────────────

function atYear(
  series: Record<string, number> | undefined,
  year: number | null,
): number | null {
  if (!series || year === null) return null
  const v = series[String(year)]
  return v === null || v === undefined || v === 0 ? null : v
}

/** Compact IDR — triliun/miliar/juta (Indonesia). */
function fmtIDR(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)} T`
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} M`
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)} Jt`
  return n.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return n.toLocaleString('id-ID', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

function fmtRatio(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return `${n.toFixed(2)}x`
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return `${(n * 100).toFixed(2)}%`
}

/** Signed-value color → Klunting light tokens (mint up / coral down). */
function signColor(n: number | null | undefined): string | undefined {
  if (n === null || n === undefined || isNaN(n)) return undefined
  if (n > 0) return 'var(--c-mint)'
  if (n < 0) return 'var(--c-coral)'
  return undefined
}

// ─── Types ────────────────────────────────────────────────────────────

interface StatRow {
  label: string
  value: string
  /** Raw number (for tooltip full-value display) */
  raw?: number | null
  /** Format hint untuk tooltip (idr = Rp X.XXX.XXX; lainnya = angka penuh) */
  rawFormat?: 'idr' | 'number' | 'pct' | 'ratio'
  /** Inline CSS color value (e.g. var(--c-mint)) */
  color?: string
  title?: string
}

/** Tooltip text dari raw value (full precision). */
function tooltipFor(row: StatRow): string | undefined {
  if (row.title) return row.title
  if (row.raw === null || row.raw === undefined || isNaN(row.raw))
    return undefined
  if (row.rawFormat === 'idr') return fmtFullIDR(row.raw)
  if (row.rawFormat === 'pct') return `${(row.raw * 100).toFixed(4)}%`
  if (row.rawFormat === 'ratio') return `${row.raw.toFixed(4)}x`
  return row.raw.toLocaleString('id-ID')
}

interface StatSection {
  title: string
  rows: StatRow[]
}

// ─── Main component ──────────────────────────────────────────────────

export function KeyStatsGrid({
  stock,
  quarterly,
  emittenStats,
  pricePerformance,
  dividendEvents,
}: {
  stock: StockLike
  quarterly: Record<string, Record<string, number>>
  emittenStats: EmittenStatLike | null | undefined
  pricePerformance: PricePerfLike | null | undefined
  dividendEvents: DividendEventLike[]
}) {
  const year = canonicalYear(stock as Stock)
  const price = stock.currentPrice
  const m = stock.metrics

  // Latest-year values — probe multiple field name aliases karena scraper
  // map dari label Bahasa dan termasuk v1 (Ekuitas) & v2 (Total Equity) names.
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = atYear(m[k], year)
      if (v !== null) return v
    }
    return null
  }

  const revenue = pick('Revenue')
  const netProfit = pick('Net Profit')
  const grossProfit = pick('Gross Profit')
  const ebit = pick('EBIT')
  const ebitda = pick('EBITDA')
  const eps = pick('EPS')
  const bvps = pick('BVPS')
  // Shares: prefer latest stats > Shares Outstanding (BS)
  const shares =
    emittenStats?.currentShareOutstanding ??
    pick('Shares Outstanding (BS)') ??
    null
  const equity = pick('Total Equity', 'Ekuitas')
  const totalAssets = pick('Total Assets')
  const totalLiab = pick('Total Liabilitas')
  const cash = pick('Cash')
  const totalDebt = pick('Total Debt')
  const netDebt = pick('Net Debt')
  const currentAssets = pick('Aset Lancar')
  const currentLiab = pick('Liab J Pndk')
  const inventory = pick('Persediaan')
  const cfo = pick('CFO', 'Operating Cash Flow')
  const fcf = pick('Free Cash Flow')
  const capex = pick('Capital expend')
  const interestExpense = pick('Interest Expense', 'Biaya Keuangan')
  // Bank-specific: customer deposits (context untuk ticker bank)
  const customerDeposits = pick('Customer Deposits')

  // ── TTM computations dari quarterly series ──
  const ttmEPS = computeTTM(quarterly['EPS'])
  const ttmNetIncome = computeTTM(quarterly['Net Income'])
  const ttmRevenue = computeTTM(quarterly['Revenue'])

  const peTTM = price && ttmEPS && ttmEPS.value > 0 ? price / ttmEPS.value : null
  const pSalesTTM =
    price && ttmRevenue && ttmRevenue.value > 0 && shares
      ? price / (ttmRevenue.value / shares)
      : null
  const earningsYieldTTM = peTTM && peTTM > 0 ? 1 / peTTM : null

  // ── Piotroski F-Score ──
  const piotroski = computePiotroski(stock as Stock)

  // ── Reverse DCF: growth apa yang di-imply pasar? ──
  const reverseDCFResult =
    price && fcf && fcf > 0 && shares
      ? reverseDCF({
          currentPrice: price,
          latestFCF: fcf,
          shares,
          netDebt: netDebt ?? 0,
        })
      : null

  // Per-share derivations
  const revPerShare = revenue && shares ? revenue / shares : null
  const cashPerShare = cash && shares ? cash / shares : null
  const fcfPerShare = fcf && shares ? fcf / shares : null
  const cfoPerShare = cfo && shares ? cfo / shares : null

  // Market cap & EV (prefer EmittenStats current value)
  const marketCap = emittenStats?.marketCap ?? atYear(m['Market Cap'], year)
  const enterpriseValue =
    emittenStats?.enterpriseValue ??
    atYear(m['Enterprise Value'], year) ??
    (marketCap !== null && totalDebt !== null && cash !== null
      ? marketCap + totalDebt - cash
      : null)

  // Valuation multiples (computed)
  const peRatio = price && eps && eps > 0 ? price / eps : null
  const pbv = price && bvps && bvps > 0 ? price / bvps : null
  const priceToSales =
    price && revPerShare && revPerShare > 0 ? price / revPerShare : null
  const priceToCashflow =
    price && cfoPerShare && cfoPerShare > 0 ? price / cfoPerShare : null
  const priceToFCF =
    price && fcfPerShare && fcfPerShare > 0 ? price / fcfPerShare : null
  const evEbit =
    enterpriseValue && ebit && ebit > 0 ? enterpriseValue / ebit : null
  const evEbitda =
    enterpriseValue && ebitda && ebitda > 0 ? enterpriseValue / ebitda : null
  const earningsYield = peRatio && peRatio > 0 ? 1 / peRatio : null
  const dividendYield =
    dividendEvents.length > 0 && price && price > 0
      ? dividendEvents
          .filter((d) => !!d.exDate && !!d.dividend)
          .slice(0, 12) // cap
          .reduce((s, d) => s + (d.dividend ?? 0), 0) / price
      : null

  // Solvency
  const currentRatio =
    currentAssets && currentLiab && currentLiab > 0
      ? currentAssets / currentLiab
      : null
  const quickRatio =
    currentAssets !== null && inventory !== null && currentLiab && currentLiab > 0
      ? (currentAssets - inventory) / currentLiab
      : null
  const debtToEquity =
    totalDebt !== null && equity && equity > 0 ? totalDebt / equity : null
  const totalLiabEquity =
    totalLiab !== null && equity && equity > 0 ? totalLiab / equity : null
  const debtToAssets =
    totalDebt !== null && totalAssets && totalAssets > 0
      ? totalDebt / totalAssets
      : null
  const financialLeverage =
    totalAssets && equity && equity > 0 ? totalAssets / equity : null
  const interestCoverage =
    ebit && interestExpense && interestExpense !== 0
      ? ebit / Math.abs(interestExpense)
      : null

  // Management effectiveness
  const roa = netProfit && totalAssets ? netProfit / totalAssets : null
  const roe = netProfit && equity ? netProfit / equity : null
  const roic =
    netProfit && (equity ?? 0) + (totalDebt ?? 0) > 0
      ? netProfit / ((equity ?? 0) + (totalDebt ?? 0))
      : null
  const assetTurnover = revenue && totalAssets ? revenue / totalAssets : null
  const inventoryTurnover =
    revenue && inventory && inventory > 0 ? revenue / inventory : null

  // Profitability
  const grossMargin = grossProfit && revenue ? grossProfit / revenue : null
  const opMargin = ebit && revenue ? ebit / revenue : null
  const netMargin = netProfit && revenue ? netProfit / revenue : null

  // Growth (YoY)
  const revYoY =
    revenue !== null && year !== null
      ? (() => {
          const prev = atYear(m['Revenue'], year - 1)
          return prev && prev !== 0 ? (revenue - prev) / prev : null
        })()
      : null
  const npYoY =
    netProfit !== null && year !== null
      ? (() => {
          const prev = atYear(m['Net Profit'], year - 1)
          return prev && prev !== 0 ? (netProfit - prev) / prev : null
        })()
      : null
  const gpYoY =
    grossProfit !== null && year !== null
      ? (() => {
          const prev = atYear(m['Gross Profit'], year - 1)
          return prev && prev !== 0 ? (grossProfit - prev) / prev : null
        })()
      : null

  // 52-week
  const wk52 = pricePerformance?.['1Y']

  // Quarterly latest (Net Income QoQ-YoY)
  const niQ = quarterly['Net Income'] ?? {}
  const niQsorted = Object.entries(niQ).sort((a, b) => a[0].localeCompare(b[0]))
  const latestQ = niQsorted[niQsorted.length - 1]
  const prevYearQ =
    latestQ && niQsorted.length >= 4
      ? niQsorted[niQsorted.length - 4 - 1]?.[1] ?? null
      : null
  const niQyoy =
    latestQ && prevYearQ !== null ? (latestQ[1] - prevYearQ) / prevYearQ : null

  // ── Build sections ──────────────────────────────────────────────────

  const idrRow = (label: string, raw: number | null, color?: string): StatRow => ({
    label,
    value: fmtIDR(raw),
    raw,
    rawFormat: 'idr',
    color,
  })
  const pctRow = (label: string, raw: number | null, color?: string): StatRow => ({
    label,
    value: fmtPct(raw),
    raw,
    rawFormat: 'pct',
    color,
  })
  const ratioRow = (label: string, raw: number | null, color?: string): StatRow => ({
    label,
    value: fmtRatio(raw),
    raw,
    rawFormat: 'ratio',
    color,
  })
  const numRow = (
    label: string,
    raw: number | null,
    digits = 2,
    color?: string,
  ): StatRow => ({
    label,
    value: fmtNum(raw, digits),
    raw,
    rawFormat: 'number',
    color,
  })

  const ttmPeriodNote = (t: { startPeriod: string; endPeriod: string } | null) =>
    t ? `${t.startPeriod} → ${t.endPeriod}` : undefined

  const sections: StatSection[] = [
    {
      title: 'Current Valuation',
      rows: [
        ratioRow('P/E Ratio (FY)', peRatio),
        { ...ratioRow('P/E Ratio (TTM)', peTTM), title: ttmPeriodNote(ttmEPS) },
        pctRow('Earnings Yield (FY)', earningsYield, signColor(earningsYield)),
        pctRow('Earnings Yield (TTM)', earningsYieldTTM, signColor(earningsYieldTTM)),
        ratioRow('P/B Ratio', pbv),
        ratioRow('P/S Ratio (FY)', priceToSales),
        ratioRow('P/S Ratio (TTM)', pSalesTTM),
        ratioRow('Price / Cash Flow', priceToCashflow),
        ratioRow('Price / Free Cash Flow', priceToFCF),
        ratioRow('EV / EBIT', evEbit),
        ratioRow('EV / EBITDA', evEbitda),
        pctRow('Dividend Yield (TTM)', dividendYield, signColor(dividendYield)),
      ],
    },
    {
      title: 'TTM Financials',
      rows: [
        { ...idrRow('Revenue (TTM)', ttmRevenue?.value ?? null), title: ttmPeriodNote(ttmRevenue) },
        {
          ...idrRow('Net Income (TTM)', ttmNetIncome?.value ?? null, signColor(ttmNetIncome?.value)),
          title: ttmPeriodNote(ttmNetIncome),
        },
        {
          ...numRow('EPS (TTM)', ttmEPS?.value ?? null, 2, signColor(ttmEPS?.value)),
          title: ttmPeriodNote(ttmEPS),
        },
        pctRow(
          'Net Margin (TTM)',
          ttmRevenue && ttmNetIncome && ttmRevenue.value > 0
            ? ttmNetIncome.value / ttmRevenue.value
            : null,
          signColor(
            ttmRevenue && ttmNetIncome && ttmRevenue.value > 0
              ? ttmNetIncome.value / ttmRevenue.value
              : null,
          ),
        ),
      ],
    },
    {
      title: 'Per Share',
      rows: [
        numRow('EPS', eps, 2),
        numRow('Book Value / Share', bvps, 2),
        numRow('Revenue / Share', revPerShare, 2),
        numRow('Cash Flow / Share', cfoPerShare, 2),
        numRow('Free Cash Flow / Share', fcfPerShare, 2),
        numRow('Cash / Share', cashPerShare, 2),
      ],
    },
    {
      title: 'Solvency',
      rows: [
        ratioRow('Current Ratio', currentRatio),
        ratioRow('Quick Ratio', quickRatio),
        ratioRow('Debt / Equity', debtToEquity),
        ratioRow('Total Liabilities / Equity', totalLiabEquity),
        ratioRow('Total Debt / Total Assets', debtToAssets),
        ratioRow('Financial Leverage', financialLeverage),
        ratioRow('Interest Coverage', interestCoverage),
        idrRow('Free Cash Flow', fcf, signColor(fcf)),
      ],
    },
    {
      title: 'Management Effectiveness',
      rows: [
        pctRow('Return on Assets', roa, signColor(roa)),
        pctRow('Return on Equity', roe, signColor(roe)),
        pctRow('Return on Invested Capital', roic, signColor(roic)),
        ratioRow('Asset Turnover', assetTurnover),
        ratioRow('Inventory Turnover', inventoryTurnover),
      ],
    },
    {
      title: 'Profitability',
      rows: [
        pctRow('Gross Margin', grossMargin, signColor(grossMargin)),
        pctRow('Operating Margin', opMargin, signColor(opMargin)),
        pctRow('Net Margin', netMargin, signColor(netMargin)),
      ],
    },
    {
      title: 'Growth (YoY)',
      rows: [
        pctRow('Revenue Growth', revYoY, signColor(revYoY)),
        pctRow('Gross Profit Growth', gpYoY, signColor(gpYoY)),
        pctRow('Net Income Growth', npYoY, signColor(npYoY)),
        pctRow('Net Income Growth (QoQ YoY)', niQyoy, signColor(niQyoy)),
      ],
    },
    {
      title: 'Market Data',
      rows: [
        idrRow('Market Cap', marketCap),
        idrRow('Enterprise Value', enterpriseValue),
        numRow('Shares Outstanding', shares, 0),
        pctRow('Free Float', emittenStats?.freeFloatPct ?? null),
        numRow('52-Week High', wk52?.high ?? null, 0),
        numRow('52-Week Low', wk52?.low ?? null, 0),
        pctRow(
          '52-Week Change',
          wk52?.percentage != null ? wk52.percentage / 100 : null,
          wk52?.percentage != null ? signColor(wk52.percentage / 100) : undefined,
        ),
      ],
    },
    {
      title: 'Income Statement (FY)',
      rows: [
        idrRow('Revenue', revenue),
        idrRow('Gross Profit', grossProfit),
        idrRow('EBIT', ebit),
        idrRow('EBITDA', ebitda),
        idrRow('Net Income', netProfit, signColor(netProfit)),
      ],
    },
    {
      title: 'Balance Sheet (FY)',
      rows: [
        idrRow('Cash', cash),
        idrRow('Total Assets', totalAssets),
        idrRow('Total Liabilities', totalLiab),
        idrRow('Total Equity', equity),
        idrRow('Total Debt', totalDebt),
        idrRow('Net Debt', netDebt, signColor(netDebt)),
      ],
    },
    {
      title: 'Cash Flow (FY)',
      rows: [
        idrRow('Operating Cash Flow', cfo, signColor(cfo)),
        idrRow('Capital Expenditure', capex),
        idrRow('Free Cash Flow', fcf, signColor(fcf)),
      ],
    },
    {
      title: 'Quality Score (Piotroski F-Score)',
      rows: [
        {
          label: 'F-Score',
          value: `${piotroski.score} / ${piotroski.maxPossible}`,
          raw: piotroski.score,
          rawFormat: 'number',
          color:
            piotroski.verdict === 'Strong'
              ? 'var(--c-mint)'
              : piotroski.verdict === 'Weak'
                ? 'var(--c-coral)'
                : undefined,
          title: `${piotroski.verdict} — ${piotroski.checks.filter((c) => c.pass === true).length} pass, ${piotroski.checks.filter((c) => c.pass === false).length} fail, ${piotroski.checks.filter((c) => c.pass === null).length} no data`,
        },
        ...piotroski.checks.map((c) => ({
          label: `  ${c.id}. ${c.label}`,
          value:
            c.pass === true ? '✓ PASS' : c.pass === false ? '✗ FAIL' : '— N/A',
          color:
            c.pass === true
              ? 'var(--c-mint)'
              : c.pass === false
                ? 'var(--c-coral)'
                : 'var(--ink-soft)',
          title: c.note,
        })),
      ],
    },
    ...(reverseDCFResult
      ? [
          {
            title: 'Market Expectations (Reverse DCF)',
            rows: [
              {
                label: 'Implied FCF Growth',
                value:
                  reverseDCFResult.impliedGrowth !== null
                    ? fmtPct(reverseDCFResult.impliedGrowth)
                    : '—',
                raw: reverseDCFResult.impliedGrowth,
                rawFormat: 'pct' as const,
                color: signColor(reverseDCFResult.impliedGrowth),
                title: reverseDCFResult.note,
              },
              {
                label: 'Convergence',
                value: reverseDCFResult.convergence.toUpperCase(),
                color:
                  reverseDCFResult.convergence === 'ok'
                    ? 'var(--c-mint)'
                    : 'var(--amber-500)',
              },
              {
                label: 'Basis: Current FCF',
                value: fmtIDR(fcf),
                raw: fcf,
                rawFormat: 'idr' as const,
              },
              {
                label: 'Basis: Net Debt',
                value: fmtIDR(netDebt),
                raw: netDebt,
                rawFormat: 'idr' as const,
              },
            ] as StatRow[],
          },
        ]
      : []),
  ]

  // Bank-specific section kalau ada customer deposits (bank terdeteksi)
  if (customerDeposits !== null) {
    const loansGiven = pick('Loans Given')
    const loanToDeposit =
      customerDeposits && customerDeposits > 0
        ? (loansGiven ?? 0) / customerDeposits
        : null
    sections.push({
      title: 'Bank-Specific',
      rows: [
        idrRow('Customer Deposits', customerDeposits),
        idrRow('Loans Given', loansGiven),
        pctRow(
          'Loan-to-Deposit Ratio',
          loanToDeposit,
          loanToDeposit !== null && loanToDeposit > 0.9
            ? 'var(--amber-500)'
            : loanToDeposit !== null && loanToDeposit < 0.7
              ? 'var(--c-coral)'
              : undefined,
        ),
        idrRow('BI Placements', pick('BI Placements')),
        idrRow('Interbank Deposits', pick('Interbank Deposits')),
      ],
    })
  }

  // Hide baris kosong "—" untuk kurangi noise. Keep section dengan
  // minimal 1 baris terisi.
  const filteredSections = sections
    .map((sec) => ({
      ...sec,
      rows: sec.rows.filter((r) => r.value !== '—'),
    }))
    .filter((sec) => sec.rows.length > 0)

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg border p-3"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border-soft)' }}
      >
        <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          <strong style={{ color: 'var(--ink)' }}>Key Statistics</strong> — dihitung
          real-time dari laporan keuangan FY{year ?? '—'}. Semua rasio pakai harga
          pasar sekarang ({price ? price.toLocaleString('id-ID') : '—'}) kecuali yang
          berlabel FY atau TTM. Field yang nggak relevan (misal Current Ratio buat
          sektor bank) otomatis disembunyiin.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredSections.map((sec) => (
          <div key={sec.title} className="s-card overflow-hidden">
            <div
              className="px-4 py-2.5"
              style={{ borderBottom: '1px solid var(--border-soft)' }}
            >
              <h3 className="eyebrow">{sec.title}</h3>
            </div>
            <div>
              {sec.rows.map((row, i) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between px-4 py-2"
                  style={{
                    borderTop: i === 0 ? undefined : '1px solid var(--border-soft)',
                  }}
                  title={tooltipFor(row)}
                >
                  <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                    {row.label}
                  </span>
                  <span
                    className="num tabular text-sm font-medium cursor-help"
                    style={{ color: row.color ?? 'var(--ink)' }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
