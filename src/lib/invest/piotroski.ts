import type { Stock } from "./stocks";
import { canonicalYear } from "./valuation";

/**
 * Piotroski F-Score — 9-point financial strength checklist by Joseph Piotroski
 * (U. Chicago, 2000). Score range: 0-9, higher is better (7-9 = strong, 0-3 = weak).
 *
 * Categories:
 *   Profitability:
 *     1. Positive Net Income
 *     2. Positive CFO
 *     3. ROA this year > prior year
 *     4. CFO > Net Income (quality of earnings)
 *   Leverage/Liquidity:
 *     5. Lower Long-Term Debt this year vs prior
 *     6. Higher Current Ratio this year vs prior
 *     7. No new shares issued (diluted EPS improving)
 *   Operating Efficiency:
 *     8. Higher Gross Margin this year vs prior
 *     9. Higher Asset Turnover this year vs prior
 */

export interface PiotroskiCheck {
  id: number;
  category: "Profitability" | "Leverage/Liquidity" | "Efficiency";
  label: string;
  pass: boolean | null; // null = can't evaluate (missing data)
  note?: string;
}

export interface PiotroskiResult {
  score: number;
  maxPossible: number;
  checks: PiotroskiCheck[];
  anchorYear: number | null;
  verdict: "Strong" | "Moderate" | "Weak" | "Insufficient";
}

function atYear(s: Record<string, number> | undefined, y: number | null): number | null {
  if (!s || y === null) return null;
  const v = s[String(y)];
  return v === null || v === undefined ? null : v;
}

function pick(stock: Stock, keys: string[], year: number | null): number | null {
  for (const k of keys) {
    const v = atYear(stock.metrics[k], year);
    if (v !== null) return v;
  }
  return null;
}

