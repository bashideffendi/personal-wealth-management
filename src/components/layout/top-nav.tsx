'use client'

/**
 * TopNav — editorial horizontal navigation per design handoff 2026-05-28.
 *
 * Layout (3-col grid):
 *   Brand left · primary menus (+ dropdown utk item ber-children spt Kekayaan)
 *   + "Lainnya" dropdown center · search + lang + AI credits + plus + bell + avatar right.
 *
 * Labels are i18n-wired (t(titleKey)); a language toggle (ID/EN) sits in the
 * top actions so switching is one tap from anywhere.
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
import { useI18n, useT } from '@/lib/i18n/context'
import { LangToggle } from '@/components/layout/lang-toggle'
import type { User } from '@supabase/supabase-js'

interface TopNavProps {
  user: User
}

const PRIMARY_HREFS = new Set<string>([
  '/dashboard',
  '/dashboard/transactions',
  '/dashboard/budgeting',
  '/dashboard/assets/investment',
  '/dashboard/net-worth',
  '/dashboard/goals',
])

const HIDDEN_HREFS = new Set<string>([
  '/dashboard/rules',
  '/dashboard/subscriptions',
])

function matchesPath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

function isActiveItem(pathname: string, item: NavItem): boolean {
  if (matchesPath(pathname, item.href)) return true
  if (item.children) {
    return item.children.some((c) => matchesPath(pathname, c.href))
  }
  return false
}

/** Dropdown nav reusable — dipakai buat "Kekayaan" (children) + "Lainnya". */
function NavDropdown({
  label, items, pathname, align = 'left',
}: {
  label: string
  items: NavItem[]
  pathname: string
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const t = useT()
  const active = items.some((it) => isActiveItem(pathname, it))

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative px-3.5 py-2.5 rounded-xl text-[13.5px] inline-flex items-center gap-1 transition-colors"
        style={{
          fontWeight: active ? 600 : 500,
          color: active || open ? 'var(--ink)' : 'var(--text-mute)',
          background: 'transparent',
        }}
        onMouseEnter={(e) => { if (!active && !open) e.currentTarget.style.color = 'var(--ink)' }}
        onMouseLeave={(e) => { if (!active && !open) e.currentTarget.style.color = 'var(--text-mute)' }}
      >
        {label}
        <ChevronDown
          className="size-3.5 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
        {active && (
          <span
            className="absolute left-1/2 -translate-x-1/2"
            style={{ bottom: -13, width: 16, height: 2, borderRadius: 2, background: 'var(--c-primary)' }}
          />
        )}
      </button>

      {open && (
        <div
          className="absolute mt-2 w-[240px] rounded-2xl p-2 overflow-hidden z-50"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-lg)',
            ...(align === 'right' ? { right: 0 } : { left: 0 }),
          }}
        >
          <div className="flex flex-col gap-0.5">
            {items.map((it) => {
              const a = isActiveItem(pathname, it)
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-lg text-[13px] transition-colors"
                  style={{
                    fontWeight: a ? 600 : 500,
                    color: a ? 'var(--c-primary)' : 'var(--ink-muted)',
                    background: a ? 'var(--c-primary-soft)' : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!a) e.currentTarget.style.background = 'var(--surface-2)' }}
                  onMouseLeave={(e) => { if (!a) e.currentTarget.style.background = 'transparent' }}
                >
                  {it.titleKey ? t(it.titleKey) : it.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function TopNav({ user }: TopNavProps) {
  const pathname = usePathname()
  const { t } = useI18n()
  const navLabel = (it: NavItem) => (it.titleKey ? t(it.titleKey) : it.label)
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMac, setIsMac] = useState(false)
  useEffect(() => { setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) }, [])

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const primary = NAV_ITEMS.filter((it) => PRIMARY_HREFS.has(it.href))
  const lainnya = NAV_ITEMS.filter((it) => !PRIMARY_HREFS.has(it.href) && !HIDDEN_HREFS.has(it.href))

  function openCommandPalette() {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
  }

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
            <div
              className="grid place-items-center"
              style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'var(--c-primary)', color: 'var(--c-primary-foreground)',
                fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.04em',
              }}
            >
              K
            </div>
            <span
              className="hidden sm:inline"
              style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink)' }}
            >
              Klunting
            </span>
          </Link>

          {/* ─── Nav center (desktop) ─── */}
          <nav className="hidden lg:flex items-center justify-center gap-0.5">
            {primary.map((it) => {
              if (it.children?.length) {
                return <NavDropdown key={it.href} label={navLabel(it)} items={it.children} pathname={pathname} />
              }
              const active = isActiveItem(pathname, it)
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className="relative px-3.5 py-2.5 rounded-xl text-[13.5px] transition-colors"
                  style={{
                    fontWeight: active ? 600 : 500,
                    color: active ? 'var(--ink)' : 'var(--text-mute)',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--ink)' }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-mute)' }}
                >
                  {navLabel(it)}
                  {active && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2"
                      style={{ bottom: -13, width: 16, height: 2, borderRadius: 2, background: 'var(--c-primary)' }}
                    />
                  )}
                </Link>
              )
            })}

            <NavDropdown label={t('nav.section.secondary')} items={lainnya} pathname={pathname} align="right" />
          </nav>

          {/* ─── Mobile menu trigger ─── */}
          <div className="lg:hidden flex justify-center">
            <button
              onClick={() => setMobileOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium"
              style={{ color: 'var(--ink-muted)', background: 'var(--surface-2)', border: '1px solid var(--line)' }}
              aria-label="Buka menu"
            >
              <MenuIcon className="size-4" />
              {t('nav.menu')}
            </button>
          </div>

          {/* ─── Actions right ─── */}
          <div className="flex items-center gap-2">
            <button
              onClick={openCommandPalette}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] transition-colors"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text-mute)', width: 180 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
            >
              <Search className="size-3.5" />
              <span className="flex-1 text-left">{t('common.search')}</span>
              <kbd
                className="text-[10px] px-1.5 py-px rounded"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', border: '1px solid var(--line)' }}
              >
                {isMac ? '⌘K' : 'Ctrl K'}
              </kbd>
            </button>

            {/* Language toggle (ID / EN) */}
            <div className="hidden sm:block">
              <LangToggle />
            </div>

            <div className="hidden sm:block">
              <AICreditsBadge />
            </div>

            <button
              onClick={openQuickAdd}
              className="btn-outline btn-primary"
              style={{ padding: '9px 12px' }}
              aria-label="Tambah cepat"
            >
              <Plus className="size-3.5" />
            </button>

            <button
              className="relative grid place-items-center"
              style={{ width: 38, height: 38, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text-2)' }}
              aria-label="Notifikasi"
              title="Notifikasi (segera)"
            >
              <Bell className="size-3.5" />
            </button>

            <div className="hidden sm:block">
              <AvatarMenu user={user} />
            </div>
            <div className="sm:hidden">
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
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} />
          <div
            className="absolute top-0 right-0 bottom-0 w-[320px] max-w-[88vw] flex flex-col"
            style={{ background: 'var(--surface)', borderLeft: '1px solid var(--line)', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
              <div className="flex items-center gap-2">
                <div
                  className="grid place-items-center"
                  style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.04em', boxShadow: 'var(--card-shadow)' }}
                >
                  K
                </div>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                  Klunting
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="grid place-items-center"
                style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
                aria-label="Tutup"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <p className="px-3 py-2 text-[10px] font-bold uppercase" style={{ letterSpacing: '0.12em', color: 'var(--text-faint)' }}>
                {t('nav.section.main')}
              </p>
              <div className="flex flex-col gap-0.5 mb-3">
                {primary.map((it) => {
                  if (it.children?.length) {
                    return (
                      <div key={it.href} className="mt-1">
                        <p className="px-3 py-1.5 text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                          {navLabel(it)}
                        </p>
                        <div className="ml-3 flex flex-col gap-0.5 border-l pl-2" style={{ borderColor: 'var(--line)' }}>
                          {it.children.map((c) => {
                            const active = isActiveItem(pathname, c)
                            return (
                              <Link
                                key={c.href}
                                href={c.href}
                                onClick={() => setMobileOpen(false)}
                                className="px-3 py-2 rounded-lg text-[13px] transition-colors"
                                style={{
                                  fontWeight: active ? 600 : 500,
                                  color: active ? 'var(--c-primary)' : 'var(--ink-muted)',
                                  background: active ? 'var(--c-primary-soft)' : 'transparent',
                                }}
                              >
                                {navLabel(c)}
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }
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
                      {navLabel(it)}
                    </Link>
                  )
                })}
              </div>

              <p className="px-3 py-2 text-[10px] font-bold uppercase" style={{ letterSpacing: '0.12em', color: 'var(--text-faint)' }}>
                {t('nav.section.secondary')}
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
                      {navLabel(it)}
                    </Link>
                  )
                })}
              </div>

              {/* Language toggle (mobile) */}
              <div className="px-3 mt-5">
                <p className="text-[10px] font-bold uppercase mb-2" style={{ letterSpacing: '0.12em', color: 'var(--text-faint)' }}>{t('common.language')}</p>
                <LangToggle full />
              </div>
            </div>

            <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--line)' }}>
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
