'use client'

/**
 * Money Flow Sankey — Stockbit-style flow viz applied to personal finance.
 *
 *   Income source (left)  →  Total Pemasukan (middle hub)  →  Spending (right)
 *
 * Why a middle hub?
 *   It anchors the visual — every link width sums INTO the hub on one side
 *   and back OUT the other. Reads as "all your income pools here, then
 *   gets distributed."
 *
 * Conservation matters. If sum(income) ≠ sum(outflow), recharts visually
 * shrinks the middle bar to the smaller side, which makes the smaller
 * income source (e.g. Side Hustle at the bottom) appear to drop off into
 * empty space. Fix: add a synthetic balancing node so in == out always.
 *   - Surplus (income > outflow) → "Belum Terpakai" pseudo-outflow.
 *   - Deficit (outflow > income) → "Defisit Bulan Ini" pseudo-income.
 *
 * Categories colored by kind:
 *   - Income     → emerald (Klunting signature)
 *   - Expense    → coral
 *   - Saving     → amber
 *   - Investment → sky/violet
 *   - Hub/Surplus/Deficit → ink (neutral hub)
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
import { useT } from '@/lib/i18n/context'

export type FlowKind = 'income' | 'expense' | 'saving' | 'investment' | 'middle'

interface CategoryAmount {
  name: string
  amount: number
  kind: FlowKind
}

interface MoneyFlowSankeyProps {
  income: CategoryAmount[]      // left side
  outflow: CategoryAmount[]     // right side: expense + saving + investment
  middleLabel?: string          // default "Total Pemasukan"
  surplusLabel?: string         // label for the balancing pseudo-outflow
  deficitLabel?: string         // label for the balancing pseudo-income
  height?: number
  emptyMessage?: string
  /** When true, render a more compact layout suited to <600px viewports. */
  compact?: boolean
}

// ─── Color palette — fintech semantic ──────────────────────────────────
// income=emerald, expense=coral, saving=amber, investment=violet (AI/long-
// term accent), middle=ink hub. Link ribbons fillOpacity ~0.42.
const COLORS: Record<FlowKind, { node: string; link: string }> = {
  income:     { node: 'var(--c-mint)', link: 'color-mix(in srgb, var(--c-mint) 42%, transparent)' },  // emerald
  expense:    { node: 'var(--c-coral)', link: 'color-mix(in srgb, var(--c-coral) 40%, transparent)' },   // coral
  saving:     { node: 'var(--c-amber)', link: 'color-mix(in srgb, var(--c-amber) 42%, transparent)' },  // amber
  investment: { node: 'var(--c-violet)', link: 'color-mix(in srgb, var(--c-violet) 38%, transparent)' },  // violet
  middle:     { node: 'var(--ink)', link: 'color-mix(in srgb, var(--ink) 20%, transparent)' }, // ink hub (theme-aware)
}

