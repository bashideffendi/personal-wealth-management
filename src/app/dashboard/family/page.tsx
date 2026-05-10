'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
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
  AlertCircle, Mail, Calendar, Sparkles, Home, ExternalLink,
} from 'lucide-react'

interface MyUser { id: string; email: string }

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
      // Load members + their profile names + emails (via Supabase admin not avail to client;
      // we only show emails for owner via a separate field, otherwise just names)
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
    if (!newHouseholdName.trim()) { alert('Nama keluarga wajib diisi.'); return }
    setCreating(true)
    const { data: hhData, error } = await supabase
      .from('households')
      .insert({ name: newHouseholdName.trim(), owner_user_id: user.id })
      .select()
      .single()
    if (error || !hhData) {
      setCreating(false)
      alert(`Gagal buat keluarga: ${error?.message ?? 'unknown'}`)
      return
    }
    // Insert self as owner-member
    const { error: memErr } = await supabase
      .from('household_members')
      .insert({ household_id: hhData.id, user_id: user.id, role: 'owner' })
    setCreating(false)
    if (memErr) {
      alert(`Keluarga dibuat tapi gagal join sebagai owner: ${memErr.message}`)
      return
    }
    setCreateDialogOpen(false)
    setNewHouseholdName('')
    await load()
  }

  async function generateInvite() {
    if (!household || !user) return
    if (members.length >= household.max_seats) {
      alert(`Kuota anggota keluarga sudah penuh (${household.max_seats} max).`)
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
      alert(`Gagal bikin undangan: ${error?.message ?? 'unknown'}`)
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
    if (error) { alert(`Gagal: ${error.message}`); return }
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
    if (error) { alert(`Gagal: ${error.message}`); return }
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
    if (error) { alert(`Gagal keluar: ${error.message}`); return }
    void load()
  }

  async function deleteHousehold() {
    if (!household) return
    if (!confirm(`Hapus keluarga "${household.name}"? Semua anggota akan otomatis keluar. Data shared akan jadi orphan (household_id=null) — tetap bisa diakses owner asli.`)) return
    const { error } = await supabase
      .from('households')
      .delete()
      .eq('id', household.id)
    if (error) { alert(`Gagal hapus: ${error.message}`); return }
    void load()
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" /> Memuat...</div>
  }

  const today = formatDate(new Date())
  const isUserOwner = isOwner(household, user?.id ?? '')

  // ───────────────────────────────────────────────────────────
  // STATE 1: User has no household → invitation/create CTA
  // ───────────────────────────────────────────────────────────
  if (!household) {
    return (
      <div className="space-y-6">
        <div className="dark-card p-6 sm:p-7">
          <p className="caps" style={{ color: 'var(--emerald-300)' }}>Keluarga</p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mt-2">
            Atur Keuangan Bersama
          </h2>
          <p className="text-sm mt-3" style={{ color: 'var(--on-black-mut)' }}>{today}</p>
        </div>

        <div className="rounded-2xl border-2 border-dashed border-burgundy-300 bg-gradient-to-br from-burgundy-50/40 to-amber-50/40 p-8 sm:p-10 text-center"
          style={{ borderColor: 'rgba(139, 21, 56, 0.2)', background: 'linear-gradient(135deg, rgba(139, 21, 56, 0.04), rgba(217, 119, 6, 0.04))' }}
        >
          <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, var(--burgundy-700, #8b1538), #4f1d2c)' }}>
            <Home className="size-8 text-white" />
          </div>
          <h3 className="text-2xl font-bold">Belum di Keluarga</h3>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Bikin keluargamu sendiri dan ajak pasangan, anak, atau orang tua buat sama-sama mengatur keuangan.
            Wallet, transaksi, dan budget akan ke-share otomatis.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Home className="size-4" data-icon="inline-start" />
              Buat Keluarga Baru
            </Button>
            <Link href="/dashboard/pricing" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 hover:underline">
              <Sparkles className="size-3.5" />
              Lihat paket Family
            </Link>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Atau punya kode undangan dari anggota keluarga? Mereka tinggal kirim link <code className="rounded bg-muted px-1 py-0.5">/dashboard/join/[token]</code> ke kamu.
          </p>
        </div>

        {/* How it works */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: <Home className="size-5" />, title: 'Buat keluarga', desc: 'Kasih nama, kamu jadi owner.' },
            { icon: <UserPlus className="size-5" />, title: 'Undang anggota', desc: 'Kirim link unik, hingga 4 anggota total.' },
            { icon: <Users className="size-5" />, title: 'Atur bareng', desc: 'Wallet, transaksi, & budget langsung ke-share.' },
          ].map((step, i) => (
            <div key={i} className="rounded-xl border bg-white p-5">
              <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--burgundy-700, #8b1538)' }}>
                {step.icon}
                <span className="text-xs font-bold uppercase tracking-wider">Langkah {i + 1}</span>
              </div>
              <h4 className="font-semibold">{step.title}</h4>
              <p className="text-sm text-muted-foreground mt-1">{step.desc}</p>
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
  // STATE 2: User has a household → manage members & invitations
  // ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="dark-card p-6 sm:p-7">
        <p className="caps" style={{ color: 'var(--emerald-300)' }}>Keluarga</p>
        <div className="mt-3 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              {household.name}
            </h2>
            <p className="text-sm mt-3" style={{ color: 'var(--on-black-mut)' }}>
              {members.length} dari {household.max_seats} anggota · dibuat {formatDate(new Date(household.created_at))}
            </p>
          </div>
          {isUserOwner && (
            <Button
              onClick={() => { setGeneratedLink(null); setInviteEmail(''); setInviteDialogOpen(true) }}
              disabled={members.length >= household.max_seats}
            >
              <UserPlus className="size-4" data-icon="inline-start" />
              Undang Anggota
            </Button>
          )}
        </div>
      </div>

      {/* Members list */}
      <section className="space-y-3">
        <h3 className="font-semibold text-base">Anggota</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <div key={m.user_id} className="rounded-xl border bg-white p-4 flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white shrink-0"
                style={{ background: m.role === 'owner' ? 'linear-gradient(135deg, #b45309, #78350f)' : 'linear-gradient(135deg, var(--burgundy-700, #8b1538), #4f1d2c)' }}
              >
                {(m.full_name || m.email || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold truncate">
                    {m.user_id === user?.id ? 'Kamu' : (m.full_name || 'Anggota')}
                  </p>
                  {m.role === 'owner' && <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800"><Crown className="size-2.5" />Owner</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Gabung {formatDate(new Date(m.joined_at))}
                </p>
              </div>
              {/* Owner can remove members (not self), member can leave */}
              {isUserOwner && m.user_id !== user?.id && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeMember(m.user_id)}
                  disabled={removingMemberId === m.user_id}
                  title="Hapus dari keluarga"
                >
                  {removingMemberId === m.user_id
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : <Trash2 className="size-3.5 text-red-600" />}
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Pending invitations */}
      {isUserOwner && invitations.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-semibold text-base">Undangan Aktif</h3>
          <div className="space-y-2">
            {invitations.map((inv) => {
              const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
              const link = `${baseUrl}/dashboard/join/${inv.token}`
              return (
                <div key={inv.id} className="flex items-center gap-3 rounded-lg border bg-amber-50 border-amber-200 p-3">
                  <Mail className="size-4 text-amber-700 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{inv.email || 'Tanpa email (link sharing)'}</p>
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Calendar className="size-3" />
                      Berakhir {formatDate(new Date(inv.expires_at))}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(link); alert('Link disalin!') }}>
                    <Copy className="size-3.5" data-icon="inline-start" /> Salin Link
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => revokeInvite(inv.id)}>
                    <Trash2 className="size-3.5 text-red-600" />
                  </Button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* What's shared */}
      <section className="rounded-xl border bg-blue-50 border-blue-200 p-5">
        <div className="flex items-start gap-3">
          <Users className="size-5 text-blue-700 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-blue-900">Apa yang ke-share dengan anggota keluarga?</p>
            <ul className="mt-2 space-y-1 text-blue-800">
              <li>✅ <strong>Akun & dompet keluarga</strong> — semua anggota bisa lihat saldo, tambah/edit akun</li>
              <li>✅ <strong>Transaksi</strong> — semua nyatet, semua bisa lihat. Tetep ada label siapa yang nyatet</li>
              <li>✅ <strong>Anggaran (budget)</strong> — set bersama, terpakai bersama</li>
              <li className="text-blue-700/80">⚪ Aset, investasi, utang, goal — tetap personal di MVP ini</li>
            </ul>
            <p className="mt-3 text-xs text-blue-700/80">
              Data personal-mu sebelum gabung keluarga tetep aman dan personal. Yang baru kamu input setelah ini otomatis ke-share.
            </p>
          </div>
        </div>
      </section>

      {/* Danger zone */}
      <section className="rounded-xl border-2 border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Zona Berbahaya</h3>
            {isUserOwner ? (
              <>
                <p className="text-sm text-red-800 mt-1">
                  Sebagai owner, kamu bisa <strong>hapus keluarga</strong>. Semua anggota otomatis keluar dan data shared akan jadi orphan (household_id null) — tetap bisa diakses kamu sebagai pemilik.
                </p>
                <Button variant="destructive" size="sm" className="mt-3" onClick={deleteHousehold}>
                  <Trash2 className="size-4" data-icon="inline-start" />
                  Hapus Keluarga
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-red-800 mt-1">
                  Keluar dari keluarga. Data yang udah ke-share akan tetap dimiliki keluarga (kamu kehilangan akses).
                </p>
                <Button variant="destructive" size="sm" className="mt-3" onClick={() => setLeaveDialogOpen(true)}>
                  <ExternalLink className="size-4" data-icon="inline-start" />
                  Keluar dari Keluarga
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* INVITE DIALOG */}
      <Dialog open={inviteDialogOpen} onOpenChange={(o) => { setInviteDialogOpen(o); if (!o) { setGeneratedLink(null); setInviteEmail('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Undang Anggota Baru</DialogTitle>
            <DialogDescription>
              Generate link unik (berlaku 7 hari) — kirim ke calon anggota via WA, email, atau channel lain.
            </DialogDescription>
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
                  {inviting && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
                  Generate Link
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-3 py-2">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
                  ✅ Link undangan berhasil dibuat. Salin & kirim ke calon anggota.
                </div>
                <div className="grid gap-1.5">
                  <Label>Link undangan</Label>
                  <div className="flex gap-2">
                    <Input value={generatedLink} readOnly onFocus={(e) => e.currentTarget.select()} />
                    <Button onClick={copyLink} size="sm">
                      {linkCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                      {linkCopied ? 'Disalin' : 'Salin'}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Berlaku 7 hari. Penerima harus login (atau signup) sebelum bisa terima undangan.
                </p>
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
            <DialogTitle>Keluar dari Keluarga?</DialogTitle>
            <DialogDescription>
              Kamu akan keluar dari <strong>{household.name}</strong>. Akses ke wallet, transaksi, dan budget bersama akan hilang. Data personalmu tetap aman.
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
          <DialogTitle>Bikin Keluarga Baru</DialogTitle>
          <DialogDescription>
            Kasih nama keluargamu. Kamu jadi owner — bisa undang & hapus anggota.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="hh-name">Nama keluarga</Label>
            <Input
              id="hh-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth: Keluarga Andi & Sari"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
            Buat Keluarga
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
