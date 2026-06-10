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
import { formatCompactCurrency } from '@/lib/utils'
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

  // Direktif pendek (≤6 kata) — angka SENGAJA gak ada di kalimat: kolom tier
  // di bawah udah nunjukin nominal + %, kalimat gak boleh kerja dobel.
  let insightText: string
  let tone: 'focus' | 'warn' | 'done'
  if (!hasAman) {
    insightText = t('goal_pyramid.insight_no_safe')
    tone = 'warn'
  } else if (focus) {
    insightText = `${t('goal_pyramid.insight_focus_pre')} ${layerLabel(focus)} ${t('goal_pyramid.insight_focus_post')}`
    tone = 'focus'
  } else {
    insightText = t('goal_pyramid.insight_all_full')
    tone = 'done'
  }

  return (
    <div className="px-5 sm:px-7 pt-5 pb-6 border-b" style={{ borderColor: 'var(--border)' }}>
      <p
        className="text-[10px] font-semibold tracking-[0.22em] uppercase flex items-center gap-1.5"
        style={{ color: 'var(--ink-soft)' }}
      >
        {t('goal_pyramid.title')}
        <EduTip topic="goal-based-investing" side="bottom" />
      </p>

      {/* Direktif = momen personality: serif italic GEDE, kebaca sekali lirik.
          Bukan paragraf kecil di dalam kotak krem. */}
      <p
        className="mt-1.5 leading-snug"
        style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(20px, 2.1vw, 25px)', color: 'var(--ink)' }}
      >
        {tone === 'warn' && (
          <span aria-hidden className="inline-block size-2 rounded-full mr-2.5 align-middle" style={{ background: 'var(--c-amber)' }} />
        )}
        {tone === 'done' && (
          <span aria-hidden className="inline-block size-2 rounded-full mr-2.5 align-middle" style={{ background: 'var(--c-mint)' }} />
        )}
        {insightText}
        {tone === 'focus' && focusGoalId && onSetor && (
          <button
            type="button"
            onClick={() => onSetor(focusGoalId)}
            className="ml-3 align-middle inline-flex items-center gap-1 text-[13px] font-semibold not-italic underline underline-offset-4 decoration-[1.5px] hover:opacity-70 transition"
            style={{ fontFamily: 'var(--font-sans, inherit)', color: 'var(--ink)' }}
          >
            {t('goal_pyramid.deposit_to_tier')} <ArrowRight className="size-3.5" />
          </button>
        )}
      </p>

      {/* Tiga tier selebar band — gauge memenuhi tiap kolom, sejajar jadi satu
          garis spine (bahasa visual sama dengan baris goal: trace + solid +
          jarum). Fokus = ink pekat, sisanya tinta lembut. */}
      <div className="mt-5 grid grid-cols-3 gap-5 sm:gap-10">
        {ORDER.map((key) => {
          const a = agg[key]
          const isFocus = focus === key
          const hasGoals = grouped[key].length > 0
          const mainColor = isFocus ? 'var(--ink)' : 'var(--ink-soft)'
          const w = Math.min(a.pct, 100)
          return (
            <div key={key} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[10px] font-semibold tracking-[0.14em] uppercase truncate" style={{ color: mainColor }}>
                  {layerLabel(key)}
                  {isFocus && <span className="ml-1 normal-case tracking-normal font-medium">· {t('goal_pyramid.focus_here')}</span>}
                </p>
                <p className="num text-[12px] font-semibold shrink-0" style={{ color: mainColor }}>
                  {hasGoals ? `${a.pct.toFixed(0)}%` : '—'}
                </p>
              </div>
              <div className="mt-2 relative h-[12px]" aria-hidden>
                <div
                  className="absolute inset-x-0 bottom-[2px] h-[6px]"
                  style={{ background: 'repeating-linear-gradient(90deg, var(--border) 0 2px, transparent 2px 7px)' }}
                />
                {hasGoals && (
                  <>
                    <div className="absolute left-0 bottom-[2px] h-[6px]" style={{ width: `${w}%`, background: mainColor }} />
                    <div className="absolute bottom-0 h-[12px] w-[2px]" style={{ left: `calc(${w}% - 1px)`, background: mainColor }} />
                  </>
                )}
              </div>
              <p className="num text-[12px] mt-2 truncate" style={{ color: hasGoals ? 'var(--ink-muted)' : 'var(--ink-soft)' }}>
                {hasGoals
                  ? <><span className="font-semibold" style={{ color: 'var(--ink)' }}>{formatCompactCurrency(a.current)}</span> / {formatCompactCurrency(a.target)}</>
                  : t('goal_pyramid.empty_tier')}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
