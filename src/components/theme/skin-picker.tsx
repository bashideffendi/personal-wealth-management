'use client'

/**
 * SkinPicker — 2 tema: "Bersih" (default = redesign baru, base :root) + "Cartoon"
 * (opsi, tampilan lawas emas/dongeng via [data-skin="cartoon"]).
 * Bersih = hapus data-skin + localStorage. Cartoon = set keduanya.
 */

import { useEffect, useState } from 'react'

type Skin = 'default' | 'cartoon'

const OPTIONS: {
  key: Skin
  label: string
  desc: string
  sw: { bg: string; card: string; accent: string; border: string }
}[] = [
  { key: 'default', label: 'Bersih', desc: 'Tema utama — minimalis, 4 warna brand', sw: { bg: '#FAFAFA', card: '#FFFFFF', accent: '#17b890', border: '#ECECEF' } },
  { key: 'cartoon', label: 'Cartoon', desc: 'Tema lawas — emas, dongeng, outline tebal', sw: { bg: '#FFF9EE', card: '#FFFFFF', accent: '#FFC83D', border: '#1E1B16' } },
]

export function SkinPicker() {
  const [skin, setSkin] = useState<Skin>('default')
  useEffect(() => {
    setSkin(localStorage.getItem('pwm-skin') === 'cartoon' ? 'cartoon' : 'default')
  }, [])

  function apply(next: Skin) {
    setSkin(next)
    if (next === 'cartoon') {
      localStorage.setItem('pwm-skin', 'cartoon')
      document.documentElement.setAttribute('data-skin', 'cartoon')
    } else {
      localStorage.removeItem('pwm-skin')
      document.documentElement.removeAttribute('data-skin')
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {OPTIONS.map((o) => {
        const active = skin === o.key
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => apply(o.key)}
            aria-pressed={active}
            className="text-left rounded-xl p-2.5 transition"
            style={{
              border: `${active ? 2 : 1}px solid ${active ? 'var(--c-mint-ink)' : 'var(--border)'}`,
              background: 'var(--surface)',
            }}
          >
            <span
              className="block rounded-lg mb-2 relative overflow-hidden"
              style={{ background: o.sw.bg, border: `1px solid ${o.sw.border}`, height: 44 }}
            >
              <span style={{ position: 'absolute', left: 8, top: 9, width: 56, height: 10, borderRadius: 4, background: o.sw.card, border: `1px solid ${o.sw.border}` }} />
              <span style={{ position: 'absolute', left: 8, top: 25, width: 30, height: 9, borderRadius: 999, background: o.sw.accent }} />
            </span>
            <span className="block text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{o.label}</span>
            <span className="block text-[11px] leading-tight mt-0.5" style={{ color: 'var(--ink-soft)' }}>{o.desc}</span>
          </button>
        )
      })}
    </div>
  )
}
