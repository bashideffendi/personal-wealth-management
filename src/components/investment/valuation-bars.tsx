'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Datum = {
  method: string
  fairValue: number | null
  mos?: number | null
}

function fmt(n: number): string {
  return n.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

/**
 * Bar chart fair value per metode + garis referensi harga pasar.
 * Hijau (mint) = di atas harga (undervalued), coral = di bawah (overvalued).
 */
export function ValuationBars({
  data,
  currentPrice,
  height = 280,
}: {
  data: Datum[]
  currentPrice: number | null
  height?: number
}) {
  const filtered = data.filter((d) => d.fairValue !== null)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={filtered} margin={{ top: 20, right: 16, bottom: 5, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
        <XAxis
          dataKey="method"
          tick={{ fontSize: 11, fill: 'var(--ink-soft)' }}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-30}
          textAnchor="end"
          height={56}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--ink-soft)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmt(v)}
          width={64}
        />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content={({ active, payload, label }: any) => {
            if (!active || !payload?.length) return null
            const v = payload[0]?.value as number
            return (
              <div
                className="rounded-lg px-2.5 py-1.5 shadow"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)' }}
              >
                <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                  {String(label)}
                </p>
                <p className="num tabular text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  Rp {typeof v === 'number' ? fmt(v) : '—'}
                </p>
              </div>
            )
          }}
        />
        {currentPrice !== null && (
          <ReferenceLine
            y={currentPrice}
            stroke="var(--ink-muted)"
            strokeDasharray="4 4"
            label={{
              value: `Harga ${fmt(currentPrice)}`,
              fill: 'var(--ink-muted)',
              fontSize: 10,
              position: 'right',
            }}
          />
        )}
        <Bar dataKey="fairValue" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {filtered.map((d, i) => {
            const undervalued =
              currentPrice !== null && d.fairValue !== null && d.fairValue > currentPrice
            return (
              <Cell
                key={i}
                fill={undervalued ? 'var(--c-mint)' : 'var(--c-coral)'}
                fillOpacity={undervalued ? 0.85 : 0.55}
              />
            )
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
