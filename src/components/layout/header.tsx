'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, LogOut, ChevronDown, Moon, Sun, Search } from 'lucide-react'
import { NAV_ITEMS, type NavItem } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { LanguageToggle } from '@/components/layout/language-toggle'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'

function matchesPath(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

function findTitle(items: NavItem[], pathname: string): { label: string; key?: string } | null {
  let best: { label: string; key?: string; depth: number } | null = null
  function walk(list: NavItem[], depth: number) {
    for (const it of list) {
      if (matchesPath(pathname, it.href) && (best === null || depth > best.depth)) {
        best = { label: it.label, key: it.titleKey, depth }
      }
      if (it.children) walk(it.children, depth + 1)
    }
  }
  walk(items, 0)
  return best
}

function findBreadcrumb(items: NavItem[], pathname: string): NavItem[] {
  // Walk to the deepest matching item and reconstruct the path.
  let best: NavItem[] | null = null
  function walk(list: NavItem[], trail: NavItem[]) {
    for (const it of list) {
      const next = [...trail, it]
      if (matchesPath(pathname, it.href) && (!best || next.length > best.length)) {
        best = next
      }
      if (it.children) walk(it.children, next)
    }
  }
  walk(items, [])
  return best ?? []
}

interface HeaderProps {
  user: User
}

export function Header({ user }: HeaderProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const t = useT()

  const fullName =
    (user.user_metadata?.full_name as string) || user.email || 'Pengguna'
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const breadcrumb = findBreadcrumb(NAV_ITEMS, pathname)
  const titleInfo = findTitle(NAV_ITEMS, pathname)
  const pageTitle = titleInfo ? (titleInfo.key ? t(titleInfo.key) : titleInfo.label) : t('nav.dashboard')
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header
      className="flex h-16 items-center gap-4 border-b px-4 md:px-8 sticky top-0 z-20"
      style={{
        backgroundColor: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Buka menu"
      >
        <Menu className="h-5 w-5" style={{ color: 'var(--ink-muted)' }} />
      </Button>

      <div className="flex-1 min-w-0">
        <h1
          className="text-lg font-bold leading-tight truncate"
          style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
        >
          {pageTitle}
        </h1>
        <div className="hidden md:flex items-center gap-1 mt-0.5 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
          {breadcrumb.length > 1 ? (
            breadcrumb.map((b, i) => (
              <span key={b.href} className="flex items-center gap-1">
                {i > 0 && <span className="opacity-40">/</span>}
                <span className={i === breadcrumb.length - 1 ? 'font-medium' : ''} style={i === breadcrumb.length - 1 ? { color: 'var(--ink)' } : undefined}>
                  {b.titleKey ? t(b.titleKey) : b.label}
                </span>
              </span>
            ))
          ) : (
            <span>{today}</span>
          )}
        </div>
      </div>

      <div className="hidden md:flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true })
            window.dispatchEvent(event)
          }}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs border transition-colors hover:bg-[var(--surface-2)]"
          style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-muted)' }}
          aria-label={t('common.search')}
          title="⌘K / Ctrl+K"
        >
          <Search className="h-3.5 w-3.5" />
          <span>{t('common.search')}</span>
          <kbd className="text-[10px] ml-3 px-1 rounded font-mono" style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>⌘K</kbd>
        </button>
        <LanguageToggle />
        <ThemeToggle />
        <div className="text-right">
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {fullName}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
            {user.email}
          </p>
        </div>
        <Avatar size="sm">
          <AvatarFallback
            className="text-xs font-bold"
            style={{
              background: 'var(--lime-400)',
              color: 'var(--black)',
            }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-72 p-0 border-none"
          style={{ backgroundColor: '#09090B' }}
        >
          <SheetHeader className="p-0">
            <div
              className="flex items-center gap-3 px-5 py-5 border-b"
              style={{ borderColor: 'rgba(148,163,184,0.10)' }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl font-bold text-[13px]"
                style={{ background: 'var(--lime-400)', color: 'var(--black)' }}
              >
                PWM
              </div>
              <div>
                <SheetTitle className="text-sm font-bold text-white leading-tight">
                  Personal Wealth
                </SheetTitle>
                <p className="text-[11px] text-white/40">Management</p>
              </div>
            </div>
          </SheetHeader>

          <MobileNav pathname={pathname} onClose={() => setOpen(false)} />

          <div
            className="border-t p-3"
            style={{ borderColor: 'rgba(148,163,184,0.10)' }}
          >
            <div className="flex items-center gap-3 p-2">
              <Avatar size="sm">
                <AvatarFallback
                  className="text-xs font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #EC4899 100%)',
                    color: '#FFFFFF',
                  }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium text-white">
                  {fullName}
                </p>
                <p className="truncate text-xs text-white/40">
                  {user.email}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleLogout}
                className="text-white/50 hover:bg-white/10 hover:text-[#F43F5E]"
                aria-label="Keluar"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}

function MobileNav({
  pathname,
  onClose,
}: {
  pathname: string
  onClose: () => void
}) {
  const t = useT()
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>()
    function walk(list: NavItem[]) {
      for (const it of list) {
        if (it.children && it.children.some((c) => matchesPath(pathname, c.href) || (c.children?.some((cc) => matchesPath(pathname, cc.href)) ?? false))) {
          s.add(it.href)
        }
        if (it.children) walk(it.children)
      }
    }
    walk(NAV_ITEMS)
    return s
  })

  useEffect(() => {
    // no-op; just to anchor hooks rule
  }, [])

  function toggle(href: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  function render(item: NavItem, depth: number, parentKey = 'root') {
    const active = matchesPath(pathname, item.href)
    const hasChildren = !!item.children?.length
    const open = expanded.has(item.href)
    return (
      <div key={`${parentKey}>${item.href}`} className="select-none">
        <div className={cn('group relative flex items-center', depth === 0 ? 'px-2.5 py-1.5' : 'py-1.5')}>
          <SheetClose render={<span />}>
            <Link
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-all',
                active ? 'text-white font-semibold' : 'text-[#CBD5E1] hover:bg-white/5',
              )}
              style={
                active
                  ? {
                      background:
                        'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.18))',
                    }
                  : undefined
              }
            >
              {item.emoji && <span className="text-[15px]">{item.emoji}</span>}
              <span className="flex-1">{item.titleKey ? t(item.titleKey) : item.label}</span>
            </Link>
          </SheetClose>
          {hasChildren && (
            <button
              type="button"
              onClick={() => toggle(item.href)}
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/5 hover:text-white"
            >
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
            </button>
          )}
        </div>
        {hasChildren && open && (
          <div className="ml-4 pl-2 border-l border-white/10 space-y-0.5">
            {item.children!.map((c) => render(c, depth + 1, item.href))}
          </div>
        )}
      </div>
    )
  }

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {NAV_ITEMS.map((it) => render(it, 0))}
    </nav>
  )
}
