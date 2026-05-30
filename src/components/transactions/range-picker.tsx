'use client'

import { useState } from 'react'
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  subDays,
  subMonths,
  addMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWithinInterval,
} from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export type DateRange = { from: Date; to: Date } | null

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const MONTHS_SHORT_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]
const WEEKDAYS_ID = ['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg']

function fmt(d: Date) {
  return `${d.getDate()} ${MONTHS_SHORT_ID[d.getMonth()]} ${d.getFullYear()}`
}

const PRESETS: { key: string; label: string; get: () => DateRange }[] = [
  { key: 'all', label: 'Semua waktu', get: () => null },
  { key: 'today', label: 'Hari ini', get: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { key: 'yesterday', label: 'Kemarin', get: () => { const y = subDays(new Date(), 1); return { from: startOfDay(y), to: endOfDay(y) } } },
  { key: '7', label: '7 hari terakhir', get: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
  { key: '14', label: '14 hari terakhir', get: () => ({ from: startOfDay(subDays(new Date(), 13)), to: endOfDay(new Date()) }) },
  { key: '28', label: '28 hari terakhir', get: () => ({ from: startOfDay(subDays(new Date(), 27)), to: endOfDay(new Date()) }) },
  { key: 'thismonth', label: 'Bulan ini', get: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }) },
  { key: 'lastmonth', label: 'Bulan lalu', get: () => { const lm = subMonths(new Date(), 1); return { from: startOfMonth(lm), to: endOfMonth(lm) } } },
  { key: 'thisyear', label: 'Tahun ini', get: () => ({ from: startOfYear(new Date()), to: endOfDay(new Date()) }) },
]

function MonthGrid({
  month,
  sel,
  onPick,
}: {
  month: Date
  sel: { from: Date | null; to: Date | null }
  onPick: (d: Date) => void
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
  return (
    <div>
      <div className="mb-2 text-center text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
        {MONTHS_ID[month.getMonth()]} {month.getFullYear()}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS_ID.map((w) => (
          <div key={w} className="text-center text-[10px] font-semibold" style={{ color: 'var(--ink-soft)' }}>
            {w}
          </div>
        ))}
        {days.map((d, i) => {
          const inMonth = isSameMonth(d, month)
          const isStart = sel.from && isSameDay(d, sel.from)
          const isEnd = sel.to && isSameDay(d, sel.to)
          const isEdge = Boolean(isStart || isEnd)
          const inRange = Boolean(sel.from && sel.to && isWithinInterval(d, { start: sel.from, end: sel.to }))
          return (
            <div key={i} className="flex justify-center">
              <button
                type="button"
                onClick={() => onPick(d)}
                tabIndex={inMonth ? 0 : -1}
                className="grid size-8 place-items-center rounded-md text-xs transition-colors hover:bg-[var(--surface-2)]"
                style={{
                  visibility: inMonth ? 'visible' : 'hidden',
                  background: isEdge
                    ? 'var(--ink)'
                    : inRange
                      ? 'color-mix(in srgb, var(--ink) 9%, transparent)'
                      : undefined,
                  color: isEdge ? '#FFFFFF' : 'var(--ink)',
                  fontWeight: isEdge ? 700 : 400,
                }}
              >
                {d.getDate()}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function RangePicker({
  value,
  onChange,
}: {
  value: DateRange
  onChange: (r: DateRange) => void
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<Date>(() => startOfMonth(value?.to ?? new Date()))
  const [sel, setSel] = useState<{ from: Date | null; to: Date | null }>({
    from: value?.from ?? null,
    to: value?.to ?? null,
  })

  const label = !value
    ? 'Semua waktu'
    : isSameDay(value.from, value.to)
      ? fmt(value.from)
      : `${fmt(value.from)} – ${fmt(value.to)}`

  function openPicker() {
    setSel({ from: value?.from ?? null, to: value?.to ?? null })
    setView(startOfMonth(value?.to ?? new Date()))
    setOpen(true)
  }

  function pick(d: Date) {
    if (!sel.from || (sel.from && sel.to)) {
      setSel({ from: d, to: null })
    } else if (d < sel.from) {
      setSel({ from: d, to: sel.from })
    } else {
      setSel({ from: sel.from, to: d })
    }
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    onChange(p.get())
    setOpen(false)
  }

  function apply() {
    if (sel.from && sel.to) {
      onChange({ from: startOfDay(sel.from), to: endOfDay(sel.to) })
      setOpen(false)
    } else if (sel.from) {
      onChange({ from: startOfDay(sel.from), to: endOfDay(sel.from) })
      setOpen(false)
    }
  }

  const activePreset = !value ? 'all' : null

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
      >
        <span className="truncate">{label}</span>
        <CalendarDays className="size-4 shrink-0" style={{ color: 'var(--ink-soft)' }} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pilih rentang waktu</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 sm:flex-row">
            {/* Presets */}
            <div className="flex shrink-0 flex-col gap-0.5 sm:w-40">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="rounded-md px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--surface-2)]"
                  style={{
                    color: activePreset === p.key ? 'var(--ink)' : 'var(--ink-muted)',
                    background: activePreset === p.key ? 'var(--surface-2)' : undefined,
                    fontWeight: activePreset === p.key ? 600 : 400,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Calendars */}
            <div className="flex-1">
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setView(subMonths(view, 1))}
                  className="grid size-7 place-items-center rounded-md border hover:bg-[var(--surface-2)]"
                  style={{ borderColor: 'var(--border-soft)' }}
                  aria-label="Bulan sebelumnya"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView(addMonths(view, 1))}
                  className="grid size-7 place-items-center rounded-md border hover:bg-[var(--surface-2)]"
                  style={{ borderColor: 'var(--border-soft)' }}
                  aria-label="Bulan berikutnya"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <MonthGrid month={view} sel={sel} onPick={pick} />
                <MonthGrid month={addMonths(view, 1)} sel={sel} onPick={pick} />
              </div>
            </div>
          </div>

          <DialogFooter className="items-center">
            <span className="mr-auto text-xs" style={{ color: 'var(--ink-muted)' }}>
              {sel.from ? (sel.to ? `${fmt(sel.from)} – ${fmt(sel.to)}` : `${fmt(sel.from)} – …`) : 'Pilih tanggal mulai & akhir'}
            </span>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={apply} disabled={!sel.from}>Terapkan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
