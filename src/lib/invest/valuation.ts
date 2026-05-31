import type { Stock } from "./stocks";
import { getSuitability } from "./valuation-methods";

/**
 * Valuation engine — recomputes per-method fair value from raw financial data.
 *
 * CANONICAL YEAR POLICY
 * =====================
 * To avoid valuations picking up partial / stale current-year data (e.g. Q1
 * 2025 EPS that won't match missing FY25 Revenue), every method anchors on the
 * "canonical latest year" — defined as the most recent year where both Revenue
 * AND Net Profit have non-zero values. This is the same signal used by the
 * freshness badge. All point-in-time metrics (EPS, BVPS, Dividend, EBIT,
 * Jumlah Saham, Net Debt) are read from that anchor year; historical series
 * (CAGR, 5y averages) use data up to and including that year.
 *
 * Macro assumptions (Indonesia, Apr 2026):
 *   Risk-free rate (10Y IDR bond):  5.75%
 *   Equity risk premium (ERP):       8.0%
 *   Cost of equity:                  13.75%
 *   Terminal growth:                 3.0%
 *   Corporate tax rate:              22%
 */
export const ASSUMPTIONS = {
  riskFreeRate: 0.0575,
  equityRiskPremium: 0.08,
  costOfEquity: 0.1375,
  terminalGrowth: 0.03,
  taxRate: 0.22,
};

type Series = Record<string, number>;

// -----------------------------------------------------------------------------
// Canonical year — anchor for all point-in-time valuation inputs
// -----------------------------------------------------------------------------

/**
 * Latest year where BOTH Revenue and Net Profit are present and non-zero.
 * This is the canonical "last complete fiscal year" for the company.
 */
export function canonicalYear(stock: Stock): number | null {
  const rev = stock.metrics["Revenue"];
  const np = stock.metrics["Net Profit"];
  if (!rev || !np) return null;
  const years = Object.keys(rev)
    .filter((y) => {
      const r = rev[y];
      const n = np[y];
      return (
        r !== null &&
        r !== undefined &&
        r !== 0 &&
        n !== null &&
        n !== undefined &&
        n !== 0
      );
    })
    .map((y) => parseInt(y));
  return years.length > 0 ? Math.max(...years) : null;
}

/**
 * Read a metric at a specific year; returns null if missing or zero.
 * Zero is treated as missing for ratio-like metrics (EPS, BVPS) to avoid
 * divide-by-zero / nonsense results.
 */
function atYear(
  series: Series | undefined,
  year: number | null,
): number | null {
  if (!series || year === null) return null;
  const v = series[String(year)];
  if (v === null || v === undefined || v === 0) return null;
  return v;
}

// -----------------------------------------------------------------------------
// TTM (Trailing Twelve Months) from quarterly series
// -----------------------------------------------------------------------------

/**
 * Compute TTM value by summing the last 4 available discrete quarter values.
 * Quarterly keys are in format "YYYY-Qn" (e.g. "2025-Q3").
 * Returns null if fewer than 4 quarters available or sum is zero.
 */
export interface TTMResult {
  value: number;
  endPeriod: string; // most recent quarter included
  startPeriod: string; // oldest quarter in the 4
}

export function computeTTM(
  quarterlySeries: Series | undefined,
): TTMResult | null {
  if (!quarterlySeries) return null;
  const entries = Object.entries(quarterlySeries)
    .filter(([, v]) => v !== null && v !== undefined && v !== 0)
    .sort((a, b) => b[0].localeCompare(a[0])); // desc, newest first
  if (entries.length < 4) return null;
  const lastFour = entries.slice(0, 4);
  const sum = lastFour.reduce((acc, [, v]) => acc + v, 0);
  if (sum === 0) return null;
  return {
    value: sum,
    endPeriod: lastFour[0][0],
    startPeriod: lastFour[3][0],
  };
}

/**
 * Series values up to and including `maxYear` (inclusive), sorted ascending.
 * Excludes zero/null entries.
 */
