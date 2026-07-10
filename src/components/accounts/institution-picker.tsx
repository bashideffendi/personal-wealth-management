'use client'

/**
 * Langkah "pilih institusi" di dialog tambah akun — versi ringan picker
 * bank ala app Budget (search + list berlogo + grup huruf A-Z sticky).
 * Jenis akun sudah dipilih di langkah sebelumnya, jadi list terkunci
 * ke satu grup (tanpa chips). Mobile/bottom-sheet friendly: list scroll
 * internal & tinggi (isi sheet), tap target ≥44px, teks pendek.
 *
 * Logo: reuse InstitutionLogo untuk brand yang punya ticker IDX
 * (aset /stock-logos sudah ada); sisanya lingkaran inisial pakai warna
 * brand dari bank-catalog.
 */

import { useMemo, useState } from 'react'
import { Search, PencilLine } from 'lucide-react'
import {
  filterCatalog,
  catalogInstitution,
  type BankCatalogItem,
  type BankCatalogType,
} from '@/lib/bank-catalog'
import { InstitutionLogo } from './institution-logo'
import { useI18n } from '@/lib/i18n/context'

interface Props {
  /** Grup katalog — dari jenis akun yang dipilih di langkah sebelumnya */
  type: BankCatalogType
  onPick: (item: BankCatalogItem) => void
  /** Skip katalog — lanjut ke form dengan nama bebas */
  onManual: () => void
}

function CatalogAvatar({ item, size = 30 }: { item: BankCatalogItem; size?: number }) {
  const inst = catalogInstitution(item)
  // Ticker IDX = logo beneran sudah ada di /stock-logos → reuse InstitutionLogo.
  if (inst?.ticker) return <InstitutionLogo institution={inst} size={size} shape="circle" />
  const initials = item.name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center text-white font-bold"
      style={{
        width: size,
        height: size,
        background: item.color,
        fontSize: size * (initials.length >= 2 ? 0.38 : 0.48),
        letterSpacing: '-0.03em',
      }}
      aria-hidden
    >
      {initials}
    </div>
  )
}

export function InstitutionPicker({ type, onPick, onManual }: Props) {
  const { locale } = useI18n()
  const [query, setQuery] = useState('')

  // Kelompok per huruf awal (sort A-Z; non-huruf → '#') — index ala Budget.
  const sections = useMemo(() => {
    const items = filterCatalog(query, type)
      .filter((i) => i.type === type)
      .sort((a, b) => a.name.localeCompare(b.name))
    const map = new Map<string, BankCatalogItem[]>()
    for (const item of items) {
      const first = (item.name[0] ?? '').toUpperCase()
      const letter = /[A-Z]/.test(first) ? first : '#'
      const bucket = map.get(letter)
      if (bucket) bucket.push(item)
      else map.set(letter, [item])
    }
    return [...map.entries()]
  }, [query, type])

  return (
    <div className="grid gap-2.5">
      {/* Search kecil */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4" style={{ color: 'var(--ink-soft)' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={locale === 'id' ? 'Cari institusi…' : 'Search institutions…'}
          className="w-full h-9 pl-8 pr-3 text-sm rounded-md border outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink)' }}
          autoComplete="off"
        />
      </div>

      {/* List institusi — grup per huruf awal, header sticky */}
      <div
        className="rounded-lg border overflow-y-auto overscroll-contain max-h-[55vh] min-h-[35vh] sm:min-h-0 sm:max-h-64"
        style={{ borderColor: 'var(--border)' }}
      >
        {sections.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-center" style={{ color: 'var(--ink-soft)' }}>
            {locale === 'id' ? 'Nggak ketemu — ketik manual aja.' : 'No match — type it manually.'}
          </p>
        ) : (
          sections.map(([letter, items], si) => (
            <div key={letter}>
              <div
                className="sticky top-0 z-10 px-3 pt-1.5 pb-0.5 text-[11px] font-semibold"
                style={{
                  background: 'var(--surface)',
                  color: 'var(--c-mint-ink)',
                  borderTop: si ? '1px solid var(--border-soft)' : 'none',
                }}
              >
                {letter}
              </div>
              {items.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => onPick(item)}
                  className="w-full flex items-center gap-3 px-3 text-left hover:bg-[var(--surface-2)] active:opacity-70 transition"
                  style={{ minHeight: 44 }}
                >
                  <CatalogAvatar item={item} />
                  <span className="flex-1 min-w-0 text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Lainnya / ketik manual — selalu ada */}
      <button
        type="button"
        onClick={onManual}
        className="w-full flex items-center gap-3 px-3 rounded-lg border border-dashed text-left hover:bg-[var(--surface-2)] active:opacity-70 transition"
        style={{ minHeight: 44, borderColor: 'var(--border)' }}
      >
        <div className="size-[30px] rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>
          <PencilLine className="size-4" />
        </div>
        <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
          {locale === 'id' ? 'Lainnya / ketik manual' : 'Other / type manually'}
        </span>
      </button>
    </div>
  )
}
