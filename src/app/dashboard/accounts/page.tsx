'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ACCOUNT_TYPES } from '@/lib/constants'
import type { Account } from '@/types'
import { usePrivacy } from '@/components/privacy/privacy-provider'

import { Button } from '@/components/ui/button'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pencil, Trash2, Plus, Loader2, Wallet, Star, Layers } from 'lucide-react'
import { AccountAllocationsDialog } from '@/components/accounts/allocations-dialog'
import { InstitutionLogo } from '@/components/accounts/institution-logo'
import { InstitutionSearch } from '@/components/accounts/institution-search'

type AccountType = keyof typeof ACCOUNT_TYPES

const emptyForm = {
  name: '',
  type: 'bank' as AccountType,
  starting_balance: 0,
}

export default function AccountsPage() {
  const supabase = createClient()
  const { hidden: privacyHidden } = usePrivacy()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Allocations: { account_id: [allocations] } — populated alongside accounts
  // so each row can show its allocation summary without per-row queries.
  type AllocationSummary = {
    purpose_kind: 'emergency_fund' | 'goal' | 'sinking_fund' | 'other'
    label: string  // resolved label (goal name / 'Dana Darurat' / custom)
    amount: number
  }
  const [allocationsByAccount, setAllocationsByAccount] = useState<Record<string, AllocationSummary[]>>({})
  const [allocAccount, setAllocAccount] = useState<Account | null>(null)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [accRes, profRes, allocRes, goalsRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
      supabase.from('profiles').select('default_account_id').eq('id', user.id).maybeSingle(),
      // Allocations table may not exist yet (migration 016 not applied)
      // — wrap so the page still works in that case.
      supabase
        .from('account_allocations')
        .select('account_id, purpose_kind, goal_id, custom_label, amount')
        .eq('user_id', user.id)
        .then(
          (r: { data: unknown; error: unknown }) => r,
          () => ({ data: [] as unknown[], error: null as unknown }),
        ),
      supabase.from('goals').select('id, name').eq('user_id', user.id),
    ])

    if (accRes.data) setAccounts(accRes.data)
    if (profRes.data?.default_account_id) setDefaultAccountId(profRes.data.default_account_id as string)

    // Build allocations map
    type AllocRow = {
      account_id: string
      purpose_kind: 'emergency_fund' | 'goal' | 'sinking_fund' | 'other'
      goal_id: string | null
      custom_label: string | null
      amount: number
    }
    const goalNameById: Record<string, string> = {}
    ;((goalsRes.data ?? []) as { id: string; name: string }[]).forEach((g) => {
      goalNameById[g.id] = g.name
    })
    const map: Record<string, AllocationSummary[]> = {}
    ;((allocRes.data ?? []) as AllocRow[]).forEach((row) => {
      const label =
        row.purpose_kind === 'emergency_fund' ? 'Dana Darurat'
        : row.purpose_kind === 'goal' ? (goalNameById[row.goal_id ?? ''] ?? 'Goal')
        : (row.custom_label?.trim() || 'Sinking Fund')
      if (!map[row.account_id]) map[row.account_id] = []
      map[row.account_id].push({ purpose_kind: row.purpose_kind, label, amount: row.amount })
    })
    setAllocationsByAccount(map)

    setLoading(false)
  }

  function openAddDialog() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEditDialog(acc: Account) {
    setEditingId(acc.id)
    setForm({
      name: acc.name,
      type: acc.type as AccountType,
      starting_balance: acc.starting_balance,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      alert('Nama akun wajib diisi.')
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    if (editingId) {
      // Edit: update name, type, starting_balance.
      // Adjust current_balance by the delta of starting_balance change so existing
      // tx-driven adjustments stay intact.
      const original = accounts.find((a) => a.id === editingId)
      const startingDelta = form.starting_balance - (original?.starting_balance ?? 0)
      const newCurrent = (original?.current_balance ?? 0) + startingDelta

      const { error } = await supabase
        .from('accounts')
        .update({
          name: form.name.trim(),
          type: form.type,
          starting_balance: form.starting_balance,
          current_balance: newCurrent,
        })
        .eq('id', editingId)
      if (error) {
        setSaving(false)
        alert(`Gagal update akun: ${error.message}`)
        return
      }
    } else {
      // Auto-tag household_id if user is in a household — makes new accounts
      // shared with family members.
      const memRes = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .maybeSingle()
      const householdId = (memRes.data as { household_id: string } | null)?.household_id ?? null

      const insertPayload: Record<string, unknown> = {
        user_id: user.id,
        name: form.name.trim(),
        type: form.type,
        starting_balance: form.starting_balance,
        current_balance: form.starting_balance,
      }
      if (householdId) insertPayload.household_id = householdId

      const { error } = await supabase.from('accounts').insert(insertPayload)
      if (error) {
        setSaving(false)
        alert(`Gagal buat akun: ${error.message}`)
        return
      }
    }

    setSaving(false)
    setDialogOpen(false)
    fetchData()
  }

  async function handleDelete() {
    if (!deleteId) return
    const { error } = await supabase.from('accounts').delete().eq('id', deleteId)
    if (error) {
      alert(`Gagal hapus akun: ${error.message}\n\nMungkin akun ini masih dipakai di transaksi. Hapus dulu transaksinya, atau pindahkan ke akun lain.`)
    }
    setDeleteId(null)
    fetchData()
  }

  async function handleSetDefault(accountId: string) {
    setSettingDefaultId(accountId)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSettingDefaultId(null); return }
    const { error } = await supabase
      .from('profiles')
      .update({ default_account_id: accountId })
      .eq('id', user.id)
    setSettingDefaultId(null)
    if (error) {
      alert(`Gagal set default: ${error.message}`)
      return
    }
    setDefaultAccountId(accountId)
  }

  const today = formatDate(new Date())
  const totalBalance = accounts.reduce((sum, a) => sum + (a.current_balance ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Dark gradient hero */}
      <section
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, #0A0A0F 0%, #14141A 50%, #0F1F1A 100%)',
          color: '#F5F5F7',
          boxShadow: '0 24px 60px -20px rgba(0,0,0,0.40)',
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: -120,
            right: -80,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.18), transparent 65%)',
          }}
        />
        <div className="relative p-6 sm:p-9">
          <p
            className="text-[11px] font-semibold tracking-[0.18em] uppercase"
            style={{ color: '#6EE7B7' }}
          >
            Akun & Saldo
          </p>
          {!loading && accounts.length > 0 ? (
            <>
              <p
                className="num tabular font-bold mt-3 leading-none whitespace-nowrap"
                style={{
                  color: '#FFFFFF',
                  fontSize: 'clamp(36px, 5vw, 56px)',
                  letterSpacing: '-0.04em',
                }}
              >
                {formatCurrency(totalBalance)}
              </p>
              <p className="text-sm mt-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Total saldo gabungan dari {accounts.length} akun · {today}
              </p>
            </>
          ) : (
            <h1
              className="font-bold mt-2"
              style={{
                fontSize: 'clamp(28px, 4vw, 40px)',
                color: '#FFFFFF',
                letterSpacing: '-0.035em',
              }}
            >
              Kelola Akun
            </h1>
          )}
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={openAddDialog}>
          <Plus className="size-4" data-icon="inline-start" />
          Tambah Akun
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin mr-2" /> Memuat...
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/10 p-10 text-center">
          <Wallet className="size-12 mx-auto text-muted-foreground/60" />
          <h3 className="mt-4 text-lg font-semibold">Belum ada akun</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Bikin akun pertama kamu (e.g. BCA Tahapan, Cash di dompet, GoPay).
            Akun ini dipakai untuk mencatat transaksi.
          </p>
          <Button onClick={openAddDialog} className="mt-5">
            <Plus className="size-4" data-icon="inline-start" />
            Bikin Akun Pertama
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map((a) => {
            const allocs = allocationsByAccount[a.id] ?? []
            const totalAllocated = allocs.reduce((s, x) => s + x.amount, 0)
            const free = (a.current_balance ?? 0) - totalAllocated
            const pillBg: Record<string, string> = {
              emergency_fund: 'rgba(16,185,129,0.10)',
              goal: 'rgba(14,165,233,0.12)',
              sinking_fund: 'rgba(245,158,11,0.12)',
              other: 'rgba(107,114,128,0.10)',
            }
            const pillFg: Record<string, string> = {
              emergency_fund: '#065F46',
              goal: '#0369A1',
              sinking_fund: '#92400E',
              other: '#374151',
            }
            const typeLabel = ACCOUNT_TYPES[a.type as AccountType] ?? a.type
            const typeAccent: Record<string, string> = {
              cash: '#84CC16',
              bank: '#3B82F6',
              digital_wallet: '#8B5CF6',
              rdn: '#14B8A6',
              investment: '#0EA5E9',
            }
            const accent = typeAccent[a.type] ?? '#6B7280'
            return (
              <div
                key={a.id}
                className="group relative rounded-xl border bg-white p-4 transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden"
                style={{ borderColor: 'var(--border-soft)' }}
              >
                {/* Decorative accent stripe by type */}
                <div
                  className="absolute top-0 left-0 right-0 h-0.5"
                  style={{ background: accent }}
                  aria-hidden="true"
                />

                <div className="flex items-start gap-3">
                  <InstitutionLogo accountName={a.name} size={48} shape="circle" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>
                          {a.name?.trim() || 'Akun tanpa nama'}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                          {typeLabel}
                          {a.id === defaultAccountId && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px]" style={{ color: '#3B82F6' }}>
                              <Star className="size-2.5 fill-current" /> Default
                            </span>
                          )}
                        </p>
                      </div>

                      {/* 3-dot menu — actions on hover */}
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setAllocAccount(a)}
                          title="Atur alokasi"
                        >
                          <Layers className="size-3.5" />
                        </Button>
                        {a.id !== defaultAccountId && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleSetDefault(a.id)}
                            disabled={settingDefaultId === a.id}
                            title="Jadikan default"
                          >
                            {settingDefaultId === a.id
                              ? <Loader2 className="size-3.5 animate-spin" />
                              : <Star className="size-3.5" />}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(a)} title="Edit">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteId(a.id)} title="Hapus">
                          <Trash2 className="size-3.5" style={{ color: 'var(--c-coral)' }} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Balance */}
                <div className="mt-3">
                  <p className="num tabular text-xl font-semibold" style={{ color: 'var(--ink)' }}>
                    {formatCurrency(a.current_balance ?? 0)}
                  </p>
                  {totalAllocated > 0 && (
                    <p className="text-[11px] mt-0.5" style={{ color: free < 0 ? '#F43F5E' : 'var(--ink-soft)' }}>
                      Bebas {formatCurrency(free)} · Dialokasi {formatCurrency(totalAllocated)}
                    </p>
                  )}
                </div>

                {/* Allocation pills */}
                {allocs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {allocs.map((al, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: pillBg[al.purpose_kind], color: pillFg[al.purpose_kind] }}
                        title={privacyHidden ? al.label : `${al.label}: ${formatCurrency(al.amount)}`}
                      >
                        {al.label} · {formatCurrency(al.amount)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Allocations dialog */}
      <AccountAllocationsDialog
        open={allocAccount !== null}
        onClose={() => setAllocAccount(null)}
        account={allocAccount}
        onSaved={() => fetchData()}
      />

      {!loading && accounts.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Saldo Saat Ini auto-update tiap kali kamu input transaksi yang pakai akun ini.
          Lihat juga{' '}
          <Link href="/dashboard/transactions" className="underline hover:text-foreground">
            Transaksi
          </Link>
          {' atau '}
          <Link href="/dashboard/credit-cards" className="underline hover:text-foreground">
            Kartu Kredit
          </Link>
          .
        </p>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Akun' : 'Tambah Akun'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Ubah detail akun. Saldo Saat Ini akan disesuaikan jika kamu ubah Saldo Awal.'
                : 'Buat akun baru untuk mencatat transaksi.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="acc-name">Nama Akun</Label>
              <InstitutionSearch
                value={form.name}
                onTextChange={(text) => setForm({ ...form, name: text })}
                onPick={(inst) =>
                  setForm({
                    ...form,
                    name: inst.brand,
                    type: inst.type as AccountType,
                  })
                }
                placeholder="contoh: BCA, Jenius, GoPay, Cash..."
              />
              <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                Pilih dari daftar atau ketik nama custom (misal &ldquo;BCA Tahapan Utama&rdquo;)
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label>Tipe</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: (v ?? 'bank') as AccountType })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih tipe">
                    {(v) => ACCOUNT_TYPES[v as AccountType] ?? 'Pilih tipe'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ACCOUNT_TYPES) as AccountType[]).map((t) => (
                    <SelectItem key={t} value={t}>{ACCOUNT_TYPES[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="acc-balance">
                Saldo Awal (Rp)
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  — saldo saat akun ini mulai dicatat
                </span>
              </Label>
              <NumberInput
                id="acc-balance"
                value={form.starting_balance}
                onChange={(n) => setForm({ ...form, starting_balance: n })}
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
              {editingId ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Akun?</DialogTitle>
            <DialogDescription>
              Aksi ini tidak bisa dibatalkan. Kalau akun ini masih terhubung dengan transaksi,
              hapus akan gagal — kamu harus hapus transaksinya dulu atau pindahkan ke akun lain.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
