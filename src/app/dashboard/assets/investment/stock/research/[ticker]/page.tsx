import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, Sparkles, TrendingUp, TrendingDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  getValuation,
  getValuationDetail,
  getEmittenStat,
  getDividendsForTicker,
} from '@/lib/invest/stocks'
import { getEmiten } from '@/lib/invest/emitten'
import {
  formatIDRCompact,
  formatPercentValue,
  formatPrice,
  signColorVar,
  verdictStyle,
} from '@/lib/invest/format'

interface RouteProps {
  params: Promise<{ ticker: string }>
}

const METHOD_LABELS: Record<string, { label: string; desc: string }> = {
  DCF: { label: 'DCF', desc: 'Discounted Cash Flow — present value dari cash flow masa depan' },
  Graham: { label: 'Graham Number', desc: 'Ben Graham formula — sqrt(22.5 × EPS × BVPS)' },
  EPV: { label: 'EPV', desc: 'Earnings Power Value — earnings normalisasi tanpa growth' },
  RelPER: { label: 'Rel PER', desc: 'Relative valuation pakai PER median sektor' },
  RelPBV: { label: 'Rel PBV', desc: 'Relative valuation pakai PBV median sektor' },
  DDM: { label: 'DDM', desc: 'Dividend Discount Model — present value future dividend' },
  NAV: { label: 'NAV', desc: 'Net Asset Value — nilai asset bersih per saham' },
  EVEBIT: { label: 'EV/EBIT', desc: 'Enterprise multiple — total firm value relatif ke EBIT' },
}

