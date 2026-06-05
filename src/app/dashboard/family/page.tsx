'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import {
  fetchActiveHousehold, generateInviteToken, isOwner, relationshipLabel,
  fetchHouseholdGoals, fetchHouseholdActivities, logActivity, getHouseholdNetWorth, setMyNetWorthSharing,
  type Household, type MemberWithProfile, type HouseholdInvitation,
  type HouseholdGoal, type HouseholdActivity, type HouseholdNetWorth,
} from '@/lib/household'

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
  AlertCircle, Mail, CalendarClock, Home, LogOut,
  Wallet, ArrowLeftRight, PieChart, Lock, Target, Activity,
  Eye, SlidersHorizontal, TrendingUp,
} from 'lucide-react'

interface MyUser { id: string; email: string }

const ROLE_LABEL: Record<'owner' | 'member', string> = { owner: 'Pemilik', member: 'Anggota' }
const REL_OPTIONS = [
  { value: 'pasangan', label: 'Pasangan' },
  { value: 'orang_tua', label: 'Orang tua' },
  { value: 'anak', label: 'Anak' },
  { value: 'saudara', label: 'Saudara' },
  { value: 'lainnya', label: 'Lainnya' },
]

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.floor(h / 24)
  if (d === 1) return 'kemarin'
  if (d < 30) return `${d} hari lalu`
  return formatDate(new Date(iso))
}

