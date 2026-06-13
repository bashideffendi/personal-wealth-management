'use client'

import { useEffect, useState } from 'react'
import { Coins } from 'lucide-react'
import { levelTitle } from '@/lib/xp'
import { useT } from '@/lib/i18n/context'

/**
 * XpFx — efek koin melayang + overlay LEVEL UP (Cartoon Quest fase 2c).
 * Dengar event 'pwm:xp-gain' (dispatched awardXp). Mount sekali global
 * (dashboard layout). CSS-only animation (lihat .xpfx-* di globals).
 */
interface Coin { id: number; amount: number; x: number; y: number }
interface LevelUp { id: number; level: number }

export function XpFx() {
  const t = useT()
  const [coins, setCoins] = useState<Coin[]>([])
  const [levelUp, setLevelUp] = useState<LevelUp | null>(null)

  useEffect(() => {
    let seq = 0
    function onGain(e: Event) {
      const detail = (e as CustomEvent).detail as { amount: number; leveledUp: boolean; newLevel: number }
      const id = ++seq
      // Spawn koin dekat FAB (kanan-bawah desktop) / tengah-bawah mobile.
      const x = window.innerWidth < 768 ? window.innerWidth / 2 : window.innerWidth - 64
      const y = window.innerWidth < 768 ? window.innerHeight - 110 : window.innerHeight - 90
      setCoins((c) => [...c, { id, amount: detail.amount, x, y }])
      setTimeout(() => setCoins((c) => c.filter((k) => k.id !== id)), 1200)
      if (detail.leveledUp) {
        const lid = ++seq
        setLevelUp({ id: lid, level: detail.newLevel })
        setTimeout(() => setLevelUp((lv) => (lv?.id === lid ? null : lv)), 2300)
      }
    }
    window.addEventListener('pwm:xp-gain', onGain)
    return () => window.removeEventListener('pwm:xp-gain', onGain)
  }, [])

  return (
    <>
      {coins.map((c) => (
        <span
          key={c.id}
          className="xpfx-coin num"
          style={{ left: c.x, top: c.y, color: 'var(--c-primary-ink)', fontSize: 15 }}
        >
          <Coins className="inline size-4 mb-0.5" style={{ color: 'var(--c-primary)' }} /> +{c.amount} XP
        </span>
      ))}
      {levelUp && (
        <div
          className="xpfx-levelup s-card"
          style={{ background: 'var(--surface)', padding: '14px 22px', textAlign: 'center' }}
        >
          <p className="t-sm font-bold" style={{ color: 'var(--c-primary-ink)', letterSpacing: '0.04em' }}>
            ⭐ {t('xp.level_up')}
          </p>
          <p className="num font-bold leading-none mt-1" style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)' }}>
            Lv {levelUp.level}
          </p>
          <p className="t-cap mt-0.5" style={{ color: 'var(--ink-soft)' }}>{levelTitle(levelUp.level)}</p>
        </div>
      )}
    </>
  )
}
