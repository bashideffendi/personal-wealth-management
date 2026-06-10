/**
 * Icon identity per investment category (slug-level).
 *
 * Each category gets a Lucide icon picked for its visual specificity
 * (CandlestickChart for stocks, Bitcoin for crypto, Landmark for SBN,
 * Hourglass for pension, etc.).
 *
 * COLOR is intentionally NOT defined here anymore — the canonical class
 * palette lives in src/lib/invest/asset-class.ts (ASSET_CLASS_META). This
 * file used to carry its own gradients/tints which diverged from the donut
 * palette for 9 of 11 classes; the card restyle (neutral surface + soft-tint
 * icon box) made those fields dead, so they were removed.
 *
 * Slugs match INVESTMENT_SUBCATS in src/lib/constants.ts.
 */

import type { LucideIcon } from 'lucide-react'
import {
  CandlestickChart,    // saham
  PieChart,            // reksa dana
  Bitcoin,             // crypto
  Coins,               // emas
  ScrollText,          // obligasi
  Landmark,            // SBN ritel (gov-backed)
  Vault,               // deposito
  ArrowLeftRight,      // valas
  Handshake,           // P2P lending
  Hourglass,           // dana pensiun (time-based)
  Factory,             // bisnis
} from 'lucide-react'

export interface InvestmentVisual {
  icon: LucideIcon
}

export const INVESTMENT_VISUAL: Record<string, InvestmentVisual> = {
  stock:          { icon: CandlestickChart },
  'mutual-fund':  { icon: PieChart },
  crypto:         { icon: Bitcoin },
  gold:           { icon: Coins },
  bond:           { icon: ScrollText },
  sbn:            { icon: Landmark },
  'time-deposit': { icon: Vault },
  forex:          { icon: ArrowLeftRight },
  p2p:            { icon: Handshake },
  pension:        { icon: Hourglass },
  business:       { icon: Factory },
}

export const INVESTMENT_VISUAL_FALLBACK: InvestmentVisual = { icon: PieChart }

export function getInvestmentVisual(slug: string): InvestmentVisual {
  return INVESTMENT_VISUAL[slug] ?? INVESTMENT_VISUAL_FALLBACK
}
