'use client'

/**
 * MoneyText — angka rupiah konsisten: tabular (sejajar di kolom), warna
 * semantik (in=teal / out=coral / signed=ikut tanda), mode compact (Rp 12,5jt),
 * dan hide-balance (••••). Dipakai di semua tempat yang nampilin nominal biar
 * hierarki & warna seragam. Tanda minus pakai − (U+2212), bukan hyphen.
 */

import type { CSSProperties } from 'react'
import { cn, formatRupiahPlain, formatCompactCurrency } from '@/lib/utils'

type Tone = 'neutral' | 'in' | 'out' | 'signed'

export function MoneyText({
  value,
  tone = 'neutral',
  compact = false,
  hidden = false,
  className,
  style,
}: {
  value: number | null | undefined
  tone?: Tone
  compact?: boolean
  hidden?: boolean
  className?: string
  style?: CSSProperties
}) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : null
  const fmt = compact ? formatCompactCurrency : formatRupiahPlain

  let color = 'var(--ink)'
  let prefix = ''
  let display: string

  if (hidden) {
    display = 'Rp ••••'
  } else if (n == null) {
    display = '—'
  } else if (tone === 'signed') {
    color = n > 0 ? 'var(--c-mint-ink)' : n < 0 ? 'var(--c-coral-ink)' : 'var(--ink)'
    prefix = n > 0 ? '+' : n < 0 ? '−' : ''
    display = fmt(Math.abs(n))
  } else {
    if (tone === 'in') color = 'var(--c-mint-ink)'
    else if (tone === 'out') color = 'var(--c-coral-ink)'
    display = fmt(n)
  }

  return (
    <span
      className={cn('num', className)}
      style={{ color, fontVariantNumeric: 'tabular-nums lining-nums', ...style }}
    >
      {prefix}
      {display}
    </span>
  )
}
