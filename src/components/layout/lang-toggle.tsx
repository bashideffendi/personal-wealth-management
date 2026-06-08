'use client'

import { useI18n } from '@/lib/i18n/context'

/** Language toggle (ID / EN) — segmented pill. Shared by top-nav + landing. */
export function LangToggle({ full = false }: { full?: boolean }) {
  const { locale, setLocale } = useI18n()
  return (
    <div
      className={`inline-flex items-center rounded-lg p-0.5 ${full ? 'w-full' : ''}`}
      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
      role="group"
      aria-label="Bahasa / Language"
    >
      {(['id', 'en'] as const).map((l) => {
        const active = locale === l
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            aria-pressed={active}
            className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors ${full ? 'flex-1' : ''}`}
            style={{
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--ink)' : 'var(--text-mute)',
              boxShadow: active ? '0 1px 2px rgba(16,24,40,0.10)' : undefined,
            }}
          >
            {l.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}
