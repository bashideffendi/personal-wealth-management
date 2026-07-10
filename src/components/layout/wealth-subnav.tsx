'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS } from '@/lib/constants'

// Ambil children grup 'Kekayaan' dari NAV_ITEMS — satu sumber kebenaran
// dengan sidebar (jangan duplikat daftar label/href di sini).
const WEALTH_LINKS = NAV_ITEMS.find((i) => i.label === 'Kekayaan')?.children ?? []

/**
 * WealthSubnav — strip tab persisten klaster Kekayaan (P3 #5).
 * Desktop-only (hidden md:flex): 7 chip link keluarga Kekayaan biar pindah
 * antar halaman (Net Worth / Akun / Aset / Utang / Kartu Kredit / Dana
 * Darurat) gak perlu balik ke sidebar. Active = exact match pathname; hub
 * /dashboard/assets BUKAN anggota keluarga, jadi di sana gak ada chip yang
 * nyala — strip tetap dirender sebagai konteks navigasi.
 * Kontrak: tanpa props, self-contained (dipakai juga oleh halaman lain
 * tanpa perlu setup).
 */
export function WealthSubnav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Navigasi Kekayaan"
      className="hidden md:flex items-center gap-1 min-h-9 overflow-x-auto no-scrollbar"
    >
      {WEALTH_LINKS.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors duration-150${active ? '' : ' hover:bg-[var(--surface-2)]'}`}
            style={active
              ? { background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }
              : { color: 'var(--ink-muted)' }}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
