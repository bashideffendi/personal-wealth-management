'use client'

/**
 * Money Flow Sankey — resep Stockbit (broker-distribution) dipindah ke money flow.
 *
 * KEPUTUSAN DESAIN (jangan diubah tanpa baca ini — hasil 4 ronde review user):
 *   1. Ronde 4 (2026-07-11, klarifikasi user): STRUKTUR HUB — kiri = SUMBER
 *      pemasukan (Gaji, Side Hustle, … cap 5), TENGAH = SATU pool
 *      "Total Pemasukan", kanan = tujuan (cap 7). Dua segmen aliran:
 *      sumber→pool lalu pool→tujuan. Anti-numpuk label tengah (masalah hub
 *      versi lama): label pool ditaruh di KANAN-ATAS bar dengan halo, bukan
 *      di tengah tinggi. Konservasi: Σsumber = pool = Σtujuan (pseudo-node
 *      Defisit/Belum Terpakai menyeimbangkan).
 *   2. Node = bar TIPIS 8px di tepi → pita aliran dapat ~95% lebar chart.
 *   3. Label PENDEK nempel node DI DALAM area chart (bukan margin samping):
 *      kiri = nama di pangkal pita; kanan = "nilai · nama" di kiri node.
 *      Teks pakai halo (paint-order stroke) biar kebaca di atas pita.
 *   4. Warna by GRUP (bukan rainbow per node): masuk=mint, belanja=coral,
 *      nabung+investasi=violet, penyeimbang/Lainnya=abu. Pita kecil (<3%
 *      total) selalu abu biar fokus ke aliran besar.
 *   5. Cap 7 node/sisi + "Lainnya (N)". Tipe modest — nol angka raksasa.
 *
 * Balancing: kalau income ≠ outflow, tambah pseudo-node ("Belum Terpakai" /
 * "Defisit Bulan Ini") biar kedua kolom sama tinggi — tanpa ini sisi kecil
 * keliatan putus.
 */

