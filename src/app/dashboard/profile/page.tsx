'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  User, Bell, Database, Shield, Sparkles,
  Loader2, Crown, AlertTriangle, ExternalLink, LogOut,
  Lock, Mail, Trash2, Download, Palette, Moon, LockKeyhole,
} from 'lucide-react'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { useLock } from '@/components/security/lock-provider'
import { MfaSetup } from '@/components/security/mfa-setup'
import { ExportDataButton } from '@/components/export-data-button'
import { DeleteAccountButton } from '@/components/delete-account-button'
import { useT } from '@/lib/i18n/context'

interface Profile {
  id: string
  full_name: string
  currency: string
  language: string
  theme_accent: string
  show_decimals: boolean
  daily_reminder_enabled: boolean
  daily_reminder_time: string
  ai_credits: number
  avatar_url: string | null
}

interface Subscription {
  plan_id: string
  status: string
  started_at: string
  expires_at: string | null
}

interface Plan {
  id: string
  name: string
  price_idr: number
  ai_credits_monthly: number
}

const ACCENT_COLORS = [
  { id: 'burgundy', name: 'Burgundy', hex: '#8b1538' },
  { id: 'indigo',   name: 'Indigo',   hex: '#4f46e5' },
  { id: 'emerald',  name: 'Emerald',  hex: '#10B981' },
  { id: 'amber',    name: 'Amber',    hex: '#d97706' },
  { id: 'rose',     name: 'Rose',     hex: '#e11d48' },
  { id: 'slate',    name: 'Graphite', hex: '#475569' },
]

