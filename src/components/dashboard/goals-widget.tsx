'use client'

/**
 * Goals widget — fintech clean list of active goals.
 * Single s-card dengan list rows + circular progress per goal.
 */

import Link from 'next/link'
import { ChevronRight, Target } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'

interface GoalsWidgetProps {
  goals: Array<{ id: string; name: string; target_amount: number; current_amount: number; deadline: string | null; created_at?: string | null }>
}

function etaLabel(deadline: string | null): string | null {
  if (!deadline) return null
  const d = new Date(deadline)
  return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
}

export function GoalsWidget({ goals }: GoalsWidgetProps) {
  const t = useT()
  if (goals.length === 0) {
    return (
      <article className="s-card s-card-pad-lg">
        <div className="flex items-center justify-between mb-3">
          <p className="eyebrow">{t('goals_widget.eyebrow')}</p>
          <Link
            href="/dashboard/goals"
            className="btn-outline"
            style={{ fontSize: 11, padding: '6px 10px' }}
          >
            {t('goals_widget.create_goal')}
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div
            className="grid place-items-center mb-3"
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'var(--c-mint-soft)',
              color: 'var(--c-mint)',
            }}
          >
            <Target className="size-5" />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {t('goals_widget.empty_title')}
          </p>
          <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--text-mute)' }}>
            {t('goals_widget.empty_desc')}
          </p>
        </div>
      </article>
    )
  }

  return (
    <article className="s-card s-card-pad-lg">
      <div className="flex items-center justify-between mb-4">
        <p className="eyebrow">{t('goals_widget.eyebrow')}</p>
        <Link
          href="/dashboard/goals"
          className="text-xs font-semibold inline-flex items-center gap-0.5 hover:underline"
          style={{ color: 'var(--c-mint)' }}
        >
          {t('goals_widget.view_all')}
          <ChevronRight className="size-3" />
        </Link>
      </div>

      <div className="flex flex-col">
        {goals.slice(0, 3).map((g, i) => {
          const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0
          const eta = etaLabel(g.deadline)
          // Tone ikut PACE vs deadline — rumus sama dengan goalStatus halaman
          // Tujuan (progress vs waktu berjalan), bukan % absolut. Goal jangka
          // panjang yang baru 20% tapi on-track gak boleh tampil alarm.
          const tone = (() => {
            if (pct >= 100) return 'mint'
            if (!g.deadline || !g.created_at) return 'mint'
            const start = new Date(g.created_at).getTime()
            const end = new Date(g.deadline).getTime()
            const nowMs = Date.now()
            if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'mint'
            if (nowMs >= end) return 'coral'
            const expectedPct = ((nowMs - start) / (end - start)) * 100
            return pct + 0.5 >= expectedPct ? 'mint' : expectedPct - pct > 25 ? 'coral' : 'amber'
          })()

          // Circular progress ring math
          const radius = 18
          const circumference = 2 * Math.PI * radius
          const offset = circumference - (pct / 100) * circumference

          return (
            <Link
              key={g.id}
              href="/dashboard/goals"
              className="grid items-center gap-3 py-3 transition-colors"
              style={{
                gridTemplateColumns: '40px 1fr auto',
                borderTop: i ? '1px solid var(--line)' : 'none',
              }}
            >
              {/* Circular progress */}
              <div className="relative shrink-0" style={{ width: 40, height: 40 }}>
                <svg width={40} height={40} viewBox="0 0 40 40">
                  <circle
                    cx={20}
                    cy={20}
                    r={radius}
                    fill="none"
                    stroke="var(--surface-2)"
                    strokeWidth={4}
                  />
                  <circle
                    cx={20}
                    cy={20}
                    r={radius}
                    fill="none"
                    stroke={`var(--c-${tone})`}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform="rotate(-90 20 20)"
                  />
                </svg>
                <span
                  className="absolute inset-0 grid place-items-center num tabular font-bold"
                  style={{ fontSize: 11, color: 'var(--ink)' }}
                >
                  {pct.toFixed(0)}
                </span>
              </div>

              {/* Goal info */}
              <div className="min-w-0">
                <p
                  className="truncate"
                  style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}
                >
                  {g.name}
                </p>
                <p
                  className="num tabular"
                  style={{ fontSize: 11.5, color: 'var(--text-mute)', marginTop: 1 }}
                >
                  {formatCurrency(g.current_amount)}
                  <span style={{ opacity: 0.6 }}> / {formatCurrency(g.target_amount)}</span>
                  {eta && <span style={{ marginLeft: 6, opacity: 0.7 }}>· {eta}</span>}
                </p>
              </div>

              {/* Chevron */}
              <ChevronRight className="size-4" style={{ color: 'var(--ink-soft)' }} />
            </Link>
          )
        })}
      </div>
    </article>
  )
}