import { useMemo, type CSSProperties } from 'react'
import {
  Sankey,
  Tooltip,
  Layer,
  Rectangle,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'

export type FlowKind = 'income' | 'expense' | 'saving' | 'investment' | 'middle'

interface CategoryAmount {
  name: string
  amount: number
  kind: FlowKind
}

interface MoneyFlowSankeyProps {
  income: CategoryAmount[]      // left side — DIGABUNG jadi 1 pool (ronde 3)
  outflow: CategoryAmount[]     // right side: expense + saving + investment
  /** Label pool pemasukan kiri (default t('sankey.middleLabel') = "Total Pemasukan"). */
  middleLabel?: string
  surplusLabel?: string         // label for the balancing pseudo-outflow
  deficitLabel?: string         // label for the balancing pseudo-income
  height?: number | string
  emptyMessage?: string
  /** When true, render a more compact layout suited to <600px viewports. */
  compact?: boolean
}

// ─── Warna by grup (resep #4) ───────────────────────────────────────────
// saving+investment sengaja SATU grup violet di viz ini (grouping, bukan
// token global — di legend/kalender saving tetap amber).
const GROUP_NODE: Record<FlowKind, string> = {
  income:     'var(--c-mint)',
  expense:    'var(--c-coral)',
  saving:     'var(--c-violet)',
  investment: 'var(--c-violet)',
  middle:     'color-mix(in srgb, var(--ink) 38%, transparent)',
}
const GROUP_LINK: Record<FlowKind, string> = {
  income:     'color-mix(in srgb, var(--c-mint) 34%, transparent)',
  expense:    'color-mix(in srgb, var(--c-coral) 32%, transparent)',
  saving:     'color-mix(in srgb, var(--c-violet) 30%, transparent)',
  investment: 'color-mix(in srgb, var(--c-violet) 30%, transparent)',
  middle:     'color-mix(in srgb, var(--ink) 14%, transparent)',
}
const LINK_GRAY = 'color-mix(in srgb, var(--ink) 12%, transparent)'

function trunc(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

// Batasi jumlah node per sisi (anti-cramping, resep #5). Top (max-1) by-amount
// + sisanya digabung jadi "Lainnya (N)" abu-abu.
function capCats(list: CategoryAmount[], max: number): CategoryAmount[] {
  const sorted = [...list].sort((a, b) => b.amount - a.amount)
  if (sorted.length <= max) return sorted
  const head = sorted.slice(0, max - 1)
  const rest = sorted.slice(max - 1)
  const restSum = rest.reduce((s, c) => s + c.amount, 0)
  if (restSum > 0) head.push({ name: `Lainnya (${rest.length})`, amount: restSum, kind: 'middle' })
  return head
}

// ─── Custom node renderer ───────────────────────────────────────────────
interface SankeyNodeData {
  name: string
  value: number
  kind?: FlowKind
}

function makeRenderNode(compact: boolean, poolIdx: number) {
  const labelMax = compact ? 16 : 26
  const fontMain = compact ? 10 : 11.5
  const fontSub = compact ? 9 : 10
  const gap = 6
  // Halo biar teks kebaca di atas pita (label digambar DI DALAM chart).
  const halo: CSSProperties = {
    paintOrder: 'stroke',
    stroke: 'var(--surface)',
    strokeWidth: 3,
    strokeLinejoin: 'round',
  }

  return function renderNode(props: {
    x: number
    y: number
    width: number
    height: number
    index: number
    payload: SankeyNodeData
    containerWidth: number
  }) {
    const { x, y, width, height, payload, index } = props
    const kind: FlowKind = payload.kind ?? 'income'
    // Sisi ditentukan dari INDEKS node (kiri = sumber duluan di array), bukan
    // containerWidth — containerWidth bisa undefined/0 di render awal
    // (monthly report) → label kiri ke-anchor 'end' di tepi & kepotong (bug SS2).
    const isPool = index === poolIdx
    const isLeft = index < poolIdx

    // POOL tengah: label di KANAN-ATAS bar (bukan tengah tinggi) supaya tidak
    // numpuk dengan pita yang keluar sepanjang bar — resep #1 ronde 4.
    if (isPool) {
      return (
        <Layer>
          <Rectangle x={x} y={y} width={width} height={Math.max(height, 4)}
            fill={GROUP_NODE[kind]} fillOpacity={0.95} />
          <text x={x + width + gap} y={y + (compact ? 8 : 10)} textAnchor="start" dominantBaseline="middle"
            style={{ fontSize: fontMain, fontWeight: 700, fill: 'currentColor', ...halo }}>
            {trunc(payload.name, labelMax)}
          </text>
          <text x={x + width + gap} y={y + (compact ? 8 : 10) + (compact ? 11 : 13)} textAnchor="start" dominantBaseline="middle"
            style={{ fontSize: fontSub, fill: 'currentColor', opacity: 0.7, fontVariantNumeric: 'tabular-nums', ...halo }}>
            {formatCompactCurrency(payload.value)}
          </text>
        </Layer>
      )
    }
    // Label DI DALAM chart: kiri → kanan node (pangkal pita), kanan → kiri node.
    const labelX = isLeft ? x + width + gap : x - gap
    const anchor = isLeft ? 'start' : 'end'
    const cy = y + Math.max(height, 4) / 2
    // Dua baris cuma kalau node cukup tinggi; kalau pendek, satu baris.
    const twoLines = Math.max(height, 4) >= 26

    return (
      <Layer>
        <Rectangle
          x={x}
          y={y}
          width={width}
          height={Math.max(height, 4)}
          fill={GROUP_NODE[kind]}
          fillOpacity={0.95}
        />
        {twoLines ? (
          <>
            <text x={labelX} y={cy - 4} textAnchor={anchor} dominantBaseline="middle"
              style={{ fontSize: fontMain, fontWeight: 600, fill: 'currentColor', ...halo }}>
              {trunc(payload.name, labelMax)}
            </text>
            <text x={labelX} y={cy + (compact ? 7 : 9)} textAnchor={anchor} dominantBaseline="middle"
              style={{ fontSize: fontSub, fill: 'currentColor', opacity: 0.7, fontVariantNumeric: 'tabular-nums', ...halo }}>
              {formatCompactCurrency(payload.value)}
            </text>
          </>
        ) : (
          <text x={labelX} y={cy} textAnchor={anchor} dominantBaseline="middle"
            style={{ fontSize: fontSub, fontWeight: 600, fill: 'currentColor', ...halo }}>
            {isLeft
              ? trunc(payload.name, labelMax)
              : `${formatCompactCurrency(payload.value)} · ${trunc(payload.name, labelMax - 4)}`}
          </text>
        )}
      </Layer>
    )
  }
}

// ─── Custom link renderer ───────────────────────────────────────────────
interface SankeyLinkData {
  sourceX: number
  sourceY: number
  sourceControlX: number
  targetX: number
  targetY: number
  targetControlX: number
  linkWidth: number
  payload: {
    value?: number
    target: { kind?: FlowKind; name?: string }
    source: { kind?: FlowKind; name?: string }
  }
}

function makeRenderLink(total: number) {
  return function renderLink(props: SankeyLinkData) {
    const {
      sourceX, sourceY, sourceControlX,
      targetX, targetY, targetControlX,
      linkWidth, payload,
    } = props
    // Warna pita ikut TUJUAN (grup belanja/nabung), fallback sumber.
    // Pita kecil (<3% total) & penyeimbang → abu (resep #4).
    const targetKind = payload.target.kind
    const sourceKind = payload.source.kind
    const kind: FlowKind = (targetKind && targetKind !== 'middle')
      ? targetKind
      : (sourceKind && sourceKind !== 'middle') ? sourceKind : 'middle'
    const small = total > 0 && (payload.value ?? 0) / total < 0.03
    const stroke = small ? LINK_GRAY : GROUP_LINK[kind]

    return (
      <Layer>
        <path
          d={`
            M${sourceX},${sourceY}
            C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
          `}
          stroke={stroke}
          strokeWidth={Math.max(linkWidth, 1)}
          fill="none"
          strokeOpacity={1}
        />
      </Layer>
    )
  }
}

// ─── Main component ─────────────────────────────────────────────────────

export function MoneyFlowSankey({
  income,
  outflow,
  middleLabel: middleLabelProp,
  surplusLabel: surplusLabelProp,
  deficitLabel: deficitLabelProp,
  height = 360,
  emptyMessage: emptyMessageProp,
  compact = false,
}: MoneyFlowSankeyProps) {
  const t = useT()
  const incomePoolLabel = middleLabelProp ?? t('sankey.middleLabel')
  const surplusLabel = surplusLabelProp ?? t('sankey.surplusLabel')
  const deficitLabel = deficitLabelProp ?? t('sankey.deficitLabel')
  const emptyMessage = emptyMessageProp ?? t('sankey.emptyMessage')

  const built = useMemo(() => {
    // Ronde 4 (resep #1): sumber (cap 5) → pool tunggal → tujuan (cap 7).
    const incomeFiltered = capCats(income.filter((c) => c.amount > 0), 5)
    const outflowFiltered = capCats(outflow.filter((c) => c.amount > 0), 7)

    if (incomeFiltered.length === 0 && outflowFiltered.length === 0) return null

    const totalIn = incomeFiltered.reduce((s, c) => s + c.amount, 0)
    const totalOut = outflowFiltered.reduce((s, c) => s + c.amount, 0)

    // Balance dua segmen di pool: defisit = pseudo-SUMBER, surplus = pseudo-TUJUAN.
    const sources = [...incomeFiltered]
    const dests = [...outflowFiltered]
    if (totalIn > totalOut) {
      dests.push({ name: surplusLabel, amount: totalIn - totalOut, kind: 'middle' })
    } else if (totalOut > totalIn) {
      sources.push({ name: deficitLabel, amount: totalOut - totalIn, kind: 'middle' })
    }
    const total = Math.max(totalIn, totalOut)
    if (total <= 0) return null

    // Nodes: sumber (kiri) | POOL (tengah) | tujuan (kanan).
    const nodes: { name: string; kind: FlowKind }[] = []
    sources.forEach((c) => nodes.push({ name: c.name, kind: c.kind }))
    const poolIdx = nodes.length
    nodes.push({ name: incomePoolLabel, kind: 'income' })
    const destStartIdx = nodes.length
    dests.forEach((c) => nodes.push({ name: c.name, kind: c.kind }))

    // Links dua segmen — nilai apa adanya (konservasi di pool otomatis):
    // sumber_i → pool = amount_i; pool → tujuan_j = amount_j.
    const links: { source: number; target: number; value: number }[] = []
    sources.forEach((c, i) => {
      if (c.amount >= 0.5) links.push({ source: i, target: poolIdx, value: c.amount })
    })
    dests.forEach((c, j) => {
      if (c.amount >= 0.5) links.push({ source: poolIdx, target: destStartIdx + j, value: c.amount })
    })

    if (links.length === 0) return null
    return { data: { nodes, links }, total, poolIdx }
  }, [income, outflow, incomePoolLabel, surplusLabel, deficitLabel])

  if (!built) {
    return (
      <p className="text-[13px] text-center py-10 px-6" style={{ color: 'var(--ink-soft)' }}>
        {emptyMessage}
      </p>
    )
  }

  // Margin tipis — label digambar DI DALAM chart (resep #2/#3), pita dapat
  // hampir seluruh lebar. Bukan margin 130px kiri-kanan kayak versi hub dulu.
  const margin = compact
    ? { top: 8, right: 10, bottom: 8, left: 10 }
    : { top: 12, right: 14, bottom: 12, left: 14 }

  const renderNode = makeRenderNode(compact, built.poolIdx)
  const renderLink = makeRenderLink(built.total)

  return (
    <div
      className="rounded-xl"
      style={{ width: '100%', height, color: 'var(--ink)' }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={built.data}
          nodePadding={compact ? 14 : 22}
          nodeWidth={8}
          iterations={48}
          margin={margin}
          link={renderLink as never}
          node={renderNode as never}
        >
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0]
              const data = p.payload as {
                name?: string
                source?: { name: string }
                target?: { name: string }
                value?: number
                payload?: { value?: number }
              }
              if (data.source && data.target) {
                return (
                  <div
                    className="rounded-md border px-2.5 py-1.5 text-xs shadow-[var(--card-shadow)]"
                    style={{
                      background: 'var(--surface)',
                      borderColor: 'var(--border)',
                      color: 'var(--ink)',
                    }}
                  >
                    <p className="font-medium">
                      {data.source.name} → {data.target.name}
                    </p>
                    <p className="num tabular mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                      {formatCurrency(data.payload?.value ?? data.value ?? 0)}
                    </p>
                  </div>
                )
              }
              // Tap node → total node itu (akses full digit di mobile).
              if (data.name != null && (data.value != null || data.payload?.value != null)) {
                return (
                  <div
                    className="rounded-md border px-2.5 py-1.5 text-xs shadow-[var(--card-shadow)]"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
                  >
                    <p className="font-medium">{data.name}</p>
                    <p className="num tabular mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                      {formatCurrency(data.payload?.value ?? data.value ?? 0)}
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  )
}