function seriesThrough(
  series: Series | undefined,
  maxYear: number | null,
): { year: number; value: number }[] {
  if (!series || maxYear === null) return [];
  return Object.entries(series)
    .map(([y, v]) => ({ year: parseInt(y), value: v }))
    .filter(
      (d) =>
        d.year <= maxYear &&
        d.value !== null &&
        d.value !== undefined &&
        d.value !== 0,
    )
    .sort((a, b) => a.year - b.year);
}

function avgLastN(
  series: Series | undefined,
  maxYear: number | null,
  n: number,
): number | null {
  const pts = seriesThrough(series, maxYear);
  if (pts.length === 0) return null;
  const slice = pts.slice(-n);
  return slice.reduce((s, p) => s + p.value, 0) / slice.length;
}

function cagr(
  series: Series | undefined,
  maxYear: number | null,
  years = 5,
): number | null {
  const pts = seriesThrough(series, maxYear);
  if (pts.length < 2) return null;
  const slice = pts.slice(-years);
  if (slice.length < 2) return null;
  const first = slice[0].value;
  const last = slice[slice.length - 1].value;
  if (first <= 0 || last <= 0) return null;
  const n = slice.length - 1;
  return Math.pow(last / first, 1 / n) - 1;
}

// -----------------------------------------------------------------------------
// Valuation methods — all anchored on canonical year
// -----------------------------------------------------------------------------

/** Graham Number: √(22.5 × EPS × BVPS) */
export function grahamNumber(stock: Stock, year: number | null): number | null {
  const eps = atYear(stock.metrics["EPS"], year);
  const bvps = atYear(stock.metrics["BVPS"], year);
  if (!eps || !bvps || eps <= 0 || bvps <= 0) return null;
  return Math.sqrt(22.5 * eps * bvps);
}

/** Revised Graham: EPS × (8.5 + 2g) × 4.4 / Rf */
export function grahamRevised(
  stock: Stock,
  year: number | null,
): number | null {
  const eps = atYear(stock.metrics["EPS"], year);
  if (!eps || eps <= 0) return null;
  const growth = cagr(stock.metrics["EPS"], year, 5);
  const g = Math.max(0, Math.min(growth ?? 0, 0.2)) * 100; // cap 20%, in %
  const y = ASSUMPTIONS.riskFreeRate * 100;
  return (eps * (8.5 + 2 * g) * 4.4) / y;
}

/** Gordon growth DDM: D₁ / (r - g) */
export function ddm(stock: Stock, year: number | null): number | null {
  if (year === null) return null;
  // "Dividend" (dan "DPS") sudah PER-SHARE rupiah dari parser — JANGAN dibagi saham lagi.
  const dps = atYear(stock.metrics["Dividend"], year) ?? atYear(stock.metrics["DPS"], year);
  if (!dps || dps <= 0) return null;

  const growth = cagr(stock.metrics["Dividend"], year, 5) ?? 0;
  const g = Math.min(Math.max(growth, 0), ASSUMPTIONS.costOfEquity - 0.02);
  const d1 = dps * (1 + g);
  return d1 / (ASSUMPTIONS.costOfEquity - g);
}

/** EPV: 5y avg Net Profit / cost of equity, per share */
export function epv(stock: Stock, year: number | null): number | null {
  const avgNP = avgLastN(stock.metrics["Net Profit"], year, 5);
  if (!avgNP || avgNP <= 0) return null;
  const shares = atYear(stock.metrics["Jumlah Saham"], year);
  if (!shares || shares <= 0) return null;
  return avgNP / shares / ASSUMPTIONS.costOfEquity;
}

/**
 * Simplified DCF: 5y FCF projection at historical CAGR (capped 15%),
 * terminal value via Gordon growth (3%), discounted at cost of equity,
 * net-debt adjusted, per share.
 */
