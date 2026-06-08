'use client'

/**
 * AccountsCard — "Akun & Saldo": daftar rekening + saldo + total.
 * Widget #1 ala Monarch ("di mana duitku") — jawab sebelum kartu analisis.
 * Pola row mirror RecentTransactions; saldo dari Account.current_balance.
 */

import Link from 'next/link'
import { ChevronRight, Landmark, Coins, Smartphone, TrendingUp, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'
import { ACCOUNT_TYPES } from '@/lib/constants'
import type { Account } from '@/types'

type AccountRow = Pick<Account, 'id' | 'name' | 'type' | 'current_balance'>

const TYPE_ICON: Record<Account['type'], React.ComponentType<{ className?: string }>> = {
  cash: Coins,
  bank: Landmark,
  digital_wallet: Smartphone,
  rdn: TrendingUp,
  investment: TrendingUp,
}
const TYPE_TONE: Record<Account['type'], string> = {
  cash: 'amber',
  bank: 'primary',
  digital_wallet: 'violet',
  rdn: 'mint',
  investment: 'mint',
}

export function AccountsCard({ accounts }: { accounts: AccountRow[] }) {
  const t = useT()
  const total = accounts.reduce((s, a) => s + (a.current_balance || 0), 0)
  const sorted = [...accounts].sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0))

  return (
    <article className="s-card flex flex-col" style={{ padding: 24 }}>
      <div className="flex items-start justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <p className="eyebrow">{t('accounts_card.title')}</p>
          <p className="num tabular mt-1 truncate" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
            {formatCurrency(total)}
          </p>
        </div>
        <Link
          href="/dashboard/accounts"
          className="btn-outline shrink-0"
          style={{ fontSize: 11, padding: '6px 10px' }}
        >
          {t('accounts_card.view_all')} <ChevronRight className="size-3" />
        </Link>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--text-mute)' }}>
          {t('accounts_card.empty')}
        </p>
      ) : (
        <div className="flex flex-col mt-3 flex-1 min-h-0 overflow-y-auto">
          {sorted.map((a, i) => {
            const Icon = TYPE_ICON[a.type] ?? Wallet
            const tone = TYPE_TONE[a.type] ?? 'primary'
            return (
              <div
                key={a.id}
                className="grid items-center gap-3 py-2.5"
                style={{ gridTemplateColumns: '36px 1fr auto', borderTop: i ? '1px solid var(--line)' : 'none' }}
              >
                <div
                  className="grid place-items-center"
                  style={{ width: 32, height: 32, borderRadius: 10, background: `var(--c-${tone}-soft)`, color: `var(--c-${tone})` }}
                >
                  <Icon className="size-[15px]" />
                </div>
                <div className="min-w-0">
                  <p className="truncate" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{a.name}</p>
                  <p className="truncate" style={{ fontSize: 11.5, color: 'var(--text-mute)' }}>{ACCOUNT_TYPES[a.type] ?? a.type}</p>
                </div>
                <p className="num tabular text-right" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
                  {formatCurrency(a.current_balance || 0)}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}
