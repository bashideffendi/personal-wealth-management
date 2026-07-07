'use client'

/**
 * Lainnya — layar nav sekunder mobile gaya iOS Settings (F9, mockup approved
 * 2026-07-02). Kartu profil hero ala Budget di atas (avatar center + 3 statistik)
 * + grouped list (.m-sec label nempel kanvas,
 * s-card borderless berisi baris 50px). Menggantikan MoreSheet sebagai rumah
 * semua destinasi di luar 3 tab utama — dibuka dari tab "Lainnya" BottomTabBar.
 *
 * titleKey per baris mirror NAV_ITEMS (src/lib/constants.ts) biar i18n
 * konsisten; ditulis eksplisit karena /dashboard/net-worth di NAV_ITEMS
 * kepake dua label (parent "Kekayaan" vs child "Net Worth") — di sini
 * mockup pakai "Kekayaan" (nav.wealth).
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Building2, Landmark, Coins, Gem, TrendingUp, Target, HandCoins, CreditCard,
  Umbrella, Repeat, FileText, Calculator, Home, Compass, UserCircle, Palette,
  Bell, ChevronRight, type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { fetchActiveHousehold } from '@/lib/household'
import {
  isPushSupported,
  getActivePushSubscription,
  registerPushSubscription,
  unregisterPushSubscription,
} from '@/lib/push-client'
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
  // Tampilan gak ada di NAV_ITEMS — pinjam key profile.appearance_title existing.
  { href: '/dashboard/appearance', titleKey: 'profile.appearance_title', icon: Palette, tint: 'mint' },
]

// Baris "Notifikasi" + toggle Web Push — gaya baris menu existing (chip ikon +
// label + kontrol kanan). Disembunyikan total kalau browser gak support push.
// State ON = ada subscription aktif device ini (izin granted + getSubscription).
function NotificationRow() {
  const { locale } = useI18n()
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return
    setSupported(true)
    getActivePushSubscription()
      .then((sub) => setEnabled(!!sub))
      .catch(() => {})
  }, [])

  if (!supported) return null

  const label = locale === 'id' ? 'Notifikasi' : 'Notifications'

  const onToggle = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (enabled) {
        await unregisterPushSubscription()
        setEnabled(false)
      } else {
        const result = await registerPushSubscription()
        if (result.ok) {
          setEnabled(true)
        } else {
          const msg =
            result.reason === 'denied'
              ? locale === 'id'
                ? 'Izin notifikasi ditolak di browser'
                : 'Notification permission denied'
              : (('message' in result && result.message) ||
                (locale === 'id' ? 'Gagal mengaktifkan notifikasi' : 'Failed to enable notifications'))
          toast.error(msg)
        }
      }
    } catch {
      toast.error(locale === 'id' ? 'Gagal mengubah notifikasi' : 'Failed to update notifications')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="flex items-center gap-2.5 px-3.5 min-h-[54px]"
      style={{ borderTop: '1px solid var(--border-soft)' }}
    >
      <span
        className="grid place-items-center size-[32px] rounded-[8px] shrink-0"
        style={{ background: 'var(--c-mint-soft)', color: 'var(--c-mint-ink)' }}
      >
        <Bell className="size-[17px]" />
      </span>
      <span className="text-[15px] font-medium truncate flex-1 min-w-0" style={{ color: 'var(--ink)' }}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        disabled={busy}
        onClick={onToggle}
        className="relative shrink-0 rounded-full transition-colors disabled:opacity-60"
        style={{
          width: 44,
          height: 26,
          background: enabled ? 'var(--c-mint-ink)' : 'var(--surface-2)',
          border: '1px solid var(--border-soft)',
        }}
      >
        <span
          className="absolute top-1/2 -translate-y-1/2 rounded-full transition-all"
          style={{
            left: enabled ? 20 : 2,
            width: 20,
            height: 20,
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          }}
        />
      </button>
    </div>
  )
}

// Tanpa label section (ala Budget) — grup dipisah murni oleh jarak antar kartu.
function Group({ rows, trailing }: { rows: Row[]; trailing?: React.ReactNode }) {
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
                className="text-[14px] shrink-0"
                style={{ color: row.valueTone === 'danger' ? 'var(--c-coral-ink)' : 'var(--ink-soft)' }}
              >
                {row.value}
              </span>
            )}
            <ChevronRight className="size-4 shrink-0" style={{ color: 'var(--ink-soft)' }} />
          </Link>
        )
      })}
      {trailing}
    </section>
  )
}

export default function MorePage() {
  const { t, locale } = useI18n()
  const supabase = createClient()

  // Identitas + statistik kartu hero — best-effort, gagal fetch tetap render.
  const { data: me } = useQuery({
    queryKey: ['more-hero'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      let fullName = ''
      try {
        const p = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
        fullName = (p.data?.full_name as string | null) ?? ''
      } catch { /* best-effort */ }
      let txCount: number | null = null
      try {
        const r = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
        txCount = r.count ?? null
      } catch { /* best-effort */ }
      let accountCount: number | null = null
      try {
        const r = await supabase
          .from('accounts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
        accountCount = r.count ?? null
      } catch { /* best-effort */ }
      // days dihitung DI SINI (queryFn) — Date.now() di render dilarang
      // React Compiler (impure function during render).
      const days = user.created_at
        ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000)
        : null
      return { email: user.email ?? '', fullName, txCount, accountCount, days }
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

  // 3 statistik hero (ala Budget) — angka besar + label pendek.
  const nf = new Intl.NumberFormat(locale === 'id' ? 'id-ID' : 'en-US')
  const days = me?.days ?? null
  const stats = [
    {
      num: typeof me?.txCount === 'number' ? nf.format(me.txCount) : '–',
      label: locale === 'id' ? 'Transaksi' : 'Transactions',
    },
    {
      num: typeof me?.accountCount === 'number' ? nf.format(me.accountCount) : '–',
      label: locale === 'id' ? 'Akun' : 'Accounts',
    },
    {
      num: days !== null ? nf.format(days) : '–',
      label: locale === 'id' ? 'Hari' : 'Days',
    },
  ]

  return (
    <div className="max-w-md mx-auto">
      {/* Judul auto-hidden di mobile; document.title "Lainnya · Klunting" kepakai MobileAppBar */}
      <QuietPageHeader title={t('nav.section.secondary')} />

      {/* Kartu profil hero (ala Budget) — avatar center + 3 statistik,
          tint gradasi mint sangat halus biar playful tanpa rame */}
      <section
        className="s-card overflow-hidden md:mt-4"
        style={{ background: 'linear-gradient(135deg, var(--c-mint-soft), var(--surface) 62%)' }}
      >
        <Link
          href="/dashboard/profile"
          className="flex flex-col items-center px-3.5 pt-5 pb-4 transition-opacity active:opacity-70"
        >
          <span
            className="grid place-items-center size-16 rounded-full text-[22px] font-bold"
            style={{
              background: 'var(--c-mint-soft)',
              color: 'var(--c-mint-ink)',
              boxShadow: '0 0 0 3px var(--surface)',
            }}
            aria-hidden
          >
            {initial}
          </span>
          <span
            className="mt-2.5 inline-flex items-center gap-0.5 max-w-full text-[15px] font-semibold"
            style={{ color: 'var(--ink)' }}
          >
            <span className="truncate">{name}</span>
            <ChevronRight className="size-3.5 shrink-0" style={{ color: 'var(--ink-soft)' }} />
          </span>
          {me?.email && (
            <span className="mt-0.5 max-w-full truncate text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>
              {me.email}
            </span>
          )}
        </Link>
        <div className="grid grid-cols-3 px-3.5 pb-4 pt-1 text-center">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <div className="num text-[22px] font-bold leading-tight" style={{ color: 'var(--ink)' }}>
                {s.num}
              </div>
              <div className="mt-0.5 truncate text-[12px]" style={{ color: 'var(--ink-soft)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Group rows={MONEY} />
      <Group rows={withValues(AUTOMATION)} />
      <Group rows={withValues(OTHER)} trailing={<NotificationRow />} />
    </div>
  )
}
