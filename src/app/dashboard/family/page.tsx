'use client'

import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BILLING_ENABLED } from '@/lib/billing-flag'
import { formatDate, formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'
import { toast } from 'sonner'
import {
  fetchActiveHousehold, fetchHouseholdDirectory, generateInviteToken, isOwner,
  fetchHouseholdGoals, fetchHouseholdActivities, logActivity, getHouseholdNetWorth, setMyNetWorthSharing,
  type Household, type MemberWithProfile, type HouseholdInvitation,
  type HouseholdGoal, type HouseholdActivity, type HouseholdNetWorth,
} from '@/lib/household'

import { QuietPageHeader } from '@/components/layout/quiet-page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumberInput } from '@/components/ui/number-input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Users, UserPlus, Crown, Copy, Check, Loader2, Trash2,
  AlertCircle, Mail, CalendarClock, Home, ChevronDown,
  Wallet, ArrowLeftRight, PieChart, Lock, Target, Activity,
  Eye, SlidersHorizontal, TrendingUp,
} from 'lucide-react'

interface MyUser { id: string; email: string }

const REL_KEYS = ['pasangan', 'orang_tua', 'anak', 'saudara', 'lainnya'] as const
const REL_LABEL_KEY: Record<string, string> = {
  pasangan: 'family.rel_pasangan', orang_tua: 'family.rel_orang_tua',
  anak: 'family.rel_anak', saudara: 'family.rel_saudara', lainnya: 'family.rel_lainnya',
}

function timeAgo(iso: string, t: (key: string) => string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return t('family.time_just_now')
  if (m < 60) return `${m} ${t('family.time_minutes_ago')}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ${t('family.time_hours_ago')}`
  const d = Math.floor(h / 24)
  if (d === 1) return t('family.time_yesterday')
  if (d < 30) return `${d} ${t('family.time_days_ago')}`
  return formatDate(new Date(iso))
}

