'use client'

import * as React from 'react'
import { useEffect } from 'react'
import { InfoTip } from '@/components/ui/info-tip'

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
  icon: Icon,
}: {
  title: string
  /** Longer explanation — shown in an ⓘ tooltip instead of a permanent subtitle. */
  info?: string
  actions?: React.ReactNode
  /** Overrides the document title (defaults to `title`). */
  docTitle?: string
  /** Ikon RPG opsional — chip kecil ber-outline sebelum judul (tema cartoon). */
  icon?: React.ComponentType<{ className?: string }>
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
      {/* F9: judul pindah ke MobileAppBar di <md — cluster judul desktop-only */}
      <div className="hidden md:flex items-center gap-2 min-w-0">
        {Icon && (
          <span
            className="grid place-items-center shrink-0 rounded-xl"
            style={{ width: 34, height: 34, background: 'var(--c-primary-soft)', border: 'var(--outline-w) solid var(--outline)', boxShadow: 'var(--btn-shadow)', color: 'var(--c-primary-ink)' }}
            aria-hidden
          >
            <Icon className="size-4" />
          </span>
        )}
        <h1
          className="tracking-tight truncate"
          style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em' }}
        >
          {title}
        </h1>
        {info && <span className="shrink-0"><InfoTip text={info} /></span>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
