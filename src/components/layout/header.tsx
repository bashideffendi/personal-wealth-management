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
    <header className="flex h-14 items-center gap-4 border-b bg-white px-4 md:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Buka menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Page title */}
      <h1 className="text-lg font-semibold">{pageTitle}</h1>

      {/* Mobile Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="bg-gradient-to-b from-teal-700 to-teal-800 p-0">
            <div className="flex items-center gap-3 px-6 py-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 font-bold text-white">
                PWM
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold text-white">
                  PWM
                </SheetTitle>
                <p className="text-xs text-teal-200">
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
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-teal-50 hover:text-teal-700',
                      isActive && 'bg-teal-50 text-teal-700'
                    )}
                  >
                    {Icon && <Icon className="h-5 w-5" />}
                    {item.label}
                  </Link>
                </SheetClose>
              )
            })}
          </nav>

          <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar size="sm">
                <AvatarFallback className="bg-teal-600 text-xs text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium">{fullName}</p>
                <p className="truncate text-xs text-gray-500">{user.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleLogout}
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