const PLAN_BADGES: Record<string, { label: string; bg: string; fg: string }> = {
  basic:  { label: 'Basic',        bg: '#f1f5f9', fg: '#475569' },
  full:   { label: 'Full Service', bg: '#d1fae5', fg: '#047857' },
  // Legacy slugs kept for backward compatibility (pre-migration 020)
  solo:   { label: 'Solo',         bg: '#f1f5f9', fg: '#475569' },
  pro:    { label: 'Pro',          bg: '#fef3c7', fg: '#92400e' },
  family: { label: 'Family',       bg: '#dbeafe', fg: '#1e40af' },
}

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const lock = useLock()
  const t = useT()

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [, setPlan] = useState<Plan | null>(null)

  // Counters for dashboard summary
  const [accountCount, setAccountCount] = useState(0)
  const [txCount, setTxCount] = useState(0)

  // Save state
  const [savingPrefs, setSavingPrefs] = useState(false)

  // Password change
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // PIN (handled by LockProvider; this dialog drives setPin/removePin)
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinRemoveInput, setPinRemoveInput] = useState('')
  const [pinRemoveDialogOpen, setPinRemoveDialogOpen] = useState(false)
  const [savingPin, setSavingPin] = useState(false)

  async function savePin() {
    if (!/^\d{4,6}$/.test(pinInput)) {
      toast.error(t('profile.toast_pin_format'))
      return
    }
    if (pinInput !== pinConfirm) {
      toast.error(t('profile.toast_pin_mismatch'))
      return
    }
    setSavingPin(true)
    const ok = await lock.setPin(pinInput)
    setSavingPin(false)
    if (!ok) {
      toast.error(t('profile.toast_pin_save_failed'))
      return
    }
    setPinInput('')
    setPinConfirm('')
    setPinDialogOpen(false)
    toast.success(t('profile.toast_pin_active'), {
      description: `${t('profile.toast_pin_active_desc_prefix')} ${lock.lockAfterMin} ${t('profile.toast_pin_active_desc_suffix')}`,
    })
  }

  async function confirmRemovePin() {
    setSavingPin(true)
    const ok = await lock.removePin(pinRemoveInput)
    setSavingPin(false)
    if (!ok) {
      toast.error(t('profile.toast_pin_wrong'))
      return
    }
    setPinRemoveInput('')
    setPinRemoveDialogOpen(false)
    toast.success(t('profile.toast_pin_disabled'))
  }

  // Biometric enrollment uses a separate dialog to capture the current PIN
  // (required by LockProvider for security — biometric is convenience over PIN,
  // not a way to set up auth without one).
  const [bioDialogOpen, setBioDialogOpen] = useState(false)
  const [bioPin, setBioPin] = useState('')
  const [bioBusy, setBioBusy] = useState(false)

  async function enrollBiometric() {
    setBioBusy(true)
    const ok = await lock.enrollBiometric(bioPin)
    setBioBusy(false)
    if (!ok) {
      toast.error(t('profile.toast_bio_enroll_failed'), {
        description: t('profile.toast_bio_enroll_failed_desc'),
      })
      return
    }
    setBioPin('')
    setBioDialogOpen(false)
    toast.success(t('profile.toast_bio_active'), {
      description: t('profile.toast_bio_active_desc'),
    })
  }

  function disableBiometric() {
    lock.removeBiometric()
    toast.success(t('profile.toast_bio_disabled'))
  }

  // Reset confirmation
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetTyped, setResetTyped] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { setLoading(false); return }
    setUser({ id: u.id, email: u.email ?? '' })

    // Profile is required — others are best-effort (gracefully degrade if
    // migration 014 hasn't been applied yet)
    const pRes = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle()

    // Hydrate profile with safe defaults so the UI never crashes on missing columns
    const raw = (pRes.data ?? {}) as Partial<Profile>
    setProfile({
      id: raw.id ?? u.id,
      full_name: raw.full_name ?? '',
      currency: raw.currency ?? 'IDR',
      language: raw.language ?? 'id',
      theme_accent: raw.theme_accent ?? 'burgundy',
      show_decimals: raw.show_decimals ?? false,
      daily_reminder_enabled: raw.daily_reminder_enabled ?? false,
      daily_reminder_time: raw.daily_reminder_time ?? '20:00',
      ai_credits: raw.ai_credits ?? 0,
      avatar_url: raw.avatar_url ?? null,
    })

    // These can fail if migration 014 hasn't run — wrap in try/catch
    try {
      const sRes = await supabase
        .from('subscriptions')
        .select('plan_id, status, started_at, expires_at')
        .eq('user_id', u.id)
        .in('status', ['active', 'trialing'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (sRes.data) {
        setSubscription(sRes.data as Subscription)
        const planRes = await supabase
          .from('plans')
          .select('id, name, price_idr, ai_credits_monthly')
          .eq('id', (sRes.data as Subscription).plan_id)
          .maybeSingle()
        if (planRes.data) setPlan(planRes.data as Plan)
      }
    } catch (err) {
      console.warn('Subscription/plans query failed (likely migration 014 not yet run):', err)
    }

    try {
      const [accRes, txRes] = await Promise.all([
        supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('user_id', u.id),
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', u.id),
      ])
      setAccountCount(accRes.count ?? 0)
      setTxCount(txRes.count ?? 0)
    } catch (err) {
      console.warn('Counts query failed:', err)
    }

    setLoading(false)
  }

  async function savePreferences() {
    if (!profile || !user) return
    setSavingPrefs(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        currency: profile.currency,
        language: profile.language,
        theme_accent: profile.theme_accent,
        show_decimals: profile.show_decimals,
      })
      .eq('id', user.id)
    setSavingPrefs(false)
    if (error) { toast.error(t('profile.toast_save_failed'), { description: error.message }); return }
    toast.success(t('profile.toast_prefs_saved'))
  }

  async function updatePassword() {
    if (newPassword.length < 8) { toast.error(t('profile.toast_password_min')); return }
    if (newPassword !== confirmPassword) { toast.error(t('profile.toast_password_mismatch')); return }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) { toast.error(t('profile.toast_password_failed'), { description: error.message }); return }
    setNewPassword(''); setConfirmPassword('')
    toast.success(t('profile.toast_password_updated'))
  }

  async function toggleDailyReminder(enabled: boolean) {
    if (!profile || !user) return
    setProfile({ ...profile, daily_reminder_enabled: enabled })
    const { error } = await supabase
      .from('profiles')
      .update({ daily_reminder_enabled: enabled })
      .eq('id', user.id)
    if (error) {
      setProfile({ ...profile, daily_reminder_enabled: !enabled })
      toast.error(t('profile.toast_update_failed'), { description: error.message })
    }
  }

  async function updateReminderTime(time: string) {
    if (!profile || !user) return
    setProfile({ ...profile, daily_reminder_time: time })
    await supabase
      .from('profiles')
      .update({ daily_reminder_time: time })
      .eq('id', user.id)
  }

  // PIN is now managed device-side via LockProvider (see hook below).
  // Server-side `profiles.pin_hash` is left untouched but no longer the
  // source of truth — locking is enforced by LockProvider + LockScreen.

  async function resetAllData() {
    if (!user) return
    if (resetTyped !== 'HAPUS SEMUA') { toast.error(t('profile.toast_reset_confirm_required')); return }
    setResetting(true)
    // Delete all user-scoped data (RLS filters per user, so this is safe)
    await Promise.all([
      supabase.from('transactions').delete().eq('user_id', user.id),
      supabase.from('budgets').delete().eq('user_id', user.id),
      supabase.from('debt_payments').delete().eq('user_id', user.id),
      supabase.from('credit_card_payments').delete().eq('user_id', user.id),
      supabase.from('debts').delete().eq('user_id', user.id),
      supabase.from('credit_cards').delete().eq('user_id', user.id),
      supabase.from('investments').delete().eq('user_id', user.id),
      supabase.from('stock_transactions').delete().eq('user_id', user.id),
      supabase.from('dividends').delete().eq('user_id', user.id),
      supabase.from('goals').delete().eq('user_id', user.id),
      supabase.from('recurring_transactions').delete().eq('user_id', user.id),
      supabase.from('categorization_rules').delete().eq('user_id', user.id),
      supabase.from('contracts').delete().eq('user_id', user.id),
      supabase.from('assets_liquid').delete().eq('user_id', user.id),
      supabase.from('assets_non_liquid').delete().eq('user_id', user.id),
      supabase.from('emergency_funds').delete().eq('user_id', user.id),
      supabase.from('net_worth_snapshots').delete().eq('user_id', user.id),
      supabase.from('transfers').delete().eq('user_id', user.id),
      supabase.from('accounts').delete().eq('user_id', user.id),
    ])
    setResetting(false)
    setResetDialogOpen(false)
    toast.success(t('profile.toast_reset_done'), { description: t('profile.toast_reset_done_desc') })
    window.location.href = '/dashboard'
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> {t('profile.loading')}
      </div>
    )
  }

  if (!profile || !user) {
    return <div className="text-muted-foreground">{t('profile.load_failed')}</div>
  }

  const today = formatDate(new Date())
  const planBadge = subscription
    ? (PLAN_BADGES[subscription.plan_id] ?? PLAN_BADGES.basic)
    : PLAN_BADGES.basic

  return (
    <div className="space-y-6">
      {/* Header — dark gradient profile anchor */}
      <section
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, #0A0A0F 0%, #14141A 50%, #1C1C24 100%)',
          color: '#F5F5F7',
          boxShadow: '0 24px 60px -20px rgba(0,0,0,0.40)',
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: -100,
            right: -60,
            width: 360,
            height: 360,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.05), transparent 65%)',
          }}
        />
        <div className="relative p-6 sm:p-7">
          <p
            className="text-[11px] font-semibold tracking-[0.18em] uppercase"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            {t('profile.eyebrow')}
          </p>
          <div className="mt-3 flex items-end justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl font-bold"
                style={{
                  background: 'var(--c-primary)',
                  color: 'var(--c-primary-foreground)',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 800,
                  fontSize: 28,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  boxShadow: '0 8px 24px -8px rgba(16, 24, 40, 0.14)',
                }}
              >
                {(profile.full_name || user.email).slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h1
                  className="font-bold"
                  style={{
                    fontSize: 'clamp(28px, 4vw, 40px)',
                    color: '#FFFFFF',
                    letterSpacing: '-0.035em',
                  }}
                >
                  {profile.full_name?.trim() || t('profile.default_name')}
                </h1>
                <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {user.email}
                </p>
                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
                    style={{
                      background: subscription?.plan_id === 'full' ? 'rgba(16,185,129,0.20)' : 'rgba(255,255,255,0.10)',
                      color: subscription?.plan_id === 'full' ? '#6EE7B7' : 'rgba(255,255,255,0.85)',
                    }}
                  >
                    {subscription?.plan_id === 'full' && <Crown className="size-3" />}
                    {subscription?.status === 'trialing' && <Sparkles className="size-3" />}
                    {t('profile.plan_prefix')} {planBadge.label}
                    {subscription?.status === 'trialing' && ` (${t('profile.plan_trial')})`}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {accountCount} {t('profile.stat_accounts')} · {txCount} {t('profile.stat_transactions')} · {t('profile.stat_since')} {formatDate(new Date(subscription?.started_at ?? Date.now()))}
                  </span>
                </div>
              </div>
            </div>
            <Link
              href="/dashboard/pricing"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90"
              style={{
                background: 'var(--c-primary)',
                color: 'var(--c-primary-foreground)',
                boxShadow: '0 4px 12px -4px rgba(16, 24, 40, 0.12)',
              }}
            >
              <Crown className="size-4" />
              {subscription?.status === 'trialing' || subscription?.plan_id === 'basic' ? t('profile.cta_upgrade') : t('profile.cta_manage_sub')}
            </Link>
          </div>
          <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.45)' }}>{today}</p>
        </div>
      </section>

      {/* AI Credits card */}
      <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-orange-50 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white p-2 shadow-sm">
              <Sparkles className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold">{t('profile.ai_credits_title')}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t('profile.ai_credits_desc')}
              </p>
              <p className="mt-3 text-3xl font-bold tabular-nums">
                {profile.ai_credits.toLocaleString('id-ID')}
                <span className="text-sm font-normal text-muted-foreground ml-1">{t('profile.ai_credits_unit')}</span>
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/pricing"
            className="self-end inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 transition"
          >
            <Sparkles className="size-3.5" />
            {t('profile.ai_credits_topup')}
          </Link>
        </div>
      </div>

      {/* Tabs section */}
      <Tabs defaultValue="preferensi" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="preferensi"><User className="size-3.5 mr-1.5" />{t('profile.tab_preferences')}</TabsTrigger>
          <TabsTrigger value="keamanan"><Shield className="size-3.5 mr-1.5" />{t('profile.tab_security')}</TabsTrigger>
          <TabsTrigger value="notifikasi"><Bell className="size-3.5 mr-1.5" />{t('profile.tab_notifications')}</TabsTrigger>
          <TabsTrigger value="data"><Database className="size-3.5 mr-1.5" />{t('profile.tab_data')}</TabsTrigger>
        </TabsList>

        {/* PREFERENSI */}
        <TabsContent value="preferensi" className="space-y-6 mt-6">
          <section className="rounded-xl border bg-[var(--surface)] p-5 space-y-4">
            <h3 className="font-semibold">{t('profile.identity_title')}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="fullname">{t('profile.display_name_label')}</Label>
                <Input
                  id="fullname"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder={t('profile.display_name_placeholder')}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('profile.email_label')}</Label>
                <Input value={user.email} disabled />
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-[var(--surface)] p-5 space-y-4">
            <h3 className="font-semibold">{t('profile.appearance_title')}</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>{t('profile.currency_label')}</Label>
                <Select value={profile.currency} onValueChange={(v) => setProfile({ ...profile, currency: v ?? 'IDR' })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('profile.currency_placeholder')}>
                      {(v) => ({
                        IDR: 'Rupiah (Rp)',
                        USD: 'US Dollar ($)',
                        SGD: 'Singapore Dollar (S$)',
                        MYR: 'Ringgit (RM)',
                      } as Record<string, string>)[v] ?? 'Rupiah (Rp)'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IDR">Rupiah (Rp)</SelectItem>
                    <SelectItem value="USD">US Dollar ($)</SelectItem>
                    <SelectItem value="SGD">Singapore Dollar (S$)</SelectItem>
                    <SelectItem value="MYR">Ringgit (RM)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t('profile.language_label')}</Label>
                <Select value={profile.language} onValueChange={(v) => setProfile({ ...profile, language: v ?? 'id' })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('profile.language_placeholder')}>
                      {(v) => v === 'en' ? 'English' : 'Bahasa Indonesia'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="id">Bahasa Indonesia</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="flex items-center gap-1.5">{t('profile.show_decimals_label')}</Label>
                <button
                  type="button"
                  onClick={() => setProfile({ ...profile, show_decimals: !profile.show_decimals })}
                  className={`h-10 rounded-lg border text-sm font-medium transition ${profile.show_decimals ? 'bg-[var(--c-mint-soft)] border-emerald-300 text-[var(--c-mint)]' : 'bg-muted/40 border-muted text-muted-foreground'}`}
                >
                  {profile.show_decimals ? `${t('profile.decimals_on')} (${formatCurrency(12500.5)})` : `${t('profile.decimals_off')} (${formatCurrency(12500)})`}
                </button>
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-2"><Moon className="size-4" />{t('profile.theme_mode_label')}</Label>
              <ThemeToggle />
              <p className="text-xs text-muted-foreground mt-2">
                {t('profile.theme_mode_hint')}
              </p>
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-2"><Palette className="size-4" />{t('profile.accent_color_label')}</Label>
              <div className="flex flex-wrap gap-2">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setProfile({ ...profile, theme_accent: c.id })}
                    className={`group flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs font-medium transition ${profile.theme_accent === c.id ? 'border-foreground' : 'border-transparent hover:border-muted-foreground/30'}`}
                  >
                    <span className="h-4 w-4 rounded-full" style={{ backgroundColor: c.hex }} />
                    {c.name}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{t('profile.accent_color_hint')}</p>
            </div>
          </section>

          <div className="flex justify-end">
            <Button onClick={savePreferences} disabled={savingPrefs}>
              {savingPrefs && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
              {t('profile.save_prefs_btn')}
            </Button>
          </div>
        </TabsContent>

        {/* KEAMANAN */}
        <TabsContent value="keamanan" className="space-y-6 mt-6">
          <section className="rounded-xl border bg-[var(--surface)] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-muted-foreground" />
              <h3 className="font-semibold">{t('profile.change_password_title')}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="password" placeholder={t('profile.new_password_placeholder')} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <Input type="password" placeholder={t('profile.confirm_password_placeholder')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <Button onClick={updatePassword} disabled={savingPassword || !newPassword}>
              {savingPassword && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
              {t('profile.update_password_btn')}
            </Button>
          </section>

          <MfaSetup />

          <section className="rounded-xl border bg-[var(--surface)] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              <h3 className="font-semibold">{t('profile.email_section_title')}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('profile.account_email_label')} <span className="font-medium text-foreground">{user.email}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {t('profile.change_email_hint')}
            </p>
          </section>

          <section className="rounded-xl border bg-[var(--surface)] p-5 space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-start gap-2">
                <Shield className="size-4 mt-0.5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">{t('profile.pin_lock_title')}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {t('profile.pin_lock_desc')}
                  </p>
                </div>
              </div>
              {lock.hasPin ? (
                <div className="flex gap-2">
                  <Badge className="bg-[var(--c-mint-soft)] text-[var(--c-mint)]">{t('profile.badge_active')}</Badge>
                  <Button variant="outline" size="sm" onClick={() => setPinRemoveDialogOpen(true)}>
                    {t('profile.pin_disable_btn')}
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => setPinDialogOpen(true)}>{t('profile.pin_set_btn')}</Button>
              )}
            </div>

            {lock.hasPin && (
              <div className="pt-3 border-t flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <Label htmlFor="lock-after" className="text-sm sm:min-w-[140px]">
                  {t('profile.autolock_label')}
                </Label>
                <Select
                  value={String(lock.lockAfterMin)}
                  onValueChange={(v) => v && lock.setLockAfter(parseInt(v, 10))}
                >
                  <SelectTrigger id="lock-after" className="sm:max-w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 {t('profile.minutes_unit')}</SelectItem>
                    <SelectItem value="5">5 {t('profile.minutes_unit')}</SelectItem>
                    <SelectItem value="15">15 {t('profile.minutes_unit')}</SelectItem>
                    <SelectItem value="30">30 {t('profile.minutes_unit')}</SelectItem>
                    <SelectItem value="60">60 {t('profile.minutes_unit')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    lock.lockNow()
                    toast.success(t('profile.toast_app_locked'))
                  }}
                  className="sm:ml-auto"
                >
                  <LockKeyhole className="size-3.5" />
                  {t('profile.lock_now_btn')}
                </Button>
              </div>
            )}
          </section>

          {/* Biometric — only shown when PIN aktif & device support */}
          {lock.hasPin && lock.biometricSupported && (
            <section className="rounded-xl border bg-[var(--surface)] p-5 space-y-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex items-start gap-2">
                  <Shield className="size-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold">{t('profile.biometric_title')}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {t('profile.biometric_desc')}
                    </p>
                  </div>
                </div>
                {lock.hasBiometric ? (
                  <div className="flex gap-2">
                    <Badge className="bg-[var(--c-mint-soft)] text-[var(--c-mint)]">{t('profile.badge_active')}</Badge>
                    <Button variant="outline" size="sm" onClick={disableBiometric}>
                      {t('profile.biometric_disable_btn')}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => setBioDialogOpen(true)}>
                    {t('profile.biometric_enable_btn')}
                  </Button>
                )}
              </div>
            </section>
          )}
        </TabsContent>

        {/* NOTIFIKASI */}
        <TabsContent value="notifikasi" className="space-y-6 mt-6">
          <section className="rounded-xl border bg-[var(--surface)] p-5 space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-start gap-2">
                <Bell className="size-4 mt-0.5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">{t('profile.daily_reminder_title')}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {t('profile.daily_reminder_desc')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleDailyReminder(!profile.daily_reminder_enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${profile.daily_reminder_enabled ? 'bg-[var(--c-mint)]' : 'bg-muted'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition ${profile.daily_reminder_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {profile.daily_reminder_enabled && (
              <div className="grid gap-1.5 sm:max-w-xs">
                <Label htmlFor="reminder-time">{t('profile.reminder_time_label')}</Label>
                <Input
                  id="reminder-time"
                  type="time"
                  value={profile.daily_reminder_time}
                  onChange={(e) => updateReminderTime(e.target.value)}
                />
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-amber-50 border-amber-200 p-5">
            <p className="text-sm text-amber-900">
              {t('profile.push_notice_prefix')} <strong>{t('profile.push_notice_bold')}</strong> {t('profile.push_notice_suffix')}
            </p>
          </section>
        </TabsContent>

        {/* DATA */}
        <TabsContent value="data" className="space-y-6 mt-6">
          <section className="rounded-xl border bg-[var(--surface)] p-5 space-y-4">
            <div className="flex items-start gap-2">
              <Download className="size-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <h3 className="font-semibold">{t('profile.export_title')}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t('profile.export_desc')}
                </p>
                <div className="mt-3">
                  <ExportDataButton />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t('profile.export_csv_hint')}
                </p>
              </div>
            </div>
          </section>

          <section
            className="rounded-xl border-2 p-5 space-y-3"
            style={{
              background: 'var(--c-coral-soft)',
              borderColor: 'color-mix(in srgb, var(--c-coral) 25%, transparent)',
            }}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 mt-0.5 shrink-0" style={{ color: 'var(--c-coral)' }} />
              <div className="flex-1">
                <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>{t('profile.danger_zone_title')}</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--c-coral)' }}>
                  {t('profile.danger_zone_prefix')} <strong>{t('profile.danger_zone_bold')}</strong>.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-3"
                  onClick={() => setResetDialogOpen(true)}
                >
                  <Trash2 className="size-4" data-icon="inline-start" />
                  {t('profile.reset_all_btn')}
                </Button>

                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'color-mix(in srgb, var(--c-coral) 20%, transparent)' }}>
                  <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{t('profile.delete_account_desc')}</p>
                  <div className="mt-3"><DeleteAccountButton /></div>
                </div>
              </div>
            </div>
          </section>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="rounded-xl border bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-4">
            <Link href="#" className="hover:underline text-muted-foreground">{t('profile.footer_tutorial')}</Link>
            <Link href="#" className="hover:underline text-muted-foreground">{t('profile.footer_whats_new')}</Link>
            <a href="mailto:support@klunting.com" className="hover:underline text-muted-foreground inline-flex items-center gap-1">
              {t('profile.footer_contact_support')} <ExternalLink className="size-3" />
            </a>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="size-4" data-icon="inline-start" />
            {t('profile.logout_btn')}
          </Button>
        </div>
      </div>

      {/* PIN Set Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('profile.pin_dialog_title')}</DialogTitle>
            <DialogDescription>
              {t('profile.pin_dialog_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="pin">{t('profile.pin_new_label')}</Label>
              <Input id="pin" type="password" inputMode="numeric" maxLength={6} value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} placeholder="••••" autoFocus />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pin-confirm">{t('profile.pin_confirm_label')}</Label>
              <Input id="pin-confirm" type="password" inputMode="numeric" maxLength={6} value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialogOpen(false)}>{t('profile.cancel_btn')}</Button>
            <Button onClick={savePin} disabled={savingPin || pinInput.length < 4 || pinConfirm.length < 4}>
              {savingPin && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
              {t('profile.pin_save_btn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Biometric enrollment — verify PIN then create WebAuthn credential */}
      <Dialog open={bioDialogOpen} onOpenChange={setBioDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('profile.bio_dialog_title')}</DialogTitle>
            <DialogDescription>
              {t('profile.bio_dialog_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="bio-pin">{t('profile.current_pin_label')}</Label>
              <Input
                id="bio-pin"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={bioPin}
                onChange={(e) => setBioPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBioDialogOpen(false); setBioPin('') }}>
              {t('profile.cancel_btn')}
            </Button>
            <Button onClick={enrollBiometric} disabled={bioBusy || bioPin.length < 4}>
              {bioBusy && <Loader2 className="size-4 animate-spin" />}
              {t('profile.continue_btn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIN Remove Dialog — require current PIN before removal */}
      <Dialog open={pinRemoveDialogOpen} onOpenChange={setPinRemoveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('profile.pin_remove_dialog_title')}</DialogTitle>
            <DialogDescription>
              {t('profile.pin_remove_dialog_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="pin-current">{t('profile.current_pin_label')}</Label>
              <Input id="pin-current" type="password" inputMode="numeric" maxLength={8} value={pinRemoveInput} onChange={(e) => setPinRemoveInput(e.target.value.replace(/\D/g, ''))} placeholder="••••" autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPinRemoveDialogOpen(false); setPinRemoveInput('') }}>
              {t('profile.cancel_btn')}
            </Button>
            <Button onClick={confirmRemovePin} disabled={savingPin || pinRemoveInput.length < 4} variant="destructive">
              {savingPin && <Loader2 className="size-4 animate-spin" />}
              {t('profile.pin_remove_btn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirm */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--c-coral)' }}>{t('profile.reset_dialog_title')}</DialogTitle>
            <DialogDescription>
              {t('profile.reset_dialog_desc_prefix')} <strong>{t('profile.reset_dialog_desc_bold')}</strong>. {t('profile.reset_dialog_desc_suffix')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="confirm-input">{t('profile.reset_type_prefix')} <strong>HAPUS SEMUA</strong> {t('profile.reset_type_suffix')}</Label>
            <Input
              id="confirm-input"
              value={resetTyped}
              onChange={(e) => setResetTyped(e.target.value)}
              placeholder="HAPUS SEMUA"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetDialogOpen(false); setResetTyped('') }}>{t('profile.cancel_btn')}</Button>
            <Button variant="destructive" onClick={resetAllData} disabled={resetting || resetTyped !== 'HAPUS SEMUA'}>
              {resetting && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
              {t('profile.reset_submit_btn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
