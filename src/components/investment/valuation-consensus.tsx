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
import { useT } from '@/lib/i18n/context'
import { MethodInfoDialog } from './method-info-dialog'

// Defer recharts: fetched only when the Valuasi tab renders the bar chart, not
// on the research page's initial hydration. Skeleton matches the 300px height.
const ValuationBars = dynamic(
  () => import('@/components/charts/chart-modules').then((m) => m.ValuationBars),
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
  const t = useT()
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
          <p className="eyebrow">{t('valuation.title')}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
            {t('valuation.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: verdictColor.bg, color: verdictColor.fg }}
          >
            {data.verdict}
          </span>
          <Counter>{data.methodsValid} / 13 {t('valuation.valid')}</Counter>
          <Counter>{data.methodsRelevant} {t('valuation.relevant')}</Counter>
          <Counter>{data.undervaluedCount} {t('valuation.undervalued')}</Counter>
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
            label={t('valuation.weightedFairValue')}
            value={`Rp ${formatPrice(data.weightedFairValue)}`}
            sub={t('valuation.weightedFairValueSub')}
          />
          <SummaryStat
            label={t('valuation.weightedMos')}
            value={formatPercentValue(data.weightedMoS)}
            valueColor={signColorVar(data.weightedMoS)}
            sub={t('valuation.weightedMosSub')}
          />
          <SummaryStat
            label={t('valuation.avgFairValue')}
            value={`Rp ${formatPrice(data.avgFairValue)}`}
            sub={t('valuation.avgFairValueSub')}
          />
          <SummaryStat
            label={t('valuation.medianFairValue')}
            value={`Rp ${formatPrice(data.medianFairValue)}`}
            sub={t('valuation.medianFairValueSub')}
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

        {/* ── Per-method table (desktop) ──────────────────────────── */}
        <div className="hidden md:block overflow-x-auto rounded-md border" style={{ borderColor: 'var(--border-soft)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th className="eyebrow px-3 py-2 text-left">{t('valuation.colMethod')}</th>
                <th className="eyebrow px-3 py-2 text-left">{t('valuation.colSectorFit')}</th>
                <th className="eyebrow px-3 py-2 text-right">{t('valuation.colFairValue')}</th>
                <th className="eyebrow px-3 py-2 text-right">{t('valuation.colMos')}</th>
                <th className="eyebrow px-3 py-2 text-right">{t('valuation.colStatus')}</th>
                <th className="eyebrow px-3 py-2 text-left">{t('valuation.colFormula')}</th>
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
                            background: undervalued ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)',
                            color: '#FFFFFF',
                          }}
                        >
                          {undervalued ? <Check className="size-3" /> : <X className="size-3" />}
                          {undervalued ? t('valuation.under') : t('valuation.over')}
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

        {/* ── Per-method list (mobile) — baris ringkas, formula via dialog info ── */}
        <div className="md:hidden rounded-md border overflow-hidden" style={{ borderColor: 'var(--border-soft)' }}>
          {data.results.map((r, idx) => {
            const suitability = getSuitability(r.method, sector)
            const isAvoid = suitability === 'avoid'
            const suit = suitStyle(suitability)
            return (
              <div
                key={r.method}
                className="flex items-center gap-3 px-3 py-2"
                style={{
                  minHeight: 56,
                  borderTop: idx === 0 ? undefined : '1px solid var(--border-soft)',
                  background: isAvoid ? 'rgba(244,63,94,0.04)' : undefined,
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[14px] font-semibold leading-tight truncate" style={{ color: 'var(--ink)' }}>
                      {r.method}
                    </span>
                    <MethodInfoDialog methodKey={r.method} sector={sector} />
                  </div>
                  <span
                    className="mt-0.5 inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-semibold"
                    style={{ background: suit.bg, color: suit.fg }}
                  >
                    {suitabilityLabel(suitability)}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <p className="num tabular text-[14px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                    {r.fairValue === null ? '—' : `Rp ${formatPrice(r.fairValue)}`}
                  </p>
                  <p
                    className="num tabular text-[11.5px] font-semibold leading-tight mt-0.5"
                    style={{ color: signColorVar(r.mos), opacity: isAvoid ? 0.6 : 1 }}
                  >
                    {formatPercentValue(r.mos)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Global assumptions footer ───────────────────────────── */}
        <div
          className="rounded-md p-3 text-xs"
          style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
        >
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('valuation.globalAssumptions')}</p>
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
  const t = useT()
  if (anchorYear === null) {
    return (
      <div
        className="flex items-start gap-2 rounded-md p-3 text-sm"
        style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.25)' }}
      >
        <AlertTriangle className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--c-coral-ink)' }} />
        <div>
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('valuation.noFiscalYearTitle')}</p>
          <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            {t('valuation.noFiscalYearBody')}
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
          {t('valuation.basisPrefix')}{anchorYear}
          {gapMonths !== null && gapMonths > 0 && (
            <span style={{ color: 'var(--ink-soft)' }}> · {gapMonths} {t('valuation.monthsAgo')}</span>
          )}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
          {t('valuation.fairValueBasisPrefix')}{anchorYear}{t('valuation.fairValueBasisMid')}{' '}
          <span className="font-semibold" style={{ color: 'var(--ink)' }}>{t('valuation.marketPriceToday')}</span>
          {currentPrice !== null && (
            <span className="num"> (Rp {currentPrice.toLocaleString('id-ID')})</span>
          )}
          {t('valuation.blindSpotNote')}
        </p>
        {gapConfidence !== 'high' && (
          <p className="mt-1 text-xs font-semibold" style={{ color: tone.ink }}>
            {t('valuation.confidence')}: {gapConfidence.toUpperCase()}
            {gapConfidence === 'medium' && t('valuation.confidenceMedium')}
            {gapConfidence === 'low' && t('valuation.confidenceLow')}
          </p>
        )}
      </div>
    </div>
  )
}
