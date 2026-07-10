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

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Search, ChevronDown, ArrowLeft, Eye, EyeOff,
} from 'lucide-react'
import { usePrivacy } from '@/components/privacy/privacy-provider'
import { NotificationBell } from '@/components/notifications/notification-bell'
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
                  aria-current={a ? 'page' : undefined}
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

/**
 * MobileAppBar — app bar kontekstual <md (F9 shell, 2026-07-02).
 * Logo bar dibuang total di mobile: subhalaman = back + judul 17px (pola
 * app native); Beranda = null (greeting dirender halaman). Judul dari
 * NAV_ITEMS (longest prefix match) dgn fallback document.title yang
 * di-set QuietPageHeader ("X · Klunting").
 */
// Root tab bottom-bar (selain Beranda) — dibuka via tab, bukan drill-down →
// tanpa tombol back (judul saja). Subroute di bawahnya tetap dapet back.
const TAB_ROOTS = ['/dashboard/transactions', '/dashboard/budgeting', '/dashboard/more']

function MobileAppBar({ pathname }: { pathname: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [docTitle, setDocTitle] = useState('')

  useEffect(() => {
    // document.title di-set effect halaman — baca setelah macrotask biar kebaca.
    const id = setTimeout(() => {
      const dt = document.title.replace(/ · Klunting$/, '')
      setDocTitle(dt === 'Klunting' ? '' : dt)
    }, 60)
    return () => clearTimeout(id)
  }, [pathname])

  const flat = useMemo(() => {
    const out: NavItem[] = []
    for (const it of NAV_ITEMS) {
      out.push(it)
      if (it.children) out.push(...it.children)
    }
    return out
  }, [])

  if (pathname === '/dashboard') return null

  const isTabRoot = TAB_ROOTS.includes(pathname)

  const matched = flat
    .filter((it) => it.href !== '/dashboard' && matchesPath(pathname, it.href))
    .sort((a, b) => b.href.length - a.href.length)[0]
  const title = matched ? (matched.titleKey ? t(matched.titleKey) : matched.label ?? '') : docTitle

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/dashboard')
  }

  return (
    <header
      className="md:hidden sticky top-0 z-40"
      style={{
        background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
        backdropFilter: 'blur(14px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className={`flex items-center gap-1 ${isTabRoot ? 'px-4' : 'px-2'}`} style={{ height: 48 }}>
        {!isTabRoot && (
          <button
            type="button"
            onClick={goBack}
            aria-label="Kembali"
            className="grid place-items-center size-9 rounded-full transition-colors active:bg-[var(--surface-2)]"
            style={{ color: 'var(--ink)' }}
          >
            <ArrowLeft className="size-5" />
          </button>
        )}
        <h1 className="text-[17px] font-semibold truncate" style={{ color: 'var(--ink)', letterSpacing: '-0.01em', fontFamily: 'var(--font-display)' }}>
          {title}
        </h1>
      </div>
    </header>
  )
}

export function TopNav({ user }: TopNavProps) {
  const pathname = usePathname()
  const { t } = useI18n()
  const { hidden: privacyHidden, toggle: togglePrivacy } = usePrivacy()
  const navLabel = (it: NavItem) => (it.titleKey ? t(it.titleKey) : it.label)
  const [scrolled, setScrolled] = useState(false)
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

  return (
    <>
      {/* F9: <md pakai app bar kontekstual, logo bar desktop-only */}
      <MobileAppBar pathname={pathname} />
      <header
        className="hidden md:block sticky top-0 z-40 transition-[background,backdrop-filter,border-color] duration-200"
        style={{
          background: scrolled ? 'color-mix(in srgb, var(--bg) 80%, transparent)' : 'var(--bg)',
          backdropFilter: scrolled ? 'blur(14px) saturate(1.2)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(14px) saturate(1.2)' : 'none',
          borderBottom: '1px solid var(--line)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Mobile: flex justify-end → actions (avatar) PASTI di kanan (brand
            absolute center, nav hidden). Desktop: grid 3-kolom. */}
        <div
          className="relative mx-auto flex items-center justify-end gap-4 md:gap-6 px-4 md:px-8 py-3 lg:grid lg:[grid-template-columns:auto_1fr_auto]"
          style={{ maxWidth: 1400 }}
        >
          {/* ─── Brand — di TENGAH pas mobile (ala Stockbit), kiri pas desktop ─── */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 lg:static lg:translate-x-0 lg:translate-y-0"
          >
            <svg width="28" height="28" viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
              <rect x="35" y="3" width="30" height="30" rx="9" fill="#17b890" />
              <rect x="3" y="35" width="30" height="30" rx="9" fill="#f0664f" />
              <rect x="67" y="35" width="30" height="30" rx="9" fill="#5d6fe0" />
              <rect x="35" y="67" width="30" height="30" rx="9" fill="#8b4fb0" />
            </svg>
            <span
              style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 21, letterSpacing: '-0.02em', color: 'var(--ink)' }}
            >
              klunting
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
                  aria-current={active ? 'page' : undefined}
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

          {/* ─── Actions right (mobile: flex justify-end; desktop: grid kolom 3) ─── */}
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

            {/* Privacy mode — global hide-numbers toggle (ghost button) */}
            <button
              type="button"
              onClick={togglePrivacy}
              className="hidden md:grid place-items-center transition-colors"
              style={{ width: 38, height: 38, borderRadius: 12, background: 'transparent', color: 'var(--text-2)' }}
              aria-label={privacyHidden ? 'Tampilkan angka' : 'Sembunyikan angka'}
              aria-pressed={privacyHidden}
              title={privacyHidden ? 'Tampilkan angka' : 'Sembunyikan angka'}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {privacyHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>

            {/* Bell hidup — inbox in-app + alert target watchlist (P3 #4) */}
            <NotificationBell />

            <AvatarMenu user={user} />
          </div>
        </div>
      </header>

    </>
  )
}
