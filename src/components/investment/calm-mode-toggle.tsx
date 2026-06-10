'use client'

/**
 * Calm Mode Toggle — anti-panic UX. Now reads/writes via CalmModeProvider
 * so multiple instances (header + profile + investment page) stay in sync.
 */

import { Heart, HeartPulse } from 'lucide-react'
import { useCalmMode } from '@/components/privacy/calm-mode-provider'
import { useT } from '@/lib/i18n/context'

export function CalmModeToggle({ compact = false }: { compact?: boolean }) {
  const t = useT()
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
        title={calm ? t('investment.calm_on_hint') : t('investment.calm_off_hint')}
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
      title={calm ? t('investment.calm_on_hint_long') : t('investment.calm_off_hint_long')}
    >
      {calm ? <HeartPulse className="size-3.5" /> : <Heart className="size-3.5" />}
      <span>{calm ? 'Calm Mode ON' : 'Calm Mode'}</span>
    </button>
  )
}
