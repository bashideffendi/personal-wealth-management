'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/context'

type Skin = 'cartoon' | 'mono' | 'terminal'
type Mode = 'light' | 'dark' | 'auto'

/** Swatch literal per skin (preview identitas, bukan token aktif). */
const SKINS: { key: Skin; darkOnly?: boolean; light: SwatchColors; dark: SwatchColors }[] = [
  {
    key: 'cartoon',
    light: { bg: '#FFF9EE', card: '#FFFFFF', accent: '#FFC83D', outline: '#1E1B16' },
    dark: { bg: '#241F31', card: '#322B45', accent: '#FFC83D', outline: '#4A4063' },
  },
  {
    key: 'mono',
    light: { bg: '#F4F3EE', card: '#FFFFFF', accent: '#131110', outline: '#E0DCD2' },
    dark: { bg: '#0E0C0A', card: '#1E1A16', accent: '#F4F2ED', outline: '#2A2622' },
  },
  {
    key: 'terminal',
    darkOnly: true,
    light: { bg: '#0E0F12', card: '#16181D', accent: '#F7A600', outline: '#2A2D33' },
    dark: { bg: '#0E0F12', card: '#16181D', accent: '#F7A600', outline: '#2A2D33' },
  },
]
type SwatchColors = { bg: string; card: string; accent: string; outline: string }

const THEME_COLOR: Record<Skin, { light: string; dark: string }> = {
  cartoon: { light: '#FFF9EE', dark: '#241F31' },
  mono: { light: '#F4F3EE', dark: '#0E0C0A' },
  terminal: { light: '#0E0F12', dark: '#0E0F12' },
}

function resolveDark(skin: Skin, mode: Mode): boolean {
  if (skin === 'terminal') return true
  if (mode === 'auto') return window.matchMedia('(prefers-color-scheme: dark)').matches
  return mode === 'dark'
}

function applySkin(skin: Skin, mode: Mode) {
  const el = document.documentElement
  el.setAttribute('data-skin', skin)
  try {
    localStorage.setItem('pwm-skin', skin)
    localStorage.setItem('pwm-theme', skin === 'terminal' ? 'dark' : mode)
  } catch { /* private mode */ }
  const dark = resolveDark(skin, mode)
  el.classList.toggle('dark', dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[skin][dark ? 'dark' : 'light'])
}

export function SkinPicker() {
  const t = useT()
  const [skin, setSkin] = useState<Skin>('cartoon')
  const [mode, setMode] = useState<Mode>('auto')

  useEffect(() => {
    const cur = document.documentElement.getAttribute('data-skin') as Skin | null
    if (cur === 'mono' || cur === 'terminal' || cur === 'cartoon') setSkin(cur)
    try {
      const m = localStorage.getItem('pwm-theme')
      if (m === 'light' || m === 'dark' || m === 'auto') setMode(m)
    } catch { /* ignore */ }
  }, [])

  const MODES: { key: Mode; label: string }[] = [
    { key: 'light', label: t('profile.mode_light') },
    { key: 'dark', label: t('profile.mode_dark') },
    { key: 'auto', label: t('profile.mode_auto') },
  ]

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2.5">
        {SKINS.map((s) => {
          const on = skin === s.key
          const previewDark = s.darkOnly || (on ? resolveDark(s.key, mode) : false)
          const c = previewDark ? s.dark : s.light
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => { applySkin(s.key, mode); setSkin(s.key) }}
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
                style={{ background: c.bg, border: `1.5px solid ${c.outline}` }}
                aria-hidden
              >
                <span className="absolute left-1.5 top-1.5 right-1.5 h-5 rounded" style={{ background: c.card, border: `1.5px solid ${c.outline}` }} />
                <span className="absolute left-1.5 bottom-1.5 h-3.5 w-9 rounded-full" style={{ background: c.accent }} />
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

      {/* Light/Dark/Auto — per tema aktif. Terminal dark-only → disabled. */}
      <div
        className="inline-flex rounded-full p-0.5 gap-0.5"
        style={{ border: 'var(--outline-w) solid var(--outline)', background: 'var(--surface-2)', opacity: skin === 'terminal' ? 0.5 : 1 }}
      >
        {MODES.map((m) => {
          const on = skin !== 'terminal' && mode === m.key
          return (
            <button
              key={m.key}
              type="button"
              disabled={skin === 'terminal'}
              onClick={() => { setMode(m.key); applySkin(skin, m.key) }}
              aria-pressed={on}
              className="px-3 py-1 rounded-full text-[12px] font-semibold transition disabled:cursor-not-allowed"
              style={{
                background: on ? 'var(--c-primary)' : 'transparent',
                color: on ? 'var(--c-primary-foreground)' : 'var(--ink-soft)',
              }}
            >
              {m.label}
            </button>
          )
        })}
        {skin === 'terminal' && (
          <span className="px-2 py-1 text-[11px] self-center" style={{ color: 'var(--ink-soft)' }}>
            {t('profile.terminal_dark_only')}
          </span>
        )}
      </div>
    </div>
  )
}
