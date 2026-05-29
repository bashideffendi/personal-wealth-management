'use client'

/**
 * Institution logo — bank or digital wallet.
 *
 * Resolution order:
 *   1. If institution has an IDX ticker (e.g. BCA → BBCA, Jenius → BTPN),
 *      use the existing /stock-logos/{TICKER}.png.
 *   2. If institution has a wallet-logos slug AND that file exists at
 *      /wallet-logos/{slug}.png, use that. (User can ship custom PNGs
 *      to /public/wallet-logos/ for non-listed banks + e-wallets.)
 *   3. Otherwise, fallback monogram with a deterministic gradient by
 *      institution type (banks blue/indigo, wallets emerald/violet).
 */

import { useState } from 'react'
import Image from 'next/image'
import { StockLogo } from '@/components/investment/stock-logo'
import {
  identifyInstitution,
  type FinancialInstitution,
} from '@/lib/indonesian-institutions'

interface Props {
  /** The user's account name (free text). We'll attempt to identify the institution. */
  accountName?: string | null
  /** Or pass the institution directly if already known */
  institution?: FinancialInstitution
  size?: number
  className?: string
  /** 'circle' (default — no white gaps) or 'rounded' (rounded square) */
  shape?: 'circle' | 'rounded'
}

const BANK_GRADIENTS = [
  'linear-gradient(135deg, #3B82F6, #1E40AF)',
  'linear-gradient(135deg, #6366F1, #4338CA)',
  'linear-gradient(135deg, #0EA5E9, #0284C7)',
  'linear-gradient(135deg, #14B8A6, #0F766E)',
]
const WALLET_GRADIENTS = [
  'linear-gradient(135deg, #10B981, #047857)',
  'linear-gradient(135deg, #8B5CF6, #6D28D9)',
  'linear-gradient(135deg, #F59E0B, #D97706)',
  'linear-gradient(135deg, #EC4899, #BE185D)',
]
const CASH_GRADIENT = 'linear-gradient(135deg, #84CC16, #4D7C0F)'

function pickGradient(brand: string, type: 'bank' | 'digital_wallet' | 'cash' | 'rdn' | 'investment'): string {
  if (type === 'cash') return CASH_GRADIENT
  if (type === 'rdn') return 'linear-gradient(135deg, #14B8A6, #0F766E)'  // teal — distinguish RDN visually
  const palette = type === 'bank' ? BANK_GRADIENTS : WALLET_GRADIENTS
  let hash = 0
  for (let i = 0; i < brand.length; i++) hash = (hash * 31 + brand.charCodeAt(i)) | 0
  return palette[Math.abs(hash) % palette.length]
}

export function InstitutionLogo({ accountName, institution, size = 28, className, shape = 'circle' }: Props) {
  const inst = institution ?? identifyInstitution(accountName)
  const [walletErrored, setWalletErrored] = useState(false)

  // Path 1 (preferred): /wallet-logos/{slug}.png if a slug is set. Sub-brands
  // (Jenius, Livin, D-Save) get their own logo here instead of the parent
  // bank's. If the file doesn't exist, falls through to ticker / monogram.
  if (inst?.slug && !walletErrored) {
    return (
      <WalletLogoImage
        slug={inst.slug}
        brand={inst.brand}
        size={size}
        className={className}
        shape={shape}
        onAllFailed={() => setWalletErrored(true)}
      />
    )
  }

  // Path 2: IDX ticker → reuse stock logo
  if (inst?.ticker) {
    return <StockLogo ticker={inst.ticker} size={size} className={className} shape={shape} />
  }

  // Path 3: Monogram fallback
  const label = inst?.brand ?? (accountName?.trim() || '?')
  const monogram = label
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'
  const gradient = pickGradient(label, inst?.type ?? 'bank')
  const fontSize = size * (monogram.length >= 2 ? 0.40 : 0.50)
  const radiusCls = shape === 'circle' ? 'rounded-full' : 'rounded-lg'

  return (
    <div
      className={`shrink-0 flex items-center justify-center ${radiusCls} text-white font-bold ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        background: gradient,
        fontSize,
        letterSpacing: '-0.03em',
      }}
      aria-label={label}
    >
      {monogram}
    </div>
  )
}

/**
 * Tries /wallet-logos/{slug}.svg → .png → triggers onAllFailed.
 * Splitting this out keeps the parent component's render logic clean.
 */
function WalletLogoImage({
  slug, brand, size, className, shape, onAllFailed,
}: {
  slug: string
  brand: string
  size: number
  className?: string
  shape: 'circle' | 'rounded'
  onAllFailed: () => void
}) {
  // Try .png first (most logos shipped as PNG), fall back to .svg
  const [tried, setTried] = useState<'png' | 'svg'>('png')
  const radiusCls = shape === 'circle' ? 'rounded-full' : 'rounded-lg'
  return (
    <div
      // ring bumped from /5 to /10 + soft inset shadow so logos with white
      // backgrounds stay visible against a white card. Slight padding so
      // the logo doesn't crash into the ring edge.
      className={`relative shrink-0 ${radiusCls} overflow-hidden bg-white ring-1 ring-black/10 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] p-[2px] flex items-center justify-center ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={`/wallet-logos/${slug}.${tried}`}
        alt={`Logo ${brand}`}
        width={size}
        height={size}
        // object-contain so logos don't get cropped — the bg-white frame
        // gives them breathing room (matters for non-square wallet logos).
        className="object-contain w-full h-full"
        onError={() => {
          if (tried === 'png') setTried('svg')
          else onAllFailed()
        }}
        unoptimized
      />
    </div>
  )
}
