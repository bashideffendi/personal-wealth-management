'use client'

/**
 * Valuasi Konsensus — 13 metode weighted by sector fit, live-compute dari
 * raw financial data (lib/invest/valuation.ts). Diport dari IDX Terminal
 * "Valuasi" tab ke Klunting (LIGHT theme).
 *
 * Weight: ideal = 2×, berlaku = 1×, kurang cocok = diabaikan.
 */

import dynamic from 'next/dynamic'
import { AlertTriangle, Check, Info, X } from 'lucide-react'

import {
  ASSUMPTIONS,
  type ValuationSummary,
} from '@/lib/invest/valuation'
import {
  getSuitability,
  suitabilityLabel,
  type Suitability,
} from '@/lib/invest/valuation-methods'
import {
  formatPrice,
  formatPercentValue,
  signColorVar,
  verdictStyle,
} from '@/lib/invest/format'
import { MethodInfoDialog } from './method-info-dialog'

// Defer recharts: fetched only when the Valuasi tab renders the bar chart, not
// on the research page's initial hydration. Skeleton matches the 300px height.
const ValuationBars = dynamic(
  () => import('./valuation-bars').then((m) => m.ValuationBars),
  {
    ssr: false,
    loading: () => (
      <div
        className="animate-pulse rounded-lg"
        style={{ height: 300, background: 'var(--surface-2)' }}
      />
    ),
  },
)

/** Light-theme palette per suitability untuk badge "Sektor Fit". */
function suitStyle(s: Suitability): { bg: string; fg: string } {
  if (s === 'ideal') return { bg: 'var(--c-mint)', fg: '#FFFFFF' }
  if (s === 'avoid') return { bg: 'var(--c-coral)', fg: '#FFFFFF' }
  return { bg: 'var(--surface-2)', fg: 'var(--ink-muted)' }
}

export function ValuationConsensus({
  data,
  price,
  sector,
}: {
  data: ValuationSummary
  price: number | null
  sector: string | null
}) {
  const barData = data.results.map((r) => ({
    method: r.method,
    fairValue: r.fairValue,
    mos: r.mos,
  }))
  const currentPrice = price && price > 0 ? price : null
  const verdictColor = verdictStyle(data.verdict)

  return (
    <div className="s-card overflow-hidden">
      {/* ── Header — verdict + counters ───────────────────────────── */}
      <div className="p-5 sm:p-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between border-b" style={{ borderColor: 'var(--border-soft)' }}>
        <div>
          <p className="eyebrow">Valuasi Konsensus</p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
            13 metode · weighted by sector fit (ideal 2× · berlaku 1× · kurang cocok diabaikan)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: verdictColor.bg, color: verdictColor.fg }}
          >
            {data.verdict}
          </span>
          <Counter>{data.methodsValid} / 13 valid</Counter>
          <Counter>{data.methodsRelevant} relevan</Counter>
          <Counter>{data.undervaluedCount} undervalued</Counter>
        </div>
      </div>

      <div className="p-5 sm:p-6 flex flex-col gap-4">
        {/* ── Anchor & time-gap disclosure ────────────────────────── */}
        <TimeGapDisclosure
          anchorYear={data.anchorYear}
          gapMonths={data.gapMonths}
          gapConfidence={data.gapConfidence}
          currentPrice={currentPrice}
        />

        {/* ── 4 summary cards ─────────────────────────────────────── */}
        <div className="grid gap-3 md:grid-cols-4">
          <SummaryStat
            label="Weighted Fair Value"
            value={`Rp ${formatPrice(data.weightedFairValue)}`}
            sub="Ideal 2× · berlaku 1×"
          />
          <SummaryStat
            label="Weighted MoS"
            value={formatPercentValue(data.weightedMoS)}
            valueColor={signColorVar(data.weightedMoS)}
            sub="vs harga pasar"
          />
          <SummaryStat
            label="Avg Fair Value"
            value={`Rp ${formatPrice(data.avgFairValue)}`}
            sub="Rata-rata sederhana"
          />
          <SummaryStat
            label="Median Fair Value"
            value={`Rp ${formatPrice(data.medianFairValue)}`}
            sub="Tahan outlier"
          />
        </div>

        {/* ── Bar chart ───────────────────────────────────────────── */}
        {barData.some((d) => d.fairValue !== null) && (
          <div
            className="rounded-xl p-3 pt-4"
            style={{ background: 'var(--surface-2)' }}
          >
            <ValuationBars data={barData} currentPrice={currentPrice} height={300} />
          </div>
        )}

        {/* ── Per-method table ────────────────────────────────────── */}
        <div className="overflow-x-auto rounded-md border" style={{ borderColor: 'var(--border-soft)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th className="eyebrow px-3 py-2 text-left">Metode</th>
                <th className="eyebrow px-3 py-2 text-left">Sektor Fit</th>
                <th className="eyebrow px-3 py-2 text-right">Fair Value</th>
                <th className="eyebrow px-3 py-2 text-right">MoS</th>
                <th className="eyebrow px-3 py-2 text-right">Status</th>
                <th className="eyebrow px-3 py-2 text-left">Rumus</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r, idx) => {
                const undervalued =
                  r.fairValue !== null && currentPrice !== null && r.fairValue > currentPrice
                const suitability = getSuitability(r.method, sector)
                const isAvoid = suitability === 'avoid'
                const suit = suitStyle(suitability)
                return (
                  <tr
                    key={r.method}
                    style={{
                      borderTop: idx === 0 ? undefined : '1px solid var(--border-soft)',
                      background: isAvoid ? 'rgba(244,63,94,0.04)' : undefined,
                    }}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold" style={{ color: 'var(--ink)' }}>{r.method}</span>
                        <MethodInfoDialog methodKey={r.method} sector={sector} />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: suit.bg, color: suit.fg }}
                      >
                        {suitabilityLabel(suitability)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right num tabular" style={{ color: 'var(--ink)' }}>
                      {r.fairValue === null ? '—' : `Rp ${formatPrice(r.fairValue)}`}
                    </td>
                    <td
                      className="px-3 py-2 text-right num tabular"
                      style={{ color: signColorVar(r.mos), opacity: isAvoid ? 0.6 : 1 }}
                    >
                      {formatPercentValue(r.mos)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.fairValue === null ? (
                        <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>N/A</span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            background: undervalued ? 'var(--c-mint)' : 'var(--c-coral)',
                            color: '#FFFFFF',
                          }}
                        >
                          {undervalued ? <Check className="size-3" /> : <X className="size-3" />}
                          {undervalued ? 'Under' : 'Over'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
                      {r.note}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Global assumptions footer ───────────────────────────── */}
        <div
          className="rounded-md p-3 text-xs"
          style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
        >
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>Asumsi global (Indonesia, April 2026):</p>
          <p className="num mt-0.5">
            Risk-free {(ASSUMPTIONS.riskFreeRate * 100).toFixed(2)}% · Equity risk premium{' '}
            {(ASSUMPTIONS.equityRiskPremium * 100).toFixed(0)}% · Cost of equity{' '}
            {(ASSUMPTIONS.costOfEquity * 100).toFixed(2)}% · Terminal growth{' '}
            {(ASSUMPTIONS.terminalGrowth * 100).toFixed(0)}% · Tax{' '}
            {(ASSUMPTIONS.taxRate * 100).toFixed(0)}%
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────

function Counter({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold num tabular"
      style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-muted)' }}
    >
      {children}
    </span>
  )
}

function SummaryStat({
  label,
  value,
  valueColor,
  sub,
}: {
  label: string
  value: React.ReactNode
  valueColor?: string
  sub?: string
}) {
  return (
    <div
      className="flex flex-col gap-0.5 rounded-md border p-3"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}
    >
      <span className="eyebrow">{label}</span>
      <span className="num tabular text-lg font-semibold" style={{ color: valueColor ?? 'var(--ink)' }}>
        {value}
      </span>
      {sub && <span className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{sub}</span>}
    </div>
  )
}

