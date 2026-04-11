'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, LogOut } from 'lucide-react'
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Building2,
  CreditCard,
  Shield,
  TrendingUp,
} from 'lucide-react'
import { NAV_ITEMS } from '@/lib/constants'
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

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transaksi',
  '/budget': 'Anggaran',
  '/assets': 'Aset',
  '/debts': 'Utang',
  '/emergency-fund': 'Dana Darurat',
  '/net-worth': 'Kekayaan Bersih',
}

interface HeaderProps {
  user: User
}

export function Header({ user }: HeaderProps) {
  const [open, setOpen] = useState(false)
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

  const pageTitle = pageTitles[pathname] || 'Dashboard'

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-4 md:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Buka menu"
      >
        <Menu className="h-5 w-5 text-slate-600" />
      </Button>

      {/* Page title */}
      <h1 className="font-semibold text-lg text-slate-800">{pageTitle}</h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Desktop user info */}
      <div className="hidden md:flex items-center gap-3">
        <span className="text-sm text-slate-600">{fullName}</span>
        <Avatar size="sm">
          <AvatarFallback className="bg-teal-500/20 text-xs text-teal-400">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Mobile Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-slate-900 border-slate-800">
          <SheetHeader className="p-0">
            <div className="flex items-center gap-3 px-6 py-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/20 font-bold text-sm text-teal-400">
                PWM
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold text-slate-200">
                  PWM
                </SheetTitle>
                <p className="text-xs text-slate-400">
                  Personal Wealth Management
                </p>
              </div>
            </div>
          </SheetHeader>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {NAV_ITEMS.map((item) => {
              const Icon = iconMap[item.icon]
              const isActive = pathname === item.href
              return (
                <SheetClose key={item.href} render={<span />}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-slate-800 hover:text-slate-200',
                      isActive && 'border-l-2 border-teal-400 bg-teal-500/10 text-teal-400'
                    )}
                  >
                    {Icon && <Icon className="size-5 shrink-0" />}
                    {item.label}
                  </Link>
                </SheetClose>
              )
            })}
          </nav>

          <div className="border-t border-slate-800 p-4">
            <div className="flex items-center gap-3">
              <Avatar size="sm">
                <AvatarFallback className="bg-teal-500/20 text-xs text-teal-400">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium text-slate-200">{fullName}</p>
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
        </SheetContent>
      </Sheet>
    </header>
  )
}
