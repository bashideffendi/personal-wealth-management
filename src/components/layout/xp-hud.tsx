'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchMyXp, levelFromXp } from '@/lib/xp'
import { useT } from '@/lib/i18n/context'

/**
 * HUD level di header (Cartoon Quest fase 2a): chip "Lv n" + XP bar mini.
 * Refresh instan via event 'pwm:xp-changed' (dispatched awardXp).
 * Data gagal/kosong → tampil Lv 1 bar kosong — jujur, bukan placeholder palsu.
 */
export function XpHud() {
  const t = useT()
  const [xp, setXp] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let alive = true
    const load = () => {
      void fetchMyXp(supabase).then((total) => { if (alive) setXp(total) })
    }
    load()
    window.addEventListener('pwm:xp-changed', load)
    return () => {
      alive = false
      window.removeEventListener('pwm:xp-changed', load)
    }
  }, [])

  if (xp === null) return null // belum kebaca — jangan render Lv palsu
  const info = levelFromXp(xp)
  const pct = Math.max(4, Math.min(100, Math.round((info.intoLevel / info.needed) * 100)))

  return (
    <div
      className="hidden sm:flex items-center gap-2 rounded-full px-2.5 py-1"
      style={{ background: 'var(--c-primary-soft)', border: '1.5px solid var(--outline)' }}
      title={`${t('xp.hud_title')} · ${info.intoLevel}/${info.needed} XP`}
    >
      <span className="num text-[11px] font-semibold leading-none" style={{ color: 'var(--c-primary-ink)' }}>
        Lv {info.level}
      </span>
      <span
        className="block h-[5px] w-10 rounded-full overflow-hidden"
        style={{ background: 'var(--surface-3)' }}
        role="progressbar"
        aria-valuenow={info.intoLevel}
        aria-valuemin={0}
        aria-valuemax={info.needed}
        aria-label={t('xp.hud_title')}
      >
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--c-primary)' }} />
      </span>
    </div>
  )
}
