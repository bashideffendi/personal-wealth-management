'use client'

/**
 * Multi-Goal Pyramid view — restructures user's goals into Behavioral
 * Portfolio Theory layers (Shefrin & Statman 2000):
 *   - Pelindung (bottom):  protection, emergency, short-term needs
 *   - Pertumbuhan (mid):   stable growth, long-term essentials
 *   - Mimpi (top):         high-growth ambitions, "lottery jar"
 *
 * Each layer aggregates goals by category — user just sees their goals
 * grouped into the layer that best matches the risk/horizon profile.
 *
 * Visual: 3 stacked horizontal bars (largest at bottom = pelindung) with
 * goals listed inside each layer.
 */

import { useMemo } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  PYRAMID_LAYERS,
  categoryToPyramidLayer,
  type PyramidLayer,
} from '@/lib/goal-probability'
import { EduTip } from '@/components/edu/edu-tip'

interface Goal {
  id: string
  name: string
  category: string
  current_amount: number
  target_amount: number
  deadline: string | null
}

interface Props {
  goals: Goal[]
}

export function GoalPyramid({ goals }: Props) {
  const grouped = useMemo(() => {
    const out: Record<PyramidLayer, Goal[]> = { pelindung: [], pertumbuhan: [], mimpi: [] }
    for (const g of goals) {
      const layer = categoryToPyramidLayer(g.category)
      out[layer].push(g)
    }
    return out
  }, [goals])

  if (goals.length === 0) return null

  return (
    <div
      className="rounded-2xl border p-5 sm:p-6"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            Behavioral Portfolio
            <EduTip topic="goal-based-investing" side="bottom" />
          </p>
          <h3 className="text-lg font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
            Piramida Tujuan
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
            Goals dikelompokkan berdasarkan profil risiko & horizon — strategi tabungannya bisa beda.
          </p>
        </div>
      </div>

      {/* Pyramid — top (mimpi, narrow) → bottom (pelindung, wide) */}
      <div className="space-y-1.5">
        {(['mimpi', 'pertumbuhan', 'pelindung'] as PyramidLayer[]).map((layerKey, idx) => {
          const layer = PYRAMID_LAYERS[layerKey]
          const items = grouped[layerKey]
          // Width grows from top (60%) to bottom (100%)
          const widths = ['60%', '80%', '100%']
          const width = widths[idx]
          return (
            <div key={layerKey} className="flex justify-center">
              <div
                className="rounded-lg border p-3 sm:p-4 transition-all hover:shadow-md"
                style={{
                  width,
                  background: `${layer.color}0F`,
                  borderColor: `${layer.color}40`,
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{layer.emoji}</span>
                    <p
                      className="text-xs font-bold uppercase tracking-wide"
                      style={{ color: layer.color }}
                    >
                      {layer.label}
                    </p>
                  </div>
                  <span
                    className="text-[10px] num font-semibold"
                    style={{ color: layer.color }}
                  >
                    {items.length}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                    Belum ada goal di layer ini.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {items.slice(0, 3).map((g) => {
                      const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0
                      return (
                        <div key={g.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate font-medium" style={{ color: 'var(--ink)' }}>
                            {g.name}
                          </span>
                          <span className="num shrink-0" style={{ color: 'var(--ink-muted)' }}>
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      )
                    })}
                    {items.length > 3 && (
                      <p className="text-[10px] mt-1" style={{ color: 'var(--ink-soft)' }}>
                        +{items.length - 3} goal lain
                      </p>
                    )}
                  </div>
                )}
                <p className="text-[10px] mt-2 opacity-70" style={{ color: layer.color }}>
                  {layer.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Layer total summary */}
      <div
        className="mt-4 pt-3 border-t grid grid-cols-3 gap-2 text-[11px]"
        style={{ borderColor: 'var(--border-soft)' }}
      >
        {(['pelindung', 'pertumbuhan', 'mimpi'] as PyramidLayer[]).map((key) => {
          const layer = PYRAMID_LAYERS[key]
          const items = grouped[key]
          const total = items.reduce((s, g) => s + g.current_amount, 0)
          return (
            <div key={key}>
              <p style={{ color: 'var(--ink-soft)' }}>{layer.label}</p>
              <p
                className="num font-semibold mt-0.5"
                style={{ color: layer.color }}
              >
                {formatCurrency(total)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Mini pyramid badge showing where a single goal sits */
export function GoalLayerBadge({ category }: { category: string }) {
  const layer = categoryToPyramidLayer(category)
  const meta = PYRAMID_LAYERS[layer]
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
      style={{
        background: `${meta.color}15`,
        color: meta.color,
      }}
      title={meta.description}
    >
      {meta.emoji} {meta.label}
    </span>
  )
}
