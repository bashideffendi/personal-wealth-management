'use client'

import { useState } from 'react'
import { Popover } from '@base-ui/react/popover'
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
import { useT, useI18n } from '@/lib/i18n/context'
import type { Locale } from '@/lib/i18n/messages'
import { monthLong, weekdaysShort, formatDateShort } from '@/lib/i18n/dates'

export type DateRange = { from: Date; to: Date } | null

function fmt(d: Date, locale: Locale) {
  return formatDateShort(d, locale, true)
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
  locale,
}: {
  month: Date
  sel: { from: Date | null; to: Date | null }
  onPick: (d: Date) => void
  locale: Locale
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
  // weekdaysShort is Sunday-first (0=Sun); calendar is Monday-first → rotate Sun to the end
  const weekdays = weekdaysShort(locale)
  const weekdaysMonFirst = [...weekdays.slice(1), weekdays[0]]
  return (
    <div>
      <div className="mb-2 text-center text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
        {monthLong(month.getMonth(), locale)} {month.getFullYear()}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {weekdaysMonFirst.map((w) => (
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
  const t = useT()
  const { locale } = useI18n()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<Date>(() => startOfMonth(value?.to ?? new Date()))
  const [sel, setSel] = useState<{ from: Date | null; to: Date | null }>({
    from: value?.from ?? null,
    to: value?.to ?? null,
  })

  const label = !value
    ? t('range_picker.all_time')
    : isSameDay(value.from, value.to)
      ? fmt(value.from, locale)
      : `${fmt(value.from, locale)} – ${fmt(value.to, locale)}`

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
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setSel({ from: value?.from ?? null, to: value?.to ?? null })
          setView(startOfMonth(value?.to ?? new Date()))
        }
        setOpen(o)
      }}
    >
      <Popover.Trigger
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
      >
        <span className="truncate">{label}</span>
        <CalendarDays className="size-4 shrink-0" style={{ color: 'var(--ink-soft)' }} />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
          <Popover.Popup
            className="origin-(--transform-origin) rounded-xl border p-3 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border-soft)',
              width: 'min(640px, calc(100vw - 2rem))',
              boxShadow: '0 16px 48px -16px rgba(16,24,40,0.30), 0 2px 8px rgba(16,24,40,0.06)',
            }}
          >
            <div className="flex flex-col gap-4 sm:flex-row">
              {/* Presets */}
              <div className="flex shrink-0 flex-col gap-0.5 sm:w-36">
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
                    aria-label={t('range_picker.prev_month')}
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView(addMonths(view, 1))}
                    className="grid size-7 place-items-center rounded-md border hover:bg-[var(--surface-2)]"
                    style={{ borderColor: 'var(--border-soft)' }}
                    aria-label={t('range_picker.next_month')}
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <MonthGrid month={view} sel={sel} onPick={pick} locale={locale} />
                  <MonthGrid month={addMonths(view, 1)} sel={sel} onPick={pick} locale={locale} />
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--border-soft)' }}>
              <span className="mr-auto text-xs" style={{ color: 'var(--ink-muted)' }}>
                {sel.from ? (sel.to ? `${fmt(sel.from, locale)} – ${fmt(sel.to, locale)}` : `${fmt(sel.from, locale)} – …`) : t('range_picker.pick_start_end')}
              </span>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>{t('range_picker.cancel')}</Button>
              <Button size="sm" onClick={apply} disabled={!sel.from}>{t('range_picker.apply')}</Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