export function dcf(stock: Stock, year: number | null): number | null {
  if (year === null) return null;
  const latestFCF = atYear(stock.metrics["Free Cash Flow"], year);
  if (!latestFCF || latestFCF <= 0) return null;

  const shares = atYear(stock.metrics["Jumlah Saham"], year);
  if (!shares || shares <= 0) return null;

  const g = Math.min(
    Math.max(cagr(stock.metrics["Free Cash Flow"], year, 5) ?? 0.05, 0),
    0.15,
  );
  const r = ASSUMPTIONS.costOfEquity;
  const gt = ASSUMPTIONS.terminalGrowth;

  let pv = 0;
  let fcf = latestFCF;
  for (let t = 1; t <= 5; t++) {
    fcf = fcf * (1 + g);
    pv += fcf / Math.pow(1 + r, t);
  }
  const terminal = (fcf * (1 + gt)) / (r - gt);
  pv += terminal / Math.pow(1 + r, 5);

  const netDebt = atYear(stock.metrics["Net Debt"], year) ?? 0;
  const equity = pv - netDebt;
  return equity > 0 ? equity / shares : null;
}

/** NAV: Book Value per Share at canonical year */
export function nav(stock: Stock, year: number | null): number | null {
  return atYear(stock.metrics["BVPS"], year);
}

/**
 * PEG / Peter Lynch: Fair PER ≈ EPS growth rate (%), capped 5-25.
 * Fair price = EPS × (growth% capped). Good for growth companies.
 */
export function peg(stock: Stock, year: number | null): number | null {
  const eps = atYear(stock.metrics["EPS"], year);
  if (!eps || eps <= 0) return null;
  const growth =
    cagr(stock.metrics["EPS"], year, 5) ??
    cagr(stock.metrics["Net Profit"], year, 5);
  if (growth === null || growth <= 0) return null;
  const growthPct = Math.min(Math.max(growth * 100, 5), 25);
  return eps * growthPct;
}

/**
 * Residual Income Model (RIM): fair value = BVPS + PV of excess earnings.
 * Excess earnings = (ROE − cost of equity) × BVPS, fading linearly over 5y.
 * Ideal for banks and book-heavy businesses where ROE is stable.
 */
export function rim(stock: Stock, year: number | null): number | null {
  const bvps = atYear(stock.metrics["BVPS"], year);
  const roe = atYear(stock.metrics["ROE"], year);
  if (!bvps || bvps <= 0 || roe === null) return null;
  const r = ASSUMPTIONS.costOfEquity;
  const excess = roe - r;
  if (excess <= 0) return bvps;
  let pv = 0;
  for (let t = 1; t <= 5; t++) {
    const decay = 1 - (t - 1) / 5;
    const ri = excess * decay * bvps;
    pv += ri / Math.pow(1 + r, t);
  }
  return bvps + pv;
}

/**
 * Normalized FCF Power: 5y avg FCF capitalized at cost of equity, per share.
 * Like EPV but grounded on FCF (captures cash-generating quality).
 */
export function fcfPower(stock: Stock, year: number | null): number | null {
  const avgFCF = avgLastN(stock.metrics["Free Cash Flow"], year, 5);
  if (!avgFCF || avgFCF <= 0) return null;
  const shares = atYear(stock.metrics["Jumlah Saham"], year);
  if (!shares || shares <= 0) return null;
  return avgFCF / shares / ASSUMPTIONS.costOfEquity;
}

// -----------------------------------------------------------------------------
// Relative methods (sector-median based)
// -----------------------------------------------------------------------------

export interface SectorMedians {
  per: number | null;
  pbv: number | null;
  evEbit: number | null;
  ps: number | null;
  sampleSize: number;
}

/**
 * Pre-compute sector medians once for a universe of stocks. Uses each peer's
 * canonical year so fairly captures "the market today".
 */
