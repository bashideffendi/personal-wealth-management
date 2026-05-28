'use client'

/**
 * TopNav — editorial horizontal navigation per design handoff 2026-05-28.
 *
 * Layout (3-col grid):
 *   Brand left · 6 primary menus + "Lainnya" dropdown center · search +
 *   AI credits + plus btn + bell + avatar right.
 *
 * Active state: background surface-2 + underline indigo 16×2px di bawah.
 * Sticky top, blur backdrop saat scroll. Hide nav center di mobile,
 * BottomTabBar yang handle navigasi utama mobile.
 *
 * Mengganti sidebar.tsx + header.tsx lama. Provider-provider lain (theme,
 * privacy, calm-mode, lock) tetap diakses via AvatarMenu.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Search, Plus, Bell, ChevronDown, Menu as MenuIcon, X,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AICreditsBadge } from '@/components/layout/ai-credits-badge'
import { AvatarMenu } from '@/components/layout/avatar-menu'
import { NAV_ITEMS, type NavItem } from '@/lib/constants'
import type { User } from '@supabase/supabase-js'

interface TopNavProps {
  user: User
}

// Primary 6 menus per design (Beranda + 5 daily-use). Sisanya masuk
// "Lainnya" dropdown.
const PRIMARY_HREFS = new Set<string>([
  '/dashboard',
  '/dashboard/transactions',
  '/dashboard/budgeting',
  '/dashboard/assets/investment',
  '/dashboard/net-worth',
  '/dashboard/goals',
])

function matchesPath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

// Untuk parent dengan children (Kekayaan), juga match kalau pathname
// ada di salah satu child.
function isActiveItem(pathname: string, item: NavItem): boolean {
  if (matchesPath(pathname, item.href)) return true
  if (item.children) {
    return item.children.some((c) => matchesPath(pathname, c.href))
  }
  return false
}

export function TopNav({ user }: TopNavProps) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [lainnyaOpen, setLainnyaOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const lainnyaRef = useRef<HTMLDivElement>(null)

  // Blur backdrop on scroll (≥ 8px)
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Click-outside untuk Lainnya dropdown
  useEffect(() => {
    if (!lainnyaOpen) return
    function onClick(e: MouseEvent) {
      if (!lainnyaRef.current?.contains(e.target as Node)) {
        setLainnyaOpen(false)
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setLainnyaOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [lainnyaOpen])

  const primary = NAV_ITEMS.filter((it) => PRIMARY_HREFS.has(it.href))
  const lainnya = NAV_ITEMS.filter((it) => !PRIMARY_HREFS.has(it.href))

  // Trigger Cmd+K palette by dispatching keyboard event (CommandPalette
  // sudah listen ke ⌘K)
  function openCommandPalette() {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
  }

  // QuickAddLauncher fired via custom event (existing pattern, dipakai
  // BottomTabBar mobile juga)
  function openQuickAdd() {
    window.dispatchEvent(new CustomEvent('klunting:quick-add'))
  }

  const fullName = (user.user_metadata?.full_name as string) || user.email || 'Pengguna'
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <>
      <header
        className="sticky top-0 z-40 transition-[background,backdrop-filter,border-color] duration-200"
        style={{
          background: scrolled ? 'color-mix(in srgb, var(--bg) 80%, transparent)' : 'var(--bg)',
          backdropFilter: scrolled ? 'blur(14px) saturate(1.2)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(14px) saturate(1.2)' : 'none',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div
          className="mx-auto grid items-center gap-4 md:gap-6 px-4 md:px-8 py-3"
          style={{
            gridTemplateColumns: 'auto 1fr auto',
            maxWidth: 1400,
          }}
        >
          {/* ─── Brand left ─── */}
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="kl-brandmark">
              <span>K</span>
            </div>
            <div className="hidden sm:flex flex-col" style={{ lineHeight: 1 }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  letterSpacing: '-0.02em',
                  color: 'var(--ink)',
                }}
              >
                Klunting
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--text-mute)',
                  marginTop: 4,
                }}
              >
                Wealth Management
              </span>
            </div>
          </Link>

          {/* ─── Nav center (desktop) ─── */}
          <nav className="hidden lg:flex items-center justify-center gap-0.5">
            {primary.map((it) => {
              const active = isActiveItem(pathname, it)
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className="relative px-3.5 py-2.5 rounded-xl text-[13.5px] transition-colors"
                  style={{
                    fontWeight: active ? 600 : 500,
                    color: active ? 'var(--ink)' : 'var(--text-mute)',
                    background: active ? 'var(--surface-2)' : 'transparent',
                  }}
                >
                  {it.label}
                  {active && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2"
                      style={{
                        bottom: -13,
                        width: 16,
                        height: 2,
                        borderRadius: 2,
                        background: 'var(--c-primary)',
                      }}
                    />
                  )}
                </Link>
              )
            })}

            {/* "Lainnya" dropdown */}
            <div className="relative" ref={lainnyaRef}>
              <button
                onClick={() => setLainnyaOpen((o) => !o)}
                className="px-3.5 py-2.5 rounded-xl text-[13.5px] inline-flex items-center gap-1 transition-colors"
                style={{
                  fontWeight: 500,
                  color: lainnyaOpen ? 'var(--ink)' : 'var(--text-mute)',
                  background: lainnyaOpen ? 'var(--surface-2)' : 'transparent',
                }}
              >
                Lainnya
                <ChevronDown
                  className="size-3.5 transition-transform"
                  style={{ transform: lainnyaOpen ? 'rotate(180deg)' : 'none' }}
                />
              </button>

              {lainnyaOpen && (
                <div
                  className="absolute right-0 mt-2 w-[280px] rounded-2xl p-2 overflow-hidden z-50"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    boxShadow: 'var(--shadow-lg)',
                  }}
                >
                  <p
                    className="px-3 py-2 text-[10px] font-bold uppercase"
                    style={{ letterSpacing: '0.12em', color: 'var(--text-faint)' }}
                  >
                    Halaman lainnya
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {lainnya.map((it) => {
                      const active = isActiveItem(pathname, it)
                      return (
                        <Link
                          key={it.href}
                          href={it.href}
                          onClick={() => setLainnyaOpen(false)}
                          className="px-3 py-2 rounded-lg text-[13px] transition-colors"
                          style={{
                            fontWeight: active ? 600 : 500,
                            color: active ? 'var(--c-primary)' : 'var(--ink-muted)',
                            background: active ? 'var(--c-primary-soft)' : 'transparent',
                          }}
                          onMouseEnter={(e) => {
                            if (!active) e.currentTarget.style.background = 'var(--surface-2)'
                          }}
                          onMouseLeave={(e) => {
                            if (!active) e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          {it.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* ─── Mobile menu trigger (replaces center nav on small screens) ─── */}
          <div className="lg:hidden flex justify-center">
            <button
              onClick={() => setMobileOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium"
              style={{
                color: 'var(--ink-muted)',
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
              }}
              aria-label="Buka menu"
            >
              <MenuIcon className="size-4" />
              Menu
            </button>
          </div>

          {/* ─── Actions right ─── */}
          <div className="flex items-center gap-2">
            {/* Search (desktop only) */}
            <button
              onClick={openCommandPalette}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] transition-colors"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                color: 'var(--text-mute)',
                width: 180,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
            >
              <Search className="size-3.5" />
              <span className="flex-1 text-left">Cari…</span>
              <kbd
                className="text-[10px] px-1.5 py-px rounded"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-faint)',
                  border: '1px solid var(--line)',
                }}
              >
                ⌘K
              </kbd>
            </button>

            {/* AI Credits badge (existing component) */}
            <div className="hidden sm:block">
              <AICreditsBadge />
            </div>

            {/* Quick-add (+) — primary button per design */}
            <button
              onClick={openQuickAdd}
              className="kl-btn kl-btn-primary"
              style={{ padding: '9px 12px' }}
              aria-label="Tambah cepat"
            >
              <Plus className="size-3.5" />
            </button>

            {/* Bell — placeholder for notifications (no implementation yet) */}
            <button
              className="relative grid place-items-center"
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--text-2)',
              }}
              aria-label="Notifikasi"
              title="Notifikasi (segera)"
            >
              <Bell className="size-3.5" />
              {/* Placeholder dot — toggle when ada notifikasi unread real */}
              <span
                className="absolute"
                style={{
                  top: 7,
                  right: 7,
                  width: 7,
                  height: 7,
                  background: 'var(--c-coral)',
                  borderRadius: '50%',
                  border: '2px solid var(--bg)',
                }}
              />
            </button>

            {/* Avatar dropdown (existing component) */}
            <div className="hidden sm:block">
              <AvatarMenu user={user} />
            </div>
            <div className="sm:hidden">
              {/* Mobile compact avatar — opens AvatarMenu via existing component */}
              <AvatarMenu user={user} />
            </div>
          </div>
        </div>
      </header>

      {/* ─── Mobile menu drawer ─── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
          />
          <div
            className="absolute top-0 right-0 bottom-0 w-[320px] max-w-[88vw] flex flex-col"
            style={{
              background: 'var(--surface)',
              borderLeft: '1px solid var(--line)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: 'var(--line)' }}
            >
              <div className="flex items-center gap-2">
                <div className="kl-brandmark">
                  <span>K</span>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 18,
                    letterSpacing: '-0.02em',
                    color: 'var(--ink)',
                  }}
                >
                  Klunting
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="grid place-items-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  color: 'var(--ink-muted)',
                }}
                aria-label="Tutup"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <p
                className="px-3 py-2 text-[10px] font-bold uppercase"
                style={{ letterSpacing: '0.12em', color: 'var(--text-faint)' }}
              >
                Utama
              </p>
              <div className="flex flex-col gap-0.5 mb-3">
                {primary.map((it) => {
                  const active = isActiveItem(pathname, it)
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={() => setMobileOpen(false)}
                      className="px-3 py-2.5 rounded-lg text-sm transition-colors"
                      style={{
                        fontWeight: active ? 600 : 500,
                        color: active ? 'var(--c-primary)' : 'var(--ink)',
                        background: active ? 'var(--c-primary-soft)' : 'transparent',
                      }}
                    >
                      {it.label}
                    </Link>
                  )
                })}
              </div>

              <p
                className="px-3 py-2 text-[10px] font-bold uppercase"
                style={{ letterSpacing: '0.12em', color: 'var(--text-faint)' }}
              >
                Lainnya
              </p>
              <div className="flex flex-col gap-0.5">
                {lainnya.map((it) => {
                  const active = isActiveItem(pathname, it)
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={() => setMobileOpen(false)}
                      className="px-3 py-2.5 rounded-lg text-sm transition-colors"
                      style={{
                        fontWeight: active ? 600 : 500,
                        color: active ? 'var(--c-primary)' : 'var(--ink-muted)',
                        background: active ? 'var(--c-primary-soft)' : 'transparent',
                      }}
                    >
                      {it.label}
                    </Link>
                  )
                })}
              </div>
            </div>

            <div
              className="px-5 py-3 border-t"
              style={{ borderColor: 'var(--line)' }}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
                    {fullName}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--ink-soft)' }}>
                    {user.email}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