export default function FamilyPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<MyUser | null>(null)
  const [household, setHousehold] = useState<Household | null>(null)
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [invitations, setInvitations] = useState<HouseholdInvitation[]>([])
  const [goals, setGoals] = useState<HouseholdGoal[]>([])
  const [activities, setActivities] = useState<HouseholdActivity[]>([])
  const [netWorth, setNetWorth] = useState<HouseholdNetWorth | null>(null)

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

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { setLoading(false); return }
    setUser({ id: u.id, email: u.email ?? '' })

    const hh = await fetchActiveHousehold(supabase, u.id)
    setHousehold(hh)

    if (hh) {
      // select('*') = resilient: kolom baru (can_edit/relationship/share_net_worth)
      // dibaca opsional, jadi page tetap jalan sebelum migration 041 di-run.
      const [membersRes, invitesRes, goalsRes, activitiesRes, nwRes] = await Promise.all([
        supabase
          .from('household_members')
          .select('*, profiles!inner(full_name)')
          .eq('household_id', hh.id)
          .order('joined_at'),
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

      type RawMember = {
        household_id: string; user_id: string; role: 'owner' | 'member'; joined_at: string
        can_edit?: boolean; relationship?: string | null; share_net_worth?: boolean
        profiles: { full_name: string | null } | null
      }
      const raw = (membersRes.data ?? []) as RawMember[]
      setMembers(raw.map((r) => ({
        household_id: r.household_id, user_id: r.user_id, role: r.role, joined_at: r.joined_at,
        can_edit: r.can_edit ?? true, relationship: r.relationship ?? null, share_net_worth: r.share_net_worth ?? false,
        full_name: r.profiles?.full_name ?? null,
        email: r.user_id === u.id ? (u.email ?? null) : null,
      })))
      setInvitations((invitesRes.data ?? []) as HouseholdInvitation[])
      setGoals(goalsRes)
      setActivities(activitiesRes)
      setNetWorth(nwRes)
    }

    setLoading(false)
  }

  async function createHousehold() {
    if (!user) return
    if (!newHouseholdName.trim()) { toast.error('Nama keluarga wajib diisi.'); return }
    setCreating(true)
    const { data: hhData, error } = await supabase
      .from('households')
      .insert({ name: newHouseholdName.trim(), owner_user_id: user.id })
      .select()
      .single()
    if (error || !hhData) {
      setCreating(false)
      toast.error(`Gagal buat keluarga: ${error?.message ?? 'unknown'}`)
      return
    }
    const { error: memErr } = await supabase
      .from('household_members')
      .insert({ household_id: hhData.id, user_id: user.id, role: 'owner' })
    setCreating(false)
    if (memErr) {
      toast.error(`Keluarga dibuat tapi gagal join sebagai owner: ${memErr.message}`)
      return
    }
    await logActivity(supabase, hhData.id as string, user.id, 'household_created', `Membuat keluarga "${newHouseholdName.trim()}"`)
    setCreateDialogOpen(false)
    setNewHouseholdName('')
    toast.success('Keluarga dibuat. Kamu jadi pemilik.')
    await load()
  }

  async function generateInvite() {
    if (!household || !user) return
    if (members.length >= household.max_seats) {
      toast.error(`Kuota anggota keluarga sudah penuh (maks ${household.max_seats}).`)
      return
    }
    setInviting(true)
    const token = generateInviteToken()
    const { data, error } = await supabase
      .from('household_invitations')
      .insert({ household_id: household.id, invited_by: user.id, email: inviteEmail.trim() || null, token })
      .select()
      .single()
    setInviting(false)
    if (error || !data) {
      toast.error(`Gagal bikin undangan: ${error?.message ?? 'unknown'}`)
      return
    }
    await logActivity(supabase, household.id, user.id, 'invite_sent', `Mengundang anggota baru${inviteEmail.trim() ? ` (${inviteEmail.trim()})` : ''}`)
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://personalwealthmanagement.vercel.app'
    setGeneratedLink(`${baseUrl}/dashboard/join/${token}`)
    void load()
  }

  async function copyLink() {
    if (!generatedLink) return
    await navigator.clipboard.writeText(generatedLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function revokeInvite(id: string) {
    if (!confirm('Batalkan undangan ini?')) return
    const { error } = await supabase.from('household_invitations').update({ status: 'revoked' }).eq('id', id)
    if (error) { toast.error(`Gagal: ${error.message}`); return }
    if (household && user) await logActivity(supabase, household.id, user.id, 'invite_revoked', 'Membatalkan undangan')
    toast.success('Undangan dibatalkan.')
    void load()
  }

  async function removeMember(memberId: string) {
    if (!household || !user) return
    const target = members.find((m) => m.user_id === memberId)
    if (!confirm('Keluarkan anggota ini dari keluarga?')) return
    setRemovingMemberId(memberId)
    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('household_id', household.id)
      .eq('user_id', memberId)
    setRemovingMemberId(null)
    if (error) { toast.error(`Gagal: ${error.message}`); return }
    await logActivity(supabase, household.id, user.id, 'member_removed', `Mengeluarkan ${target?.full_name || 'anggota'}`)
    toast.success('Anggota dikeluarkan.')
    void load()
  }

  async function leaveHousehold() {
    if (!household || !user) return
    setLeaveDialogOpen(false)
    await logActivity(supabase, household.id, user.id, 'member_left', 'Keluar dari keluarga')
    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('household_id', household.id)
      .eq('user_id', user.id)
    if (error) { toast.error(`Gagal keluar: ${error.message}`); return }
    toast.success('Kamu sudah keluar dari keluarga.')
    void load()
  }

  async function deleteHousehold() {
    if (!household) return
    if (!confirm(`Bubarkan keluarga "${household.name}"? Semua anggota otomatis keluar. Data bersama jadi milikmu lagi (tidak hilang).`)) return
    const { error } = await supabase.from('households').delete().eq('id', household.id)
    if (error) { toast.error(`Gagal bubarkan: ${error.message}`); return }
    toast.success('Keluarga dibubarkan.')
    void load()
  }

  async function toggleMyNetWorth() {
    const self = members.find((m) => m.user_id === user?.id)
    if (!self) return
    setTogglingNW(true)
    const ok = await setMyNetWorthSharing(supabase, !self.share_net_worth)
    setTogglingNW(false)
    if (!ok) { toast.error('Gagal ubah. Pastikan migration 041 sudah dijalankan.'); return }
    toast.success(self.share_net_worth ? 'Net worth-mu disembunyikan.' : 'Net worth-mu kini dihitung di total keluarga.')
    void load()
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
    if (error) { toast.error(`Gagal: ${error.message}. Pastikan migration 041 sudah dijalankan.`); return }
    await logActivity(supabase, household.id, user.id, 'permission_changed', `Mengubah izin ${permsMember.full_name || 'anggota'}`)
    toast.success('Izin diperbarui.')
    setPermsMember(null)
    void load()
  }

  async function createSharedGoal() {
    if (!household || !user) return
    if (!goalName.trim()) { toast.error('Nama tujuan wajib diisi.'); return }
    if (goalTarget <= 0) { toast.error('Target harus lebih dari 0.'); return }
    setSavingGoal(true)
    const { error } = await supabase.from('goals').insert({
      user_id: user.id, household_id: household.id, name: goalName.trim(),
      category: 'other', target_amount: goalTarget, current_amount: 0,
      deadline: goalDeadline || null, is_active: true,
    })
    setSavingGoal(false)
    if (error) { toast.error(`Gagal: ${error.message}. Pastikan migration 042 sudah dijalankan.`); return }
    await logActivity(supabase, household.id, user.id, 'goal_created', `Membuat tujuan bersama "${goalName.trim()}"`)
    toast.success('Tujuan bersama ditambahkan.')
    setGoalDialogOpen(false)
    setGoalName(''); setGoalTarget(0); setGoalDeadline('')
    void load()
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20" style={{ color: 'var(--ink-soft)' }}><Loader2 className="size-5 animate-spin mr-2" /> Memuat...</div>
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
          <h2 className="text-xl sm:text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>Belum punya keluarga</h2>
          <p className="mt-2 max-w-md mx-auto text-sm" style={{ color: 'var(--ink-muted)' }}>
            Bikin lingkar keluargamu, ajak pasangan / orang tua sampai 4 anggota. Akun, transaksi, anggaran &amp; tujuan bersama ke-share — sisanya tetap privat.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => setCreateDialogOpen(true)}><Home className="size-4" /> Buat keluarga</Button>
            <Link href="/dashboard/pricing" className="text-sm inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--ink-muted)' }}>Lihat paket Family</Link>
          </div>
          <p className="mt-5 text-xs" style={{ color: 'var(--ink-soft)' }}>
            Dapat link undangan dari anggota keluarga? Buka link <code className="rounded px-1 py-0.5" style={{ background: 'var(--surface-2)' }}>/dashboard/join/…</code> yang mereka kirim.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Home, title: 'Buat keluarga', desc: 'Kasih nama. Kamu jadi pemilik.' },
            { icon: UserPlus, title: 'Undang anggota', desc: 'Kirim link unik, sampai 4 anggota.' },
            { icon: Users, title: 'Kelola bareng', desc: 'Akun, anggaran, tujuan & net worth gabungan.' },
          ].map((step, i) => (
            <div key={i} className="s-card p-5">
              <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--c-mint)' }}>
                <step.icon className="size-4" />
                <span className="eyebrow" style={{ color: 'var(--c-mint)' }}>Langkah {i + 1}</span>
              </div>
              <p className="font-semibold" style={{ color: 'var(--ink)' }}>{step.title}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>{step.desc}</p>
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
      <FamilyHeader
        action={isUserOwner ? (
          <Button onClick={() => { setGeneratedLink(null); setInviteEmail(''); setInviteDialogOpen(true) }} disabled={members.length >= household.max_seats}>
            <UserPlus className="size-4" /> Undang anggota
          </Button>
        ) : undefined}
      />

      {/* Hero — Lingkar Keluarga (data REAL) */}
      <section className="s-card overflow-hidden grid sm:grid-cols-[1.6fr_1fr_1fr]" style={{ background: 'linear-gradient(135deg, var(--c-coral-soft), var(--surface) 60%)' }}>
        <div className="p-5 sm:p-6 sm:border-r" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="eyebrow" style={{ color: 'var(--coral-700)' }}>Lingkar Keluarga</p>
          <h2 className="mt-1.5 text-xl sm:text-2xl leading-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>{household.name}</h2>
          <p className="text-[13px] mt-2" style={{ color: 'var(--ink-muted)' }}>{members.length} anggota aktif · dibuat {formatDate(new Date(household.created_at))}</p>
        </div>
        <div className="p-5 sm:p-6 border-t sm:border-t-0 sm:border-r" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="eyebrow" style={{ color: 'var(--ink-soft)' }}>Anggota</p>
          <p className="num font-bold mt-2 leading-none" style={{ fontSize: 26, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{members.length}<span className="text-base font-medium" style={{ color: 'var(--ink-soft)' }}> / {household.max_seats}</span></p>
          <p className="text-[12px] mt-2" style={{ color: 'var(--ink-muted)' }}>{household.max_seats - members.length} kursi tersisa</p>
        </div>
        <div className="p-5 sm:p-6 border-t sm:border-t-0" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="eyebrow" style={{ color: 'var(--ink-soft)' }}>Undangan</p>
          <p className="num font-bold mt-2 leading-none" style={{ fontSize: 26, color: invitations.length > 0 ? 'var(--c-amber)' : 'var(--ink)', letterSpacing: '-0.02em' }}>{invitations.length}</p>
          <p className="text-[12px] mt-2" style={{ color: 'var(--ink-muted)' }}>{invitations.length > 0 ? 'menunggu diterima' : 'tidak ada yang tertunda'}</p>
        </div>
      </section>

      {/* Net Worth Gabungan (opt-in, agregat) — muncul hanya kalau RPC aktif (migration 044) */}
      {nwActive && (
        <section className="s-card p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Net Worth Gabungan</p>
              {(netWorth?.members_sharing ?? 0) > 0 ? (
                <>
                  <p className="num font-bold mt-2 leading-none" style={{ fontSize: 28, color: 'var(--c-mint)', letterSpacing: '-0.02em' }}>{formatCurrency(netWorth?.combined_net_worth ?? 0)}</p>
                  <p className="text-[12px] mt-2" style={{ color: 'var(--ink-muted)' }}>
                    Aset <span className="num">{formatCurrency(netWorth?.combined_assets ?? 0)}</span> · Utang <span className="num">{formatCurrency(netWorth?.combined_debts ?? 0)}</span>
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>{netWorth?.members_sharing} dari {netWorth?.members_total} anggota berbagi · hanya total yang dibagikan, detail tiap anggota tetap privat</p>
                </>
              ) : (
                <p className="text-sm mt-2" style={{ color: 'var(--ink-muted)' }}>Belum ada anggota yang berbagi. Aktifkan toggle di bawah buat mulai menghitung kekayaan bersih keluarga.</p>
              )}
            </div>
            <TrendingUp className="size-5 shrink-0" style={{ color: 'var(--c-mint)' }} />
          </div>
          {/* Toggle berbagi (current user) */}
          <button
            type="button"
            onClick={toggleMyNetWorth}
            disabled={togglingNW}
            className="mt-4 flex items-center justify-between gap-3 w-full rounded-xl px-4 py-3 text-left transition"
            style={{ background: 'var(--surface-2)' }}
          >
            <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink)' }}>
              <Eye className="size-4" style={{ color: 'var(--ink-soft)' }} /> Bagikan net worth saya ke keluarga
            </span>
            <span className="relative inline-flex h-5 w-9 items-center rounded-full transition" style={{ background: self?.share_net_worth ? 'var(--c-mint)' : 'var(--border)' }}>
              {togglingNW
                ? <Loader2 className="size-3 animate-spin mx-auto" style={{ color: '#FFF' }} />
                : <span className="inline-block size-4 rounded-full bg-white transition" style={{ transform: self?.share_net_worth ? 'translateX(18px)' : 'translateX(2px)' }} />}
            </span>
          </button>
        </section>
      )}

      {/* Anggota Keluarga */}
      <section className="s-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Anggota Keluarga</p>
          {isUserOwner && (
            <Button variant="outline" size="sm" onClick={() => { setGeneratedLink(null); setInviteEmail(''); setInviteDialogOpen(true) }} disabled={members.length >= household.max_seats}>
              <UserPlus className="size-3.5" /> Undang
            </Button>
          )}
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
          {members.map((m) => {
            const me = m.user_id === user?.id
            const owner = m.role === 'owner'
            const relLabel = relationshipLabel(m.relationship)
            const viewOnly = !owner && m.can_edit === false
            return (
              <div key={m.user_id} className="flex items-center gap-3 p-4">
                <div className="size-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0" style={{ background: owner ? 'var(--c-amber)' : 'var(--surface-2)', color: owner ? '#FFF' : 'var(--ink)' }}>
                  {(m.full_name || m.email || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{me ? 'Kamu' : (m.full_name || 'Anggota')}</p>
                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: owner ? 'color-mix(in srgb, var(--c-amber) 16%, transparent)' : 'var(--surface-2)', color: owner ? 'var(--c-amber)' : 'var(--ink-muted)' }}>
                      {owner && <Crown className="size-2.5" />}{relLabel ?? ROLE_LABEL[m.role]}
                    </span>
                    {viewOnly && <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}><Eye className="size-2.5" />Lihat saja</span>}
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>Gabung {formatDate(new Date(m.joined_at))}</p>
                </div>
                {isUserOwner && !me && (
                  <>
                    <Button variant="ghost" size="icon-sm" onClick={() => openPerms(m)} title={`Atur izin ${m.full_name || 'anggota'}`} aria-label={`Atur izin ${m.full_name || 'anggota'}`}>
                      <SlidersHorizontal className="size-3.5" style={{ color: 'var(--ink-muted)' }} />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeMember(m.user_id)} disabled={removingMemberId === m.user_id} title={`Keluarkan ${m.full_name || 'anggota'}`} aria-label={`Keluarkan ${m.full_name || 'anggota'}`}>
                      {removingMemberId === m.user_id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" style={{ color: 'var(--c-coral)' }} />}
                    </Button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Undangan Aktif (owner) */}
      {isUserOwner && invitations.length > 0 && (
        <section className="s-card overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Undangan Aktif</p>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
            {invitations.map((inv) => {
              const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
              const link = `${baseUrl}/dashboard/join/${inv.token}`
              return (
                <div key={inv.id} className="flex items-center gap-3 p-4">
                  <div className="size-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--c-amber-soft)' }}>
                    <Mail className="size-4" style={{ color: 'var(--c-amber)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{inv.email || 'Tanpa email (link sharing)'}</p>
                    <p className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}><CalendarClock className="size-3" /> Berakhir {formatDate(new Date(inv.expires_at))}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(link); toast.success('Link undangan disalin.') }}><Copy className="size-3.5" /> Salin</Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => revokeInvite(inv.id)} title="Batalkan undangan" aria-label="Batalkan undangan"><Trash2 className="size-3.5" style={{ color: 'var(--c-coral)' }} /></Button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Tujuan Bersama */}
      <section className="s-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Tujuan Bersama</p>
          {canWrite && (
            <Button variant="outline" size="sm" onClick={() => { setGoalName(''); setGoalTarget(0); setGoalDeadline(''); setGoalDialogOpen(true) }}>
              <Target className="size-3.5" /> Tambah tujuan
            </Button>
          )}
        </div>
        {goals.length === 0 ? (
          <div className="p-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
            Belum ada tujuan bersama. {canWrite ? 'Buat target nabung keluarga — DP rumah, dana pendidikan, liburan.' : 'Pemilik / anggota bisa nambah target nabung keluarga.'}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
            {goals.map((g) => {
              const pct = g.target_amount > 0 ? Math.min((g.current_amount / g.target_amount) * 100, 100) : 0
              return (
                <div key={g.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium" style={{ color: 'var(--ink)' }}>{g.name}</p>
                    <span className="num text-[13px] font-semibold" style={{ color: 'var(--c-mint)' }}>{pct.toFixed(0)}%</span>
                  </div>
                  <p className="num text-[12px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                    {formatCurrency(g.current_amount)} <span style={{ color: 'var(--ink-soft)' }}>dari {formatCurrency(g.target_amount)}</span>
                    {g.deadline && <span style={{ color: 'var(--ink-soft)' }}> · target {formatDate(new Date(g.deadline))}</span>}
                  </p>
                  <div className="mt-2 h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--c-mint)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {goals.length > 0 && (
          <div className="p-3 border-t text-center" style={{ borderColor: 'var(--border-soft)' }}>
            <Link href="/dashboard/goals" className="text-[12px] inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--ink-muted)' }}>Kelola di halaman Tujuan</Link>
          </div>
        )}
      </section>

      {/* Aktivitas Terkini */}
      {activities.length > 0 && (
        <section className="s-card overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase flex items-center gap-1.5" style={{ color: 'var(--ink-soft)' }}><Activity className="size-3.5" /> Aktivitas Terkini</p>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
            {activities.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3.5">
                <div className="size-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                  {(a.full_name || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] truncate" style={{ color: 'var(--ink)' }}><span className="font-medium">{a.user_id === user?.id ? 'Kamu' : (a.full_name || 'Anggota')}</span> · {a.description}</p>
                </div>
                <span className="text-[11px] shrink-0" style={{ color: 'var(--ink-soft)' }}>{timeAgo(a.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Yang Dibagikan */}
      <section className="s-card p-5">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Yang Dibagikan</p>
        <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Cuma yang baru kamu input setelah gabung yang ke-share. Data lama tetap privat.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl p-4" style={{ background: 'var(--c-mint-soft)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--c-mint)' }}><Check className="size-3.5" /> Dibagikan</p>
            <ul className="mt-2.5 space-y-2 text-sm" style={{ color: 'var(--ink)' }}>
              <li className="flex items-center gap-2"><Wallet className="size-4 shrink-0" style={{ color: 'var(--c-mint)' }} /> Akun &amp; dompet keluarga</li>
              <li className="flex items-center gap-2"><ArrowLeftRight className="size-4 shrink-0" style={{ color: 'var(--c-mint)' }} /> Transaksi (dengan label pencatat)</li>
              <li className="flex items-center gap-2"><PieChart className="size-4 shrink-0" style={{ color: 'var(--c-mint)' }} /> Anggaran &amp; tujuan bersama</li>
              <li className="flex items-center gap-2"><TrendingUp className="size-4 shrink-0" style={{ color: 'var(--c-mint)' }} /> Net worth gabungan <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>(opt-in, total saja)</span></li>
            </ul>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-2)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--ink-soft)' }}><Lock className="size-3.5" /> Tetap privat</p>
            <ul className="mt-2.5 space-y-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
              <li className="flex items-center gap-2"><span className="size-1.5 rounded-full shrink-0" style={{ background: 'var(--ink-soft)' }} /> Detail aset &amp; investasi</li>
              <li className="flex items-center gap-2"><span className="size-1.5 rounded-full shrink-0" style={{ background: 'var(--ink-soft)' }} /> Utang &amp; kartu kredit</li>
              <li className="flex items-center gap-2"><span className="size-1.5 rounded-full shrink-0" style={{ background: 'var(--ink-soft)' }} /> Tujuan pribadi &amp; transaksi sebelum gabung</li>
            </ul>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/dashboard/accounts"><Button variant="outline" size="sm"><Wallet className="size-3.5" /> Akun bersama</Button></Link>
          <Link href="/dashboard/budgeting"><Button variant="outline" size="sm"><PieChart className="size-3.5" /> Anggaran bersama</Button></Link>
        </div>
      </section>

      {/* Zona Berbahaya */}
      <section className="s-card p-5" style={{ borderColor: 'color-mix(in srgb, var(--c-coral) 28%, transparent)' }}>
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 mt-0.5 shrink-0" style={{ color: 'var(--c-coral)' }} />
          <div className="flex-1">
            <p className="font-semibold" style={{ color: 'var(--ink)' }}>Zona Berbahaya</p>
            {isUserOwner ? (
              <>
                <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Bubarkan keluarga — semua anggota otomatis keluar. Data bersama kembali jadi milikmu (tidak hilang).</p>
                <Button variant="destructive" size="sm" className="mt-3" onClick={deleteHousehold}><Trash2 className="size-4" /> Bubarkan keluarga</Button>
              </>
            ) : (
              <>
                <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Keluar dari keluarga. Akses ke akun, transaksi, anggaran &amp; tujuan bersama akan hilang. Data pribadimu tetap aman.</p>
                <Button variant="destructive" size="sm" className="mt-3" onClick={() => setLeaveDialogOpen(true)}><LogOut className="size-4" /> Keluar dari keluarga</Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* INVITE DIALOG */}
      <Dialog open={inviteDialogOpen} onOpenChange={(o) => { setInviteDialogOpen(o); if (!o) { setGeneratedLink(null); setInviteEmail('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-display)' }}>Undang anggota</DialogTitle>
            <DialogDescription>Generate link unik (berlaku 7 hari) — kirim ke calon anggota via WA, email, atau lainnya.</DialogDescription>
          </DialogHeader>
          {!generatedLink ? (
            <>
              <div className="grid gap-3 py-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="invite-email">Email (opsional, untuk catatan)</Label>
                  <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="anggota@email.com" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Batal</Button>
                <Button onClick={generateInvite} disabled={inviting}>{inviting && <Loader2 className="size-4 animate-spin" />} Generate link</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-3 py-2">
                <div className="rounded-lg p-3 text-sm flex items-start gap-2" style={{ background: 'var(--c-mint-soft)', color: 'var(--ink)' }}>
                  <Check className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--c-mint)' }} />
                  <span>Link undangan berhasil dibuat. Salin &amp; kirim ke calon anggota.</span>
                </div>
                <div className="grid gap-1.5">
                  <Label>Link undangan</Label>
                  <div className="flex gap-2">
                    <Input value={generatedLink} readOnly onFocus={(e) => e.currentTarget.select()} />
                    <Button onClick={copyLink} size="sm">{linkCopied ? <Check className="size-4" /> : <Copy className="size-4" />}{linkCopied ? 'Disalin' : 'Salin'}</Button>
                  </div>
                </div>
                <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>Berlaku 7 hari. Penerima harus login (atau daftar) dulu sebelum bisa terima undangan.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Selesai</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* PERMISSIONS DIALOG (owner) */}
      <Dialog open={!!permsMember} onOpenChange={(o) => { if (!o) setPermsMember(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-display)' }}>Atur izin</DialogTitle>
            <DialogDescription>{permsMember?.full_name || 'Anggota'} — atur hubungan &amp; akses ke data bersama.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Hubungan keluarga</Label>
              <Select value={permRel} onValueChange={(v) => v && setPermRel(v)}>
                <SelectTrigger><SelectValue placeholder="Pilih (opsional)" /></SelectTrigger>
                <SelectContent>{REL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <button type="button" onClick={() => setPermCanEdit((v) => !v)} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left" style={{ background: 'var(--surface-2)' }}>
              <span className="min-w-0">
                <span className="text-sm font-medium block" style={{ color: 'var(--ink)' }}>{permCanEdit ? 'Akses penuh' : 'Lihat saja'}</span>
                <span className="text-[12px] block mt-0.5" style={{ color: 'var(--ink-soft)' }}>{permCanEdit ? 'Bisa lihat & edit akun, transaksi, anggaran, tujuan bersama.' : 'Cuma bisa lihat data bersama, tidak bisa edit/hapus.'}</span>
              </span>
              <span className="relative inline-flex h-5 w-9 items-center rounded-full transition shrink-0" style={{ background: permCanEdit ? 'var(--c-mint)' : 'var(--border)' }}>
                <span className="inline-block size-4 rounded-full bg-white transition" style={{ transform: permCanEdit ? 'translateX(18px)' : 'translateX(2px)' }} />
              </span>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermsMember(null)}>Batal</Button>
            <Button onClick={savePerms} disabled={savingPerms}>{savingPerms && <Loader2 className="size-4 animate-spin" />} Simpan izin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SHARED GOAL DIALOG */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-display)' }}>Tambah tujuan bersama</DialogTitle>
            <DialogDescription>Target nabung yang dikejar bareng. Semua anggota bisa lihat &amp; nambah saldonya.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5"><Label>Nama tujuan</Label><Input value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="cth: DP Rumah, Dana Pendidikan" autoFocus /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Target</Label><NumberInput value={goalTarget} onChange={setGoalTarget} placeholder="0" /></div>
              <div className="grid gap-1.5"><Label>Target tanggal (opsional)</Label><Input type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>Batal</Button>
            <Button onClick={createSharedGoal} disabled={savingGoal}>{savingGoal && <Loader2 className="size-4 animate-spin" />} Tambah</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LEAVE DIALOG */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-display)' }}>Keluar dari keluarga?</DialogTitle>
            <DialogDescription>Kamu akan keluar dari <strong>{household.name}</strong>. Akses ke data bersama hilang. Data pribadimu tetap aman.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveDialogOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={leaveHousehold}>Keluar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ───────────────────────────────────────────────────────────
// Header — pola seragam (eyebrow + judul serif + subtitle + aksi)
// ───────────────────────────────────────────────────────────

function FamilyHeader({ action }: { action?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 flex-wrap">
      <div className="max-w-xl">
        <p className="eyebrow" style={{ color: 'var(--ink-soft)' }}>Berbagi keuangan dengan orang tersayang</p>
        <h1 className="mt-1 text-2xl sm:text-[28px] leading-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          Keluarga
        </h1>
        <p className="text-sm mt-1.5" style={{ color: 'var(--ink-muted)' }}>
          Atur akses, tujuan &amp; net worth bersama. Privasi tetap di tanganmu — bagikan hanya yang ingin dibagikan.
        </p>
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </header>
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-display)' }}>Buat keluarga baru</DialogTitle>
          <DialogDescription>Kasih nama keluargamu. Kamu jadi pemilik — bisa undang &amp; keluarkan anggota.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="hh-name">Nama keluarga</Label>
            <Input id="hh-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth: Keluarga Andi &amp; Sari" autoFocus />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={onSubmit} disabled={loading}>{loading && <Loader2 className="size-4 animate-spin" />} Buat keluarga</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