export default async function StockResearchPage({ params }: RouteProps) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()

  // Auth gate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/assets/investment/stock/research/${ticker}`)

  const emiten = getEmiten(ticker)
  const valuation = getValuation(ticker)
  const detail = getValuationDetail(ticker)
  const stats = getEmittenStat(ticker)
  const dividends = getDividendsForTicker(ticker).slice(0, 12)

  if (!emiten && !valuation && !detail) {
    notFound()
  }

  const name = valuation?.name || detail?.name || emiten?.name || ticker
  const sector = valuation?.sector || detail?.sector || emiten?.sector
  const price = valuation?.price ?? detail?.price ?? emiten?.previousClose ?? 0
  const verdict = valuation?.verdict ?? null
  const verdictColor = verdictStyle(verdict)
  const avgMoS = valuation?.avgMoS ?? null
  const isUp = (avgMoS ?? 0) > 0

  return (
    <div className="space-y-5">
      <Link
        href="/dashboard/assets/investment/stock?tab=research"
        className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: 'var(--ink-muted)' }}
      >
        <ArrowLeft className="size-3.5" />
        Kembali ke Research
      </Link>

      <header
        className="rounded-2xl border p-6"
        style={{
          background: 'linear-gradient(135deg, var(--emerald-50) 0%, var(--surface) 60%)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className="font-mono font-bold text-2xl tracking-tight"
                style={{ color: 'var(--ink)' }}
              >
                {ticker}
              </p>
              {verdict && (
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
                  style={{ background: verdictColor.bg, color: verdictColor.fg }}
                >
                  {verdict}
                </span>
              )}
            </div>
            <p className="mt-1 text-base font-semibold" style={{ color: 'var(--ink)' }}>
              {name}
            </p>
            {sector && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                {sector}
              </p>
            )}
          </div>

          <div className="text-right">
            <p className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--ink-soft)' }}>
              Harga snapshot
            </p>
            <p className="num tabular text-3xl font-bold leading-none mt-1" style={{ color: 'var(--ink)' }}>
              Rp {formatPrice(price)}
            </p>
            {avgMoS != null && (
              <p
                className="text-xs font-semibold mt-2 inline-flex items-center gap-1"
                style={{ color: signColorVar(avgMoS) }}
              >
                {isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                MoS {formatPercentValue(avgMoS)}
              </p>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div
          className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <Stat label="Market Cap" value={formatIDRCompact(stats?.marketCap ?? null)} />
          <Stat label="Enterprise Value" value={formatIDRCompact(stats?.enterpriseValue ?? null)} />
          <Stat label="Free Float" value={stats?.freeFloatStr ?? '—'} />
          <Stat label="Saham Beredar" value={stats?.currentShareOutstanding ? formatIDRCompact(stats.currentShareOutstanding).replace('Rp ', '') : '—'} />
          <Stat label="Median Fair Value" value={formatIDRCompact(valuation?.medianFairValue ?? null)} />
          <Stat label="Avg Fair Value" value={formatIDRCompact(valuation?.avgFairValue ?? null)} />
          <Stat label="Metode Valid" value={valuation ? `${valuation.methodsValid} / 8` : '—'} />
          <Stat label="Undervalued by" value={valuation ? `${valuation.undervaluedCount} metode` : '—'} />
        </div>
      </header>

      {/* Valuation methods grid */}
      {valuation && Object.keys(valuation.methods).length > 0 && (
        <section
          className="rounded-2xl border p-5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
            <div>
              <p className="caps">Valuasi Konsensus</p>
              <h2 className="text-lg font-bold mt-0.5" style={{ color: 'var(--ink)' }}>
                Fair value per metode
              </h2>
            </div>
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
              {valuation.methodsValid} metode valid · {valuation.undervaluedCount} bilang undervalued
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {Object.entries(valuation.methods).map(([method, fv]) => {
              const meta = METHOD_LABELS[method] ?? { label: method, desc: method }
              if (fv == null) return null
              const mos = ((fv - price) / price) * 100
              const mosFraction = mos / 100
              return (
                <div
                  key={method}
                  className="rounded-xl border p-3"
                  style={{
                    background: 'var(--paper)',
                    borderColor: 'var(--border-soft)',
                  }}
                  title={meta.desc}
                >
                  <p className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                    {meta.label}
                  </p>
                  <p className="num tabular text-lg font-bold mt-1" style={{ color: 'var(--ink)' }}>
                    Rp {formatPrice(fv)}
                  </p>
                  <p className="text-xs num font-semibold mt-0.5" style={{ color: signColorVar(mosFraction) }}>
                    {mosFraction > 0 ? '+' : ''}{mos.toFixed(0)}% MoS
                  </p>
                </div>
              )
            })}
          </div>

          {/* Consensus row */}
          {(valuation.medianFairValue || valuation.avgFairValue) && (
            <div
              className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-3"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              {valuation.medianFairValue != null && (
                <div>
                  <p className="text-[10px] uppercase font-semibold" style={{ color: 'var(--ink-soft)' }}>
                    Median Fair Value
                  </p>
                  <p className="num tabular text-xl font-bold mt-1" style={{ color: 'var(--ink)' }}>
                    Rp {formatPrice(valuation.medianFairValue)}
                  </p>
                </div>
              )}
              {valuation.avgFairValue != null && (
                <div>
                  <p className="text-[10px] uppercase font-semibold" style={{ color: 'var(--ink-soft)' }}>
                    Average Fair Value
                  </p>
                  <p className="num tabular text-xl font-bold mt-1" style={{ color: 'var(--ink)' }}>
                    Rp {formatPrice(valuation.avgFairValue)}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Dividend history */}
      {dividends.length > 0 && (
        <section
          className="rounded-2xl border p-5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
            <div>
              <p className="caps">Riwayat Dividen</p>
              <h2 className="text-lg font-bold mt-0.5" style={{ color: 'var(--ink)' }}>
                {dividends.length} event terakhir
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-[10px] uppercase tracking-[0.08em] font-semibold border-b"
                  style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}
                >
                  <th className="px-2 py-2">Ex-Date</th>
                  <th className="px-2 py-2 text-right">Per Lembar</th>
                  <th className="px-2 py-2">Pay Date</th>
                  <th className="px-2 py-2">Periode</th>
                </tr>
              </thead>
              <tbody>
                {dividends.map((d, i) => (
                  <tr
                    key={`${d.exDate}-${i}`}
                    className="border-t"
                    style={{ borderColor: 'var(--border-soft)' }}
                  >
                    <td className="px-2 py-2 text-xs" style={{ color: 'var(--ink)' }}>{d.exDate || '—'}</td>
                    <td className="px-2 py-2 text-right num tabular text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                      Rp {formatPrice(d.dividend)}
                    </td>
                    <td className="px-2 py-2 text-xs" style={{ color: 'var(--ink-muted)' }}>{d.payDate || '—'}</td>
                    <td className="px-2 py-2 text-xs" style={{ color: 'var(--ink-soft)' }}>{d.period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* External link to Stockbit/IDX for deeper info */}
      <div
        className="rounded-lg border p-3 flex items-start gap-2 text-xs"
        style={{
          background: 'var(--surface-2)',
          borderColor: 'var(--border-soft)',
          color: 'var(--ink-muted)',
        }}
      >
        <Sparkles className="size-3.5 shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
        <div className="flex-1">
          <p>
            Data valuasi & dividen snapshot dari kelolainvestasi (update kuartalan).
            Bukan rekomendasi investasi. Untuk data lebih dalam:
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <a
              href={`https://stockbit.com/symbol/${ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium hover:underline"
              style={{ color: 'var(--ink)' }}
            >
              Stockbit <ArrowUpRight className="size-3" />
            </a>
            <a
              href={`https://www.idx.co.id/id/perusahaan-tercatat/profil-perusahaan-tercatat/${ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium hover:underline"
              style={{ color: 'var(--ink)' }}
            >
              IDX <ArrowUpRight className="size-3" />
            </a>
            <a
              href={`https://finance.yahoo.com/quote/${ticker}.JK`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium hover:underline"
              style={{ color: 'var(--ink)' }}
            >
              Yahoo Finance <ArrowUpRight className="size-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: 'var(--ink-soft)' }}>
        {label}
      </p>
      <p className="num tabular text-sm font-bold mt-0.5" style={{ color: 'var(--ink)' }}>
        {value}
      </p>
    </div>
  )
}
