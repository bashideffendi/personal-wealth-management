'use client'

/**
 * Goals widget — editorial GoalsCardA per design handoff.
 * Each goal = standalone tinted card dengan borderLeft accent, progress
 * percent ditampilkan besar (display 36px) di kanan, bar di kiri.
 */

import Link from 'next/link'
import { formatCompactCurrency } from '@/lib/utils'

interface GoalsWidgetProps {
  goals: Array<{ id: string; name: string; target_amount: number; current_amount: number; deadline: string | null }>
}

// Cycle warna semantic per index (per design — 3 goals → 3 tones)
const GOAL_TONES = ['primary', 'mint', 'amber'] as const

function etaLabel(deadline: string | null): string | null {
  if (!deadline) return null
  const d = new Date(deadline)
  return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
}

export function GoalsWidget({ goals }: GoalsWidgetProps) {
  if (goals.length === 0) {
    return (
      <article className="s-card" style={{ padding: 24 }}>
        <div className="flex items-center justify-between mb-3">
          <p className="eyebrow">Tujuan Aktif</p>
          <Link
            href="/dashboard/goals"
            className="btn-outline"
            style={{ fontSize: 11, padding: '6px 10px' }}
          >
            Buat tujuan
          </Link>
        </div>
        <p className="text-sm py-4 text-center" style={{ color: 'var(--text-mute)' }}>
          Set target keuangan biar ada arah — &ldquo;DP Rumah&rdquo;, &ldquo;Liburan Bali&rdquo;, dll.
        </p>
      </article>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1.5">
        <p className="eyebrow">Tujuan Aktif</p>
        <Link
          href="/dashboard/goals"
          className="text-[11px] font-semibold"
          style={{ color: 'var(--text-mute)' }}
        >
          Lihat semua ›
        </Link>
      </div>
      {goals.slice(0, 3).map((g, i) => {
        const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0
        const remaining = Math.max(0, g.target_amount - g.current_amount)
        const tone = GOAL_TONES[i % GOAL_TONES.length]
        const eta = etaLabel(g.deadline)

        return (
          <Link
            key={g.id}
            href="/dashboard/goals"
            className="s-card"
            style={{
              padding: 16,
              background: `var(--c-${tone}-soft)`,
              borderLeft: `4px solid var(--c-${tone})`,
              display: 'block',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div className="grid items-center gap-3.5" style={{ gridTemplateColumns: '1fr auto' }}>
              <div className="min-w-0">
                <p
                  className="truncate"
                  style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}
                >
                  {g.name}
                </p>
                <div
                  className="kl-bar mt-2"
                  style={{ color: `var(--c-${tone})`, background: 'rgba(255,255,255,0.6)' }}
                >
                  <i style={{ width: `${pct}%` }} />
                </div>
                <p
                  className="num tabular mt-1.5"
                  style={{ fontSize: 10.5, color: 'var(--text-2)' }}
                >
                  {formatCompactCurrency(g.current_amount)}
                  <span style={{ opacity: 0.6 }}> / {formatCompactCurrency(g.target_amount)}</span>
                </p>
                <p
                  className="num tabular"
                  style={{ fontSize: 10.5, color: 'var(--text-mute)', marginTop: 2 }}
                >
                  Sisa{' '}
                  <strong style={{ color: `var(--c-${tone})` }}>
                    {formatCompactCurrency(remaining)}
                  </strong>
                  {eta && <span> · est. {eta}</span>}
                </p>
              </div>
              <div className="text-right">
                <p
                  className="display num tabular"
                  style={{ fontSize: 36, color: `var(--c-${tone})`, lineHeight: 1 }}
                >
                  {pct.toFixed(0)}
                </p>
                <p
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--text-mute)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginTop: 2,
                  }}
                >
                  persen
                </p>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
