'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/context'

type Skin = 'cartoon' | 'mono' | 'terminal'

/** Swatch mini per skin — warna literal sengaja (preview identitas skin,
 *  bukan token yang lagi aktif). */
const SKINS: { key: Skin; bg: string; card: string; accent: string; outline: string }[] = [
  { key: 'cartoon', bg: '#FFF9EE', card: '#FFFFFF', accent: '#FFC83D', outline: '#1E1B16' },
  { key: 'mono', bg: '#F4F3EE', card: '#FFFFFF', accent: '#131110', outline: '#E0DCD2' },
  { key: 'terminal', bg: '#0E0F12', card: '#16181D', accent: '#F7A600', outline: '#2A2D33' },
]

/** Warna chrome PWA per skin (sinkron dgn token --bg di globals.css). */
const THEME_COLOR: Record<Skin, { light: string; dark: string }> = {
  cartoon: { light: '#FFF9EE', dark: '#241F31' },
  mono: { light: '#F4F3EE', dark: '#0E0C0A' },
  terminal: { light: '#0E0F12', dark: '#0E0F12' },
}

function applySkin(skin: Skin) {
  const el = document.documentElement
  el.setAttribute('data-skin', skin)
  try { localStorage.setItem('pwm-skin', skin) } catch { /* private mode */ }
  // Terminal = dark-only; keluar dari terminal → balik ke preferensi pwm-theme.
  if (skin === 'terminal') {
    el.classList.add('dark')
  } else {
    let stored: string | null = null
    try { stored = localStorage.getItem('pwm-theme') } catch { /* ignore */ }
    const mode = stored === 'light' || stored === 'dark' ? stored : 'auto'
    const dark = mode === 'auto' ? window.matchMedia('(prefers-color-scheme: dark)').matches : mode === 'dark'
    el.classList.toggle('dark', dark)
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[skin][el.classList.contains('dark') ? 'dark' : 'light'])
}

export function SkinPicker() {
  const t = useT()
  const [active, setActive] = useState<Skin>('cartoon')

  useEffect(() => {
    const cur = document.documentElement.getAttribute('data-skin') as Skin | null
    if (cur === 'mono' || cur === 'terminal' || cur === 'cartoon') setActive(cur)
  }, [])

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {SKINS.map((s) => {
        const on = active === s.key
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => { applySkin(s.key); setActive(s.key) }}
            aria-pressed={on}
            className="rounded-xl p-2 text-left transition"
            style={{
              border: on ? '2px solid var(--c-primary-ink)' : 'var(--outline-w) solid var(--outline)',
              boxShadow: on ? 'var(--card-shadow)' : 'none',
              background: 'var(--surface)',
            }}
          >
            <span
              className="block h-14 rounded-lg overflow-hidden relative"
              style={{ background: s.bg, border: `1.5px solid ${s.outline}` }}
              aria-hidden
            >
              <span className="absolute left-1.5 top-1.5 right-1.5 h-5 rounded" style={{ background: s.card, border: `1.5px solid ${s.outline}` }} />
              <span className="absolute left-1.5 bottom-1.5 h-3.5 w-9 rounded-full" style={{ background: s.accent }} />
            </span>
            <span className="block mt-1.5 text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>
              {t(`profile.skin_${s.key}`)}
            </span>
            <span className="block text-[11px]" style={{ color: 'var(--ink-soft)' }}>
              {t(`profile.skin_${s.key}_hint`)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