export function computeAllSectorMedians(
  stocks: Stock[],
): Record<string, SectorMedians> {
  const bySector: Record<
    string,
    { per: number[]; pbv: number[]; evEbit: number[]; ps: number[] }
  > = {};

  for (const s of stocks) {
    if (!s.sector) continue;
    const y = canonicalYear(s);
    if (y === null) continue;

    const perVal = atYear(s.metrics["PE Ratio"], y);
    const pbvVal = atYear(s.metrics["PBV"], y);
    const ev = atYear(s.metrics["Enterprise Value"], y);
    const ebit = atYear(s.metrics["EBIT"], y);
    const mcap = atYear(s.metrics["Market Cap"], y);
    const revenue = atYear(s.metrics["Revenue"], y);

    (bySector[s.sector] ||= { per: [], pbv: [], evEbit: [], ps: [] });

    if (perVal && perVal > 0 && perVal < 100) bySector[s.sector].per.push(perVal);
    if (pbvVal && pbvVal > 0 && pbvVal < 20)
      bySector[s.sector].pbv.push(pbvVal);
    if (ev && ebit && ebit > 0) {
      const mult = ev / ebit;
      if (mult > 0 && mult < 50) bySector[s.sector].evEbit.push(mult);
    }
    if (mcap && revenue && revenue > 0) {
      const ps = mcap / revenue;
      if (ps > 0 && ps < 20) bySector[s.sector].ps.push(ps);
    }
  }

  const median = (arr: number[]): number | null => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  };

  const result: Record<string, SectorMedians> = {};
  for (const [sector, data] of Object.entries(bySector)) {
    result[sector] = {
      per: median(data.per),
      pbv: median(data.pbv),
      evEbit: median(data.evEbit),
      ps: median(data.ps),
      sampleSize: Math.max(
        data.per.length,
        data.pbv.length,
        data.evEbit.length,
        data.ps.length,
      ),
    };
  }
  return result;
}

export function relativePS(
  stock: Stock,
  year: number | null,
  medians: SectorMedians,
): number | null {
  const revenue = atYear(stock.metrics["Revenue"], year);
  const shares = atYear(stock.metrics["Jumlah Saham"], year);
  if (!revenue || revenue <= 0 || !shares || shares <= 0 || !medians.ps)
    return null;
  const revPerShare = revenue / shares;
  return revPerShare * medians.ps;
}

export function relativePER(
  stock: Stock,
  year: number | null,
  medians: SectorMedians,
): number | null {
  const eps = atYear(stock.metrics["EPS"], year);
  if (!eps || eps <= 0 || !medians.per) return null;
  return eps * medians.per;
}

export function relativePBV(
  stock: Stock,
  year: number | null,
  medians: SectorMedians,
): number | null {
  const bvps = atYear(stock.metrics["BVPS"], year);
  if (!bvps || bvps <= 0 || !medians.pbv) return null;
  return bvps * medians.pbv;
}

export function relativeEvEbit(
  stock: Stock,
  year: number | null,
  medians: SectorMedians,
): number | null {
  const ebit = atYear(stock.metrics["EBIT"], year);
  const shares = atYear(stock.metrics["Jumlah Saham"], year);
  const netDebt = atYear(stock.metrics["Net Debt"], year) ?? 0;
  if (!ebit || ebit <= 0 || !shares || shares <= 0 || !medians.evEbit)
    return null;
  const ev = ebit * medians.evEbit;
  const equity = ev - netDebt;
  return equity > 0 ? equity / shares : null;
}

// -----------------------------------------------------------------------------
// Consensus
// -----------------------------------------------------------------------------

export interface ValuationResult {
  method: string;
  fairValue: number | null;
  mos: number | null;
  note?: string;
  /** Sector suitability: "ideal" / "works" / "avoid" — affects consensus weight */
  suitability?: "ideal" | "works" | "avoid";
}

export interface ValuationSummary {
  anchorYear: number | null;
  /** Months between anchor FY year-end and today. Large gap = stale vs market. */
  gapMonths: number | null;
  /** Confidence tier based on gapMonths: high (<12mo), medium (12-24mo), low (>24mo). */
  gapConfidence: "high" | "medium" | "low" | "unknown";
  results: ValuationResult[];
  /** Equal-weight average fair value (all valid methods) */
  avgFairValue: number | null;
  /** Median fair value (all valid methods) */
  medianFairValue: number | null;
  /** Weighted consensus fair value (ideal=2, works=1, avoid=0) */
  weightedFairValue: number | null;
  /** Equal-weight average MoS */
  avgMoS: number | null;
  /** Weighted MoS using same suitability weights */
  weightedMoS: number | null;
  methodsValid: number;
  /** How many of the valid methods are "ideal" or "works" (not avoid) for this sector */
  methodsRelevant: number;
  undervaluedCount: number;
  verdict: string;
  sectorSampleSize: number;
}

