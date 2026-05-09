'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ACCOUNT_TYPES } from '@/lib/constants'
import type { Account } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Pencil, Trash2, Plus, Loader2, Wallet, Star } from 'lucide-react'

type AccountType = keyof typeof ACCOUNT_TYPES

const TYPE_BADGE: Record<AccountType, string> = {
  cash: 'bg-amber-100 text-amber-700',
  bank: 'bg-blue-100 text-blue-700',
  digital_wallet: 'bg-purple-100 text-purple-700',
  investment: 'bg-emerald-100 text-emerald-700',
}

const emptyForm = {
  name: '',
  type: 'bank' as AccountType,
  starting_balance: 0,
}

export default function AccountsPage() {
  const supabase = createClient()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [accRes, profRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
      supabase.from('profiles').select('default_account_id').eq('id', user.id).maybeSingle(),
    ])

    if (accRes.data) setAccounts(accRes.data)
    if (profRes.data?.default_account_id) setDefaultAccountId(profRes.data.default_account_id as string)
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
      // Insert: current_balance starts at starting_balance
      const { error } = await supabase
        .from('accounts')
        .insert({
          user_id: user.id,
          name: form.name.trim(),
          type: form.type,
          starting_balance: form.starting_balance,
          current_balance: form.starting_balance,
        })
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
      <div className="dark-card p-6 sm:p-7">
        <p className="caps">Akun & Saldo</p>
        <div className="mt-2 flex items-end gap-4">
          <h2 className="text-white text-3xl sm:text-4xl font-semibold tracking-tight">
            Kelola Akun
          </h2>
          <span className="accent-underline mb-2" />
        </div>
        <p className="text-sm mt-2" style={{ color: 'var(--on-black-mut)' }}>{today}</p>
        {!loading && accounts.length > 0 && (
          <p className="text-sm mt-3" style={{ color: 'var(--on-black-mut)' }}>
            Total saldo gabungan: <span className="font-semibold text-white">{formatCurrency(totalBalance)}</span>
          </p>
        )}
      </div>

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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead className="text-right">Saldo Awal</TableHead>
              <TableHead className="text-right">Saldo Saat Ini</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {a.name}
                    {a.id === defaultAccountId && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        <Star className="size-3 fill-blue-700" /> Default
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={TYPE_BADGE[a.type as AccountType]}>
                    {ACCOUNT_TYPES[a.type as AccountType] ?? a.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCurrency(a.starting_balance ?? 0)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatCurrency(a.current_balance ?? 0)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {a.id !== defaultAccountId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSetDefault(a.id)}
                        disabled={settingDefaultId === a.id}
                        title="Jadikan default"
                      >
                        {settingDefaultId === a.id
                          ? <Loader2 className="size-4 animate-spin" />
                          : <Star className="size-4" />}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(a)} title="Edit">
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(a.id)} title="Hapus">
                      <Trash2 className="size-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!loading && accounts.length > 0 && (
        <p className="text-xs text-muted-foreground">
          💡 Saldo Saat Ini auto-update tiap kali kamu input transaksi yang pakai akun ini.
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
              <Input
                id="acc-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="contoh: BCA Tahapan, Cash, GoPay"
                autoFocus
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Tipe</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: (v ?? 'bank') as AccountType })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
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
              <Input
                id="acc-balance"
                type="number"
                min={0}
                value={form.starting_balance || ''}
                onChange={(e) => setForm({ ...form, starting_balance: Number(e.target.value) })}
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
