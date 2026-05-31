/**
 * Reverse DCF — given current market price, solve for the implied FCF growth
 * rate that would justify that price. Useful for asking: "what does the market
 * believe about growth?"
 *
 * Model: same as standard DCF — 5y projection + terminal value (Gordon growth),
 * discounted at cost of equity, net-debt adjusted.
 *
 * Uses binary search (bisection) over growth rate [-20%, +40%].
 */

import { ASSUMPTIONS } from "./valuation";

export interface ReverseDCFInput {
  currentPrice: number; // IDR per share
  latestFCF: number; // total company FCF (IDR)
  shares: number;
  netDebt: number; // IDR; positive = more debt than cash
  costOfEquity?: number; // default 13.75%
  terminalGrowth?: number; // default 3%
}

export interface ReverseDCFResult {
  impliedGrowth: number | null; // e.g. 0.08 = 8%
  convergence: "ok" | "no-solution" | "impossible";
  note: string;
}

function valuate(
  fcf: number,
  growth: number,
  r: number,
  gt: number,
  netDebt: number,
  shares: number,
): number {
  let pv = 0;
  let f = fcf;
  for (let t = 1; t <= 5; t++) {
    f = f * (1 + growth);
    pv += f / Math.pow(1 + r, t);
  }
  const terminal = (f * (1 + gt)) / (r - gt);
  pv += terminal / Math.pow(1 + r, 5);
  const equity = pv - netDebt;
  return equity / shares;
}

export function reverseDCF(input: ReverseDCFInput): ReverseDCFResult {
  const {
    currentPrice,
    latestFCF,
    shares,
    netDebt,
    costOfEquity = ASSUMPTIONS.costOfEquity,
    terminalGrowth = ASSUMPTIONS.terminalGrowth,
  } = input;

  if (shares <= 0 || latestFCF <= 0) {
    return {
      impliedGrowth: null,
      convergence: "impossible",
      note: "FCF atau shares tidak positif — reverse DCF tidak applicable.",
    };
  }

  // Binary search growth in [-0.5, 0.5]
  let low = -0.5;
  let high = 0.5;
  const targetPrice = currentPrice;

  // Check bounds
  const priceAtLow = valuate(latestFCF, low, costOfEquity, terminalGrowth, netDebt, shares);
  const priceAtHigh = valuate(latestFCF, high, costOfEquity, terminalGrowth, netDebt, shares);

  if (priceAtLow > targetPrice && priceAtHigh > targetPrice) {
    return {
      impliedGrowth: null,
      convergence: "no-solution",
      note: "Market price lebih rendah daripada no-growth fair value. Deep value — market pricing dalam decline.",
    };
  }
  if (priceAtLow < targetPrice && priceAtHigh < targetPrice) {
    return {
      impliedGrowth: null,
      convergence: "no-solution",
      note: "Market price di atas fair value dengan 50% growth — market pricing dalam explosive growth, reverse DCF tidak cukup.",
    };
  }

  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const price = valuate(latestFCF, mid, costOfEquity, terminalGrowth, netDebt, shares);
    if (Math.abs(price - targetPrice) < targetPrice * 0.001) {
      return {
        impliedGrowth: mid,
        convergence: "ok",
        note: `Konvergen setelah ${i + 1} iterasi.`,
      };
    }
    if (price < targetPrice) low = mid;
    else high = mid;
  }

  return {
    impliedGrowth: (low + high) / 2,
    convergence: "ok",
    note: "Konvergen pada batas iterasi (60).",
  };
}
