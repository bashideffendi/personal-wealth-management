/**
 * StatStrip — ringkasan halaman sebagai SATU bar tersegmentasi, bukan N kartu
 * terpisah. Resep hairline persis HeroStat (portfolio-hero): container border
 * var(--border-soft) + grid gap-px dengan bg border-soft sebagai pemisah sel.
 * Tujuannya hierarki: strip = ringkasan, .s-card individual = konten — mata
 * langsung bisa bedain dua level itu tanpa dua-duanya jadi kotak putih kembar.
 *
 * value bertipe ReactNode biar caller bisa kirim pola dua-span (compact <lg,
 * digit penuh di lg) atau angka polos. sub juga ReactNode — warna default
 * var(--ink-soft), bungkus <span style> di caller buat warna kondisional.
 */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface StatStripItem {
  label: string
  value: ReactNode
  /** teks kecil di bawah value (default var(--ink-soft)) */
  sub?: ReactNode
  /** ikon kecil muted inline di kanan label */
  icon?: LucideIcon
  /** warna ikon — default muted var(--ink-soft) */
  iconColor?: string
  /** warna value — default var(--ink) */
  accent?: string
  /** digit penuh buat hover (title) pas value-nya compact */
  title?: string
  /** blur angka di Calm Mode (nilai untung/rugi dua arah) */
  calmHide?: boolean
}

/* Tailwind butuh nama kelas literal — map jumlah item → kolom lg. */
const LG_COLS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
}

export function StatStrip({ items, className }: { items: StatStripItem[]; className?: string }) {
  return (
    <div
      className={`grid grid-cols-2 ${LG_COLS[items.length] ?? 'lg:grid-cols-4'} gap-px rounded-xl overflow-hidden border ${className ?? ''}`}
      style={{ background: 'var(--border-soft)', borderColor: 'var(--border-soft)' }}
    >
      {items.map((it) => (
        // Sel terakhir ganjil span 2 di <lg biar gak nyisain slot abu kosong.
        <div key={it.label} className="p-3.5 max-lg:last:odd:col-span-2" style={{ background: 'var(--surface)' }}>
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="eyebrow truncate">{it.label}</p>
            {it.icon && <it.icon className="size-3.5 shrink-0" aria-hidden style={{ color: it.iconColor ?? 'var(--ink-soft)' }} />}
          </div>
          <p
            className="num tabular text-lg font-bold mt-1 leading-tight"
            title={it.title}
            data-calm-hide={it.calmHide ? '' : undefined}
            style={{ color: it.accent ?? 'var(--ink)' }}
          >
            {it.value}
          </p>
          {it.sub != null && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>{it.sub}</p>
          )}
        </div>
      ))}
    </div>
  )
}
