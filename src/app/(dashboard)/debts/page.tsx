'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Debt } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Pencil, Trash2, Plus, Loader2, ChevronDown, ChevronUp, Check, X } from 'lucide-react'

// ─── Constants ───

const DEBT_CATEGORY_LABELS: Record<string, string> = {
  consumer: 'Utang Konsumer',
  cash_loan: 'Utang Pinjaman Tunai',
  long_term: 'Utang Jangka Panjang',
}

const DEBT_TYPE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  consumer: [
    { value: 'kartu_kredit', label: 'Kartu Kredit' },
    { value: 'paylater', label: 'Paylater' },
    { value: 'kta', label: 'KTA' },
    { value: 'pembiayaan_konsumer', label: 'Pembiayaan Konsumer' },
  ],
  cash_loan: [
    { value: 'pinjaman_pribadi', label: 'Pinjaman Pribadi' },
    { value: 'pinjaman_dana_tunai', label: 'Pinjaman Dana Tunai' },
  ],
  long_term: [
    { value: 'kpr', label: 'KPR' },
    { value: 'kpa', label: 'KPA' },
    { value: 'kpt', label: 'KPT' },
    { value: 'hutang_properti_komersial', label: 'Hutang Properti Komersial' },
    { value: 'hutang_kendaraan', label: 'Hutang Kendaraan' },
    { value: 'pinjaman_motor', label: 'Pinjaman Motor' },
    { value: 'pinjaman_mobil', label: 'Pinjaman Mobil' },
    { value: 'hutang_usaha', label: 'Hutang Usaha' },
    { value: 'pinjaman_bisnis', label: 'Pinjaman Bisnis' },
  ],
}

function getDebtTypeLabel(type: string): string {
  for (const types of Object.values(DEBT_TYPE_OPTIONS)) {
    const found = types.find((t) => t.value === type)
    if (found) return found.label
  }
  return type
}

const emptyDebtForm = {
  name: '',
  category: 'consumer' as string,
  type: '',
  principal: 0,
  remaining: 0,
  interest_rate: 0,
  monthly_payment: 0,
  due_date: new Date().toISOString().split('T')[0],
  is_active: true,
}

