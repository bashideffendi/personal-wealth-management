'use client'

/**
 * Money Flow Sankey — Stockbit-style bipartite flow viz for personal finance.
 *
 *   Income source (left)  ──────►  Spending category (right)
 *
 * No middle hub: every income source connects DIRECTLY to every outflow
 * category, with link width = income's pro-rata share of that outflow.
 * (e.g. if Gaji is 80% of total income and Bonus is 20%, then for a
 * Rp 1M Makanan expense, the diagram draws Gaji→Makanan at 800K and
 * Bonus→Makanan at 200K.)
 *
 * Why bipartite over a middle "Total" hub:
 *   - Smaller income sources don't visually orphan into a thin arc that
 *     curves into a central node — they get direct lines to everywhere.
 *   - Matches the Stockbit broker-flow pattern the user referenced.
 *   - Reads honestly: every rupiah of income funds every rupiah of
 *     outflow proportionally.
 *
 * Categories colored consistently:
 *   - Income     → emerald
 *   - Expense    → coral
 *   - Saving     → amber
 *   - Investment → sky
 */

import { useMemo } from 'react'
import {
  Sankey,
  Tooltip,
  Layer,
  Rectangle,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

export type FlowKind = 'income' | 'expense' | 'saving' | 'investment'

interface CategoryAmount {
  name: string
  amount: number
  kind: FlowKind
}

interface MoneyFlowSankeyProps {
  income: CategoryAmount[]      // left side
  outflow: CategoryAmount[]     // right side: expense + saving + investment
  height?: number
  emptyMessage?: string
  /** When true, render a more compact layout suited to <600px viewports. */
  compact?: boolean
}

// ─── Color palette ──────────────────────────────────────────────────────
const COLORS: Record<FlowKind, { node: string; link: string }> = {
  income:     { node: '#10B981', link: 'rgba(16, 185, 129, 0.42)' }, // emerald
  expense:    { node: '#EF4444', link: 'rgba(239, 68, 68, 0.40)' },  // coral
  saving:     { node: '#F59E0B', link: 'rgba(245, 158, 11, 0.42)' }, // amber
  investment: { node: '#0EA5E9', link: 'rgba(14, 165, 233, 0.42)' }, // sky
}

// Truncate long names so the label column doesn't blow out the layout
function trunc(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

// ─── Custom node renderer ───────────────────────────────────────────────
// In recharts Sankey, the original data props (kind) are merged onto the
// payload object directly — NOT under payload.payload.
interface SankeyNodeData {
  name: string
  value: number
  kind?: FlowKind
}

function makeRenderNode(compact: boolean) {
  const labelMax = compact ? 14 : 22
  const fontMain = compact ? 10 : 11
  const fontSub = compact ? 9 : 10
  const labelGap = compact ? 6 : 8

  return function renderNode(props: {
    x: number
    y: number
    width: number
    height: number
    index: number
    payload: SankeyNodeData
    containerWidth: number
  }) {
    const { x, y, width, height, payload, containerWidth } = props
    const kind: FlowKind = payload.kind ?? 'income'
    const color = COLORS[kind].node
    const isLeft = x < containerWidth / 2
    const labelX = isLeft ? x - labelGap : x + width + labelGap
    const anchor = isLeft ? 'end' : 'start'

    return (
      <Layer>
        <Rectangle
          x={x}
          y={y}
          width={width}
          height={Math.max(height, 4)}
          fill={color}
          fillOpacity={0.95}
        />
        <text
          x={labelX}
          y={y + height / 2 - 4}
          textAnchor={anchor}
          dominantBaseline="middle"
          style={{
            fontSize: fontMain,
            fontWeight: 600,
            fill: 'currentColor',
          }}
        >
          {trunc(payload.name, labelMax)}
        </text>
        <text
          x={labelX}
          y={y + height / 2 + (compact ? 7 : 9)}
          textAnchor={anchor}
          dominantBaseline="middle"
          style={{
            fontSize: fontSub,
            fill: 'currentColor',
            opacity: 0.65,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatCurrency(payload.value)}
        </text>
      </Layer>
    )
  }
}

// ─── Custom link renderer ───────────────────────────────────────────────
// Color each link by its TARGET kind — the destination determines what
// "kind" of flow this is (an expense flow vs a saving flow vs an
// investment flow). Income on left always source-emerald isn't useful
// since you already see it from the source bar.
interface SankeyLinkData {
  sourceX: number
  sourceY: number
  sourceControlX: number
  targetX: number
  targetY: number
  targetControlX: number
  linkWidth: number
  payload: {
    target: { kind?: FlowKind; name?: string; value?: number }
    source: { kind?: FlowKind; name?: string; value?: number }
    value?: number
  }
}

function renderLink(props: SankeyLinkData) {
  const {
    sourceX, sourceY, sourceControlX,
    targetX, targetY, targetControlX,
    linkWidth, payload,
  } = props
  const kind: FlowKind = payload.target.kind ?? payload.source.kind ?? 'expense'
  const stroke = COLORS[kind].link

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

// ─── Main component ─────────────────────────────────────────────────────

export function MoneyFlowSankey({
  income,
  outflow,
  height = 360,
  emptyMessage = 'Belum ada transaksi untuk periode ini.',
  compact = false,
}: MoneyFlowSankeyProps) {
  const data = useMemo(() => {
    const incomeFiltered = income.filter((c) => c.amount > 0)
    const outflowFiltered = outflow.filter((c) => c.amount > 0)

    if (incomeFiltered.length === 0 || outflowFiltered.length === 0) {
      return null
    }

    const totalIn = incomeFiltered.reduce((s, c) => s + c.amount, 0)
    if (totalIn <= 0) return null

    // Build node arrays. Income first, then outflow, so the layout
    // engine puts income on the left and outflow on the right naturally.
    const nodes: { name: string; kind: FlowKind }[] = []
    const incomeStartIdx = nodes.length
    incomeFiltered.forEach((c) => nodes.push({ name: c.name, kind: c.kind }))

    const outflowStartIdx = nodes.length
    outflowFiltered.forEach((c) => nodes.push({ name: c.name, kind: c.kind }))

    // Pro-rata link generation:
    //   For each outflow, allocate it across income sources by share.
    //   Skip dust (<1) so we don't draw 18 hairlines for trivia.
    const links: { source: number; target: number; value: number }[] = []
    outflowFiltered.forEach((dst, dstIdx) => {
      incomeFiltered.forEach((src, srcIdx) => {
        const share = src.amount / totalIn
        const value = dst.amount * share
        if (value < 1) return
        links.push({
          source: incomeStartIdx + srcIdx,
          target: outflowStartIdx + dstIdx,
          value,
        })
      })
    })

    if (links.length === 0) return null

    return { nodes, links }
  }, [income, outflow])

  if (!data) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border text-sm"
        style={{
          height,
          color: 'var(--ink-soft)',
          borderColor: 'var(--border-soft)',
          background: 'var(--surface-2)',
        }}
      >
        {emptyMessage}
      </div>
    )
  }

  // Tight margins on mobile so labels still fit within the chart container
  const margin = compact
    ? { top: 8, right: 70, bottom: 8, left: 70 }
    : { top: 14, right: 130, bottom: 14, left: 130 }

  const renderNode = makeRenderNode(compact)

  return (
    <div
      className="rounded-xl"
      style={{ width: '100%', height, color: 'var(--ink)' }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={data}
          nodePadding={compact ? 12 : 22}
          nodeWidth={compact ? 8 : 10}
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
                    className="rounded-md border px-2.5 py-1.5 text-xs shadow-md"
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
              return null
            }}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  )
}
