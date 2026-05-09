'use client'

import { useRouter } from 'next/navigation'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import {
  UserCircle, Crown, LogOut, Sun, Moon, Monitor, ChevronDown,
} from 'lucide-react'
import { useTheme } from '@/components/theme/theme-provider'
import type { User } from '@supabase/supabase-js'

interface AvatarMenuProps {
  user: User
}

/**
 * Header avatar dropdown — replaces the inline name+email+avatar layout.
 * Houses Profile, Paket, theme cycle, and Logout.
 *
 * Design intent: minimize visual chrome on the header itself by putting
 * account-related actions behind a single tap target.
 */
export function AvatarMenu({ user }: AvatarMenuProps) {
  const router = useRouter()
  const { mode, setMode, resolved } = useTheme()
  const fullName = (user.user_metadata?.full_name as string) || user.email || 'Pengguna'
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

  function cycleTheme() {
    const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'auto' : 'light'
    setMode(next)
  }

  const ThemeIcon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor
  const themeLabel = mode === 'light' ? 'Mode terang' : mode === 'dark' ? 'Mode gelap' : `Auto (${resolved === 'dark' ? 'gelap' : 'terang'})`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 transition hover:bg-[var(--surface-2)]"
          >
            <Avatar size="sm">
              <AvatarFallback
                className="text-xs font-bold"
                style={{
                  background: 'var(--emerald-500)',
                  color: '#FFFFFF',
                }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <ChevronDown className="size-3.5" style={{ color: 'var(--ink-muted)' }} />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-semibold truncate">{fullName}</span>
            <span className="text-xs font-normal text-muted-foreground truncate">{user.email}</span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
          <UserCircle className="size-4 mr-2" />
          Profil
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => router.push('/dashboard/pricing')}>
          <Crown className="size-4 mr-2" />
          Paket Langganan
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={cycleTheme}>
          <ThemeIcon className="size-4 mr-2" />
          <span className="flex-1">{themeLabel}</span>
          <span className="text-[10px] text-muted-foreground">Klik utk ganti</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950/30"
        >
          <LogOut className="size-4 mr-2" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