export function computePiotroski(stock: Stock): PiotroskiResult {
  const year = canonicalYear(stock);
  const prevYear = year !== null ? year - 1 : null;

  // Latest & prior year values
  const netProfit = pick(stock, ["Net Profit"], year);
  const netProfitPrev = pick(stock, ["Net Profit"], prevYear);
  const cfo = pick(stock, ["CFO", "Operating Cash Flow"], year);
  const totalAssets = pick(stock, ["Total Assets"], year);
  const totalAssetsPrev = pick(stock, ["Total Assets"], prevYear);
  const ltDebt = pick(stock, ["Liab J Pnjg", "LT Debt"], year);
  const ltDebtPrev = pick(stock, ["Liab J Pnjg", "LT Debt"], prevYear);
  const currentAssets = pick(stock, ["Aset Lancar"], year);
  const currentAssetsPrev = pick(stock, ["Aset Lancar"], prevYear);
  const currentLiab = pick(stock, ["Liab J Pndk"], year);
  const currentLiabPrev = pick(stock, ["Liab J Pndk"], prevYear);
  const shares = pick(stock, ["Shares Outstanding (BS)", "Jumlah Saham"], year);
  const sharesPrev = pick(stock, ["Shares Outstanding (BS)", "Jumlah Saham"], prevYear);
  const revenue = pick(stock, ["Revenue"], year);
  const revenuePrev = pick(stock, ["Revenue"], prevYear);
  const grossProfit = pick(stock, ["Gross Profit"], year);
  const grossProfitPrev = pick(stock, ["Gross Profit"], prevYear);

  // Derived ratios
  const roa = netProfit && totalAssets ? netProfit / totalAssets : null;
  const roaPrev =
    netProfitPrev && totalAssetsPrev ? netProfitPrev / totalAssetsPrev : null;
  const currentRatio =
    currentAssets && currentLiab && currentLiab > 0
      ? currentAssets / currentLiab
      : null;
  const currentRatioPrev =
    currentAssetsPrev && currentLiabPrev && currentLiabPrev > 0
      ? currentAssetsPrev / currentLiabPrev
      : null;
  const grossMargin = grossProfit && revenue ? grossProfit / revenue : null;
  const grossMarginPrev =
    grossProfitPrev && revenuePrev ? grossProfitPrev / revenuePrev : null;
  const assetTurnover = revenue && totalAssets ? revenue / totalAssets : null;
  const assetTurnoverPrev =
    revenuePrev && totalAssetsPrev ? revenuePrev / totalAssetsPrev : null;

  const checks: PiotroskiCheck[] = [
    {
      id: 1,
      category: "Profitability",
      label: "Net Income positif",
      pass: netProfit === null ? null : netProfit > 0,
      note: netProfit !== null ? `NP ${(netProfit / 1e9).toFixed(0)}M` : "—",
    },
    {
      id: 2,
      category: "Profitability",
      label: "CFO positif",
      pass: cfo === null ? null : cfo > 0,
      note: cfo !== null ? `CFO ${(cfo / 1e9).toFixed(0)}M` : "—",
    },
    {
      id: 3,
      category: "Profitability",
      label: "ROA naik dari tahun sebelumnya",
      pass: roa === null || roaPrev === null ? null : roa > roaPrev,
      note:
        roa !== null && roaPrev !== null
          ? `${(roa * 100).toFixed(2)}% vs ${(roaPrev * 100).toFixed(2)}%`
          : "—",
    },
    {
      id: 4,
      category: "Profitability",
      label: "CFO > Net Income (kualitas laba)",
      pass: cfo === null || netProfit === null ? null : cfo > netProfit,
      note:
        cfo !== null && netProfit !== null
          ? `CFO ${(cfo / 1e9).toFixed(0)}M vs NP ${(netProfit / 1e9).toFixed(0)}M`
          : "—",
    },
    {
      id: 5,
      category: "Leverage/Liquidity",
      label: "LT Debt turun dari tahun sebelumnya",
      pass:
        ltDebt === null || ltDebtPrev === null ? null : ltDebt < ltDebtPrev,
      note:
        ltDebt !== null && ltDebtPrev !== null
          ? `${(ltDebt / 1e9).toFixed(0)}M vs ${(ltDebtPrev / 1e9).toFixed(0)}M`
          : "—",
    },
    {
      id: 6,
      category: "Leverage/Liquidity",
      label: "Current Ratio naik",
      pass:
        currentRatio === null || currentRatioPrev === null
          ? null
          : currentRatio > currentRatioPrev,
      note:
        currentRatio !== null && currentRatioPrev !== null
          ? `${currentRatio.toFixed(2)}x vs ${currentRatioPrev.toFixed(2)}x`
          : "—",
    },
    {
      id: 7,
      category: "Leverage/Liquidity",
      label: "Tidak ada saham baru diterbitkan (no dilution)",
      pass:
        shares === null || sharesPrev === null ? null : shares <= sharesPrev,
      note:
        shares !== null && sharesPrev !== null
          ? shares === sharesPrev
            ? "Saham tetap"
            : `${((shares - sharesPrev) / sharesPrev * 100).toFixed(2)}% change`
          : "—",
    },
    {
      id: 8,
      category: "Efficiency",
      label: "Gross Margin naik",
      pass:
        grossMargin === null || grossMarginPrev === null
          ? null
          : grossMargin > grossMarginPrev,
      note:
        grossMargin !== null && grossMarginPrev !== null
          ? `${(grossMargin * 100).toFixed(2)}% vs ${(grossMarginPrev * 100).toFixed(2)}%`
          : "—",
    },
    {
      id: 9,
      category: "Efficiency",
      label: "Asset Turnover naik",
      pass:
        assetTurnover === null || assetTurnoverPrev === null
          ? null
          : assetTurnover > assetTurnoverPrev,
      note:
        assetTurnover !== null && assetTurnoverPrev !== null
          ? `${assetTurnover.toFixed(3)}x vs ${assetTurnoverPrev.toFixed(3)}x`
          : "—",
    },
  ];

  const score = checks.filter((c) => c.pass === true).length;
  const evaluable = checks.filter((c) => c.pass !== null).length;

  let verdict: PiotroskiResult["verdict"];
  if (evaluable < 5) verdict = "Insufficient";
  else if (score >= 7) verdict = "Strong";
  else if (score >= 4) verdict = "Moderate";
  else verdict = "Weak";

  return {
    score,
    maxPossible: evaluable,
    checks,
    anchorYear: year,
    verdict,
  };
}

