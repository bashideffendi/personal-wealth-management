'use client'

/**
 * Header avatar dropdown — manual implementation (NOT base-ui Menu).
 *
 * Why manual: base-ui Menu's render-prop trigger + GroupLabel-without-Group
 * combo was throwing in production ("This page couldn't load" overlay).
 * For a 4-item account menu, the simpler hand-rolled approach is more
 * reliable — useState + click-outside + Escape handler.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { BILLING_ENABLED } from '@/lib/billing-flag'
import {
  UserCircle, Crown, LogOut, Sun, Moon, Monitor, ChevronDown,
} from 'lucide-react'
import { useTheme } from '@/components/theme/theme-provider'
import type { User } from '@supabase/supabase-js'

interface AvatarMenuProps {
  user: User
}

export function AvatarMenu({ user }: AvatarMenuProps) {
  const router = useRouter()
  const { mode, setMode, resolved } = useTheme()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const fullName = (user.user_metadata?.full_name as string) || user.email || 'Pengguna'
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handleLogout() {
    setOpen(false)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  function cycleTheme() {
    const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'auto' : 'light'
    setMode(next)
  }

  const ThemeIcon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor
  const themeLabel =
    mode === 'light'
      ? 'Mode terang'
      : mode === 'dark'
        ? 'Mode gelap'
        : `Auto (${resolved === 'dark' ? 'gelap' : 'terang'})`

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu akun"
        className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 transition hover:bg-[var(--surface-2)] cursor-pointer"
      >
        <Avatar size="sm">
          <AvatarFallback
            className="text-xs font-bold"
            style={{
              background: 'var(--c-primary)',
              color: 'var(--c-primary-foreground)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        <ChevronDown
          className="size-3.5 transition-transform"
          style={{
            color: 'var(--ink-muted)',
            transform: open ? 'rotate(180deg)' : undefined,
          }}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 rounded-lg border shadow-[var(--card-shadow)] overflow-hidden z-50"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: '0 10px 30px -8px rgba(0,0,0,0.18)',
          }}
        >
          {/* User identity header */}
          <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--border-soft)' }}>
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
              {fullName}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--ink-soft)' }}>
              {user.email}
            </p>
          </div>

          <div className="py-1">
            <MenuItem onClick={() => go('/dashboard/profile')} icon={UserCircle}>
              Profil
            </MenuItem>
            {/* Billing beku (src/lib/billing-flag.ts) → menu paket disembunyikan */}
            {BILLING_ENABLED && (
              <MenuItem onClick={() => go('/dashboard/pricing')} icon={Crown}>
                Paket Langganan
              </MenuItem>
            )}
          </div>

          <div className="py-1 border-t" style={{ borderColor: 'var(--border-soft)' }}>
            <MenuItem onClick={cycleTheme} icon={ThemeIcon}>
              <span className="flex-1 text-left">{themeLabel}</span>
              <span className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                Klik utk ganti
              </span>
            </MenuItem>
          </div>

          <div className="py-1 border-t" style={{ borderColor: 'var(--border-soft)' }}>
            <MenuItem onClick={handleLogout} icon={LogOut} destructive>
              Keluar
            </MenuItem>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({
  onClick,
  icon: Icon,
  children,
  destructive = false,
}: {
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-sm transition hover:bg-[var(--surface-2)]"
      style={{ color: destructive ? 'var(--c-coral)' : 'var(--ink)' }}
    >
      <Icon className="size-4 shrink-0" />
      {children}
    </button>
  )
}
