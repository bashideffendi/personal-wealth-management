/**
 * Visual identity per investment category — distinctive icon + gradient.
 *
 * Avoids generic "📈 / 💼 / 🏦" emojis. Each category gets a Lucide icon
 * picked for its visual specificity (CandlestickChart for stocks, Bitcoin
 * for crypto, Landmark for SBN, Hourglass for pension, etc.) plus a
 * branded gradient that hints at the asset's character (gold = warm
 * amber, crypto = electric orange, bonds = trustworthy blue, etc.).
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
  /** Full gradient for prominent icon backgrounds */
  gradient: string
  /** Subtle tinted bg for cards */
  bgTint: string
  /** Border color complement */
  borderTint: string
  /** Solid color for chart accents */
  accent: string
  /** Foreground icon color when on light bg */
  fg: string
}

export const INVESTMENT_VISUAL: Record<string, InvestmentVisual> = {
  // Saham — green/teal market gradient (TradingView vibe)
  stock: {
    icon: CandlestickChart,
    gradient: 'linear-gradient(135deg, #10B981 0%, #14B8A6 100%)',
    bgTint: 'rgba(20, 184, 166, 0.06)',
    borderTint: 'rgba(20, 184, 166, 0.20)',
    accent: '#14B8A6',
    fg: '#0F766E',
  },

  // Reksa Dana — basket of slices, violet (premium / managed)
  'mutual-fund': {
    icon: PieChart,
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
    bgTint: 'rgba(139, 92, 246, 0.06)',
    borderTint: 'rgba(139, 92, 246, 0.22)',
    accent: '#8B5CF6',
    fg: '#6D28D9',
  },

  // Crypto — Bitcoin orange, electric
  crypto: {
    icon: Bitcoin,
    gradient: 'linear-gradient(135deg, #F97316 0%, #EAB308 100%)',
    bgTint: 'rgba(249, 115, 22, 0.07)',
    borderTint: 'rgba(249, 115, 22, 0.25)',
    accent: '#F97316',
    fg: '#C2410C',
  },

  // Emas — warm gold gradient
  gold: {
    icon: Coins,
    gradient: 'linear-gradient(135deg, #FBBF24 0%, #D97706 100%)',
    bgTint: 'rgba(217, 119, 6, 0.07)',
    borderTint: 'rgba(217, 119, 6, 0.25)',
    accent: '#D97706',
    fg: '#92400E',
  },

  // Obligasi — corporate blue (trust + paper)
  bond: {
    icon: ScrollText,
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    bgTint: 'rgba(59, 130, 246, 0.06)',
    borderTint: 'rgba(59, 130, 246, 0.22)',
    accent: '#3B82F6',
    fg: '#1E40AF',
  },

  // SBN Ritel — Indonesian flag colors (red+white restraint), use red on white
  sbn: {
    icon: Landmark,
    gradient: 'linear-gradient(135deg, #F43F5E 0%, #991B1B 100%)',
    bgTint: 'rgba(220, 38, 38, 0.06)',
    borderTint: 'rgba(220, 38, 38, 0.22)',
    accent: '#F43F5E',
    fg: '#991B1B',
  },

  // Deposito — navy / vault aesthetic
  'time-deposit': {
    icon: Vault,
    gradient: 'linear-gradient(135deg, #475569 0%, #1E293B 100%)',
    bgTint: 'rgba(71, 85, 105, 0.07)',
    borderTint: 'rgba(71, 85, 105, 0.22)',
    accent: '#475569',
    fg: '#334155',
  },

  // Valas — teal (international / liquidity)
  forex: {
    icon: ArrowLeftRight,
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #0EA5E9 100%)',
    bgTint: 'rgba(6, 182, 212, 0.07)',
    borderTint: 'rgba(6, 182, 212, 0.22)',
    accent: '#06B6D4',
    fg: '#0E7490',
  },

  // P2P Lending — rose (peer / human)
  p2p: {
    icon: Handshake,
    gradient: 'linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)',
    bgTint: 'rgba(244, 63, 94, 0.06)',
    borderTint: 'rgba(244, 63, 94, 0.22)',
    accent: '#F43F5E',
    fg: '#BE123C',
  },

  // Dana Pensiun — purple-to-indigo (time / future)
  pension: {
    icon: Hourglass,
    gradient: 'linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)',
    bgTint: 'rgba(168, 85, 247, 0.06)',
    borderTint: 'rgba(168, 85, 247, 0.22)',
    accent: '#A855F7',
    fg: '#7C3AED',
  },

  // Bisnis — earthy/industrial brown-orange
  business: {
    icon: Factory,
    gradient: 'linear-gradient(135deg, #B45309 0%, #78350F 100%)',
    bgTint: 'rgba(180, 83, 9, 0.07)',
    borderTint: 'rgba(180, 83, 9, 0.22)',
    accent: '#B45309',
    fg: '#78350F',
  },
}

// Fallback for any unmapped slug
export const INVESTMENT_VISUAL_FALLBACK: InvestmentVisual = {
  icon: PieChart,
  gradient: 'linear-gradient(135deg, #6B7280 0%, #374151 100%)',
  bgTint: 'rgba(107, 114, 128, 0.07)',
  borderTint: 'rgba(107, 114, 128, 0.22)',
  accent: '#6B7280',
  fg: '#374151',
}

export function getInvestmentVisual(slug: string): InvestmentVisual {
  return INVESTMENT_VISUAL[slug] ?? INVESTMENT_VISUAL_FALLBACK
}
