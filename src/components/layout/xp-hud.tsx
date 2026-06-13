'use client'

import { useEffect, useState } from 'react'
import { Coins } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchMyXp, levelFromXp, levelTitle } from '@/lib/xp'
import { useT } from '@/lib/i18n/context'

/**
 * HUD level di header (Cartoon Quest fase 2): badge koin "Lv n" + gelar +
 * quest-bar XP. Refresh instan via event 'pwm:xp-changed'. null sebelum
 * data kebaca (no Lv palsu).
 */
export function XpHud() {
  const t = useT()
  const [xp, setXp] = useState<number | null>(null)
  const [bump, setBump] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let alive = true
    const load = () => { void fetchMyXp(supabase).then((tot) => { if (alive) setXp(tot) }) }
    load()
    const onChange = () => { load(); setBump(true); setTimeout(() => alive && setBump(false), 500) }
    window.addEventListener('pwm:xp-changed', onChange)
    return () => { alive = false; window.removeEventListener('pwm:xp-changed', onChange) }
  }, [])

  if (xp === null) return null
  const info = levelFromXp(xp)
  const pct = Math.max(5, Math.min(100, Math.round((info.intoLevel / info.needed) * 100)))

  return (
    <div
      className="hidden sm:flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1 transition-transform"
      style={{
        background: 'var(--c-primary-soft)',
        border: 'var(--outline-w) solid var(--outline)',
        boxShadow: 'var(--btn-shadow)',
        transform: bump ? 'scale(1.06)' : 'scale(1)',
      }}
      title={`${levelTitle(info.level)} · ${info.intoLevel}/${info.needed} XP`}
    >
      <span
        className="grid place-items-center rounded-full shrink-0"
        style={{ width: 22, height: 22, background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}
        aria-hidden
      >
        <Coins className="size-3.5" />
      </span>
      <span className="flex flex-col leading-none gap-0.5 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="num text-[12px] font-bold leading-none" style={{ color: 'var(--c-primary-ink)' }}>
            Lv {info.level}
          </span>
          <span className="hidden lg:block text-[11px] font-semibold leading-none truncate" style={{ color: 'var(--ink-soft)', maxWidth: 110 }}>
            {levelTitle(info.level)}
          </span>
        </span>
        <span
          className="quest-bar"
          style={{ width: 78, ['--bar-h' as string]: '6px', ['--bar-outline-w' as string]: '1.5px' }}
          role="progressbar"
          aria-valuenow={info.intoLevel}
          aria-valuemin={0}
          aria-valuemax={info.needed}
          aria-label={t('xp.hud_title')}
        >
          <i style={{ width: `${pct}%` }} />
        </span>
      </span>
    </div>
  )
}
