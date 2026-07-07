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
  Umbrella, Repeat, FileText, Calculator, Home, Compass, UserCircle,
  ChevronRight, type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchActiveHousehold } from '@/lib/household'
import { QuietPageHeader } from '@/components/layout/quiet-page-header'
import { useI18n } from '@/lib/i18n/context'

type Tint = 'blue' | 'violet' | 'mint' | 'coral'

interface Row {
  href: string
  /** i18n key nav.* — sama persis dgn NAV_ITEMS */
  titleKey: string
  icon: LucideIcon
  /** Aksen brand per baris (ala Budget) — rotasi 4 tint */
  tint?: Tint
  /** Status/nilai inline rata kanan sebelum chevron (ala Budget) */
  value?: string
  valueTone?: 'muted' | 'danger'
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

// Kontrak gak listed lagi di sini — rumahnya sekarang tab Kontrak di /dashboard/recurring.
const AUTOMATION: Row[] = [
  { href: '/dashboard/recurring',      titleKey: 'nav.recurring',      icon: Repeat,     tint: 'blue' },
  { href: '/dashboard/monthly-report', titleKey: 'nav.monthly_report', icon: FileText,   tint: 'violet' },
  { href: '/dashboard/calculators',    titleKey: 'nav.calculators',    icon: Calculator, tint: 'mint' },
]

const OTHER: Row[] = [
  { href: '/dashboard/family',   titleKey: 'nav.family',   icon: Home,       tint: 'coral' },
  { href: '/dashboard/playbook', titleKey: 'nav.playbook', icon: Compass,    tint: 'blue' },
  { href: '/dashboard/profile',  titleKey: 'nav.profile',  icon: UserCircle, tint: 'violet' },
]

// Label paket — mirror PLAN_LABEL di /dashboard/profile (slug legacy ikut).
const PLAN_LABEL: Record<string, string> = {
  basic: 'Basic', full: 'Full Service',
  solo: 'Solo', pro: 'Pro', family: 'Family',
}

// Tanpa label section (ala Budget) — grup dipisah murni oleh jarak antar kartu.
function Group({ rows }: { rows: Row[] }) {
  const { t } = useI18n()
  return (
    <section className="s-card overflow-hidden mt-3.5">
      {rows.map((row, i) => {
        const Icon = row.icon
        return (
          <Link
            key={row.href}
            href={row.href}
            className="flex items-center gap-2.5 px-3.5 min-h-[54px] transition-colors active:bg-[var(--surface-2)]"
            style={{ borderTop: i ? '1px solid var(--border-soft)' : 'none' }}
          >
            <span
              className="grid place-items-center size-[32px] rounded-[8px] shrink-0"
              style={{
                background: `var(--c-${row.tint ?? 'blue'}-soft)`,
                color: `var(--c-${row.tint ?? 'blue'}-ink)`,
              }}
            >
              <Icon className="size-[17px]" />
            </span>
            <span className="text-[15px] font-medium truncate flex-1 min-w-0" style={{ color: 'var(--ink)' }}>
              {t(row.titleKey)}
            </span>
            {row.value && (
              <span
                className="text-[13px] shrink-0"
                style={{ color: row.valueTone === 'danger' ? 'var(--c-coral-ink)' : 'var(--ink-soft)' }}
              >
                {row.value}
              </span>
            )}
            <ChevronRight className="size-4 shrink-0" style={{ color: 'var(--ink-soft)' }} />
          </Link>
        )
      })}
    </section>
  )
}

export default function MorePage() {
  const { t, locale } = useI18n()
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

  // Status inline per baris (ala Budget) — best-effort, gagal fetch baris tetap polos.
  const { data: meta } = useQuery({
    queryKey: ['more-row-meta'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      let recurringActive: number | null = null
      try {
        const r = await supabase
          .from('recurring_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_active', true)
        recurringActive = r.count ?? null
      } catch { /* best-effort */ }
      let familyName: string | null = null
      try {
        familyName = (await fetchActiveHousehold(supabase, user.id))?.name ?? null
      } catch { /* best-effort */ }
      return { recurringActive, familyName }
    },
  })

  // Bulan laporan terakhir = bulan lalu (laporan bulan berjalan belum lengkap).
  const lastMonth = new Date()
  lastMonth.setDate(1)
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  const lastMonthLabel = lastMonth.toLocaleDateString(
    locale === 'id' ? 'id-ID' : 'en-US',
    { month: 'short', year: 'numeric' },
  )

  const rowValue: Record<string, Pick<Row, 'value' | 'valueTone'>> = {
    '/dashboard/monthly-report': { value: lastMonthLabel },
  }
  if (typeof meta?.recurringActive === 'number') {
    rowValue['/dashboard/recurring'] = {
      value: `${meta.recurringActive} ${locale === 'id' ? 'aktif' : 'active'}`,
    }
  }
  if (meta) {
    rowValue['/dashboard/family'] = { value: meta.familyName || 'Solo' }
  }
  const withValues = (rows: Row[]): Row[] =>
    rows.map((row) => (rowValue[row.href] ? { ...row, ...rowValue[row.href] } : row))

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

      <Group rows={MONEY} />
      <Group rows={withValues(AUTOMATION)} />
      <Group rows={withValues(OTHER)} />
    </div>
  )
}
