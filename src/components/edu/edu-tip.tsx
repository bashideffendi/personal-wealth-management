'use client'

/**
 * EduTip — small ⓘ icon that opens a popover with a brief explanation
 * of the financial theory behind a feature. Click to toggle, click
 * outside to close.
 *
 * Design tenets:
 *   - Visually subtle (muted icon, no background) — must NOT distract
 *     from the primary content next to it.
 *   - Casual Indonesian tone — no academic intimidation.
 *   - Citation at the bottom for credibility — makes the content feel
 *     grounded, not arbitrary.
 *
 * Usage:
 *   <EduTip topic="mental-accounting" />
 *
 * Or with a custom trigger:
 *   <EduTip topic="dca">
 *     <button>Why DCA?</button>
 *   </EduTip>
 */

import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { EDU_TIPS } from '@/lib/edu-content'

interface Props {
  /** Key from EDU_TIPS registry */
  topic: keyof typeof EDU_TIPS
  /** Optional custom trigger — defaults to a small ⓘ icon */
  children?: React.ReactNode
  /** Position relative to trigger — default 'bottom-end' */
  side?: 'top' | 'bottom' | 'left' | 'right'
  /** Override icon size (default 14px) */
  iconSize?: number
}

export function EduTip({ topic, children, side = 'bottom', iconSize = 14 }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLSpanElement>(null)
  const tip = EDU_TIPS[topic]

  // Click-outside to close — same pattern as AICreditsBadge dropdown
  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  if (!tip) {
    // Fail loud during dev so we catch typos in topic keys, but bail
    // silently in production so a missing tip never breaks the page.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`EduTip: unknown topic "${topic}"`)
    }
    return null
  }

  // Position class — keeps the popover near the trigger but inside viewport
  const positionCls = (() => {
    switch (side) {
      case 'top':    return 'bottom-full mb-2 left-1/2 -translate-x-1/2'
      case 'left':   return 'right-full mr-2 top-1/2 -translate-y-1/2'
      case 'right':  return 'left-full ml-2 top-1/2 -translate-y-1/2'
      case 'bottom':
      default:       return 'top-full mt-2 left-0 sm:left-auto sm:right-0'
    }
  })()

  return (
    <span ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className="inline-flex items-center justify-center rounded-full opacity-60 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        style={{ color: 'var(--ink-muted)' }}
        aria-label={`Pelajari: ${tip.title}`}
        aria-expanded={open}
      >
        {children ?? <Info style={{ width: iconSize, height: iconSize }} />}
      </button>

      {open && (
        <div
          className={`absolute z-50 w-72 sm:w-80 rounded-lg border shadow-xl p-3.5 text-left ${positionCls}`}
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: '0 10px 30px -8px rgba(0,0,0,0.18)',
            // Counter the parent's text-align if any
            color: 'var(--ink)',
          }}
          role="tooltip"
          // Stop propagation so clicks inside the popover don't bubble
          // out and trigger the click-outside handler.
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p
              className="text-[10px] uppercase tracking-wider font-semibold"
              style={{ color: 'var(--ink-soft)' }}
            >
              Teori
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] opacity-50 hover:opacity-100 transition"
              style={{ color: 'var(--ink-muted)' }}
              aria-label="Tutup"
            >
              ×
            </button>
          </div>
          <p className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>
            {tip.title}
          </p>

          {/* Body */}
          <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--ink)' }}>
            {tip.body}
          </p>

          {/* Applied (PWM context) — only if present */}
          {tip.applied && (
            <p
              className="text-[12px] leading-relaxed mt-2 pt-2 border-t"
              style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}
            >
              <span className="font-semibold" style={{ color: 'var(--c-mint)' }}>
                Di Klunting:{' '}
              </span>
              {tip.applied}
            </p>
          )}

          {/* Citation */}
          <p
            className="text-[10px] mt-2.5 pt-2 border-t"
            style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}
          >
            {tip.source}
          </p>
        </div>
      )}
    </span>
  )
}
