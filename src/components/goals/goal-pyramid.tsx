'use client'

/**
 * Prioritas (ex Goal Pyramid) — Behavioral Portfolio Theory (Shefrin & Statman
 * 2000), tiga tier risiko: Aman (fondasi) → Bertumbuh → Ambisi.
 *
 * Logikanya dipertahankan (tier terbawah yang belum 100% = fokus, plus satu
 * rekomendasi konkret + CTA setor) — tapi GAMBAR piramidanya dibuang. Tiga
 * kotak bertumpuk makin-lebar itu dekorasi; isinya cuma "tier mana yang butuh
 * perhatian". Sekarang dia band tipografis di kepala lembar tujuan: kalimat
 * rekomendasi + ringkasan tiga tier dengan hairline gauge. Penempatan tier
 * dari categoryToPyramidLayer() (kategori × horizon).
 */

import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
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
  /** Buka dialog setor buat 1 goal (dipakai CTA "Setor ke tier ini"). */
  onSetor?: (goalId: string) => void
}

// Bottom → top (fondasi dulu) — urutan baca kiri → kanan.
const ORDER: PyramidLayer[] = ['pelindung', 'pertumbuhan', 'mimpi']

const goalPct = (g: Goal) => (g.target_amount > 0 ? g.current_amount / g.target_amount : 1)

export function GoalPyramid({ goals, onSetor }: Props) {
  const t = useT()
  const layerLabel = (key: PyramidLayer) => t(`goal_pyramid.layer_${key}`)

  const { grouped, agg, focus, focusGoalId } = useMemo(() => {
    const grouped: Record<PyramidLayer, Goal[]> = { pelindung: [], pertumbuhan: [], mimpi: [] }
    for (const g of goals) grouped[categoryToPyramidLayer(g.category, monthsUntil(g.deadline))].push(g)

    const agg = {} as Record<PyramidLayer, { current: number; target: number; pct: number }>
    for (const key of ORDER) {
      const current = grouped[key].reduce((s, g) => s + g.current_amount, 0)
      const target = grouped[key].reduce((s, g) => s + g.target_amount, 0)
      agg[key] = { current, target, pct: target > 0 ? (current / target) * 100 : 0 }
    }

    // Tier fokus = tier terbawah yang punya goal tapi belum 100%.
    const focus = ORDER.find((k) => grouped[k].length > 0 && agg[k].pct < 100) ?? null
    // Goal yang paling ketinggalan di tier fokus → target setoran.
    const focusGoalId = focus
      ? (grouped[focus].filter((g) => goalPct(g) < 1).sort((a, b) => goalPct(a) - goalPct(b))[0]?.id ?? null)
      : null
    return { grouped, agg, focus, focusGoalId }
  }, [goals])

  if (goals.length === 0) return null

  const hasAman = grouped.pelindung.length > 0

  // Insight actionable — 1 kalimat yang ngarahin keputusan.
  let insightText: string
  let tone: 'focus' | 'warn' | 'done'
  if (!hasAman) {
    insightText = t('goal_pyramid.insight_no_safe')
    tone = 'warn'
  } else if (focus) {
    insightText = `${t('goal_pyramid.insight_secure_prefix')} ${layerLabel(focus)} ${t('goal_pyramid.insight_secure_mid')} ${agg[focus].pct.toFixed(0)}% ${t('goal_pyramid.insight_secure_collected')} (${formatCurrency(agg[focus].current)} ${t('goal_pyramid.insight_of')} ${formatCurrency(agg[focus].target)}). ${t('goal_pyramid.insight_prioritize')}`
    tone = 'focus'
  } else {
    insightText = t('goal_pyramid.insight_all_full')
    tone = 'done'
  }

  return (
    <div className="px-5 sm:px-7 py-5" style={{ background: 'var(--surface-2)' }}>
      <p
        className="text-[10px] font-semibold tracking-[0.22em] uppercase flex items-center gap-1.5"
        style={{ color: 'var(--ink-soft)' }}
      >
        {t('goal_pyramid.title')}
        <EduTip topic="goal-based-investing" side="bottom" />
      </p>

      {/* Rekomendasi — kalimat, bukan kotak warna. Tone cuma di titik kecil. */}
      <div className="mt-2 flex items-start gap-2">
        <span
          aria-hidden
          className="size-[7px] rounded-full mt-[5px] shrink-0"
          style={{
            background:
              tone === 'warn' ? 'var(--c-amber)' : tone === 'done' ? 'var(--c-mint)' : 'var(--ink)',
          }}
        />
        <p className="text-[13px] leading-snug max-w-2xl" style={{ color: 'var(--ink)' }}>
          {insightText}
          {tone === 'focus' && focusGoalId && onSetor && (
            <button
              type="button"
              onClick={() => onSetor(focusGoalId)}
              className="ml-2 inline-flex items-center gap-1 text-[12px] font-semibold underline underline-offset-4 decoration-[1.5px] hover:opacity-70 transition"
              style={{ color: 'var(--ink)' }}
            >
              {t('goal_pyramid.deposit_to_tier')} <ArrowRight className="size-3" />
            </button>
          )}
        </p>
      </div>

      {/* Tiga tier — kolom tipografis dengan hairline gauge. Fokus = ink pekat. */}
      <div className="mt-4 grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl">
        {ORDER.map((key) => {
          const a = agg[key]
          const isFocus = focus === key
          const hasGoals = grouped[key].length > 0
          const mainColor = isFocus ? 'var(--ink)' : 'var(--ink-soft)'
          return (
            <div key={key} className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.14em] uppercase truncate" style={{ color: mainColor }}>
                {layerLabel(key)}
                {isFocus && <span className="ml-1 normal-case tracking-normal font-medium">· {t('goal_pyramid.focus_here')}</span>}
              </p>
              <p className="num text-[13px] mt-1 truncate" style={{ color: hasGoals ? 'var(--ink)' : 'var(--ink-soft)', fontWeight: isFocus ? 600 : 400 }}>
                {hasGoals ? formatCurrency(a.current) : '—'}
                {hasGoals && <span className="text-[11px] font-normal" style={{ color: 'var(--ink-soft)' }}> · {a.pct.toFixed(0)}%</span>}
              </p>
              <div className="mt-1.5 h-px w-full relative" style={{ background: 'var(--border)' }}>
                {hasGoals && (
                  <div
                    className="absolute left-0 top-[-1px] h-[3px]"
                    style={{ width: `${Math.min(a.pct, 100)}%`, background: mainColor }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
