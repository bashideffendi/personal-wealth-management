// Splits the monolithic stocks.json (~30 MB) into per-ticker files + a tiny
// precomputed sector-medians.json. Goal: the server never parses the whole
// universe at cold-start — getStock() reads ONE ~30 KB file, and the research
// page reads precomputed medians instead of iterating all 1000+ stocks.
//
// Run AFTER sync-to-klunting regenerates stocks.json:
//   node scripts/split-stocks.mjs
//
// The median math below MIRRORS src/lib/invest/valuation.ts
// (computeAllSectorMedians + canonicalYear + atYear). If that logic changes,
// update this script too — they must produce identical numbers.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DATA = path.join(ROOT, 'src', 'data', 'invest')
const OUT_DIR = path.join(DATA, 'stocks')

const stocks = JSON.parse(fs.readFileSync(path.join(DATA, 'stocks.json'), 'utf-8'))
if (!Array.isArray(stocks)) {
  throw new Error('stocks.json is not an array — aborting split')
}

// ── per-ticker files ────────────────────────────────────────────
fs.rmSync(OUT_DIR, { recursive: true, force: true })
fs.mkdirSync(OUT_DIR, { recursive: true })
let written = 0
for (const s of stocks) {
  if (!s || !s.ticker) continue
  fs.writeFileSync(
    path.join(OUT_DIR, `${String(s.ticker).toUpperCase()}.json`),
    JSON.stringify(s),
  )
  written++
}

// ── sector medians (mirror of valuation.ts) ─────────────────────
const atYear = (series, year) => {
  if (!series || year === null) return null
  const v = series[String(year)]
  if (v === null || v === undefined || v === 0) return null
  return v
}
const canonicalYear = (stock) => {
  const rev = stock.metrics?.['Revenue']
  const np = stock.metrics?.['Net Profit']
  if (!rev || !np) return null
  const years = Object.keys(rev)
    .filter((y) => {
      const r = rev[y]
      const n = np[y]
      return r !== null && r !== undefined && r !== 0 && n !== null && n !== undefined && n !== 0
    })
    .map((y) => parseInt(y, 10))
  return years.length > 0 ? Math.max(...years) : null
}
const median = (arr) => {
  if (arr.length === 0) return null
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

const bySector = {}
for (const s of stocks) {
  if (!s || !s.sector || !s.metrics) continue
  const y = canonicalYear(s)
  if (y === null) continue

  const perVal = atYear(s.metrics['PE Ratio'], y)
  const pbvVal = atYear(s.metrics['PBV'], y)
  const ev = atYear(s.metrics['Enterprise Value'], y)
  const ebit = atYear(s.metrics['EBIT'], y)
  const mcap = atYear(s.metrics['Market Cap'], y)
  const revenue = atYear(s.metrics['Revenue'], y)

  ;(bySector[s.sector] ||= { per: [], pbv: [], evEbit: [], ps: [] })

  if (perVal && perVal > 0 && perVal < 100) bySector[s.sector].per.push(perVal)
  if (pbvVal && pbvVal > 0 && pbvVal < 20) bySector[s.sector].pbv.push(pbvVal)
  if (ev && ebit && ebit > 0) {
    const m = ev / ebit
    if (m > 0 && m < 50) bySector[s.sector].evEbit.push(m)
  }
  if (mcap && revenue && revenue > 0) {
    const ps = mcap / revenue
    if (ps > 0 && ps < 20) bySector[s.sector].ps.push(ps)
  }
}

const medians = {}
for (const [sector, d] of Object.entries(bySector)) {
  medians[sector] = {
    per: median(d.per),
    pbv: median(d.pbv),
    evEbit: median(d.evEbit),
    ps: median(d.ps),
    sampleSize: Math.max(d.per.length, d.pbv.length, d.evEbit.length, d.ps.length),
  }
}
fs.writeFileSync(path.join(DATA, 'sector-medians.json'), JSON.stringify(medians))

console.log(`✓ ${written} per-ticker files → src/data/invest/stocks/`)
console.log(`✓ ${Object.keys(medians).length} sectors → sector-medians.json`)
