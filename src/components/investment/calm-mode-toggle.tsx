'use client'

/**
 * Calm Mode Toggle — anti-panic UX for investment views.
 *
 * Loss aversion (Kahneman-Tversky 1979): kerugian terasa ~2× lebih sakit
 * daripada keuntungan setara. Ini bikin investor panik saat market turun
 * dan jual di waktu salah. Solusinya: kurangi salience P/L harian saat
 * pasar bergejolak.
 *
 * Saat Calm Mode ON:
 *   - Body attribute `data-calm="true"` di-set
 *   - CSS rule blur warna merah (loss colors)
 *   - User bisa toggle off kapan saja
 *
 * Persisted di localStorage. Cuma global state, ngga sync server.
 */

import { useEffect, useState } from 'react'
import { Heart, HeartPulse } from 'lucide-react'

const STORAGE_KEY = 'pwm.calm-mode'

export function CalmModeToggle({ compact = false }: { compact?: boolean }) {
  const [calm, setCalm] = useState(false)

  // Read initial state
  useEffect(() => {
    try {
      setCalm(localStorage.getItem(STORAGE_KEY) === 'true')
    } catch { /* ignore */ }
  }, [])

  // Mirror to body attribute so CSS can target globally
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (calm) document.body.setAttribute('data-calm', 'true')
    else document.body.removeAttribute('data-calm')
  }, [calm])

  function toggle() {
    const next = !calm
    setCalm(next)
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch { /* ignore */ }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition"
        style={{
          background: calm ? 'rgba(236,72,153,0.10)' : 'var(--surface-2)',
          color: calm ? '#EC4899' : 'var(--ink-muted)',
        }}
        title={calm ? 'Calm Mode aktif — P/L harian disamarkan' : 'Aktifkan Calm Mode — kurangi panic from market noise'}
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
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition border"
      style={{
        background: calm ? 'rgba(236,72,153,0.08)' : 'var(--surface)',
        borderColor: calm ? 'rgba(236,72,153,0.30)' : 'var(--border)',
        color: calm ? '#EC4899' : 'var(--ink-muted)',
      }}
      title={
        calm
          ? 'Calm Mode aktif — angka loss disamarkan untuk kurangi panic selling'
          : 'Aktifkan Calm Mode — bagus saat market sedang volatil'
      }
    >
      {calm ? <HeartPulse className="size-3.5" /> : <Heart className="size-3.5" />}
      <span>{calm ? 'Calm Mode ON' : 'Calm Mode'}</span>
    </button>
  )
}