export default function DebtsPage() {
  const supabase = createClient()

  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyDebtForm)

  // Collapsible sections
  const [consumerOpen, setConsumerOpen] = useState(true)
  const [cashLoanOpen, setCashLoanOpen] = useState(true)
  const [longTermOpen, setLongTermOpen] = useState(true)

  useEffect(() => {
    fetchDebts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchDebts() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('debts')
      .select('*')
      .eq('user_id', user.id)
      .order('name')

    if (data) setDebts(data)
    setLoading(false)
  }

  function openAddDialog() {
    setEditingId(null)
    setForm(emptyDebtForm)
    setDialogOpen(true)
  }

  function openEditDialog(debt: Debt) {
    setEditingId(debt.id)
    setForm({
      name: debt.name,
      category: debt.category,
      type: debt.type,
      principal: debt.principal,
      remaining: debt.remaining,
      interest_rate: debt.interest_rate,
      monthly_payment: debt.monthly_payment,
      due_date: debt.due_date,
      is_active: debt.is_active,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      name: form.name,
      category: form.category,
      type: form.type,
      principal: form.principal,
      remaining: form.remaining,
      interest_rate: form.interest_rate,
      monthly_payment: form.monthly_payment,
      due_date: form.due_date,
      is_active: form.is_active,
    }

    if (editingId) {
      await supabase.from('debts').update(payload).eq('id', editingId)
    } else {
      await supabase.from('debts').insert(payload)
    }

    setSaving(false)
    setDialogOpen(false)
    fetchDebts()
  }

  async function handleDelete(id: string) {
    await supabase.from('debts').delete().eq('id', id)
    fetchDebts()
  }

  async function handleToggleActive(debt: Debt) {
    await supabase
      .from('debts')
      .update({ is_active: !debt.is_active })
      .eq('id', debt.id)
    fetchDebts()
  }

  // ─── Grouping & Summaries ───

  const debtsByCategory = debts.reduce(
    (acc, debt) => {
      if (!acc[debt.category]) acc[debt.category] = []
      acc[debt.category].push(debt)
      return acc
    },
    {} as Record<string, Debt[]>,
  )

  const totalConsumer = (debtsByCategory['consumer'] || [])
    .filter((d) => d.is_active)
    .reduce((s, d) => s + d.remaining, 0)
  const totalCashLoan = (debtsByCategory['cash_loan'] || [])
    .filter((d) => d.is_active)
    .reduce((s, d) => s + d.remaining, 0)
  const totalLongTerm = (debtsByCategory['long_term'] || [])
    .filter((d) => d.is_active)
    .reduce((s, d) => s + d.remaining, 0)
  const totalAll = totalConsumer + totalCashLoan + totalLongTerm

  // ─── Render Section Table ───

  function renderDebtTable(category: string) {
    const categoryDebts = debtsByCategory[category] || []

    if (categoryDebts.length === 0) {
      return (
        <p className="text-sm text-gray-400 py-6 text-center">
          Belum ada utang di kategori ini.
        </p>
      )
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead className="text-right">Pokok</TableHead>
            <TableHead className="text-right">Sisa</TableHead>
            <TableHead className="text-right">Bunga (%)</TableHead>
            <TableHead className="text-right">Cicilan/bln</TableHead>
            <TableHead>Jatuh Tempo</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categoryDebts.map((debt) => (
            <TableRow key={debt.id} className={!debt.is_active ? 'opacity-60' : ''}>
              <TableCell className="font-medium">{debt.name}</TableCell>
              <TableCell>{getDebtTypeLabel(debt.type)}</TableCell>
              <TableCell className="text-right">
                {formatCurrency(debt.principal)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(debt.remaining)}
              </TableCell>
              <TableCell className="text-right">{debt.interest_rate}%</TableCell>
              <TableCell className="text-right">
                {formatCurrency(debt.monthly_payment)}
              </TableCell>
              <TableCell>{formatDate(debt.due_date)}</TableCell>
              <TableCell className="text-center">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleToggleActive(debt)}
                  title={debt.is_active ? 'Tandai lunas' : 'Tandai aktif'}
                >
                  {debt.is_active ? (
                    <Badge className="bg-red-100 text-red-700">Aktif</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-700">Lunas</Badge>
                  )}
                </Button>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEditDialog(debt)}
                  >
                    <Pencil className="size-4 text-gray-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(debt.id)}
                  >
                    <Trash2 className="size-4 text-red-500" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Utang</h1>
          <p className="text-sm text-gray-500">Kelola semua utang dan kewajiban Anda</p>
        </div>
        <Button
          className="bg-teal-600 hover:bg-teal-700 text-white"
          onClick={openAddDialog}
        >
          <Plus className="size-4" data-icon="inline-start" />
          Tambah Utang
        </Button>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-teal-600" />
          <span className="ml-2 text-gray-500">Memuat data...</span>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-sm text-red-800">Total Utang Konsumer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-red-900">
                  {formatCurrency(totalConsumer)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-sm text-red-800">Total Utang Pinjaman Tunai</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-red-900">
                  {formatCurrency(totalCashLoan)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-sm text-red-800">Total Utang Jangka Panjang</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-red-900">
                  {formatCurrency(totalLongTerm)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-red-300 bg-red-100">
              <CardHeader>
                <CardTitle className="text-sm text-red-900 font-bold">Total Semua Utang</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-red-900">
                  {formatCurrency(totalAll)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ═══ Section 1: Utang Konsumer ═══ */}
          <Card>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setConsumerOpen(!consumerOpen)}
            >
              <div className="flex items-center justify-between w-full">
                <CardTitle className="text-teal-800">Utang Konsumer</CardTitle>
                {consumerOpen ? (
                  <ChevronUp className="size-5 text-teal-600" />
                ) : (
                  <ChevronDown className="size-5 text-teal-600" />
                )}
              </div>
            </CardHeader>
            {consumerOpen && <CardContent>{renderDebtTable('consumer')}</CardContent>}
          </Card>

          {/* ═══ Section 2: Utang Pinjaman Tunai ═══ */}
          <Card>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setCashLoanOpen(!cashLoanOpen)}
            >
              <div className="flex items-center justify-between w-full">
                <CardTitle className="text-teal-800">Utang Pinjaman Tunai</CardTitle>
                {cashLoanOpen ? (
                  <ChevronUp className="size-5 text-teal-600" />
                ) : (
                  <ChevronDown className="size-5 text-teal-600" />
                )}
              </div>
            </CardHeader>
            {cashLoanOpen && <CardContent>{renderDebtTable('cash_loan')}</CardContent>}
          </Card>

          {/* ═══ Section 3: Utang Jangka Panjang ═══ */}
          <Card>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setLongTermOpen(!longTermOpen)}
            >
              <div className="flex items-center justify-between w-full">
                <CardTitle className="text-teal-800">Utang Jangka Panjang</CardTitle>
                {longTermOpen ? (
                  <ChevronUp className="size-5 text-teal-600" />
                ) : (
                  <ChevronDown className="size-5 text-teal-600" />
                )}
              </div>
            </CardHeader>
            {longTermOpen && <CardContent>{renderDebtTable('long_term')}</CardContent>}
          </Card>
        </>
      )}

      {/* ═══ Add / Edit Dialog ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Utang' : 'Tambah Utang'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Ubah detail utang di bawah ini.'
                : 'Isi detail utang baru di bawah ini.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="debt-name">Nama</Label>
              <Input
                id="debt-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: KPR BCA, Kartu Kredit Mandiri"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Kategori</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v ?? form.category, type: '' })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DEBT_CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Tipe</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v ?? '' })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih tipe" />
                </SelectTrigger>
                <SelectContent>
                  {(DEBT_TYPE_OPTIONS[form.category] || []).map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="debt-principal">Pokok (Rp)</Label>
              <Input
                id="debt-principal"
                type="number"
                min={0}
                value={form.principal || ''}
                onChange={(e) =>
                  setForm({ ...form, principal: Number(e.target.value) })
                }
                placeholder="0"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="debt-remaining">Sisa (Rp)</Label>
              <Input
                id="debt-remaining"
                type="number"
                min={0}
                value={form.remaining || ''}
                onChange={(e) =>
                  setForm({ ...form, remaining: Number(e.target.value) })
                }
                placeholder="0"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="debt-interest">Bunga (%)</Label>
              <Input
                id="debt-interest"
                type="number"
                min={0}
                step="0.01"
                value={form.interest_rate || ''}
                onChange={(e) =>
                  setForm({ ...form, interest_rate: Number(e.target.value) })
                }
                placeholder="0"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="debt-monthly">Cicilan/bulan (Rp)</Label>
              <Input
                id="debt-monthly"
                type="number"
                min={0}
                value={form.monthly_payment || ''}
                onChange={(e) =>
                  setForm({ ...form, monthly_payment: Number(e.target.value) })
                }
                placeholder="0"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="debt-due">Jatuh Tempo</Label>
              <Input
                id="debt-due"
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={form.is_active ? 'outline' : 'ghost'}
                size="sm"
                className={
                  form.is_active
                    ? 'border-red-300 text-red-700 hover:bg-red-50'
                    : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                }
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
              >
                {form.is_active ? (
                  <>
                    <X className="size-3.5 mr-1" />
                    Aktif
                  </>
                ) : (
                  <>
                    <Check className="size-3.5 mr-1" />
                    Lunas
                  </>
                )}
              </Button>
              <span className="text-sm text-gray-500">
                {form.is_active ? 'Utang masih aktif' : 'Utang sudah lunas'}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={handleSave}
              disabled={saving}
            >
              {saving && <Loader2 className="size-4 animate-spin mr-1" />}
              {editingId ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
