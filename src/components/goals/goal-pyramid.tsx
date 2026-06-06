'use client'

/**
 * Goal Pyramid — Behavioral Portfolio Theory (Shefrin & Statman 2000).
 * Goals dikelompokkan ke 3 tier risiko/horizon: Aman (fondasi) → Bertumbuh →
 * Ambisi (puncak). Bukan pajangan: ngitung tier mana yang harus diamankan dulu
 * (tier terbawah yang belum 100%) dan kasih 1 rekomendasi konkret.
 *
 * Penempatan tier dari categoryToPyramidLayer() (logika app), BUKAN manual —
 * jadi konsisten + bener (dana darurat/pendidikan = Aman, liburan = Ambisi).
 */

import { useMemo } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  PYRAMID_LAYERS,
  categoryToPyramidLayer,
  type PyramidLayer,
} from '@/lib/goal-probability'
import { EduTip } from '@/components/edu/edu-tip'
import { useT } from '@/lib/i18n/context'

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
  /** Buka dialog setor buat 1 goal (dipakai tombol "Setor ke tier ini"). */
  onSetor?: (goalId: string) => void
}

// Bottom → top (fondasi dulu). Render dibalik (puncak di atas).
const BOTTOM_UP: PyramidLayer[] = ['pelindung', 'pertumbuhan', 'mimpi']

const goalPct = (g: Goal) => (g.target_amount > 0 ? g.current_amount / g.target_amount : 1)

export function GoalPyramid({ goals, onSetor }: Props) {
  const t = useT()
  const { grouped, agg, focus, focusGoalId } = useMemo(() => {
    const grouped: Record<PyramidLayer, Goal[]> = { pelindung: [], pertumbuhan: [], mimpi: [] }
    for (const g of goals) grouped[categoryToPyramidLayer(g.category)].push(g)

    const agg = {} as Record<PyramidLayer, { current: number; target: number; pct: number }>
    for (const key of BOTTOM_UP) {
      const current = grouped[key].reduce((s, g) => s + g.current_amount, 0)
      const target = grouped[key].reduce((s, g) => s + g.target_amount, 0)
      agg[key] = { current, target, pct: target > 0 ? (current / target) * 100 : 0 }
    }

    // Tier fokus = tier terbawah yang punya goal tapi belum 100%.
    const focus = BOTTOM_UP.find((k) => grouped[k].length > 0 && agg[k].pct < 100) ?? null
    // Goal yang paling ketinggalan di tier fokus → target setoran.
    const focusGoalId = focus
      ? (grouped[focus].filter((g) => goalPct(g) < 1).sort((a, b) => goalPct(a) - goalPct(b))[0]?.id ?? null)
      : null
    return { grouped, agg, focus, focusGoalId }
  }, [goals])

  if (goals.length === 0) return null

  const hasAman = grouped.pelindung.length > 0

  // Insight actionable — 1 kalimat yang ngarahin keputusan.
  let insight: { text: string; tone: 'focus' | 'warn' | 'done'; color: string }
  if (!hasAman) {
    insight = {
      text: t('goal_pyramid.insight_no_safe'),
      tone: 'warn',
      color: '#F59E0B',
    }
  } else if (focus) {
    const meta = PYRAMID_LAYERS[focus]
    insight = {
      text: `${t('goal_pyramid.insight_secure_prefix')} ${meta.label} ${t('goal_pyramid.insight_secure_mid')} ${agg[focus].pct.toFixed(0)}% ${t('goal_pyramid.insight_secure_collected')} (${formatCurrency(agg[focus].current)} ${t('goal_pyramid.insight_of')} ${formatCurrency(agg[focus].target)}). ${t('goal_pyramid.insight_prioritize')}`,
      tone: 'focus',
      color: meta.color,
    }
  } else {
    insight = {
      text: t('goal_pyramid.insight_all_full'),
      tone: 'done',
      color: '#10B981',
    }
  }

  // Lebar pyramid: puncak sempit → dasar lebar.
  const widthFor: Record<PyramidLayer, string> = {
    mimpi: '70%',
    pertumbuhan: '85%',
    pelindung: '100%',
  }

  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase flex items-center gap-1.5" style={{ color: 'var(--ink-soft)' }}>
            {t('goal_pyramid.title')}
            <EduTip topic="goal-based-investing" side="bottom" />
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
            {t('goal_pyramid.subtitle')}
          </p>
        </div>
      </div>

      {/* Insight actionable */}
      <div className="mt-3 rounded-lg px-3 py-2.5" style={{ background: `${insight.color}14` }}>
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="size-4 mt-0.5 shrink-0" style={{ color: insight.color }} />
          <p className="text-[12px] leading-snug" style={{ color: 'var(--ink)' }}>
            {insight.text}
          </p>
        </div>
        {insight.tone === 'focus' && focusGoalId && onSetor && (
          <button
            type="button"
            onClick={() => onSetor(focusGoalId)}
            className="mt-2.5 ml-[26px] inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
            style={{ color: insight.color }}
          >
            {t('goal_pyramid.deposit_to_tier')} <ArrowRight className="size-3.5" />
          </button>
        )}
      </div>

      {/* Tiers — puncak (mimpi) di atas, dasar (pelindung) di bawah */}
      <div className="mt-4 space-y-1.5">
        {(['mimpi', 'pertumbuhan', 'pelindung'] as PyramidLayer[]).map((key) => {
          const meta = PYRAMID_LAYERS[key]
          const items = grouped[key]
          const a = agg[key]
          const isFocus = focus === key
          return (
            <div key={key} className="flex justify-center">
              <div
                className="rounded-lg border px-3 py-2.5 transition-all"
                style={{
                  width: widthFor[key],
                  background: `${meta.color}0F`,
                  borderColor: isFocus ? meta.color : `${meta.color}33`,
                  boxShadow: isFocus ? `0 0 0 1px ${meta.color}` : 'none',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
                    {meta.label}
                    {isFocus && <span className="ml-1.5 font-medium normal-case opacity-80">· fokus di sini</span>}
                  </span>
                  <span className="num text-[11px] font-semibold shrink-0" style={{ color: meta.color }}>
                    {items.length > 0 ? `${a.pct.toFixed(0)}%` : '—'}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>
                    Belum ada tujuan.
                  </p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    {items.slice(0, 4).map((g) => (
                      <span key={g.id} className="text-[11px] truncate" style={{ color: 'var(--ink-muted)' }}>
                        {g.name}
                      </span>
                    ))}
                    {items.length > 4 && (
                      <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                        +{items.length - 4} lain
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer total per tier */}
      <div
        className="mt-3 pt-3 border-t grid grid-cols-3 gap-2"
        style={{ borderColor: 'var(--border-soft)' }}
      >
        {BOTTOM_UP.map((key) => {
          const meta = PYRAMID_LAYERS[key]
          return (
            <div key={key} className="flex items-center gap-1.5 text-[11px]">
              <ArrowRight className="size-3 shrink-0" style={{ color: meta.color }} />
              <span className="num font-semibold truncate" style={{ color: 'var(--ink)' }}>
                {formatCurrency(agg[key].current)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Mini badge — di mana satu goal duduk di piramida. */
export function GoalLayerBadge({ category }: { category: string }) {
  const layer = categoryToPyramidLayer(category)
  const meta = PYRAMID_LAYERS[layer]
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: `${meta.color}1A`, color: meta.color }}
      title={meta.description}
    >
      {meta.label}
    </span>
  )
}
