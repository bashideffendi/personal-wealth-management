'use client'

/**
 * Crypto coin logo with graceful fallback.
 *
 * Source: spothq/cryptocurrency-icons on GitHub (MIT-licensed, ~600 coins,
 * 128px PNG color icons). CORS-open — fetched directly via next/image.
 *
 * Binance public API does NOT serve coin logos, so we use this third-party
 * icon set. Coverage is excellent for the top ~500 coins (anything an
 * Indonesian retail investor would actually hold). Coins not in the set
 * fall back to a tinted gradient monogram with the coin symbol.
 *
 * Yahoo-style tickers ("BTC-USD", "ETH-USD") + Binance-style ("BTCUSDT",
 * "ETHUSDT") + bare symbols ("BTC") all normalize to the bare base symbol.
 */

import { useState } from 'react'
import Image from 'next/image'

interface CryptoLogoProps {
  /** Symbol in any common form: "BTC", "BTC-USD", "BTCUSDT", "btc-usdt" */
  symbol?: string | null
  size?: number
  className?: string
  shape?: 'circle' | 'rounded'
}

const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, #F7931A, #B66B14)',  // BTC orange
  'linear-gradient(135deg, #627EEA, #3C5BD0)',  // ETH blue
  'linear-gradient(135deg, #F0B90B, #C49100)',  // BNB yellow
  'linear-gradient(135deg, #14F195, #9945FF)',  // SOL gradient
  'linear-gradient(135deg, #00B7C2, #008B95)',  // teal
  'linear-gradient(135deg, #8247E5, #5B2FA8)',  // violet
]

function normalizeSymbol(raw: string): string {
  // Strip everything after - or _ first (BTC-USD → BTC)
  const beforeDash = raw.split(/[-_]/)[0].toUpperCase().trim()
  // Strip Binance-style USDT/BUSD/USDC/USD suffix when concatenated (BTCUSDT → BTC)
  const STABLE_SUFFIXES = ['USDT', 'BUSD', 'USDC', 'TUSD', 'USD']
  for (const sfx of STABLE_SUFFIXES) {
    if (beforeDash.endsWith(sfx) && beforeDash.length > sfx.length) {
      return beforeDash.slice(0, -sfx.length)
    }
  }
  return beforeDash
}

function pickGradient(sym: string): string {
  let hash = 0
  for (let i = 0; i < sym.length; i++) hash = (hash * 31 + sym.charCodeAt(i)) | 0
  return FALLBACK_GRADIENTS[Math.abs(hash) % FALLBACK_GRADIENTS.length]
}

export function CryptoLogo({ symbol, size = 28, className, shape = 'circle' }: CryptoLogoProps) {
  // Two-stage fallback:
  //   1. Local /crypto-logos/{slug}.png (top 50 popular coins, shipped with app)
  //   2. spothq GitHub raw (everything else — newer coins not in local snapshot)
  //   3. Monogram fallback (URL dead OR symbol totally unknown)
  // We track which path failed via stage state.
  const [stage, setStage] = useState<'local' | 'remote' | 'monogram'>('local')
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-lg'

  if (!symbol) {
    return (
      <FallbackMonogram label="?" size={size} className={className} radius={radius} gradient={FALLBACK_GRADIENTS[0]} />
    )
  }

  const normalized = normalizeSymbol(symbol)
  const lower = normalized.toLowerCase()

  if (stage === 'monogram') {
    return (
      <FallbackMonogram
        label={normalized.slice(0, 4)}
        size={size}
        className={className}
        radius={radius}
        gradient={pickGradient(normalized)}
      />
    )
  }

  const url = stage === 'local'
    ? `/crypto-logos/${lower}.png`
    : `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${lower}.png`

  return (
    <div
      className={`relative shrink-0 ${radius} overflow-hidden bg-white ring-1 ring-black/5 ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={url}
        alt={`Logo ${normalized}`}
        width={size}
        height={size}
        className="object-cover w-full h-full"
        onError={() => setStage(stage === 'local' ? 'remote' : 'monogram')}
        unoptimized
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
  radius: string
}) {
  const fontSize = size * (label.length >= 4 ? 0.30 : label.length === 3 ? 0.36 : 0.42)
  return (
    <div
      className={`shrink-0 flex items-center justify-center ${radius} text-white font-bold ${className ?? ''}`}
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
