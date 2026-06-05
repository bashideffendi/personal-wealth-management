'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  fetchActiveHousehold, generateInviteToken, isOwner,
  type Household, type MemberWithProfile, type HouseholdInvitation,
} from '@/lib/household'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Users, UserPlus, Crown, Copy, Check, Loader2, Trash2,
  AlertCircle, Mail, CalendarClock, Home, LogOut,
  Wallet, ArrowLeftRight, PieChart, Lock,
} from 'lucide-react'

interface MyUser { id: string; email: string }

const ROLE_LABEL: Record<'owner' | 'member', string> = { owner: 'Pemilik', member: 'Anggota' }

export default function FamilyPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<MyUser | null>(null)
  const [household, setHousehold] = useState<Household | null>(null)
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [invitations, setInvitations] = useState<HouseholdInvitation[]>([])

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
      const [membersRes, invitesRes] = await Promise.all([
        supabase
          .from('household_members')
          .select('household_id, user_id, role, joined_at, profiles!inner(full_name)')
          .eq('household_id', hh.id)
          .order('joined_at'),
        supabase
          .from('household_invitations')
          .select('*')
          .eq('household_id', hh.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ])

      type RawMember = {
        household_id: string
        user_id: string
        role: 'owner' | 'member'
        joined_at: string
        profiles: { full_name: string | null } | null
      }
      const raw = (membersRes.data ?? []) as RawMember[]
      setMembers(raw.map((r) => ({
        household_id: r.household_id,
        user_id: r.user_id,
        role: r.role,
        joined_at: r.joined_at,
        full_name: r.profiles?.full_name ?? null,
        email: r.user_id === u.id ? (u.email ?? null) : null,
      })))
      setInvitations((invitesRes.data ?? []) as HouseholdInvitation[])
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
      .insert({
        household_id: household.id,
        invited_by: user.id,
        email: inviteEmail.trim() || null,
        token,
      })
      .select()
      .single()
    setInviting(false)
    if (error || !data) {
      toast.error(`Gagal bikin undangan: ${error?.message ?? 'unknown'}`)
      return
    }
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
    const { error } = await supabase
      .from('household_invitations')
      .update({ status: 'revoked' })
      .eq('id', id)
    if (error) { toast.error(`Gagal: ${error.message}`); return }
    toast.success('Undangan dibatalkan.')
    void load()
  }

  async function removeMember(memberId: string) {
    if (!household) return
    if (!confirm('Hapus anggota ini dari keluarga?')) return
    setRemovingMemberId(memberId)
    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('household_id', household.id)
      .eq('user_id', memberId)
    setRemovingMemberId(null)
    if (error) { toast.error(`Gagal: ${error.message}`); return }
    toast.success('Anggota dikeluarkan.')
    void load()
  }

  async function leaveHousehold() {
    if (!household || !user) return
    setLeaveDialogOpen(false)
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
    const { error } = await supabase
      .from('households')
      .delete()
      .eq('id', household.id)
    if (error) { toast.error(`Gagal bubarkan: ${error.message}`); return }
    toast.success('Keluarga dibubarkan.')
    void load()
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20" style={{ color: 'var(--ink-soft)' }}><Loader2 className="size-5 animate-spin mr-2" /> Memuat...</div>
  }

  const isUserOwner = isOwner(household, user?.id ?? '')

  // ───────────────────────────────────────────────────────────
  // STATE 1: User has no household → create / join CTA
  // ───────────────────────────────────────────────────────────
  if (!household) {
    return (
      <div className="space-y-6">
        <FamilyHeader />

        {/* Empty-state — kartu hangat, ajakan buat keluarga */}
        <div className="s-card p-8 sm:p-10 text-center" style={{ background: 'linear-gradient(135deg, var(--c-coral-soft), var(--surface) 65%)' }}>
          <div className="mx-auto size-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--c-primary)' }}>
            <Home className="size-7" style={{ color: 'var(--surface)' }} />
          </div>
          <h2 className="text-xl sm:text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>Belum punya keluarga</h2>
          <p className="mt-2 max-w-md mx-auto text-sm" style={{ color: 'var(--ink-muted)' }}>
            Bikin lingkar keluargamu, ajak pasangan / orang tua sampai 4 anggota. Akun, transaksi, &amp; anggaran ke-share otomatis — sisanya tetap privat.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => setCreateDialogOpen(true)}><Home className="size-4" /> Buat keluarga</Button>
            <Link href="/dashboard/pricing" className="text-sm inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--ink-muted)' }}>Lihat paket Family</Link>
          </div>
          <p className="mt-5 text-xs" style={{ color: 'var(--ink-soft)' }}>
            Dapat link undangan dari anggota keluarga? Buka link <code className="rounded px-1 py-0.5" style={{ background: 'var(--surface-2)' }}>/dashboard/join/…</code> yang mereka kirim.
          </p>
        </div>

        {/* How it works */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Home, title: 'Buat keluarga', desc: 'Kasih nama. Kamu jadi pemilik.' },
            { icon: UserPlus, title: 'Undang anggota', desc: 'Kirim link unik, sampai 4 anggota.' },
            { icon: Users, title: 'Kelola bareng', desc: 'Akun, transaksi, & anggaran langsung ke-share.' },
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

        <CreateHouseholdDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          name={newHouseholdName}
          setName={setNewHouseholdName}
          onSubmit={createHousehold}
          loading={creating}
        />
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────
  // STATE 2: User has a household → manage members & sharing
  // ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <FamilyHeader
        action={isUserOwner ? (
          <Button
            onClick={() => { setGeneratedLink(null); setInviteEmail(''); setInviteDialogOpen(true) }}
            disabled={members.length >= household.max_seats}
          >
            <UserPlus className="size-4" /> Undang anggota
          </Button>
        ) : undefined}
      />

      {/* Hero — Lingkar Keluarga (3 cell, hangat coral-soft). Semua data REAL. */}
      <section className="s-card overflow-hidden grid sm:grid-cols-[1.6fr_1fr_1fr]" style={{ background: 'linear-gradient(135deg, var(--c-coral-soft), var(--surface) 60%)' }}>
        <div className="p-5 sm:p-6 sm:border-r" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="eyebrow" style={{ color: 'var(--c-coral)' }}>Lingkar Keluarga</p>
          <h2 className="mt-1.5 text-xl sm:text-2xl leading-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>{household.name}</h2>
          <p className="text-[13px] mt-2" style={{ color: 'var(--ink-muted)' }}>
            {members.length} anggota aktif · dibuat {formatDate(new Date(household.created_at))}
          </p>
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
            const self = m.user_id === user?.id
            const owner = m.role === 'owner'
            return (
              <div key={m.user_id} className="flex items-center gap-3 p-4">
                <div className="size-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0" style={{ background: owner ? 'var(--c-amber)' : 'var(--surface-2)', color: owner ? '#FFF' : 'var(--ink)' }}>
                  {(m.full_name || m.email || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{self ? 'Kamu' : (m.full_name || 'Anggota')}</p>
                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: owner ? 'color-mix(in srgb, var(--c-amber) 16%, transparent)' : 'var(--surface-2)', color: owner ? 'var(--c-amber)' : 'var(--ink-muted)' }}>
                      {owner && <Crown className="size-2.5" />}{ROLE_LABEL[m.role]}
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>Gabung {formatDate(new Date(m.joined_at))}</p>
                </div>
                {isUserOwner && !self && (
                  <Button variant="ghost" size="icon-sm" onClick={() => removeMember(m.user_id)} disabled={removingMemberId === m.user_id} title={`Keluarkan ${m.full_name || 'anggota'}`} aria-label={`Keluarkan ${m.full_name || 'anggota'}`}>
                    {removingMemberId === m.user_id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" style={{ color: 'var(--c-coral)' }} />}
                  </Button>
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
                    <p className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
                      <CalendarClock className="size-3" /> Berakhir {formatDate(new Date(inv.expires_at))}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(link); toast.success('Link undangan disalin.') }}>
                    <Copy className="size-3.5" /> Salin
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => revokeInvite(inv.id)} title="Batalkan undangan" aria-label="Batalkan undangan">
                    <Trash2 className="size-3.5" style={{ color: 'var(--c-coral)' }} />
                  </Button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Yang Dibagikan — model privasi JUJUR (by data-type, bukan toggle palsu) */}
      <section className="s-card p-5">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Yang Dibagikan</p>
        <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Cuma yang baru kamu input setelah gabung yang ke-share. Data lama tetap privat.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl p-4" style={{ background: 'var(--c-mint-soft)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--c-mint)' }}><Check className="size-3.5" /> Dibagikan</p>
            <ul className="mt-2.5 space-y-2 text-sm" style={{ color: 'var(--ink)' }}>
              <li className="flex items-center gap-2"><Wallet className="size-4 shrink-0" style={{ color: 'var(--c-mint)' }} /> Akun &amp; dompet keluarga</li>
              <li className="flex items-center gap-2"><ArrowLeftRight className="size-4 shrink-0" style={{ color: 'var(--c-mint)' }} /> Transaksi (dengan label pencatat)</li>
              <li className="flex items-center gap-2"><PieChart className="size-4 shrink-0" style={{ color: 'var(--c-mint)' }} /> Anggaran bersama</li>
            </ul>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-2)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--ink-soft)' }}><Lock className="size-3.5" /> Tetap privat</p>
            <ul className="mt-2.5 space-y-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
              <li className="flex items-center gap-2"><span className="size-1.5 rounded-full shrink-0" style={{ background: 'var(--ink-soft)' }} /> Aset &amp; investasi</li>
              <li className="flex items-center gap-2"><span className="size-1.5 rounded-full shrink-0" style={{ background: 'var(--ink-soft)' }} /> Utang &amp; kartu kredit</li>
              <li className="flex items-center gap-2"><span className="size-1.5 rounded-full shrink-0" style={{ background: 'var(--ink-soft)' }} /> Tujuan &amp; net worth pribadi</li>
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
                <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
                  Bubarkan keluarga — semua anggota otomatis keluar. Data bersama kembali jadi milikmu (tidak hilang).
                </p>
                <Button variant="destructive" size="sm" className="mt-3" onClick={deleteHousehold}><Trash2 className="size-4" /> Bubarkan keluarga</Button>
              </>
            ) : (
              <>
                <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
                  Keluar dari keluarga. Akses ke akun, transaksi &amp; anggaran bersama akan hilang. Data pribadimu tetap aman.
                </p>
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
                <Button onClick={generateInvite} disabled={inviting}>
                  {inviting && <Loader2 className="size-4 animate-spin" />} Generate link
                </Button>
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
                    <Button onClick={copyLink} size="sm">
                      {linkCopied ? <Check className="size-4" /> : <Copy className="size-4" />}{linkCopied ? 'Disalin' : 'Salin'}
                    </Button>
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

      {/* LEAVE DIALOG */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-display)' }}>Keluar dari keluarga?</DialogTitle>
            <DialogDescription>
              Kamu akan keluar dari <strong>{household.name}</strong>. Akses ke akun, transaksi &amp; anggaran bersama hilang. Data pribadimu tetap aman.
            </DialogDescription>
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
          Atur akses &amp; kelola keuangan bareng. Privasi tetap di tanganmu — yang dibagikan hanya akun, transaksi &amp; anggaran.
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
          <Button onClick={onSubmit} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />} Buat keluarga
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
