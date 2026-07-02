'use client'

/**
 * Lainnya — layar nav sekunder mobile gaya iOS Settings (F9, mockup approved
 * 2026-07-02). Kartu profil di atas + grouped list (.m-sec label nempel kanvas,
 * s-card borderless berisi baris 50px). Menggantikan MoreSheet sebagai rumah
 * semua destinasi di luar 3 tab utama — dibuka dari tab "Lainnya" BottomTabBar.
 *
 * titleKey per baris mirror NAV_ITEMS (src/lib/constants.ts) biar i18n
 * konsisten; ditulis eksplisit karena /dashboard/net-worth di NAV_ITEMS
 * kepake dua label (parent "Kekayaan" vs child "Net Worth") — di sini
 * mockup pakai "Kekayaan" (nav.wealth).
 */

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  Building2, Landmark, Coins, Gem, TrendingUp, Target, HandCoins, CreditCard,
  Umbrella, Repeat, FileClock, FileText, Calculator, Home, Compass, UserCircle,
  ChevronRight, type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { QuietPageHeader } from '@/components/layout/quiet-page-header'
import { useT } from '@/lib/i18n/context'

type Tint = 'blue' | 'violet' | 'mint' | 'coral'

interface Row {
  href: string
  /** i18n key nav.* — sama persis dgn NAV_ITEMS */
  titleKey: string
  icon: LucideIcon
  /** Aksen brand (grup Uang saja) — tanpa tint = chip netral surface-2 */
  tint?: Tint
}

// Grup Uang — aksen brand kecil di chip ikon (blue=struktur, mint=aset,
// violet=rencana, coral=kewajiban). Bukan blok warna besar.
const MONEY: Row[] = [
  { href: '/dashboard/net-worth',          titleKey: 'nav.wealth',            icon: Building2,  tint: 'blue' },
  { href: '/dashboard/accounts',           titleKey: 'nav.accounts',          icon: Landmark,   tint: 'blue' },
  { href: '/dashboard/assets/liquid',      titleKey: 'nav.assets_liquid',     icon: Coins,      tint: 'mint' },
  { href: '/dashboard/assets/non-liquid',  titleKey: 'nav.assets_non_liquid', icon: Gem,        tint: 'violet' },
  { href: '/dashboard/assets/investment',  titleKey: 'nav.investment',        icon: TrendingUp, tint: 'mint' },
  { href: '/dashboard/goals',              titleKey: 'nav.goals',             icon: Target,     tint: 'violet' },
  { href: '/dashboard/debts',              titleKey: 'nav.debts',             icon: HandCoins,  tint: 'coral' },
  { href: '/dashboard/credit-cards',       titleKey: 'nav.credit_cards',      icon: CreditCard, tint: 'coral' },
  { href: '/dashboard/emergency-fund',     titleKey: 'nav.emergency_fund',    icon: Umbrella,   tint: 'mint' },
]

const AUTOMATION: Row[] = [
  { href: '/dashboard/recurring',      titleKey: 'nav.recurring',      icon: Repeat },
  { href: '/dashboard/contracts',      titleKey: 'nav.contracts',      icon: FileClock },
  { href: '/dashboard/monthly-report', titleKey: 'nav.monthly_report', icon: FileText },
  { href: '/dashboard/calculators',    titleKey: 'nav.calculators',    icon: Calculator },
]

const OTHER: Row[] = [
  { href: '/dashboard/family',   titleKey: 'nav.family',   icon: Home },
  { href: '/dashboard/playbook', titleKey: 'nav.playbook', icon: Compass },
  { href: '/dashboard/profile',  titleKey: 'nav.profile',  icon: UserCircle },
]

// Label paket — mirror PLAN_LABEL di /dashboard/profile (slug legacy ikut).
const PLAN_LABEL: Record<string, string> = {
  basic: 'Basic', full: 'Full Service',
  solo: 'Solo', pro: 'Pro', family: 'Family',
}

function Group({ label, rows }: { label: string; rows: Row[] }) {
  const t = useT()
  return (
    <>
      {/* Kelas utility mirror .m-sec (yang cuma ada <md) biar desktop sama */}
      <div className="m-sec mx-0.5 mt-3.5 mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
        <span>{label}</span>
      </div>
      <section className="s-card overflow-hidden">
        {rows.map((row, i) => {
          const Icon = row.icon
          return (
            <Link
              key={row.href}
              href={row.href}
              className="flex items-center gap-2.5 px-3.5 min-h-[50px] transition-colors active:bg-[var(--surface-2)]"
              style={{ borderTop: i ? '1px solid var(--border-soft)' : 'none' }}
            >
              <span
                className="grid place-items-center size-[30px] rounded-[9px] shrink-0"
                style={{
                  background: row.tint ? `var(--c-${row.tint}-soft)` : 'var(--surface-2)',
                  color: row.tint ? `var(--c-${row.tint}-ink)` : 'var(--ink-soft)',
                }}
              >
                <Icon className="size-[15px]" />
              </span>
              <span className="text-[13px] font-medium truncate flex-1 min-w-0" style={{ color: 'var(--ink)' }}>
                {t(row.titleKey)}
              </span>
              <ChevronRight className="size-4 shrink-0" style={{ color: 'var(--ink-soft)' }} />
            </Link>
          )
        })}
      </section>
    </>
  )
}

export default function MorePage() {
  const t = useT()
  const supabase = createClient()

  // Identitas ringan buat kartu profil — best-effort, gagal fetch tetap render.
  const { data: me } = useQuery({
    queryKey: ['more-profile'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      let fullName = ''
      try {
        const p = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
        fullName = (p.data?.full_name as string | null) ?? ''
      } catch { /* best-effort */ }
      let planId: string | null = null
      try {
        const s = await supabase
          .from('subscriptions')
          .select('plan_id')
          .eq('user_id', user.id)
          .in('status', ['active', 'trialing'])
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        planId = (s.data?.plan_id as string | null) ?? null
      } catch { /* pra-migration */ }
      return { email: user.email ?? '', fullName, planId }
    },
  })

  const name = me?.fullName?.trim() || t('profile.default_name')
  const initial = (me?.fullName?.trim() || me?.email || 'K').slice(0, 1).toUpperCase()
  const planLabel = (me?.planId && PLAN_LABEL[me.planId]) || 'Basic'

  return (
    <div className="max-w-md mx-auto">
      {/* Judul auto-hidden di mobile; document.title "Lainnya · Klunting" kepakai MobileAppBar */}
      <QuietPageHeader title={t('nav.section.secondary')} />

      {/* Kartu profil */}
      <Link
        href="/dashboard/profile"
        className="s-card flex items-center gap-3 px-3.5 py-3 transition-colors active:bg-[var(--surface-2)] md:mt-4"
        style={{ display: 'flex' }}
      >
        <span
          className="grid place-items-center size-[38px] rounded-full shrink-0 text-[15px] font-semibold"
          style={{ background: 'var(--c-mint-soft)', color: 'var(--c-mint-ink)' }}
          aria-hidden
        >
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold truncate leading-tight" style={{ color: 'var(--ink)' }}>
            {name}
          </span>
          <span className="block text-[11px] truncate leading-tight mt-0.5" style={{ color: 'var(--ink-soft)' }}>
            {me?.email ? `${me.email} · ` : ''}{t('profile.plan_prefix')} {planLabel}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0" style={{ color: 'var(--ink-soft)' }} />
      </Link>

      <Group label="Uang" rows={MONEY} />
      <Group label="Otomatisasi" rows={AUTOMATION} />
      <Group label={t('nav.section.secondary')} rows={OTHER} />
    </div>
  )
}