export default function FamilyPage() {
  const supabase = createClient()
  const qc = useQueryClient()
  const t = useT()

  // Create household
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newHouseholdName, setNewHouseholdName] = useState('')
  const [creating, setCreating] = useState(false)

  // Invite
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  // Leave/remove
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)

  // Kartu utama: detail anggota collapse (pola Share Manager: baris avatar + chevron)
  const [membersOpen, setMembersOpen] = useState(false)

  // Net worth sharing toggle
  const [togglingNW, setTogglingNW] = useState(false)

  // Permissions dialog (owner edits a member)
  const [permsMember, setPermsMember] = useState<MemberWithProfile | null>(null)
  const [permRel, setPermRel] = useState<string>('')
  const [permCanEdit, setPermCanEdit] = useState(true)
  const [savingPerms, setSavingPerms] = useState(false)

  // Shared goal dialog
  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState(0)
  const [goalDeadline, setGoalDeadline] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)

  const pageQuery = useQuery({
    queryKey: ['family'],
    staleTime: 60 * 1000,
    // Error skema (tabel/kolom/relasi absen) deterministik — retry cuma bikin
    // user natap spinner ±7 detik. Satu retry buat error transien aja, dan
    // jangan refetch tiap fokus tab (tombol Coba Lagi = jalur recovery).
    retry: (count, err) => {
      const code = (err as { code?: string })?.code ?? ''
      if (code.startsWith('PGRST') || code === '42703' || code === '42P01' || code === '42501') return false
      return count < 1
    },
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // getSession = lokal (tanpa round-trip auth server); middleware sudah
      // memvalidasi sesi, dan semua data di bawah tetap dijaga RLS.
      const { data: { session } } = await supabase.auth.getSession()
      const u = session?.user
      if (!u) throw new Error('unauthenticated')
      const me: MyUser = { id: u.id, email: u.email ?? '' }
      const hh = await fetchActiveHousehold(supabase, u.id)
      if (!hh) {
        return {
          user: me, household: null as Household | null,
          members: [] as MemberWithProfile[], invitations: [] as HouseholdInvitation[],
          goals: [] as HouseholdGoal[], activities: [] as HouseholdActivity[],
          netWorth: null as HouseholdNetWorth | null,
          partialFailures: [] as string[],
        }
      }
      // Members = KRITIS (inti halaman) → gagal = error card. Sisanya
      // SEKUNDER → best-effort: satu section gagal gak boleh matiin halaman
      // (dulu Promise.all bikin error feed aktivitas meledakkan semuanya).
      // select('*') tanpa embed: kolom 041 dibaca opsional, dan JANGAN
      // pernah embed profiles dari sini (PGRST200 — gak ada FK ke profiles).
      const [membersRes, dirRes, invitesRes, goalsRes, activitiesRes, nwRes] = await Promise.allSettled([
        supabase
          .from('household_members')
          .select('*')
          .eq('household_id', hh.id)
          .order('joined_at'),
        fetchHouseholdDirectory(supabase, hh.id),
        supabase
          .from('household_invitations')
          .select('*')
          .eq('household_id', hh.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        fetchHouseholdGoals(supabase, hh.id),
        fetchHouseholdActivities(supabase, hh.id),
        getHouseholdNetWorth(supabase, hh.id),
      ])
      if (membersRes.status === 'rejected') throw membersRes.reason
      if (membersRes.value.error) throw membersRes.value.error

      const directory = dirRes.status === 'fulfilled' ? dirRes.value : new Map<string, string | null>()
      const partialFailures: string[] = []
      const invitations = invitesRes.status === 'fulfilled' && !invitesRes.value.error
        ? ((invitesRes.value.data ?? []) as HouseholdInvitation[])
        : (partialFailures.push('section_invites'), [] as HouseholdInvitation[])
      const goals = goalsRes.status === 'fulfilled'
        ? goalsRes.value
        : (partialFailures.push('section_goals'), [] as HouseholdGoal[])
      const activitiesRaw = activitiesRes.status === 'fulfilled'
        ? activitiesRes.value
        : (partialFailures.push('section_activities'), [] as HouseholdActivity[])

      type RawMember = {
        household_id: string; user_id: string; role: 'owner' | 'member'; joined_at: string
        can_edit?: boolean; relationship?: string | null; share_net_worth?: boolean
      }
      const raw = (membersRes.value.data ?? []) as RawMember[]
      return {
        user: me,
        household: hh,
        members: raw.map((r) => ({
          household_id: r.household_id, user_id: r.user_id, role: r.role, joined_at: r.joined_at,
          can_edit: r.can_edit ?? true, relationship: r.relationship ?? null, share_net_worth: r.share_net_worth ?? false,
          full_name: directory.get(r.user_id) ?? null,
          email: r.user_id === u.id ? (u.email ?? null) : null,
        })) as MemberWithProfile[],
        invitations,
        goals,
        activities: activitiesRaw.map((a) => ({ ...a, full_name: directory.get(a.user_id) ?? null })),
        netWorth: nwRes.status === 'fulfilled' ? nwRes.value : null,
        partialFailures,
      }
    },
  })
  const loading = pageQuery.isLoading
  const user = pageQuery.data?.user ?? null
  const household = pageQuery.data?.household ?? null
  const members = pageQuery.data?.members ?? []
  const invitations = pageQuery.data?.invitations ?? []
  const goals = pageQuery.data?.goals ?? []
  const activities = pageQuery.data?.activities ?? []
  const netWorth = pageQuery.data?.netWorth ?? null
  const partialFailures = pageQuery.data?.partialFailures ?? []
  const refresh = () => qc.invalidateQueries({ queryKey: ['family'] })

  async function createHousehold() {
    if (!user) return
    if (!newHouseholdName.trim()) { toast.error(t('family.toast_name_required')); return }
    setCreating(true)
    const { data: hhData, error } = await supabase
      .from('households')
      .insert({ name: newHouseholdName.trim(), owner_user_id: user.id })
      .select()
      .single()
    if (error || !hhData) {
      setCreating(false)
      toast.error(`${t('family.toast_create_failed')}: ${error?.message ?? 'unknown'}`)
      return
    }
    const { error: memErr } = await supabase
      .from('household_members')
      .insert({ household_id: hhData.id, user_id: user.id, role: 'owner' })
    setCreating(false)
    if (memErr) {
      // Bersihin household yatim — tanpa membership, halaman gak bakal nemuin lagi.
      await supabase.from('households').delete().eq('id', hhData.id)
      toast.error(`${t('family.toast_create_join_failed')}: ${memErr.message}`)
      return
    }
    await logActivity(supabase, hhData.id as string, user.id, 'household_created', `Membuat keluarga "${newHouseholdName.trim()}"`)
    setCreateDialogOpen(false)
    setNewHouseholdName('')
    toast.success(t('family.toast_created'))
    refresh()
  }

  async function generateInvite() {
    if (!household || !user) return
    if (members.length >= household.max_seats) {
      toast.error(`${t('family.toast_seats_full')} (${t('family.max_short')} ${household.max_seats}).`)
      return
    }
    setInviting(true)
    const token = generateInviteToken()
    const { data, error } = await supabase
      .from('household_invitations')
      .insert({ household_id: household.id, invited_by: user.id, email: inviteEmail.trim() || null, token })
      .select()
      .single()
    if (error || !data) {
      setInviting(false)
      toast.error(`${t('family.toast_invite_failed')}: ${error?.message ?? 'unknown'}`)
      return
    }
    await logActivity(supabase, household.id, user.id, 'invite_sent', `Mengundang anggota baru${inviteEmail.trim() ? ` (${inviteEmail.trim()})` : ''}`)
    setGeneratedLink(`${window.location.origin}/dashboard/join/${token}`)
    if (inviteEmail.trim()) {
      // Kirim email undangan via server — best-effort, link tetap bisa dibagi manual.
      try {
        const res = await fetch('/api/household/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitationId: (data as { id: string }).id }),
        })
        const out = (await res.json().catch(() => null)) as { sent?: boolean } | null
        if (res.ok && out?.sent) toast.success(t('family.toast_invite_emailed'))
      } catch { /* tanpa RESEND_API_KEY atau offline: cukup link manual */ }
    }
    setInviting(false)
    refresh()
  }

  async function copyLink() {
    if (!generatedLink) return
    await navigator.clipboard.writeText(generatedLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function revokeInvite(id: string) {
    if (!confirm(t('family.confirm_revoke_invite'))) return
    const { error } = await supabase.from('household_invitations').update({ status: 'revoked' }).eq('id', id)
    if (error) { toast.error(`${t('family.toast_failed')}: ${error.message}`); return }
    if (household && user) await logActivity(supabase, household.id, user.id, 'invite_revoked', 'Membatalkan undangan')
    toast.success(t('family.toast_invite_revoked'))
    refresh()
  }

  async function removeMember(memberId: string) {
    if (!household || !user) return
    const target = members.find((m) => m.user_id === memberId)
    if (!confirm(t('family.confirm_remove_member'))) return
    setRemovingMemberId(memberId)
    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('household_id', household.id)
      .eq('user_id', memberId)
    setRemovingMemberId(null)
    if (error) { toast.error(`${t('family.toast_failed')}: ${error.message}`); return }
    await logActivity(supabase, household.id, user.id, 'member_removed', `Mengeluarkan ${target?.full_name || 'anggota'}`)
    toast.success(t('family.toast_member_removed'))
    refresh()
  }

  async function leaveHousehold() {
    if (!household || !user) return
    setLeaveDialogOpen(false)
    // Log dulu (sesudah keluar, RLS nolak insert activity); kalau delete-nya
    // gagal, log dicabut lagi biar gak ada riwayat "keluar" palsu.
    const logId = await logActivity(supabase, household.id, user.id, 'member_left', 'Keluar dari keluarga')
    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('household_id', household.id)
      .eq('user_id', user.id)
    if (error) {
      if (logId) await supabase.from('household_activities').delete().eq('id', logId)
      toast.error(`${t('family.toast_leave_failed')}: ${error.message}`)
      return
    }
    toast.success(t('family.toast_left'))
    refresh()
  }

  async function deleteHousehold() {
    if (!household) return
    if (!confirm(`${t('family.confirm_disband_prefix')} "${household.name}"? ${t('family.confirm_disband_suffix')}`)) return
    const { error } = await supabase.from('households').delete().eq('id', household.id)
    if (error) { toast.error(`${t('family.toast_disband_failed')}: ${error.message}`); return }
    toast.success(t('family.toast_disbanded'))
    refresh()
  }

  async function toggleMyNetWorth() {
    const self = members.find((m) => m.user_id === user?.id)
    if (!self) return
    setTogglingNW(true)
    const ok = await setMyNetWorthSharing(supabase, !self.share_net_worth)
    setTogglingNW(false)
    if (!ok) { toast.error(t('family.toast_nw_failed')); return }
    toast.success(self.share_net_worth ? t('family.toast_nw_hidden') : t('family.toast_nw_shared'))
    refresh()
  }

  function openPerms(m: MemberWithProfile) {
    setPermsMember(m)
    setPermRel(m.relationship ?? '')
    setPermCanEdit(m.can_edit ?? true)
  }

  async function savePerms() {
    if (!household || !permsMember || !user) return
    setSavingPerms(true)
    const { error } = await supabase
      .from('household_members')
      .update({ can_edit: permCanEdit, relationship: permRel || null })
      .eq('household_id', household.id)
      .eq('user_id', permsMember.user_id)
    setSavingPerms(false)
    if (error) { toast.error(`${t('family.toast_failed')}: ${error.message}. ${t('family.toast_migration_041')}`); return }
    await logActivity(supabase, household.id, user.id, 'permission_changed', `Mengubah izin ${permsMember.full_name || 'anggota'}`)
    toast.success(t('family.toast_perms_updated'))
    setPermsMember(null)
    refresh()
  }

  async function createSharedGoal() {
    if (!household || !user) return
    if (!goalName.trim()) { toast.error(t('family.toast_goal_name_required')); return }
    if (goalTarget <= 0) { toast.error(t('family.toast_goal_target_positive')); return }
    setSavingGoal(true)
    const { error } = await supabase.from('goals').insert({
      user_id: user.id, household_id: household.id, name: goalName.trim(),
      category: 'other', target_amount: goalTarget, current_amount: 0,
      deadline: goalDeadline || null, is_active: true,
    })
    setSavingGoal(false)
    if (error) { toast.error(`${t('family.toast_failed')}: ${error.message}. ${t('family.toast_migration_042')}`); return }
    await logActivity(supabase, household.id, user.id, 'goal_created', `Membuat tujuan bersama "${goalName.trim()}"`)
    toast.success(t('family.toast_goal_added'))
    qc.invalidateQueries({ queryKey: ['goals-page'] }) // goal bersama ikut nongol di halaman Tujuan
    setGoalDialogOpen(false)
    setGoalName(''); setGoalTarget(0); setGoalDeadline('')
    refresh()
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20" style={{ color: 'var(--ink-soft)' }}><Loader2 className="size-5 animate-spin mr-2" /> {t('family.loading')}</div>
  }

  if (pageQuery.isError) {
    return (
      <div className="space-y-6">
        <FamilyHeader />
        <div className="s-card flex flex-col items-center text-center py-14 px-8 gap-3">
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{t('common.load_failed')}</p>
          <Button variant="outline" onClick={() => pageQuery.refetch()}>{t('common.retry')}</Button>
        </div>
      </div>
    )
  }

  const isUserOwner = isOwner(household, user?.id ?? '')
  const self = members.find((m) => m.user_id === user?.id)
  const canWrite = isUserOwner || (self?.can_edit ?? true)
  const nwActive = !!netWorth?.success

  // ───────────────────────────────────────────────────────────
  // STATE 1: User has no household → create / join CTA
  // ───────────────────────────────────────────────────────────
  if (!household) {
    return (
      <div className="space-y-6">
        <FamilyHeader />
        <div className="s-card p-8 sm:p-10 text-center" style={{ background: 'linear-gradient(135deg, var(--c-coral-soft), var(--surface) 65%)' }}>
          <div className="mx-auto size-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--c-primary)' }}>
            <Home className="size-7" style={{ color: 'var(--surface)' }} />
          </div>
          <h2 className="text-xl sm:text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>{t('family.empty_title')}</h2>
          <p className="hidden md:block mt-2 max-w-md mx-auto text-sm" style={{ color: 'var(--ink-muted)' }}>
            {t('family.empty_desc')}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => setCreateDialogOpen(true)}><Home className="size-4" /> {t('family.create_household')}</Button>
            {/* Billing beku (src/lib/billing-flag.ts) → link paket keluarga disembunyikan */}
            {BILLING_ENABLED && (
              <Link href="/dashboard/pricing" className="text-sm inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--ink-muted)' }}>{t('family.view_family_plan')}</Link>
            )}
          </div>
          <p className="hidden md:block mt-5 text-xs" style={{ color: 'var(--ink-soft)' }}>
            {t('family.empty_invite_prefix')} <code className="rounded px-1 py-0.5" style={{ background: 'var(--surface-2)' }}>/dashboard/join/…</code> {t('family.empty_invite_suffix')}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Home, title: t('family.step1_title'), desc: t('family.step1_desc') },
            { icon: UserPlus, title: t('family.step2_title'), desc: t('family.step2_desc') },
            { icon: Users, title: t('family.step3_title'), desc: t('family.step3_desc') },
          ].map((step, i) => (
            <div key={i} className="s-card p-5">
              <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--c-mint-ink)' }}>
                <step.icon className="size-4" />
                <span className="eyebrow" style={{ color: 'var(--c-mint-ink)' }}>{t('family.step_label')} {i + 1}</span>
              </div>
              <p className="font-semibold" style={{ color: 'var(--ink)' }}>{step.title}</p>
              <p className="hidden md:block text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>{step.desc}</p>
            </div>
          ))}
        </div>
        <CreateHouseholdDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} name={newHouseholdName} setName={setNewHouseholdName} onSubmit={createHousehold} loading={creating} />
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────
  // STATE 2: User has a household
  // ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <FamilyHeader />

      {/* Sebagian section gagal dimuat — halaman tetap jalan, kasih tahu jujur */}
      {partialFailures.length > 0 && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2.5 flex-wrap" style={{ background: 'color-mix(in srgb, var(--c-amber) 10%, transparent)' }}>
          <AlertCircle className="size-4 shrink-0" style={{ color: 'var(--c-amber-ink)' }} />
          <p className="text-[13px] flex-1 min-w-0" style={{ color: 'var(--c-amber-ink)' }}>
            {t('family.partial_load_prefix')} {partialFailures.map((k) => t(`family.${k}`)).join(', ')}.
          </p>
          <Button variant="outline" size="sm" onClick={refresh}>{t('common.retry')}</Button>
        </div>
      )}

      {/* KARTU UTAMA — nama lingkar + baris avatar (overlap) + Undang pill + kuota inline.
          Detail anggota & undangan dilipat di balik chevron (pola Share Manager). */}
      <section className="s-card overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--c-coral-soft), var(--surface) 60%)' }}>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow" style={{ color: 'var(--c-coral-ink)' }}>{t('family.family_circle')}</p>
              <h2 className="mt-0.5 text-lg sm:text-xl leading-tight truncate" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>{household.name}</h2>
            </div>
            {isUserOwner && (
              <Button size="sm" className="rounded-full shrink-0" onClick={() => { setGeneratedLink(null); setInviteEmail(''); setInviteDialogOpen(true) }} disabled={members.length >= household.max_seats}>
                <UserPlus className="size-3.5" /> {t('family.invite')}
              </Button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMembersOpen((v) => !v)}
            aria-expanded={membersOpen}
            title={t('family.section_members')}
            className="mt-4 flex w-full items-center gap-2.5 text-left"
          >
            <span className="flex -space-x-2">
              {members.map((m) => (
                <span key={m.user_id} className="size-9 rounded-full border-2 flex items-center justify-center text-[12px] font-bold" style={{ background: m.role === 'owner' ? 'var(--c-amber)' : 'var(--surface-2)', color: m.role === 'owner' ? '#FFF' : 'var(--ink)', borderColor: 'var(--surface)' }}>
                  {(m.full_name || m.email || '?').slice(0, 1).toUpperCase()}
                </span>
              ))}
            </span>
            <span className="num text-[12px] font-semibold" style={{ color: 'var(--ink-muted)' }} title={`${household.max_seats - members.length} ${t('family.seats_remaining')}`}>
              {members.length}<span style={{ color: 'var(--ink-soft)' }}>/{household.max_seats}</span>
            </span>
            {isUserOwner && invitations.length > 0 && (
              <span className="num inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'color-mix(in srgb, var(--c-amber) 16%, transparent)', color: 'var(--c-amber-ink)' }} title={`${invitations.length} ${t('family.awaiting_acceptance')}`}>
                <Mail className="size-2.5" /> {invitations.length}
              </span>
            )}
            <ChevronDown className="size-4 ml-auto shrink-0 transition-transform" style={{ color: 'var(--ink-soft)', transform: membersOpen ? 'rotate(180deg)' : 'none' }} />
          </button>
        </div>
        {membersOpen && (
          <div className="border-t divide-y" style={{ borderColor: 'var(--border-soft)' }}>
            {members.map((m) => {
              const me = m.user_id === user?.id
              const owner = m.role === 'owner'
              const relLabel = m.relationship && REL_LABEL_KEY[m.relationship] ? t(REL_LABEL_KEY[m.relationship]) : null
              const viewOnly = !owner && m.can_edit === false
              return (
                <div key={m.user_id} className="flex items-center gap-2.5 px-4 py-2.5" title={`${t('family.joined')} ${formatDate(new Date(m.joined_at))}`}>
                  <span className="size-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: owner ? 'var(--c-amber)' : 'var(--surface-2)', color: owner ? '#FFF' : 'var(--ink)' }}>
                    {(m.full_name || m.email || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{me ? t('family.you') : (m.full_name || t('family.member_fallback'))}</p>
                    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: owner ? 'color-mix(in srgb, var(--c-amber) 16%, transparent)' : 'var(--surface-2)', color: owner ? 'var(--c-amber-ink)' : 'var(--ink-muted)' }}>
                      {owner && <Crown className="size-2.5" />}{relLabel ?? (owner ? t('family.role_owner') : t('family.role_member'))}
                    </span>
                    {viewOnly && <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}><Eye className="size-2.5" />{t('family.view_only')}</span>}
                  </div>
                  {isUserOwner && !me && (
                    <>
                      <Button variant="ghost" size="icon-sm" onClick={() => openPerms(m)} title={`${t('family.set_perms_for')} ${m.full_name || t('family.member_fallback_lower')}`} aria-label={`${t('family.set_perms_for')} ${m.full_name || t('family.member_fallback_lower')}`}>
                        <SlidersHorizontal className="size-3.5" style={{ color: 'var(--ink-muted)' }} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => removeMember(m.user_id)} disabled={removingMemberId === m.user_id} title={`${t('family.remove_member_for')} ${m.full_name || t('family.member_fallback_lower')}`} aria-label={`${t('family.remove_member_for')} ${m.full_name || t('family.member_fallback_lower')}`}>
                        {removingMemberId === m.user_id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" style={{ color: 'var(--c-coral-ink)' }} />}
                      </Button>
                    </>
                  )}
                </div>
              )
            })}
            {isUserOwner && invitations.map((inv) => {
              const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
              const link = `${baseUrl}/dashboard/join/${inv.token}`
              return (
                <div key={inv.id} className="flex items-center gap-2.5 px-4 py-2.5">
                  <span className="size-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--c-amber-soft)' }}>
                    <Mail className="size-3.5" style={{ color: 'var(--c-amber-ink)' }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{inv.email || t('family.no_email_link')}</p>
                    <p className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}><CalendarClock className="size-3" /> {t('family.expires')} {formatDate(new Date(inv.expires_at))}</p>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => { navigator.clipboard.writeText(link); toast.success(t('family.toast_invite_link_copied')) }} title={t('family.copy')} aria-label={t('family.copy')}><Copy className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => revokeInvite(inv.id)} title={t('family.revoke_invite')} aria-label={t('family.revoke_invite')}><Trash2 className="size-3.5" style={{ color: 'var(--c-coral-ink)' }} /></Button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* KARTU BERBAGI — toggle net worth (1 baris) + chip yang dibagikan + privat 1 baris */}
      <section className="s-card p-4 sm:p-5">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('family.whats_shared')}</p>
        {nwActive && (
          <button
            type="button"
            onClick={toggleMyNetWorth}
            disabled={togglingNW}
            className="mt-3 flex items-center justify-between gap-3 w-full rounded-xl px-3.5 py-2.5 text-left transition"
            style={{ background: 'var(--surface-2)' }}
          >
            <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink)' }}>
              <Eye className="size-4 shrink-0" style={{ color: 'var(--ink-soft)' }} /> {t('family.share_my_nw')}
            </span>
            <span className="relative inline-flex h-5 w-9 items-center rounded-full transition shrink-0" style={{ background: self?.share_net_worth ? 'var(--c-mint)' : 'var(--border)' }}>
              {togglingNW
                ? <Loader2 className="size-3 animate-spin mx-auto" style={{ color: '#FFF' }} />
                : <span className="inline-block size-4 rounded-full bg-white transition" style={{ transform: self?.share_net_worth ? 'translateX(18px)' : 'translateX(2px)' }} />}
            </span>
          </button>
        )}
        {nwActive && (netWorth?.members_sharing ?? 0) > 0 && (
          <p className="mt-2 text-[12px]" style={{ color: 'var(--ink-muted)' }} title={`${netWorth?.members_sharing} ${t('family.of')} ${netWorth?.members_total} ${t('family.members_sharing_note')}`}>
            {t('family.combined_net_worth')}{' '}
            <span className="num font-bold" title={formatCurrency(netWorth?.combined_net_worth ?? 0)} style={{ color: 'var(--c-mint-ink)' }}>{formatCompactCurrency(netWorth?.combined_net_worth ?? 0)}</span>
            <span className="num" style={{ color: 'var(--ink-soft)' }}> · {netWorth?.members_sharing}/{netWorth?.members_total}</span>
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            { icon: Wallet, label: t('family.shared_accounts') },
            { icon: ArrowLeftRight, label: t('family.shared_transactions') },
            { icon: PieChart, label: t('family.shared_budgets_goals') },
            { icon: TrendingUp, label: t('family.shared_net_worth') },
          ].map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: 'var(--c-mint-soft)', color: 'var(--c-mint-ink)' }}>
              <c.icon className="size-3 shrink-0" /> {c.label}
            </span>
          ))}
        </div>
        <p className="mt-2.5 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--ink-soft)' }} title={`${t('family.private_assets')} · ${t('family.private_debts')} · ${t('family.private_personal_goals')}`}>
          <Lock className="size-3 shrink-0" /> {t('family.stays_private')}
        </p>
      </section>

      {/* Tujuan Bersama */}
      <section className="s-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('family.shared_goals')}</p>
          {canWrite && (
            <Button variant="outline" size="sm" onClick={() => { setGoalName(''); setGoalTarget(0); setGoalDeadline(''); setGoalDialogOpen(true) }}>
              <Target className="size-3.5" /> {t('family.add_goal')}
            </Button>
          )}
        </div>
        {goals.length === 0 ? (
          <div className="p-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
            {t('family.goals_empty')}<span className="hidden md:inline"> {canWrite ? t('family.goals_empty_can_write') : t('family.goals_empty_readonly')}</span>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
            {goals.map((g) => {
              const pct = g.target_amount > 0 ? Math.min((g.current_amount / g.target_amount) * 100, 100) : 0
              return (
                <div key={g.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium" style={{ color: 'var(--ink)' }}>{g.name}</p>
                    <span className="num text-[13px] font-semibold" style={{ color: 'var(--c-mint-ink)' }}>{pct.toFixed(0)}%</span>
                  </div>
                  <p className="num text-[12px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                    {formatCurrency(g.current_amount)} <span style={{ color: 'var(--ink-soft)' }}>{t('family.of')} {formatCurrency(g.target_amount)}</span>
                    {g.deadline && <span style={{ color: 'var(--ink-soft)' }}> · {t('family.target')} {formatDate(new Date(g.deadline))}</span>}
                  </p>
                  <span className="quest-bar mt-2 w-full" style={{ ['--bar-fill' as string]: 'var(--c-mint)', ['--bar-h' as string]: '8px' }}><i style={{ width: `${pct}%` }} /></span>
                </div>
              )
            })}
          </div>
        )}
        {goals.length > 0 && (
          <div className="p-3 border-t text-center" style={{ borderColor: 'var(--border-soft)' }}>
            <Link href="/dashboard/goals" className="text-[12px] inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--ink-muted)' }}>{t('family.manage_in_goals')}</Link>
          </div>
        )}
      </section>

      {/* Aktivitas terakhir — 1 baris teks kecil, bukan kartu */}
      {activities.length > 0 && (
        <p className="flex items-center gap-2 px-1 text-[11px]" title={t('family.recent_activity')} style={{ color: 'var(--ink-soft)' }}>
          <Activity className="size-3 shrink-0" />
          <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--ink-muted)' }}>
            <span className="font-medium">{activities[0].user_id === user?.id ? t('family.you') : (activities[0].full_name || t('family.member_fallback'))}</span> · {activities[0].description}
          </span>
          <span className="shrink-0">{timeAgo(activities[0].created_at, t)}</span>
        </p>
      )}

      {/* Bubarkan / keluar — 1 baris teks merah, confirm/dialog tetap jalan */}
      <div className="pb-1 text-center">
        {isUserOwner ? (
          <button type="button" onClick={deleteHousehold} className="text-[12px] font-medium hover:underline" style={{ color: 'var(--c-coral-ink)' }}>
            {t('family.disband_household')}
          </button>
        ) : (
          <button type="button" onClick={() => setLeaveDialogOpen(true)} className="text-[12px] font-medium hover:underline" style={{ color: 'var(--c-coral-ink)' }}>
            {t('family.leave_household')}
          </button>
        )}
      </div>

      {/* INVITE DIALOG */}
      <Dialog open={inviteDialogOpen} onOpenChange={(o) => { setInviteDialogOpen(o); if (!o) { setGeneratedLink(null); setInviteEmail('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-display)' }}>{t('family.invite_member')}</DialogTitle>
            <DialogDescription>{t('family.invite_dialog_desc')}</DialogDescription>
          </DialogHeader>
          {!generatedLink ? (
            <>
              <div className="grid gap-3 py-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="invite-email">{t('family.email_optional_label')}</Label>
                  <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="anggota@email.com" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>{t('family.cancel')}</Button>
                <Button onClick={generateInvite} disabled={inviting}>{inviting && <Loader2 className="size-4 animate-spin" />} {t('family.generate_link')}</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-3 py-2">
                <div className="rounded-lg p-3 text-sm flex items-start gap-2" style={{ background: 'var(--c-mint-soft)', color: 'var(--ink)' }}>
                  <Check className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--c-mint-ink)' }} />
                  <span>{t('family.invite_link_created')}</span>
                </div>
                <div className="grid gap-1.5">
                  <Label>{t('family.invite_link_label')}</Label>
                  <div className="flex gap-2">
                    <Input value={generatedLink} readOnly onFocus={(e) => e.currentTarget.select()} />
                    <Button onClick={copyLink} size="sm">{linkCopied ? <Check className="size-4" /> : <Copy className="size-4" />}{linkCopied ? t('family.copied') : t('family.copy')}</Button>
                  </div>
                </div>
                <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{t('family.invite_link_note')}</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>{t('family.done')}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* PERMISSIONS DIALOG (owner) */}
      <Dialog open={!!permsMember} onOpenChange={(o) => { if (!o) setPermsMember(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-display)' }}>{t('family.set_permissions')}</DialogTitle>
            <DialogDescription>{permsMember?.full_name || t('family.member_fallback')} — {t('family.perms_dialog_desc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>{t('family.relationship_label')}</Label>
              <Select value={permRel} onValueChange={(v) => v && setPermRel(v)}>
                <SelectTrigger><SelectValue placeholder={t('family.relationship_placeholder')} /></SelectTrigger>
                <SelectContent>{REL_KEYS.map((v) => <SelectItem key={v} value={v}>{t(REL_LABEL_KEY[v])}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <button type="button" onClick={() => setPermCanEdit((v) => !v)} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left" style={{ background: 'var(--surface-2)' }}>
              <span className="min-w-0">
                <span className="text-sm font-medium block" style={{ color: 'var(--ink)' }}>{permCanEdit ? t('family.full_access') : t('family.view_only')}</span>
                <span className="text-[12px] block mt-0.5" style={{ color: 'var(--ink-soft)' }}>{permCanEdit ? t('family.full_access_desc') : t('family.view_only_desc')}</span>
              </span>
              <span className="relative inline-flex h-5 w-9 items-center rounded-full transition shrink-0" style={{ background: permCanEdit ? 'var(--c-mint)' : 'var(--border)' }}>
                <span className="inline-block size-4 rounded-full bg-white transition" style={{ transform: permCanEdit ? 'translateX(18px)' : 'translateX(2px)' }} />
              </span>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermsMember(null)}>{t('family.cancel')}</Button>
            <Button onClick={savePerms} disabled={savingPerms}>{savingPerms && <Loader2 className="size-4 animate-spin" />} {t('family.save_permissions')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SHARED GOAL DIALOG */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-display)' }}>{t('family.add_shared_goal')}</DialogTitle>
            <DialogDescription>{t('family.goal_dialog_desc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5"><Label>{t('family.goal_name_label')}</Label><Input value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder={t('family.goal_name_placeholder')} autoFocus /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>{t('family.target')}</Label><NumberInput value={goalTarget} onChange={setGoalTarget} placeholder="0" /></div>
              <div className="grid gap-1.5"><Label>{t('family.target_date_label')}</Label><Input type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>{t('family.cancel')}</Button>
            <Button onClick={createSharedGoal} disabled={savingGoal}>{savingGoal && <Loader2 className="size-4 animate-spin" />} {t('family.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LEAVE DIALOG */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-display)' }}>{t('family.leave_dialog_title')}</DialogTitle>
            <DialogDescription>{t('family.leave_dialog_prefix')} <strong>{household.name}</strong>. {t('family.leave_dialog_suffix')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveDialogOpen(false)}>{t('family.cancel')}</Button>
            <Button variant="destructive" onClick={leaveHousehold}>{t('family.leave')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ───────────────────────────────────────────────────────────
// Header — pola QuietPageHeader (judul 20px + ⓘ tooltip + aksi)
// ───────────────────────────────────────────────────────────

function FamilyHeader({ action }: { action?: ReactNode }) {
  const t = useT()
  return (
    <QuietPageHeader
      title={t('family.header_title')}
      info={t('family.header_subtitle')}
      actions={action}
    />
  )
}

// ───────────────────────────────────────────────────────────
// Sub-component: create household dialog
// ───────────────────────────────────────────────────────────

function CreateHouseholdDialog({
  open, onOpenChange, name, setName, onSubmit, loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  setName: (v: string) => void
  onSubmit: () => void
  loading: boolean
}) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-display)' }}>{t('family.create_dialog_title')}</DialogTitle>
          <DialogDescription>{t('family.create_dialog_desc')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="hh-name">{t('family.household_name_label')}</Label>
            <Input id="hh-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('family.household_name_placeholder')} autoFocus />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('family.cancel')}</Button>
          <Button onClick={onSubmit} disabled={loading}>{loading && <Loader2 className="size-4 animate-spin" />} {t('family.create_household')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