/**
 * Months between anchor FY year-end (Dec 31, anchorYear) and the reference date.
 */
function gapMonthsFromAnchor(
  anchorYear: number | null,
  referenceDate: Date = new Date(),
): number | null {
  if (anchorYear === null) return null;
  const anchorEnd = new Date(anchorYear, 11, 31); // Dec 31
  const ms = referenceDate.getTime() - anchorEnd.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24 * 30.44)));
}

function gapConfidenceFromMonths(
  m: number | null,
): "high" | "medium" | "low" | "unknown" {
  if (m === null) return "unknown";
  if (m < 12) return "high";
  if (m <= 24) return "medium";
  return "low";
}

export function valuationVerdict(avgMoS: number | null): string {
  if (avgMoS === null) return "INSUFFICIENT DATA";
  if (avgMoS > 0.5) return "HIGHLY UNDERVALUED";
  if (avgMoS > 0.15) return "UNDERVALUED";
  if (avgMoS > -0.15) return "FAIR VALUE";
  if (avgMoS > -0.5) return "OVERVALUED";
  return "HIGHLY OVERVALUED";
}

/**
 * Run the full 13-method valuation suite against a stock. Pass pre-computed
 * sector medians for batch use (leaderboard).
 *
 * Methods: DCF, Graham, Graham Revised, EPV, DDM, Rel PER, Rel PBV, EV/EBIT,
 *          NAV, PEG, RIM, FCF Power, Rel PS.
 */
