'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Building2,
  CreditCard,
  Shield,
  TrendingUp,
  LogOut,
} from 'lucide-react'
import { NAV_ITEMS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Receipt,
  Wallet,
  Building2,
  CreditCard,
  Shield,
  TrendingUp,
}

interface SidebarProps {
  user: User
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const fullName =
    (user.user_metadata?.full_name as string) || user.email || 'Pengguna'
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col">
      <div className="flex flex-1 flex-col bg-slate-900">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/20 font-bold text-sm text-teal-400">
            PWM
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-200">PWM</h1>
            <p className="text-xs text-slate-400">Personal Wealth Management</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = iconMap[item.icon]
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-slate-800 hover:text-slate-200',
                  isActive && 'border-l-2 border-teal-400 bg-teal-500/10 text-teal-400'
                )}
              >
                {Icon && <Icon className="size-5 shrink-0" />}
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User Info */}
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <Avatar size="sm">
              <AvatarFallback className="bg-teal-500/20 text-xs text-teal-400">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium text-slate-200">
                {fullName}
              </p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleLogout}
              className="text-slate-500 hover:bg-slate-800 hover:text-red-400"
              aria-label="Keluar"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  )
}
