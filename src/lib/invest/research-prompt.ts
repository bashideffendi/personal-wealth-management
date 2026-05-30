import 'server-only'
import type { Stock, Valuation, ValuationDetail, EmittenStat, DividendEvent } from './stocks'
import { latestMetricYear, getMetricSeries } from './stocks'

/**
 * Build prompt buat Claude untuk generate equity research markdown.
 *
 * Output yang diharapkan: markdown dengan YAML frontmatter (ticker, name,
 * sector, generated, recommendation, conviction, fair_value_low,
 * fair_value_high, current_price), lalu body sections:
 *   Ringkasan Eksekutif, Bisnis & Posisi Kompetitif, Highlights Finansial,
 *   Bull Case (4 poin), Bear Case (4 poin), Katalis 6-12 Bulan,
 *   Risiko Material, Disclosure & Limitasi
 *
 * Format konsisten dengan markdown yang ada di data/invest/research/BBCA.md
 * supaya rendering UI seragam.
 */

export const SYSTEM_PROMPT = `Kamu adalah equity research analyst senior di Indonesia dengan 15+ tahun
pengalaman covering IDX. Tugasmu: tulis report research untuk satu saham
berdasarkan data laporan keuangan + valuasi yang dikasih. Output harus
markdown valid dengan YAML frontmatter.

Aturan kualitas:
- Tulis bahasa Indonesia formal-konversasional (bukan kaku banker, bukan
  juga casual blog). Pakai istilah finance yang umum dipake (ROE, NPM,
  PER, PBV, debt-to-equity, dst).
- ANGKA HARUS AKURAT — semua angka di body harus konsisten dengan data
  yang dikasih di prompt. Jangan halusinasi. Kalau gak yakin, skip.
- Bull case dan Bear case harus BALANCED — masing-masing 4 poin spesifik,
  data-driven. Jangan satu sisi yang menang.
- Recommendation harus dasar dari analisis, BUKAN dari current price vs
  fair value semata. Considerations: kualitas bisnis, growth trajectory,
  competitive position, risk factors.
- Conviction: high/medium/low. High kalau angka jelas + bisnis stabil.
  Low kalau banyak unknown.
- Format frontmatter YAML harus persis sesuai contoh — parser strict.

Struktur output (mandatory):

---
ticker: <TICKER>
name: <Company name>
sector: <Sector>
generated: <YYYY-MM-DD>
recommendation: <BUY|HOLD|SELL>
conviction: <high|medium|low>
fair_value_low: <integer Rp>
fair_value_high: <integer Rp>
current_price: <integer Rp>
thesis: <1-2 kalimat tesis investasi inti — punchy, kenapa layak beli/hold/avoid. Tanpa tanda kutip, satu baris.>
---

## Ringkasan Eksekutif

<2-3 paragraf tight, langsung ke kesimpulan>

## Bisnis & Posisi Kompetitif

<paragraf bahas bisnis emiten, segmen, posisi vs kompetitor>

## Highlights Finansial

<bullet list 4-6 poin angka kunci: ROE, NPM, growth, leverage, dll>

## Bull Case

<bullet list 4 poin specific>

## Bear Case

<bullet list 4 poin specific>

## Katalis 6-12 Bulan

<bullet list 3-5 katalis konkret>

## Risiko Material

<bullet list 4-5 risiko spesifik bukan generic>

## Disclosure & Limitasi

<paragraf: snapshot quarterly, bukan rekomendasi investasi, do your own DD>
`

interface BuildPromptInput {
  stock: Stock
  valuation: Valuation | null
  valuationDetail: ValuationDetail | null
  stats: EmittenStat | null
  dividends: DividendEvent[]
}

