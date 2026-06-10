'use client'

/**
 * Goal Pyramid — Behavioral Portfolio Theory (Shefrin & Statman 2000).
 * Goals dikelompokkan ke 3 tier risiko/horizon: Aman (fondasi) → Bertumbuh →
 * Ambisi (puncak). Bukan pajangan: ngitung tier mana yang harus diamankan dulu
 * (tier terbawah yang belum 100%) dan kasih 1 rekomendasi konkret.
 *
 * Penempatan tier dari categoryToPyramidLayer() (kategori × horizon), BUKAN
 * manual — dana darurat & kebutuhan dekat = Aman, keinginan = Ambisi.
 */

import { useMemo } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  PYRAMID_LAYERS,
  categoryToPyramidLayer,
  monthsUntil,
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

const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`

export function GoalPyramid({ goals, onSetor }: Props) {
  const t = useT()
  const layerLabel = (key: PyramidLayer) => t(`goal_pyramid.layer_${key}`)

  const { grouped, agg, focus, focusGoalId } = useMemo(() => {
    const grouped: Record<PyramidLayer, Goal[]> = { pelindung: [], pertumbuhan: [], mimpi: [] }
    for (const g of goals) grouped[categoryToPyramidLayer(g.category, monthsUntil(g.deadline))].push(g)

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
  let insight: { text: string; tone: 'focus' | 'warn' | 'done'; color: string; ink: string }
  if (!hasAman) {
    insight = {
      text: t('goal_pyramid.insight_no_safe'),
      tone: 'warn',
      color: 'var(--c-amber)',
      ink: 'var(--c-amber-ink)',
    }
  } else if (focus) {
    const meta = PYRAMID_LAYERS[focus]
    insight = {
      // Direktif pendek — angka gak diulang di kalimat, tier box di bawah
      // udah nunjukin % + nominalnya.
      text: `${t('goal_pyramid.insight_focus_pre')} ${layerLabel(focus)} ${t('goal_pyramid.insight_focus_post')}`,
      tone: 'focus',
      color: meta.color,
      ink: meta.ink,
    }
  } else {
    insight = {
      text: t('goal_pyramid.insight_all_full'),
      tone: 'done',
      color: 'var(--c-mint)',
      ink: 'var(--c-mint-ink)',
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
      <div className="mt-3 rounded-lg px-3 py-2.5" style={{ background: tint(insight.color, 9) }}>
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="size-4 mt-0.5 shrink-0" style={{ color: insight.ink }} />
          <p className="text-[12px] leading-snug" style={{ color: 'var(--ink)' }}>
            {insight.text}
          </p>
        </div>
        {insight.tone === 'focus' && focusGoalId && onSetor && (
          <button
            type="button"
            onClick={() => onSetor(focusGoalId)}
            className="mt-2.5 ml-[26px] inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
            style={{ color: insight.ink }}
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
              {/* Kotak netral — warna cukup di label + % (border cuma pas fokus).
                  Tint bg + border + teks berwarna sekaligus = 4 lapis encoding
                  buat satu informasi. */}
              <div
                className="rounded-lg border px-3 py-2.5 transition-all"
                style={{
                  width: widthFor[key],
                  background: 'var(--surface)',
                  borderColor: isFocus ? meta.color : 'var(--border-soft)',
                  boxShadow: isFocus ? `0 0 0 1px ${meta.color}` : 'none',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: meta.ink }}>
                    {layerLabel(key)}
                    {isFocus && <span className="ml-1.5 font-medium normal-case opacity-80">· {t('goal_pyramid.focus_here')}</span>}
                  </span>
                  <span className="num text-[11px] font-semibold shrink-0" style={{ color: meta.ink }}>
                    {items.length > 0 ? `${a.pct.toFixed(0)}%` : '—'}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>
                    {t('goal_pyramid.empty_tier')}
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
                        +{items.length - 4} {t('goal_pyramid.more_suffix')}
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
            <div key={key} className="min-w-0 text-[11px]">
              <p className="uppercase tracking-wide truncate" style={{ color: meta.ink }}>{layerLabel(key)}</p>
              <p className="num font-semibold truncate mt-0.5" style={{ color: 'var(--ink)' }}>
                {formatCurrency(agg[key].current)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
