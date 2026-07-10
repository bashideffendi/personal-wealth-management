'use client'

/**
 * Stock company logo with graceful fallback.
 *
 * Tries to load /stock-logos/{TICKER}.png (Stockbit-scraped IDX logos,
 * 971 tickers cover most of the IDX universe). If the image fails to
 * load — either the ticker isn't IDX, the file doesn't exist, or it's
 * a US/crypto symbol — falls back to a tinted circle with the first
 * 1-2 characters of the ticker as a monogram.
 *
 * Yahoo Finance tickers come in as "BBCA.JK" / "AAPL" / "BTC-USD" —
 * we strip the .JK suffix before lookup since the logo files are named
 * by bare IDX ticker.
 */

import { useState } from 'react'
import Image from 'next/image'

interface StockLogoProps {
  ticker?: string | null
  size?: number  // px, default 28
  className?: string
  /** 'circle' (default, no white gaps) or 'rounded' (rounded square) */
  shape?: 'circle' | 'rounded'
}

// Strip exchange suffix (BBCA.JK → BBCA, GOOGL.NASDAQ → GOOGL).
// Crypto tickers like BTC-USD also pass through unchanged.
function normalizeForLogo(ticker: string): string {
  return ticker.split('.')[0].toUpperCase().trim()
}

// Hash the ticker to pick a deterministic gradient color
const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, #17b890, #14B8A6)',  // teal
  'linear-gradient(135deg, #6366F1, #8b4fb0)',  // indigo→violet
  'linear-gradient(135deg, #C98F0E, #AC7708)',  // amber
  'linear-gradient(135deg, #EF4444, #EC4899)',  // rose
  'linear-gradient(135deg, #2D89BC, #06B6D4)',  // sky
  'linear-gradient(135deg, #A855F7, #6A4BC2)',  // violet
  'linear-gradient(135deg, #84CC16, #22C55E)',  // lime
  'linear-gradient(135deg, #14B8A6, #2D89BC)',  // teal-sky
]

function pickGradient(ticker: string): string {
  let hash = 0
  for (let i = 0; i < ticker.length; i++) {
    hash = (hash * 31 + ticker.charCodeAt(i)) | 0
  }
  return FALLBACK_GRADIENTS[Math.abs(hash) % FALLBACK_GRADIENTS.length]
}

export function StockLogo({ ticker, size = 28, className, shape = 'circle' }: StockLogoProps) {
  const [errored, setErrored] = useState(false)
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-lg'

  if (!ticker) {
    return <FallbackMonogram label="—" size={size} className={className} gradient={FALLBACK_GRADIENTS[0]} radius={radius} />
  }

  const normalized = normalizeForLogo(ticker)
  const monogram = normalized.slice(0, 4)

  if (errored) {
    return (
      <FallbackMonogram
        label={monogram}
        size={size}
        className={className}
        gradient={pickGradient(normalized)}
        radius={radius}
      />
    )
  }

  return (
    <div
      // ring bumped from /5 to /10 + subtle inner shadow so logos with
      // white backgrounds (BCA, Mandiri, etc.) stay distinguishable when
      // placed against a white card. Inner padding via p-[2px] keeps the
      // logo from kissing the ring.
      className={`relative shrink-0 ${radius} overflow-hidden bg-white ring-1 ring-black/10 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] p-[2px] ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={`/stock-logos/${normalized}.png`}
        alt={`Logo ${normalized}`}
        width={size}
        height={size}
        className="object-contain w-full h-full"
        onError={() => setErrored(true)}
        unoptimized // many small images, skip Next image opt to avoid build cost
      />
    </div>
  )
}

function FallbackMonogram({
  label, size, className, gradient, radius,
}: {
  label: string
  size: number
  className?: string
  gradient: string
  radius?: string
}) {
  // Auto-shrink font to fit the monogram regardless of length (1-4 chars)
  const fontSize = size * (label.length >= 4 ? 0.30 : label.length === 3 ? 0.36 : 0.42)
  return (
    <div
      className={`shrink-0 flex items-center justify-center ${radius ?? 'rounded-full'} text-white font-bold ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        background: gradient,
        fontSize,
        letterSpacing: '-0.03em',
      }}
      aria-label={label}
    >
      {label}
    </div>
  )
}
