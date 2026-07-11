'use client'

/**
 * Cash-flow Forecast — projects daily balance for next 30 days. Surfaces:
 *   - Min balance hit during the window (vs current balance)
 *   - Days where balance projects to dip below "safe" threshold
 *
 * Why this matters (CFPB cash-flow budgeting framework, 2021): mayoritas
 * problem cashflow rumah tangga bukan "berapa total bulanan" tapi "kapan
 * uang masuk vs kapan tagihan jatuh" — timing mismatch yang bikin
 * overdraft meskipun bulan-end positif.
 *
 * Dua mode (logika murni di lib/data/cashflow-forecast — lihat kontrak
 * angka di sana):
 * - RECURRING: user rawat recurring → jadwal recurring + kontrak (lama).
 * - BOOTSTRAP (recurring kosong): rata-rata belanja 60 hari + tagihan
 *   CC/utang → kartu langsung berguna dari hari pertama, TANPA nag setup.
 *   Pemasukan tidak ditebak — badge "Perkiraan" + caption menjelaskan.
 */

import { useMemo } from 'react'
import { TrendingDown, TrendingUp, AlertTriangle, Calendar } from 'lucide-react'
import { formatCompactCurrency, formatCurrency } from '@/lib/utils'
import { EduTip } from '@/components/edu/edu-tip'
import { useI18n } from '@/lib/i18n/context'
import {
  buildForecast,
  FORECAST_DAYS,
  type BillEvent,
  type ContractItem,
  type RecurringItem,
} from '@/lib/data/cashflow-forecast'

interface Props {
  liquidBalance: number
  recurringItems: RecurringItem[]
  contracts: ContractItem[]
  /** Tagihan tersintesis (CC due + cicilan utang) — dipakai saat recurring kosong. */
  bootstrapBills?: BillEvent[]
  /** Rata-rata belanja likuid/hari dari histori — dipakai saat recurring kosong. */
  avgDailyExpense?: number | null
  /** Buffer threshold below which we flag "risk" (default Rp 500k) */
  safetyBuffer?: number
  /** Days to project (default 30) */
  daysAhead?: number
}

