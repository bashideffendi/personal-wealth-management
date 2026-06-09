'use client'

import * as React from 'react'
import { useEffect } from 'react'
import { Info } from 'lucide-react'

/**
 * QuietPageHeader — minimal, density-first header for WORK pages
 * (Transaksi, Anggaran, Rutin, Aturan, …).
 *
 * Per design 2026-06-09 (Monarch/YNAB minimal-chrome direction): replaces
 * the billboard eyebrow + big H1 + subtitle with a compact label. Page
 * orientation lives in the top-nav active item; the long description moves
 * into an ⓘ tooltip (hover/focus). The serif hero stays reserved for
 * IDENTITY pages (Kekayaan, Aset, Dashboard greeting).
 *
 * Accessibility preserved on purpose:
 *  - a real <h1> still renders (just visually small), so screen-reader
 *    heading navigation + "where am I" cue survive;
 *  - the route's document.title is set, so the browser tab / AT page title
 *    is correct (a common SPA regression when titles go quiet).
 */
export function QuietPageHeader({
  title,
  info,
  actions,
  docTitle,
}: {
  title: string
  /** Longer explanation — shown in an ⓘ tooltip instead of a permanent subtitle. */
  info?: string
  actions?: React.ReactNode
  /** Overrides the document title (defaults to `title`). */
  docTitle?: string
}) {
  useEffect(() => {
    const prev = document.title
    document.title = `${docTitle ?? title} · Klunting`
    return () => {
      document.title = prev
    }
  }, [title, docTitle])

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <h1
          className="font-semibold tracking-tight truncate"
          style={{ fontSize: 24, color: 'var(--ink)', letterSpacing: '-0.025em' }}
        >
          {title}
        </h1>
        {info && (
          <span className="group relative inline-flex shrink-0">
            <button type="button" className="inline-flex" aria-label={info}>
              <Info className="size-3.5 cursor-help" style={{ color: 'var(--ink-soft)' }} />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 hidden w-max max-w-[280px] rounded-lg px-2.5 py-1.5 text-[11px] leading-snug shadow-lg group-hover:block group-focus-within:block"
              style={{ background: 'var(--ink)', color: 'var(--surface)' }}
            >
              {info}
            </span>
          </span>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