function TimeGapDisclosure({
  anchorYear,
  gapMonths,
  gapConfidence,
  currentPrice,
}: {
  anchorYear: number | null
  gapMonths: number | null
  gapConfidence: 'high' | 'medium' | 'low' | 'unknown'
  currentPrice: number | null
}) {
  if (anchorYear === null) {
    return (
      <div
        className="flex items-start gap-2 rounded-md p-3 text-sm"
        style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.25)' }}
      >
        <AlertTriangle className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--c-coral)' }} />
        <div>
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>Belum ada tahun fiskal lengkap</p>
          <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            Emiten ini belum punya satu pun tahun dengan Revenue + Net Profit lengkap, jadi valuasi
            gak bisa dihitung.
          </p>
        </div>
      </div>
    )
  }

  const tone =
    gapConfidence === 'high'
      ? { bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.28)', ink: 'var(--emerald-600)' }
      : gapConfidence === 'medium'
        ? { bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.3)', ink: 'var(--amber-500)' }
        : { bg: 'rgba(244,63,94,0.06)', border: 'rgba(244,63,94,0.25)', ink: 'var(--c-coral)' }

  return (
    <div
      className="flex items-start gap-2 rounded-md p-3"
      style={{ background: tone.bg, border: `1px solid ${tone.border}` }}
    >
      <Info className="size-4 shrink-0 mt-0.5" style={{ color: tone.ink }} />
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          Basis: Laporan Tahunan FY{anchorYear}
          {gapMonths !== null && gapMonths > 0 && (
            <span style={{ color: 'var(--ink-soft)' }}> · {gapMonths} bulan lalu</span>
          )}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
          Fair value dihitung dari data FY{anchorYear} ke bawah. Margin of Safety dibandingin sama{' '}
          <span className="font-semibold" style={{ color: 'var(--ink)' }}>harga pasar hari ini</span>
          {currentPrice !== null && (
            <span className="num"> (Rp {currentPrice.toLocaleString('id-ID')})</span>
          )}
          . Makin besar gap waktu, makin besar risiko &ldquo;blind spot&rdquo; — fair value bisa
          overstated kalau fundamental udah turun di luar data annual. Metode relatif (PER, PBV,
          EV/EBIT) relatif lebih tahan karena median peer juga diambil dari tahun anchor
          masing-masing.
        </p>
        {gapConfidence !== 'high' && (
          <p className="mt-1 text-xs font-semibold" style={{ color: tone.ink }}>
            Confidence: {gapConfidence.toUpperCase()}
            {gapConfidence === 'medium' &&
              ' — gap 12–24 bulan, cek berita & laporan kuartalan terbaru sebelum action.'}
            {gapConfidence === 'low' &&
              ' — gap >24 bulan, data udah ketinggalan banget. Anggap indikatif aja.'}
          </p>
        )}
      </div>
    </div>
  )
}