function trunc(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

// ─── Custom node renderer ───────────────────────────────────────────────
// In recharts Sankey, original data props (kind) are merged onto the
// payload object directly — NOT under payload.payload.
interface SankeyNodeData {
  name: string
  value: number
  kind?: FlowKind
}

function makeRenderNode(compact: boolean) {
  // Compact mode is sized to fit within ~70px label margin on a 375px
  // mobile viewport. Names truncate hard ("Cryptocurr…") and amounts use
  // the compact "Rp 5,5jt" format instead of full "Rp 5.500.000".
  const labelMax = compact ? 10 : 22
  const fontMain = compact ? 9.5 : 11
  const fontSub = compact ? 8.5 : 10
  const labelGap = compact ? 4 : 8
  const lineGap = compact ? 6 : 9

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
    // The middle hub sits roughly centered — anchor labels right of it
    const isLeft = x < containerWidth * 0.4
    const isMiddle = !isLeft && x < containerWidth * 0.6
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
          fillOpacity={isMiddle ? 1 : 0.95}
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
          y={y + height / 2 + lineGap}
          textAnchor={anchor}
          dominantBaseline="middle"
          style={{
            fontSize: fontSub,
            fill: 'currentColor',
            opacity: 0.65,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {compact ? formatCurrency(payload.value) : formatCurrency(payload.value)}
        </text>
      </Layer>
    )
  }
}

// ─── Custom link renderer ───────────────────────────────────────────────
// Color income-side (source kind income) by source kind = emerald.
// Color outflow-side (target kind != middle) by target kind so each
// branch from the hub clearly reads as expense/saving/investment.
interface SankeyLinkData {
  sourceX: number
  sourceY: number
  sourceControlX: number
  targetX: number
  targetY: number
  targetControlX: number
  linkWidth: number
  payload: {
    target: { kind?: FlowKind; name?: string }
    source: { kind?: FlowKind; name?: string }
  }
}

function renderLink(props: SankeyLinkData) {
  const {
    sourceX, sourceY, sourceControlX,
    targetX, targetY, targetControlX,
    linkWidth, payload,
  } = props
  const targetKind = payload.target.kind
  const sourceKind = payload.source.kind
  // Inflow side: source is income (or deficit pseudo-income), target is hub
  //   → use source kind so deficit can be shown in indigo and real income in green
  // Outflow side: source is hub, target is expense/saving/investment/surplus
  //   → use target kind
  const kind: FlowKind = (targetKind && targetKind !== 'middle')
    ? targetKind
    : (sourceKind && sourceKind !== 'middle')
      ? sourceKind
      : 'middle'
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
  middleLabel: middleLabelProp,
  surplusLabel: surplusLabelProp,
  deficitLabel: deficitLabelProp,
  height = 360,
  emptyMessage: emptyMessageProp,
  compact = false,
}: MoneyFlowSankeyProps) {
  const t = useT()
  const middleLabel = middleLabelProp ?? t('sankey.middleLabel')
  const surplusLabel = surplusLabelProp ?? t('sankey.surplusLabel')
  const deficitLabel = deficitLabelProp ?? t('sankey.deficitLabel')
  const emptyMessage = emptyMessageProp ?? t('sankey.emptyMessage')

  const data = useMemo(() => {
    const incomeFiltered = income.filter((c) => c.amount > 0)
    const outflowFiltered = outflow.filter((c) => c.amount > 0)

    if (incomeFiltered.length === 0 && outflowFiltered.length === 0) return null

    const totalIn = incomeFiltered.reduce((s, c) => s + c.amount, 0)
    const totalOut = outflowFiltered.reduce((s, c) => s + c.amount, 0)

    // Balance the diagram so the middle hub bar height = totalIn = totalOut.
    // This is what makes Side Hustle (or any small income source) connect
    // properly to the bottom of the hub instead of being visually orphaned.
    const balancedIncome = [...incomeFiltered]
    const balancedOutflow = [...outflowFiltered]
    if (totalIn > totalOut) {
      // Surplus — money came in but isn't spent/saved/invested yet
      balancedOutflow.push({
        name: surplusLabel,
        amount: totalIn - totalOut,
        kind: 'middle',
      })
    } else if (totalOut > totalIn) {
      // Deficit — spent more than earned (drew from savings, debt, etc.)
      balancedIncome.push({
        name: deficitLabel,
        amount: totalOut - totalIn,
        kind: 'middle',
      })
    }

    // Build nodes: income | middle | outflow
    const nodes: { name: string; kind: FlowKind }[] = []
    const incomeStartIdx = nodes.length
    balancedIncome.forEach((c) => nodes.push({ name: c.name, kind: c.kind }))

    const middleIdx = nodes.length
    nodes.push({ name: middleLabel, kind: 'middle' })

    const outflowStartIdx = nodes.length
    balancedOutflow.forEach((c) => nodes.push({ name: c.name, kind: c.kind }))

    // Links: every income → middle, middle → every outflow
    const links: { source: number; target: number; value: number }[] = []
    balancedIncome.forEach((c, i) => {
      links.push({ source: incomeStartIdx + i, target: middleIdx, value: c.amount })
    })
    balancedOutflow.forEach((c, i) => {
      links.push({ source: middleIdx, target: outflowStartIdx + i, value: c.amount })
    })

    if (links.length === 0) return null
    return { nodes, links }
  }, [income, outflow, middleLabel, surplusLabel, deficitLabel])

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

  // Asymmetric on compact: spending category names (right side) tend to be
  // longer than income source names ("Cryptocurrency" vs "Gaji"), so give
  // the right side more breathing room.
  const margin = compact
    ? { top: 8, right: 88, bottom: 8, left: 56 }
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