/**
 * Magic Formula score (Joel Greenblatt): rank stocks by combining
 *   1. Earnings Yield = EBIT / EV (higher = cheaper)
 *   2. Return on Capital = EBIT / (Net Working Capital + Net Fixed Assets)
 * A stock with LOW combined rank (good at both) is the best candidate.
 *
 * Returns per-stock raw metrics; use `rankMagicFormula()` to get final rank.
 */
export interface MagicFormulaMetrics {
  ticker: string;
  name: string | null;
  sector: string | null;
  earningsYield: number | null;
  roc: number | null;
  ebit: number | null;
  ev: number | null;
}

export function computeMagicFormulaMetrics(
  stock: Stock,
  emittenEV: number | null,
): MagicFormulaMetrics {
  const year = canonicalYear(stock);
  const ebit = atYear(stock.metrics["EBIT"], year);
  const ev =
    emittenEV ?? atYear(stock.metrics["Enterprise Value"], year);
  const currentAssets = atYear(stock.metrics["Aset Lancar"], year);
  const currentLiab = atYear(stock.metrics["Liab J Pndk"], year);
  const fixedAssets = atYear(stock.metrics["Fixed Assets"], year);

  const netWorkingCap =
    currentAssets !== null && currentLiab !== null
      ? currentAssets - currentLiab
      : null;
  const capital =
    netWorkingCap !== null && fixedAssets !== null
      ? netWorkingCap + fixedAssets
      : null;

  const earningsYield = ebit && ev && ev > 0 ? ebit / ev : null;
  const roc = ebit && capital && capital > 0 ? ebit / capital : null;

  return {
    ticker: stock.ticker,
    name: stock.name,
    sector: stock.sector,
    earningsYield,
    roc,
    ebit,
    ev,
  };
}

export interface MagicFormulaRanked extends MagicFormulaMetrics {
  eyRank: number;
  rocRank: number;
  combinedRank: number;
  finalRank: number;
}

export function rankMagicFormula(
  metrics: MagicFormulaMetrics[],
): MagicFormulaRanked[] {
  // Only rank stocks with BOTH metrics valid
  const eligible = metrics.filter(
    (m) =>
      m.earningsYield !== null &&
      m.roc !== null &&
      m.earningsYield > 0 &&
      m.roc > 0,
  );

  // Rank by earningsYield descending (higher = better = rank 1)
  const byEY = [...eligible].sort(
    (a, b) => (b.earningsYield ?? 0) - (a.earningsYield ?? 0),
  );
  const eyRankMap = new Map<string, number>();
  byEY.forEach((m, i) => eyRankMap.set(m.ticker, i + 1));

  const byROC = [...eligible].sort((a, b) => (b.roc ?? 0) - (a.roc ?? 0));
  const rocRankMap = new Map<string, number>();
  byROC.forEach((m, i) => rocRankMap.set(m.ticker, i + 1));

  const withRanks = eligible.map((m) => ({
    ...m,
    eyRank: eyRankMap.get(m.ticker) ?? 0,
    rocRank: rocRankMap.get(m.ticker) ?? 0,
    combinedRank:
      (eyRankMap.get(m.ticker) ?? 0) + (rocRankMap.get(m.ticker) ?? 0),
  }));

  const sortedByCombined = withRanks.sort(
    (a, b) => a.combinedRank - b.combinedRank,
  );
  return sortedByCombined.map((m, i) => ({ ...m, finalRank: i + 1 }));
}