export function valuate(
  stock: Stock,
  allMedians: Record<string, SectorMedians>,
): ValuationSummary {
  const year = canonicalYear(stock);
  const medians: SectorMedians =
    stock.sector && allMedians[stock.sector]
      ? allMedians[stock.sector]
      : { per: null, pbv: null, evEbit: null, ps: null, sampleSize: 0 };

  const price = stock.currentPrice;

  const rawResults: ValuationResult[] = [
    {
      method: "DCF",
      fairValue: dcf(stock, year),
      mos: null,
      note: `5y proj + terminal, r=13.75%, g_term=3% (FY${year ?? "—"})`,
    },
    {
      method: "Graham",
      fairValue: grahamNumber(stock, year),
      mos: null,
      note: `√(22.5 × EPS × BVPS) pada FY${year ?? "—"}`,
    },
    {
      method: "Graham Revised",
      fairValue: grahamRevised(stock, year),
      mos: null,
      note: `EPS × (8.5 + 2g) × 4.4 / Rf (FY${year ?? "—"})`,
    },
    {
      method: "EPV",
      fairValue: epv(stock, year),
      mos: null,
      note: `5y avg Net Profit / r, per share (basis FY${year ?? "—"})`,
    },
    {
      method: "DDM",
      fairValue: ddm(stock, year),
      mos: null,
      note: `Gordon growth dari DPS (FY${year ?? "—"})`,
    },
    {
      method: "Rel PER",
      fairValue: relativePER(stock, year, medians),
      mos: null,
      note: `EPS × median PER sektor (${medians.per?.toFixed(1) ?? "N/A"}, n=${medians.sampleSize})`,
    },
    {
      method: "Rel PBV",
      fairValue: relativePBV(stock, year, medians),
      mos: null,
      note: `BVPS × median PBV sektor (${medians.pbv?.toFixed(2) ?? "N/A"}, n=${medians.sampleSize})`,
    },
    {
      method: "EV/EBIT",
      fairValue: relativeEvEbit(stock, year, medians),
      mos: null,
      note: `EBIT × median EV/EBIT (${medians.evEbit?.toFixed(1) ?? "N/A"}) − net debt`,
    },
    {
      method: "NAV",
      fairValue: nav(stock, year),
      mos: null,
      note: `Book Value per Share pada FY${year ?? "—"}`,
    },
    {
      method: "PEG",
      fairValue: peg(stock, year),
      mos: null,
      note: `EPS × growth% (Peter Lynch), capped 5-25`,
    },
    {
      method: "RIM",
      fairValue: rim(stock, year),
      mos: null,
      note: `BVPS + PV excess earnings (ROE − r), fading 5y`,
    },
    {
      method: "FCF Power",
      fairValue: fcfPower(stock, year),
      mos: null,
      note: `5y avg FCF / r, per share (FY${year ?? "—"})`,
    },
    {
      method: "Rel PS",
      fairValue: relativePS(stock, year, medians),
      mos: null,
      note: `Rev/share × median P/S sektor (${medians.ps?.toFixed(2) ?? "N/A"})`,
    },
  ];

  const results = rawResults.map((r) => {
    let mos: number | null = null;
    if (r.fairValue !== null && price && price > 0) {
      mos = (r.fairValue - price) / price;
    }
    const suitability = getSuitability(r.method, stock.sector);
    return { ...r, mos, suitability };
  });

  const validResults = results.filter((r) => r.fairValue !== null);
  const fvs = validResults.map((r) => r.fairValue!);
  const avgFV =
    fvs.length > 0 ? fvs.reduce((a, b) => a + b, 0) / fvs.length : null;

  const sortedFV = [...fvs].sort((a, b) => a - b);
  const medFV =
    sortedFV.length === 0
      ? null
      : sortedFV.length % 2 === 0
        ? (sortedFV[sortedFV.length / 2 - 1] +
            sortedFV[sortedFV.length / 2]) /
          2
        : sortedFV[Math.floor(sortedFV.length / 2)];

  // Weighted consensus: ideal = 2, works = 1, avoid = 0 (excluded)
  const weightOf = (s: "ideal" | "works" | "avoid"): number =>
    s === "ideal" ? 2 : s === "works" ? 1 : 0;
  const weightedPairs = validResults.map((r) => ({
    fv: r.fairValue!,
    mos: r.mos,
    w: weightOf(r.suitability ?? "works"),
  }));
  const totalWeight = weightedPairs.reduce((s, p) => s + p.w, 0);
  const weightedFV =
    totalWeight > 0
      ? weightedPairs.reduce((s, p) => s + p.fv * p.w, 0) / totalWeight
      : null;
  const weightedMoS =
    totalWeight > 0
      ? weightedPairs
          .filter((p) => p.mos !== null)
          .reduce((s, p) => s + p.mos! * p.w, 0) /
        weightedPairs
          .filter((p) => p.mos !== null)
          .reduce((s, p) => s + p.w, 0)
      : null;

  const moses = validResults
    .map((r) => r.mos!)
    .filter((v) => v !== null && !isNaN(v));
  const avgMoS =
    moses.length > 0 ? moses.reduce((a, b) => a + b, 0) / moses.length : null;

  const undervaluedCount = validResults.filter(
    (r) => r.mos !== null && r.mos > 0,
  ).length;

  const methodsRelevant = validResults.filter(
    (r) => r.suitability !== "avoid",
  ).length;

  const gapMonths = gapMonthsFromAnchor(year);
  return {
    anchorYear: year,
    gapMonths,
    gapConfidence: gapConfidenceFromMonths(gapMonths),
    results,
    avgFairValue: avgFV,
    medianFairValue: medFV,
    weightedFairValue: weightedFV,
    avgMoS,
    weightedMoS,
    methodsValid: validResults.length,
    methodsRelevant,
    undervaluedCount,
    verdict: valuationVerdict(weightedMoS ?? avgMoS),
    sectorSampleSize: medians.sampleSize,
  };
}

/**
 * Convenience wrapper for single-stock valuation that computes sector medians
 * inline. Good for detail pages; do not use in loops.
 */
export function valuateOne(
  stock: Stock,
  allStocks: Stock[],
): ValuationSummary {
  const medians = computeAllSectorMedians(allStocks);
  return valuate(stock, medians);
}
