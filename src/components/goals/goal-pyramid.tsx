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

  // ── Piramida SVG — segitiga BENERAN (diagram laporan tahunan), bukan tiga
  // kotak bertumpuk. Tiga strata exploded; tiap strata terisi kiri→kanan
  // sesuai progres tier-nya. Fokus = tinta pekat; tier kosong = outline dashed.
  const APEX_Y = 8
  const BASE_Y = 150
  const CX = 100
  const HALF = 92
  const H = BASE_Y - APEX_Y
  const halfAt = (y: number) => (HALF * (y - APEX_Y)) / H
  const yCuts = [APEX_Y + H / 3, APEX_Y + (2 * H) / 3]
  // top→bottom: mimpi (puncak) → pelindung (fondasi)
  const SLICES: Array<{ key: PyramidLayer; pts: Array<[number, number]>; dy: number }> = [
    { key: 'mimpi', dy: -6, pts: [[CX, APEX_Y], [CX + halfAt(yCuts[0]), yCuts[0]], [CX - halfAt(yCuts[0]), yCuts[0]]] },
    { key: 'pertumbuhan', dy: 0, pts: [[CX + halfAt(yCuts[0]), yCuts[0]], [CX + halfAt(yCuts[1]), yCuts[1]], [CX - halfAt(yCuts[1]), yCuts[1]], [CX - halfAt(yCuts[0]), yCuts[0]]] },
    { key: 'pelindung', dy: 6, pts: [[CX + halfAt(yCuts[1]), yCuts[1]], [CX + HALF, BASE_Y], [CX - HALF, BASE_Y], [CX - halfAt(yCuts[1]), yCuts[1]]] },
  ]

  return (
    <div className="px-5 sm:px-7 pt-5 pb-6 border-b" style={{ borderColor: 'var(--border)' }}>
      <p
        className="text-[10px] font-semibold tracking-[0.22em] uppercase flex items-center gap-1.5"
        style={{ color: 'var(--ink-soft)' }}
      >
        {t('goal_pyramid.title')}
        <EduTip topic="goal-based-investing" side="bottom" />
      </p>

      <div className="mt-3 grid md:grid-cols-[200px_minmax(0,1fr)] gap-x-10 gap-y-4 items-center">
        {/* Piramida — anchor fokal halaman */}
        <svg viewBox="0 0 200 162" className="w-[168px] md:w-full max-w-[200px] mx-auto md:mx-0" aria-hidden>
          {SLICES.map(({ key, pts, dy }) => {
            const isFocus = focus === key
            const hasGoals = grouped[key].length > 0
            const pct = Math.min(agg[key].pct, 100)
            const xs = pts.map((p) => p[0])
            const ys = pts.map((p) => p[1])
            const minX = Math.min(...xs)
            const minY = Math.min(...ys)
            const fillW = (Math.max(...xs) - minX) * (pct / 100)
            const poly = pts.map((p) => p.join(',')).join(' ')
            const tone = isFocus ? 'var(--ink)' : 'color-mix(in srgb, var(--ink) 32%, transparent)'
            return (
              <g key={key} transform={`translate(0 ${dy})`}>
                <clipPath id={`gp-${key}`}><polygon points={poly} /></clipPath>
                {hasGoals && fillW > 0 && (
                  <rect
                    x={minX} y={minY} width={fillW} height={Math.max(...ys) - minY}
                    clipPath={`url(#gp-${key})`} fill={tone}
                  />
                )}
                <polygon
                  points={poly}
                  fill="none"
                  stroke={isFocus ? 'var(--ink)' : 'var(--ink-soft)'}
                  strokeWidth={isFocus ? 1.75 : 1}
                  strokeDasharray={hasGoals ? undefined : '3 4'}
                  strokeLinejoin="round"
                />
              </g>
            )
          })}
        </svg>

        {/* Direktif + tabel tier — figur duduk di samping bentuknya */}
        <div className="min-w-0">
          <p
            className="leading-snug"
            style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(21px, 2.2vw, 27px)', color: 'var(--ink)' }}
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
                style={{ color: 'var(--ink)' }}
              >
                {t('goal_pyramid.deposit_to_tier')} <ArrowRight className="size-3.5" />
              </button>
            )}
          </p>

          <div className="mt-3.5 max-w-md">
            {SLICES.map(({ key }) => {
              const a = agg[key]
              const isFocus = focus === key
              const hasGoals = grouped[key].length > 0
              const mainColor = isFocus ? 'var(--ink)' : 'var(--ink-soft)'
              return (
                <div
                  key={key}
                  className="flex items-baseline gap-3 py-[5px] border-t first:border-t-0"
                  style={{ borderColor: 'var(--border-soft)' }}
                >
                  {/* Fokus ditandai bobot tinta + piramida — gak butuh teks tambahan. */}
                  <p className="w-[110px] shrink-0 text-[10px] font-semibold tracking-[0.14em] uppercase truncate" style={{ color: mainColor }}>
                    {layerLabel(key)}
                  </p>
                  <p className="num text-[12.5px] flex-1 truncate" style={{ color: hasGoals ? 'var(--ink-muted)' : 'var(--ink-soft)' }}>
                    {hasGoals
                      ? <><span className="font-semibold" style={{ color: 'var(--ink)' }}>{formatCompactCurrency(a.current)}</span> / {formatCompactCurrency(a.target)}</>
                      : t('goal_pyramid.empty_tier')}
                  </p>
                  <p className="num text-[12.5px] font-semibold shrink-0 text-right w-10" style={{ color: mainColor }}>
                    {hasGoals ? `${a.pct.toFixed(0)}%` : '—'}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
