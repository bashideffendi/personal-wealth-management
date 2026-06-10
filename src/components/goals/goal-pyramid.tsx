'use client'

/**
 * Direktif Prioritas — Behavioral Portfolio Theory (Shefrin & Statman 2000):
 * tiga tier risiko (Aman → Bertumbuh → Ambisi), amankan fondasi dulu.
 *
 * Keputusan desain final: LOGIKA-nya yang bernilai (tier terbawah yang belum
 * 100% = fokus → satu rekomendasi + CTA setor), bukan gambarnya. Tiga
 * inkarnasi visual (kotak bertumpuk, kolom gauge, SVG segitiga) semuanya
 * berebut perhatian dengan data di bawahnya. Sekarang dia SATU kalimat
 * direktif di antara hero dan baris goal — suara penasihat, bukan diagram.
 * Penempatan tier tetap dari categoryToPyramidLayer() (kategori × horizon).
 */

import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
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

// Bottom → top (fondasi dulu).
const ORDER: PyramidLayer[] = ['pelindung', 'pertumbuhan', 'mimpi']

const goalPct = (g: Goal) => (g.target_amount > 0 ? g.current_amount / g.target_amount : 1)

export function GoalPyramid({ goals, onSetor }: Props) {
  const t = useT()

  const { focus, focusGoalId, hasAman } = useMemo(() => {
    const grouped: Record<PyramidLayer, Goal[]> = { pelindung: [], pertumbuhan: [], mimpi: [] }
    for (const g of goals) grouped[categoryToPyramidLayer(g.category, monthsUntil(g.deadline))].push(g)

    const pctOf = (k: PyramidLayer) => {
      const target = grouped[k].reduce((s, g) => s + g.target_amount, 0)
      const current = grouped[k].reduce((s, g) => s + g.current_amount, 0)
      return target > 0 ? (current / target) * 100 : 0
    }
    const focus = ORDER.find((k) => grouped[k].length > 0 && pctOf(k) < 100) ?? null
    const focusGoalId = focus
      ? (grouped[focus].filter((g) => goalPct(g) < 1).sort((a, b) => goalPct(a) - goalPct(b))[0]?.id ?? null)
      : null
    return { focus, focusGoalId, hasAman: grouped.pelindung.length > 0 }
  }, [goals])

  if (goals.length === 0) return null

  let insightText: string
  let tone: 'focus' | 'warn' | 'done'
  if (!hasAman) {
    insightText = t('goal_pyramid.insight_no_safe')
    tone = 'warn'
  } else if (focus) {
    insightText = `${t('goal_pyramid.insight_focus_pre')} ${t(`goal_pyramid.layer_${focus}`)} ${t('goal_pyramid.insight_focus_post')}`
    tone = 'focus'
  } else {
    insightText = t('goal_pyramid.insight_all_full')
    tone = 'done'
  }

  return (
    <div className="px-5 sm:px-7 py-4 border-b flex items-baseline gap-2.5" style={{ borderColor: 'var(--border)' }}>
      <span
        aria-hidden
        className="size-2 rounded-full shrink-0 self-center"
        style={{
          background: tone === 'warn' ? 'var(--c-amber)' : tone === 'done' ? 'var(--c-mint)' : 'var(--ink)',
        }}
      />
      <p
        className="leading-snug min-w-0"
        style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(17px, 1.6vw, 20px)', color: 'var(--ink)' }}
      >
        {insightText}
        {tone === 'focus' && focusGoalId && onSetor && (
          <button
            type="button"
            onClick={() => onSetor(focusGoalId)}
            className="ml-3 align-middle inline-flex items-center gap-1 text-[12.5px] font-semibold not-italic underline underline-offset-4 decoration-[1.5px] hover:opacity-70 transition whitespace-nowrap"
            style={{ color: 'var(--ink)' }}
          >
            {t('goal_pyramid.deposit_to_tier')} <ArrowRight className="size-3.5" />
          </button>
        )}
        <span className="ml-2 align-middle not-italic inline-flex"><EduTip topic="goal-based-investing" side="bottom" /></span>
      </p>
    </div>
  )
}