export function CashFlowForecast({
  liquidBalance,
  recurringItems,
  contracts,
  bootstrapBills,
  avgDailyExpense,
  safetyBuffer = 500_000,
  daysAhead = FORECAST_DAYS,
}: Props) {
  const { locale } = useI18n()
  // Bootstrap hanya saat recurring kosong DAN ada bahannya — kalau user sudah
  // merawat recurring, jangan campur tagihan sintesis (risiko double-count
  // dengan recurring "bayar kartu" buatan user sendiri). Recurring kosong
  // tapi tanpa bahan bootstrap (cuma kontrak) → jatuh ke perilaku lama.
  const bootstrap =
    recurringItems.length === 0 &&
    ((avgDailyExpense ?? 0) > 0 || (bootstrapBills?.length ?? 0) > 0)
  const dailyBurn = bootstrap ? (avgDailyExpense ?? 0) : 0
  const bills = useMemo(
    () => (bootstrap ? (bootstrapBills ?? []) : []),
    [bootstrap, bootstrapBills],
  )
  const forecast = useMemo(
    () => buildForecast(liquidBalance, recurringItems, contracts, daysAhead, { dailyBurn, bills }),
    [liquidBalance, recurringItems, contracts, daysAhead, dailyBurn, bills],
  )

  // Stats
  const minPoint = forecast.reduce((min, p) => (p.balance < min.balance ? p : min), forecast[0])
  const endBalance = forecast[forecast.length - 1]?.balance ?? liquidBalance
  const riskDays = forecast.filter((p) => p.balance < safetyBuffer)
  const negativeDays = forecast.filter((p) => p.balance < 0)
  const eventDays = forecast.filter((p) => p.events.length > 0)

  // Empty state — HANYA saat benar-benar tidak ada bahan proyeksi sama
  // sekali (tanpa recurring, tanpa histori belanja, tanpa tagihan/kontrak).
  if (recurringItems.length === 0 && !bootstrap && eventDays.length === 0) {
    return (
      <div
        className="rounded-2xl border p-5 sm:p-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-start gap-3 mb-2">
          <div
            className="size-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--c-blue-soft)' }}
          >
            <Calendar className="size-4" style={{ color: 'var(--c-blue-ink)' }} />
          </div>
          <div>
            <p className="eyebrow">Forecast Saldo</p>
            <h3 className="text-base font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
              30 Hari ke Depan
            </h3>
          </div>
        </div>
        <p className="text-sm leading-relaxed mt-3" style={{ color: 'var(--ink-muted)' }}>
          Catat <span className="font-semibold">recurring transactions</span> kamu (gaji, langganan,
          listrik) supaya kita bisa proyeksiin saldo harian dan kasih warning kalau bakal tipis
          sebelum gajian.
        </p>
        <a
          href="/dashboard/recurring"
          className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold transition hover:underline"
          style={{ color: 'var(--c-mint-ink)' }}
        >
          Set up recurring →
        </a>
      </div>
    )
  }

  // Color the chart based on health. Bootstrap = NETRAL (biru): proyeksinya
  // belum memuat pemasukan, jadi klaim "Risiko Negatif" tidak berdasar —
  // garis turun itu ekspektasi, bukan alarm.
  const hasNegative = !bootstrap && negativeDays.length > 0
  const hasRisk = !bootstrap && riskDays.length > 0
  const accentColor = bootstrap
    ? 'var(--c-blue)'
    : hasNegative ? 'var(--c-coral)' : hasRisk ? 'var(--c-amber)' : 'var(--c-mint)'
  // Varian -ink (AA-safe) buat TEKS Stat; accentColor (hue terang) buat garis chart.
  const accentColorInk = bootstrap
    ? 'var(--c-blue-ink)'
    : hasNegative ? 'var(--c-coral-ink)' : hasRisk ? 'var(--c-amber-ink)' : 'var(--c-mint-ink)'

  // SVG chart dimensions
  const chartH = 80
  const chartW = 320  // base; will scale via viewBox
  const balances = forecast.map((p) => p.balance)
  const maxBal = Math.max(...balances, liquidBalance, safetyBuffer * 1.2)
  const minBal = Math.min(...balances, 0)
  const range = Math.max(1, maxBal - minBal)

  // Build polyline points
  const points = forecast.map((p, i) => {
    const x = (i / (forecast.length - 1)) * chartW
    const y = chartH - ((p.balance - minBal) / range) * chartH
    return `${x},${y}`
  }).join(' ')

  // Buffer line position
  const bufferY = chartH - ((safetyBuffer - minBal) / range) * chartH
  const zeroY = chartH - ((0 - minBal) / range) * chartH

  return (
    <div
      className="s-card p-4 sm:p-5"
      style={{
        background: hasNegative
          ? 'linear-gradient(135deg, rgba(244,63,94,0.05), var(--surface) 50%)'
          : undefined,
        borderColor: hasNegative ? 'rgba(244,63,94,0.45)' : undefined,
      }}
    >
      {/* Compact header — title + status badge in one row, mini sparkline beside */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="size-3.5 shrink-0" style={{ color: accentColor }} />
          <p className="eyebrow flex items-center gap-1.5">
            Forecast Saldo 30h
            <EduTip topic="cash-flow" side="bottom" />
          </p>
        </div>
        {bootstrap ? (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide shrink-0"
            style={{ background: 'var(--c-blue-soft)', color: 'var(--c-blue-ink)' }}
            title="Dari rata-rata belanja & tagihanmu — belum termasuk pemasukan"
          >
            Perkiraan
          </span>
        ) : hasNegative ? (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0"
            style={{ background: 'var(--c-coral-soft)', color: 'var(--c-coral-ink)' }}
          >
            <AlertTriangle className="size-2.5" />
            Risiko Negatif
          </span>
        ) : hasRisk ? (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0"
            style={{ background: 'var(--c-amber-soft)', color: 'var(--c-amber-ink)' }}
          >
            Saldo Tipis
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide shrink-0"
            style={{ background: 'var(--c-mint-soft)', color: 'var(--c-mint-ink)' }}
          >
            <TrendingUp className="size-2.5" />
            Aman
          </span>
        )}
      </div>

      {/* Side-by-side: stats (left) + mini sparkline (right) */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center">
        <div className="grid grid-cols-3 gap-3 text-[11px]">
          <Stat
            label="Sekarang"
            value={formatCompactCurrency(liquidBalance)}
            title={formatCurrency(liquidBalance)}
            color="var(--ink)"
          />
          <Stat
            label="Akhir 30h"
            value={formatCompactCurrency(endBalance)}
            title={formatCurrency(endBalance)}
            color={endBalance < liquidBalance ? 'var(--c-coral-ink)' : 'var(--c-mint-ink)'}
            icon={endBalance < liquidBalance ? <TrendingDown className="size-3" /> : <TrendingUp className="size-3" />}
          />
          <Stat
            label="Terendah"
            value={formatCompactCurrency(minPoint?.balance ?? liquidBalance)}
            title={formatCurrency(minPoint?.balance ?? liquidBalance)}
            color={minPoint && minPoint.balance < safetyBuffer ? accentColorInk : 'var(--ink)'}
            sub={minPoint?.balance !== undefined && minPoint.balance < liquidBalance
              ? `H+${forecast.indexOf(minPoint)}`
              : undefined}
          />
        </div>

        {/* Mini sparkline — visible only on sm+ to save mobile space */}
        <div className="hidden sm:block w-32 shrink-0">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-12"
            preserveAspectRatio="none"
          >
            {bufferY > 0 && bufferY < chartH && (
              <line
                x1="0" y1={bufferY} x2={chartW} y2={bufferY}
                stroke="var(--c-amber)" strokeWidth="0.5" strokeDasharray="3,3"
                opacity="0.5"
              />
            )}
            {minBal < 0 && (
              <line
                x1="0" y1={zeroY} x2={chartW} y2={zeroY}
                stroke="var(--c-coral)" strokeWidth="0.8" opacity="0.7"
              />
            )}
            <polygon
              points={`0,${chartH} ${points} ${chartW},${chartH}`}
              fill={accentColor}
              fillOpacity="0.12"
            />
            <polyline
              points={points}
              fill="none"
              stroke={accentColor}
              strokeWidth="1.5"
            />
          </svg>
        </div>
      </div>

      {/* Upcoming events list — actionable bit */}
      {eventDays.length > 0 && (
        <div
          className="mt-3 pt-2 border-t"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {eventDays.slice(0, 4).map((p) => {
              // Nominal dari EVENT-nya, bukan total hari — di mode bootstrap
              // outflow harian ikut memuat burn rata-rata yang bukan bagian
              // dari tagihan yang ditampilkan.
              const evIn = p.events.filter((e) => e.kind === 'in').reduce((s, e) => s + e.amount, 0)
              const evOut = p.events.filter((e) => e.kind === 'out').reduce((s, e) => s + e.amount, 0)
              return (
                <div key={p.iso} className="flex items-center gap-1.5">
                  <span className="num font-medium" style={{ color: 'var(--ink-soft)' }}>
                    {p.date.toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="truncate max-w-[100px]" style={{ color: 'var(--ink)' }}>
                    {p.events[0].name}
                  </span>
                  <span
                    className="num font-semibold"
                    style={{ color: evIn > evOut ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}
                  >
                    {evIn > evOut ? '+' : '-'}
                    {formatCurrency(Math.max(evIn, evOut))}
                  </span>
                </div>
              )
            })}
            {eventDays.length > 4 && (
              <span className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                +{eventDays.length - 4} event lain
              </span>
            )}
          </div>
        </div>
      )}

      {/* Bootstrap: jelaskan asal angkanya + jalan halus ke recurring —
          pengganti empty-state nag yang dulu menyita seluruh kartu. */}
      {bootstrap && (
        <p className="mt-3 pt-2 border-t text-[10.5px] leading-relaxed" style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-soft)' }}>
          Perkiraan dari rata-rata belanjamu 60 hari terakhir + tagihan terjadwal — belum
          termasuk pemasukan.{' '}
          <a href="/dashboard/recurring" className="font-semibold hover:underline" style={{ color: 'var(--c-mint-ink)' }}>
            Catat gaji &amp; langganan →
          </a>
        </p>
      )}
    </div>
  )
}

function Stat({
  label, value, color, icon, sub, title,
}: {
  label: string
  value: string
  color: string
  icon?: React.ReactNode
  sub?: string
  /** Full digit — hover/long-press tetap bisa lihat nominal utuh */
  title?: string
}) {
  return (
    <div>
      <p style={{ color: 'var(--ink-soft)' }}>{label}</p>
      <p
        className="num font-bold mt-0.5 inline-flex items-center gap-1"
        title={title}
        style={{ color, fontSize: 14 }}
      >
        {icon}
        {value}
      </p>
      {sub && (
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}
