'use client'

/**
 * Bank / digital wallet picker — searchable dropdown over the
 * INDONESIAN_INSTITUTIONS catalog. Picking a result returns the
 * institution and lets the parent set the account name + type
 * automatically.
 *
 * Always offers a "Custom" option at the bottom so users can name
 * accounts that aren't in the catalog (e.g. foreign bank, niche fintech).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Plus } from 'lucide-react'
import {
  INDONESIAN_INSTITUTIONS,
  type FinancialInstitution,
  type InstitutionType,
} from '@/lib/indonesian-institutions'
import { InstitutionLogo } from './institution-logo'
import { useT } from '@/lib/i18n/context'

interface Props {
  /** Current text in the input (account name or brand) */
  value: string
  /** Free text typing — for custom institutions */
  onTextChange: (text: string) => void
  /** Picked from the catalog */
  onPick: (inst: FinancialInstitution) => void
  placeholder?: string
  /** Limit catalog to these types (e.g. ['bank'] for credit-card issuers). */
  restrictTypes?: InstitutionType[]
}

export function InstitutionSearch({ value, onTextChange, onPick, placeholder, restrictTypes }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const results = useMemo(() => {
    const q = value.trim().toLowerCase()
    const inScope = (i: FinancialInstitution) => !restrictTypes || restrictTypes.includes(i.type)
    if (!q) {
      // Initial state: show curated popular ones first
      const popular = ['BCA', 'Mandiri', 'BNI', 'BRI', 'Jenius', 'Jago', 'Seabank', 'GoPay', 'OVO', 'DANA', 'ShopeePay']
      const popularSet = new Set(popular)
      const popularList = popular
        .map((p) => INDONESIAN_INSTITUTIONS.find((i) => i.brand === p))
        .filter((i): i is FinancialInstitution => !!i && inScope(i))
      const rest = INDONESIAN_INSTITUTIONS
        .filter((i) => !popularSet.has(i.brand) && inScope(i))
        .slice(0, 12)
      return [...popularList, ...rest].slice(0, 20)
    }
    return INDONESIAN_INSTITUTIONS
      .filter(
        (i) =>
          inScope(i) &&
          (i.brand.toLowerCase().includes(q) ||
            i.legal.toLowerCase().includes(q)),
      )
      .slice(0, 20)
  }, [value, restrictTypes])

  function pick(inst: FinancialInstitution) {
    onPick(inst)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4"
          style={{ color: 'var(--ink-soft)' }}
        />
        <input
          value={value}
          onChange={(e) => {
            onTextChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? t('institution_search.placeholder')}
          className="w-full h-9 pl-8 pr-3 text-sm rounded-md border outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--ink)',
          }}
        />
      </div>

      {open && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-lg border shadow-xl max-h-72 overflow-y-auto"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: '0 10px 30px -8px rgba(0,0,0,0.18)',
          }}
        >
          {results.map((inst) => (
            <button
              key={inst.brand}
              type="button"
              onClick={() => pick(inst)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--surface-2)] transition border-b last:border-0"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <InstitutionLogo institution={inst} size={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
                    {inst.brand}
                  </span>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide shrink-0"
                    style={{
                      background:
                        inst.type === 'bank' ? 'rgba(59,130,246,0.10)'
                        : inst.type === 'digital_wallet' ? 'rgba(139,92,246,0.10)'
                        : 'rgba(132,204,22,0.10)',
                      color:
                        inst.type === 'bank' ? '#1E40AF'
                        : inst.type === 'digital_wallet' ? '#6D28D9'
                        : '#4D7C0F',
                    }}
                  >
                    {inst.type === 'digital_wallet' ? 'wallet' : inst.type}
                  </span>
                </div>
                <p className="text-[11px] truncate" style={{ color: 'var(--ink-soft)' }}>
                  {inst.legal}
                </p>
              </div>
            </button>
          ))}

          {/* Always-available custom entry */}
          {value.trim() && !results.some((r) => r.brand.toLowerCase() === value.trim().toLowerCase()) && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--surface-2)] transition border-t"
              style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
            >
              <div
                className="size-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}
              >
                <Plus className="size-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {t('institution_search.use_prefix')}&ldquo;{value.trim()}&rdquo;{t('institution_search.use_suffix')}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                  {t('institution_search.custom_hint')}
                </p>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
