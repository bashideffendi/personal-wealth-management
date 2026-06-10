'use client'

/**
 * Calm Mode Toggle — anti-panic UX. Now reads/writes via CalmModeProvider
 * so multiple instances (header + profile + investment page) stay in sync.
 */

import { Heart, HeartPulse } from 'lucide-react'
import { useCalmMode } from '@/components/privacy/calm-mode-provider'

export function CalmModeToggle({ compact = false }: { compact?: boolean }) {
  const { calm, toggle } = useCalmMode()

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={calm}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition"
        style={{
          background: calm ? 'var(--c-mint-soft)' : 'var(--surface-2)',
          color: calm ? 'var(--c-mint-ink)' : 'var(--ink-muted)',
        }}
        title={calm ? 'Calm Mode aktif — angka loss disamarkan' : 'Aktifkan Calm Mode — biar nggak panik pas market berisik'}
      >
        {calm ? <HeartPulse className="size-3" /> : <Heart className="size-3" />}
        Calm Mode
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={calm}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition border"
      style={{
        background: calm ? 'var(--c-mint-soft)' : 'var(--surface)',
        borderColor: calm ? 'color-mix(in srgb, var(--c-mint) 30%, transparent)' : 'var(--border)',
        color: calm ? 'var(--c-mint-ink)' : 'var(--ink-muted)',
      }}
      title={
        calm
          ? 'Calm Mode aktif — angka loss disamarkan biar nggak memicu panic selling'
          : 'Aktifkan Calm Mode — bagus saat market sedang volatil'
      }
    >
      {calm ? <HeartPulse className="size-3.5" /> : <Heart className="size-3.5" />}
      <span>{calm ? 'Calm Mode ON' : 'Calm Mode'}</span>
    </button>
  )
}
