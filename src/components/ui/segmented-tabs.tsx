'use client'

/**
 * SegmentedTabs — baris tab pill yang BISA SCROLL horizontal (anti-overflow).
 * Fix isu "tab Compare/Laporan ke-potong" di mobile: tab gak dikecilin/dipotong,
 * tapi row-nya scroll + edge-fade (mask) jadi sinyal "ada lagi". Active = pill
 * ink-fill (brand restraint — warna brand cuma di data). Tap-target ≥36.
 */

import { cn } from '@/lib/utils'

export type SegTab = { value: string; label: string; badge?: string | number }

export function SegmentedTabs({
  tabs,
  value,
  onValueChange,
  size = 'md',
  className,
}: {
  tabs: SegTab[]
  value: string
  onValueChange: (value: string) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn('no-scrollbar flex gap-1 overflow-x-auto', className)}
      style={{
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        maskImage:
          'linear-gradient(to right, transparent, #000 14px, #000 calc(100% - 14px), transparent)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent, #000 14px, #000 calc(100% - 14px), transparent)',
      }}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(tab.value)}
            className={cn(
              'shrink-0 snap-start whitespace-nowrap rounded-full inline-flex items-center gap-1.5 transition-colors',
              size === 'sm' ? 'px-3 py-1 text-[12.5px]' : 'px-3.5 py-2 text-[13px]',
            )}
            style={{
              fontWeight: active ? 600 : 500,
              background: active ? 'var(--ink)' : 'transparent',
              color: active ? 'var(--bg)' : 'var(--ink-soft)',
            }}
          >
            {tab.label}
            {tab.badge != null && (
              <span
                className="num tabular text-[11px] px-1.5 rounded-full"
                style={{
                  background: active ? 'rgba(255,255,255,0.18)' : 'var(--surface-2)',
                  color: active ? 'var(--bg)' : 'var(--ink-soft)',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