export function buildResearchPrompt(input: BuildPromptInput): string {
  const { stock, valuation, valuationDetail, stats, dividends } = input

  const today = new Date().toISOString().slice(0, 10)
  const latestYear = latestMetricYear(stock.metrics['Net Profit'])?.year ?? null
  const get = (m: string): number | null => {
    if (latestYear == null) return null
    return stock.metrics[m]?.[String(latestYear)] ?? null
  }

  // Compact 5Y series for prompt context
  const metricsBlock = ['Revenue', 'Net Profit', 'ROE', 'Net Profit Margin', 'EPS', 'BVPS', 'DPS', 'PE Ratio', 'PBV', 'Debt to Equity']
    .map((metric) => {
      const series = getMetricSeries(stock, metric, 5)
      if (series.length === 0) return null
      const items = series.map((s) => `${s.year}=${formatNum(s.value, metric)}`).join(', ')
      return `${metric}: ${items}`
    })
    .filter(Boolean)
    .join('\n')

  const valuationBlock = valuation
    ? `Valuasi consensus (8 metode):
- Verdict: ${valuation.verdict}
- Avg MoS: ${(valuation.avgMoS * 100).toFixed(1)}%
- Methods valid: ${valuation.methodsValid}/8
- Median fair value: Rp ${formatPrice(valuation.medianFairValue)}
- Avg fair value: Rp ${formatPrice(valuation.avgFairValue)}
- Undervalued by ${valuation.undervaluedCount} metode

Per-method fair value:
${Object.entries(valuation.methods)
  .map(([m, v]) => `  - ${m}: Rp ${formatPrice(v)}`)
  .join('\n')}`
    : '(Data valuasi tidak tersedia)'

  const statsBlock = stats
    ? `Statistik emiten:
- Market Cap: Rp ${formatCompact(stats.marketCap)}
- Enterprise Value: Rp ${formatCompact(stats.enterpriseValue)}
- Free Float: ${stats.freeFloatPct ? (stats.freeFloatPct * 100).toFixed(2) + '%' : '—'}
- Saham Beredar: ${formatCompact(stats.currentShareOutstanding)}`
    : ''

  const recentDividends = dividends.slice(0, 6)
  const divBlock = recentDividends.length > 0
    ? `Dividen 6 event terakhir:
${recentDividends.map((d) => `  - ${d.exDate} ex-date · Rp ${d.dividend} (FY ${d.period})`).join('\n')}`
    : '(Tidak ada riwayat dividen)'

  return `Generate equity research markdown untuk:

Ticker: ${stock.ticker}
Nama: ${stock.name ?? stock.ticker}
Sektor: ${stock.sector ?? '—'}
Papan: ${stock.board ?? '—'}
Listing date: ${stock.listingDate ?? '—'}
Harga saat ini (snapshot): Rp ${formatPrice(stock.currentPrice)}
Tanggal hari ini (untuk frontmatter 'generated'): ${today}

Latest FY ${latestYear ?? '—'} highlights:
- Revenue: Rp ${formatCompact(get('Revenue'))}
- Revenue YoY: ${formatPct(get('Revenue YoY Growth'))}
- Net Profit: Rp ${formatCompact(get('Net Profit'))}
- Net Profit YoY: ${formatPct(get('Net Profit YoY Growth'))}
- NPM: ${formatPct(get('Net Profit Margin'))}
- ROE: ${formatPct(get('ROE'))}
- EPS: Rp ${formatPrice(get('EPS'))}
- BVPS: Rp ${formatPrice(get('BVPS'))}
- DPS: Rp ${formatPrice(get('DPS'))}
- PER: ${formatRatio(get('PE Ratio'))}
- PBV: ${formatRatio(get('PBV'))}
- DER: ${formatRatio(get('Debt to Equity'))}

5-year trend (year=value):
${metricsBlock || '(Data trend tidak tersedia)'}

${valuationBlock}

${statsBlock}

${divBlock}

${valuationDetail
  ? `Per-method MoS detail:
${Object.entries(valuationDetail.methods)
  .map(([m, v]) => `  - ${m}: fair value Rp ${formatPrice(v.fairValue)}, MoS ${v.mos != null ? (v.mos * 100).toFixed(1) + '%' : '—'}`)
  .join('\n')}`
  : ''}

Tulis research markdown dengan struktur persis di SYSTEM_PROMPT. Recommendation
+ conviction harus reasonable berdasar data — gak harus selalu BUY. Fair_value
range pakai 25th-75th percentile dari fair value per-method, atau approximate
median ± 30%. Output: markdown lengkap, langsung mulai dari "---" frontmatter.
JANGAN bungkus dalam code block.`
}

function formatPrice(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Math.round(v).toLocaleString('id-ID')
}

function formatCompact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e12) return `${(abs / 1e12).toFixed(2)} T`
  if (abs >= 1e9) return `${(abs / 1e9).toFixed(2)} M`
  if (abs >= 1e6) return `${(abs / 1e6).toFixed(2)} Jt`
  return formatPrice(v)
}

function formatPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${(v * 100).toFixed(2)}%`
}

function formatRatio(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toFixed(2)}x`
}

function formatNum(v: number, metric: string): string {
  if (!Number.isFinite(v)) return '—'
  // Choose format hint based on metric name
  if (metric.includes('Growth') || metric === 'ROE' || metric === 'Net Profit Margin') {
    return formatPct(v)
  }
  if (metric === 'EPS' || metric === 'BVPS' || metric === 'DPS') {
    return formatPrice(v)
  }
  if (metric === 'PE Ratio' || metric === 'PBV' || metric === 'Debt to Equity') {
    return formatRatio(v)
  }
  return formatCompact(v)
}
