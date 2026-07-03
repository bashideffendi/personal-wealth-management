'use client'

/**
 * MobileMonthCalendar — kalender bulan ala app "Budget" iOS (F12, mockup
 * di-approve 2026-07-03). Mobile-only, dipasang di atas list Transaksi.
 *
 * - Sel = tanggal + net harian compact (coral keluar / teal masuk).
 * - Tap tanggal → onSelectDay(iso) → list di bawah difilter ke hari itu;
 *   tap lagi tanggal yang sama → batal (null).
 * - Navigator ‹ Bulan › pindah bulan TANPA menyentuh filter dateRange —
 *   kalender = lensa, bukan filter.
 * - Baris bawah: Masuk / Keluar / Selisih bulan yang ditampilkan.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { monthLong } from '@/lib/i18n/dates'

export interface CalendarMonthData {
  /** net per tanggal ISO yyyy-mm-dd (income − expense, Transfer di-skip) */
  perDay: Map<string, number>
  income: number
  expense: number
}

const WEEKDAYS_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export function MobileMonthCalendar({
  monthDate,
  data,
  selectedDay,
  onSelectDay,
  onPrev,
  onNext,
  locale,
  labels,
}: {
  monthDate: Date
  data: CalendarMonthData
  selectedDay: string | null
  onSelectDay: (day: string | null) => void
  onPrev: () => void
  onNext: () => void
  locale: 'en' | 'id'
  labels: { income: string; expense: string; net: string }
}) {
  const y = monthDate.getFullYear()
  const m = monthDate.getMonth()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  // Senin = kolom pertama (konvensi ID, sama dengan referensi Budget).
  const leadBlanks = (new Date(y, m, 1).getDay() + 6) % 7
  const todayIso = iso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
  const weekdays = locale === 'en' ? WEEKDAYS_EN : WEEKDAYS_ID
  const net = data.income - data.expense

  return (
    <div className="s-card px-3 pt-3 pb-2.5">
      <div className="flex items-center justify-center gap-3 pb-2">
        <button type="button" onClick={onPrev} aria-label="Bulan sebelumnya" className="grid place-items-center size-8 rounded-full active:opacity-60" style={{ color: 'var(--ink-soft)' }}>
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-[14px] font-semibold min-w-[120px] text-center" style={{ color: 'var(--ink)' }}>
          {monthLong(m, locale)} {y}
        </span>
        <button type="button" onClick={onNext} aria-label="Bulan berikutnya" className="grid place-items-center size-8 rounded-full active:opacity-60" style={{ color: 'var(--ink-soft)' }}>
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-[3px] text-center">
        {weekdays.map((w) => (
          <span key={w} className="text-[10px] pb-1" style={{ color: 'var(--ink-soft)' }}>{w}</span>
        ))}
        {Array.from({ length: leadBlanks }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = i + 1
          const dayIso = iso(y, m, d)
          const dayNet = data.perDay.get(dayIso) ?? 0
          const has = dayNet !== 0
          const selected = selectedDay === dayIso
          const isToday = dayIso === todayIso
          return (
            <button
              key={dayIso}
              type="button"
              onClick={() => onSelectDay(selected ? null : dayIso)}
              aria-pressed={selected}
              className="rounded-[9px] pt-[5px] pb-[3px] min-h-[38px] leading-tight transition-colors"
              style={{
                background: selected ? 'var(--ink)' : has ? 'var(--surface-2)' : 'transparent',
                boxShadow: isToday && !selected ? 'inset 0 0 0 1.5px var(--c-mint)' : 'none',
              }}
            >
              <span className="num block text-[12px] font-medium" style={{ color: selected ? 'var(--surface)' : 'var(--ink)' }}>{d}</span>
              {has && (
                <span
                  className="num block text-[8px] font-medium truncate px-[1px]"
                  style={{
                    color: selected
                      ? 'var(--surface)'
                      : dayNet < 0 ? 'var(--c-coral-ink)' : 'var(--c-mint-ink)',
                  }}
                >
                  {dayNet < 0 ? '' : '+'}{formatCompactCurrency(Math.abs(dayNet)).replace('Rp ', '')}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex justify-between mt-2 pt-2.5" style={{ borderTop: '1px solid var(--border-soft)' }}>
        <span>
          <span className="block text-[10px]" style={{ color: 'var(--ink-soft)' }}>{labels.income}</span>
          <span className="num tabular text-[13px] font-semibold" title={formatCurrency(data.income)} style={{ color: 'var(--c-mint-ink)' }}>{formatCompactCurrency(data.income)}</span>
        </span>
        <span>
          <span className="block text-[10px]" style={{ color: 'var(--ink-soft)' }}>{labels.expense}</span>
          <span className="num tabular text-[13px] font-semibold" title={formatCurrency(data.expense)} style={{ color: 'var(--c-coral-ink)' }}>{formatCompactCurrency(data.expense)}</span>
        </span>
        <span className="text-right">
          <span className="block text-[10px]" style={{ color: 'var(--ink-soft)' }}>{labels.net}</span>
          <span className="num tabular text-[13px] font-semibold" title={formatCurrency(net)} style={{ color: 'var(--ink)' }}>{net >= 0 ? '+' : '−'}{formatCompactCurrency(Math.abs(net))}</span>
        </span>
      </div>
    </div>
  )
}
