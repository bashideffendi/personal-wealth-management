'use client'

/**
 * MobileMonthCalendar — kalender bulan ala app "Budget" iOS (F12, mockup
 * di-approve 2026-07-03). Mobile-only, dipasang di atas list Transaksi.
 *
 * - SEMUA sel kotak abu muda seragam (surface-2); hari ini blok coral-soft.
 * - Sel = tanggal + dua baris mikro: income (mint) di atas expense (coral).
 * - Tap tanggal → onSelectDay(iso) → list di bawah difilter ke hari itu;
 *   tap lagi tanggal yang sama → batal (null).
 * - Navigator ‹ Bulan › pindah bulan TANPA menyentuh filter dateRange —
 *   kalender = lensa, bukan filter.
 * - Baris bawah: Masuk / Keluar / Selisih bulan yang ditampilkan (angka penuh).
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { monthLong } from '@/lib/i18n/dates'

export interface CalendarMonthData {
  /**
   * Per tanggal ISO yyyy-mm-dd (Transfer di-skip). Bentuk kaya
   * {income, expense} = dua baris mikro terpisah di sel; bentuk lama
   * number (net) tetap diterima — di-derive jadi satu sisi saja.
   */
  perDay: ReadonlyMap<string, number | { income: number; expense: number }>
  income: number
  expense: number
}

const WEEKDAYS_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Angka compact tanpa prefix 'Rp ' — muat di sel mikro. */
const cellAmount = (v: number) => formatCompactCurrency(v).replace('Rp ', '')

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
  const daysInPrevMonth = new Date(y, m, 0).getDate()
  // Senin = kolom pertama (konvensi ID, sama dengan referensi Budget).
  const leadBlanks = (new Date(y, m, 1).getDay() + 6) % 7
  const trailBlanks = (7 - ((leadBlanks + daysInMonth) % 7)) % 7
  const todayIso = iso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
  const weekdays = locale === 'en' ? WEEKDAYS_EN : WEEKDAYS_ID
  const net = data.income - data.expense

  // Sel dim bulan sebelum/sesudah — non-interactive, biar grid penuh 7 kolom.
  const dimCell = (key: string, d: number) => (
    <span
      key={key}
      aria-hidden="true"
      className="rounded-[9px] pt-[5px] pb-[3px] min-h-[46px] leading-tight"
      style={{ background: 'var(--surface-2)', opacity: 0.5 }}
    >
      <span className="num block text-[12px] font-medium" style={{ color: 'var(--ink-soft)' }}>{d}</span>
    </span>
  )

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
        {Array.from({ length: leadBlanks }, (_, i) =>
          dimCell(`p${i}`, daysInPrevMonth - leadBlanks + 1 + i),
        )}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = i + 1
          const dayIso = iso(y, m, d)
          const raw = data.perDay.get(dayIso)
          // Kompat bentuk lama number (net): derive ke satu sisi saja.
          const day = raw === undefined
            ? undefined
            : typeof raw === 'number'
              ? { income: raw > 0 ? raw : 0, expense: raw < 0 ? -raw : 0 }
              : raw
          const selected = selectedDay === dayIso
          const isToday = dayIso === todayIso
          return (
            <button
              key={dayIso}
              type="button"
              onClick={() => onSelectDay(selected ? null : dayIso)}
              aria-pressed={selected}
              className="rounded-[9px] pt-[5px] pb-[3px] min-h-[46px] leading-tight transition-colors"
              style={{
                background: selected
                  ? 'var(--ink)'
                  : isToday ? 'var(--c-coral-soft)' : 'var(--surface-2)',
              }}
            >
              <span className="num block text-[12px] font-medium" style={{ color: selected ? 'var(--surface)' : 'var(--ink)' }}>{d}</span>
              {day && day.income > 0 && (
                <span
                  className="num block text-[7.5px] font-medium truncate px-[1px]"
                  style={{ color: selected ? 'var(--surface)' : 'var(--c-mint-ink)' }}
                >
                  {cellAmount(day.income)}
                </span>
              )}
              {day && day.expense > 0 && (
                <span
                  className="num block text-[7.5px] font-medium truncate px-[1px]"
                  style={{ color: selected ? 'var(--surface)' : 'var(--c-coral-ink)' }}
                >
                  {cellAmount(day.expense)}
                </span>
              )}
            </button>
          )
        })}
        {Array.from({ length: trailBlanks }, (_, i) => dimCell(`n${i}`, i + 1))}
      </div>

      <div className="flex justify-between mt-2 pt-2.5" style={{ borderTop: '1px solid var(--border-soft)' }}>
        <span>
          <span className="block text-[10px]" style={{ color: 'var(--ink-soft)' }}>{labels.income}</span>
          <span className="num tabular text-[15px] font-bold" style={{ color: 'var(--c-mint-ink)', letterSpacing: '-0.02em' }}>{formatCurrency(data.income)}</span>
        </span>
        <span>
          <span className="block text-[10px]" style={{ color: 'var(--ink-soft)' }}>{labels.expense}</span>
          <span className="num tabular text-[15px] font-bold" style={{ color: 'var(--c-coral-ink)', letterSpacing: '-0.02em' }}>{formatCurrency(data.expense)}</span>
        </span>
        <span className="text-right">
          <span className="block text-[10px]" style={{ color: 'var(--ink-soft)' }}>{labels.net}</span>
          <span className="num tabular text-[15px] font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>{formatCurrency(net)}</span>
        </span>
      </div>
    </div>
  )
}
