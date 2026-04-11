'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { AssetLiquid, AssetNonLiquid, Investment } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react'

// ─── Liquid Asset Constants ───

const LIQUID_TYPE_LABELS: Record<string, string> = {
  cash: 'Kas',
  bank: 'Bank',
  digital_wallet: 'Dompet Digital',
  receivable: 'Piutang',
}

// ─── Non-Liquid Asset Constants ───

const NON_LIQUID_CATEGORY_LABELS: Record<string, string> = {
  property: 'Properti',
  vehicle: 'Kendaraan',
  personal_item: 'Barang Pribadi',
}

const NON_LIQUID_TYPES: Record<string, { value: string; label: string }[]> = {
  property: [
    { value: 'rumah', label: 'Rumah' },
    { value: 'apartemen', label: 'Apartemen' },
    { value: 'tanah', label: 'Tanah' },
    { value: 'properti_komersial', label: 'Properti Komersial' },
    { value: 'properti_industri', label: 'Properti Industri' },
  ],
  vehicle: [
    { value: 'motor', label: 'Motor' },
    { value: 'mobil', label: 'Mobil' },
    { value: 'kendaraan_lainnya', label: 'Kendaraan Lainnya' },
  ],
  personal_item: [
    { value: 'koleksi', label: 'Koleksi' },
    { value: 'perabotan', label: 'Perabotan' },
    { value: 'elektronik', label: 'Elektronik' },
  ],
}

function getNonLiquidTypeLabel(type: string): string {
  for (const types of Object.values(NON_LIQUID_TYPES)) {
    const found = types.find((t) => t.value === type)
    if (found) return found.label
  }
  return type
}

// ─── Investment Constants ───

const INVESTMENT_CATEGORY_LABELS: Record<string, string> = {
  stock: 'Saham',
  mutual_fund: 'Reksa Dana',
  crypto: 'Cryptocurrency',
  gold: 'Emas',
  bond: 'Obligasi',
  time_deposit: 'Deposito',
  p2p: 'P2P Lending',
  business: 'Investasi Bisnis',
}

const INVESTMENT_TYPE_LABELS: Record<string, string> = {
  variable_income: 'Pendapatan Variabel',
  fixed_income: 'Pendapatan Tetap',
  business: 'Bisnis',
}

const INVESTMENT_BADGE_COLORS: Record<string, string> = {
  stock: 'bg-blue-100 text-blue-700',
  mutual_fund: 'bg-purple-100 text-purple-700',
  crypto: 'bg-orange-100 text-orange-700',
  gold: 'bg-yellow-100 text-yellow-700',
  bond: 'bg-green-100 text-green-700',
  time_deposit: 'bg-teal-100 text-teal-700',
  p2p: 'bg-pink-100 text-pink-700',
  business: 'bg-indigo-100 text-indigo-700',
}

// ─── Empty Forms ───

const emptyLiquidForm = {
  name: '',
  type: 'cash' as string,
  balance: 0,
}

const emptyNonLiquidForm = {
  name: '',
  category: 'property' as string,
  type: '',
  purchase_value: 0,
  current_value: 0,
  purchase_date: new Date().toISOString().split('T')[0],
  notes: '',
}

const emptyInvestmentForm = {
  category: 'stock' as string,
  name: '',
  platform: '',
  quantity: 0,
  avg_cost: 0,
  current_price: 0,
  total_value: 0,
  type: 'variable_income' as string,
}

export default function AssetsPage() {
  const supabase = createClient()

  // ─── Liquid Assets State ───
  const [liquidAssets, setLiquidAssets] = useState<AssetLiquid[]>([])
  const [liquidLoading, setLiquidLoading] = useState(true)
  const [liquidDialogOpen, setLiquidDialogOpen] = useState(false)
  const [liquidEditingId, setLiquidEditingId] = useState<string | null>(null)
  const [liquidForm, setLiquidForm] = useState(emptyLiquidForm)
  const [liquidSaving, setLiquidSaving] = useState(false)

  // ─── Non-Liquid Assets State ───
  const [nonLiquidAssets, setNonLiquidAssets] = useState<AssetNonLiquid[]>([])
  const [nonLiquidLoading, setNonLiquidLoading] = useState(true)
  const [nonLiquidDialogOpen, setNonLiquidDialogOpen] = useState(false)
  const [nonLiquidEditingId, setNonLiquidEditingId] = useState<string | null>(null)
  const [nonLiquidForm, setNonLiquidForm] = useState(emptyNonLiquidForm)
  const [nonLiquidSaving, setNonLiquidSaving] = useState(false)

  // ─── Investments State ───
  const [investments, setInvestments] = useState<Investment[]>([])
  const [investmentLoading, setInvestmentLoading] = useState(true)
  const [investmentDialogOpen, setInvestmentDialogOpen] = useState(false)
  const [investmentEditingId, setInvestmentEditingId] = useState<string | null>(null)
  const [investmentForm, setInvestmentForm] = useState(emptyInvestmentForm)
  const [investmentSaving, setInvestmentSaving] = useState(false)

  useEffect(() => {
    fetchLiquidAssets()
    fetchNonLiquidAssets()
    fetchInvestments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Liquid Assets CRUD ───

  async function fetchLiquidAssets() {
    setLiquidLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('assets_liquid')
      .select('*')
      .eq('user_id', user.id)
      .order('name')

    if (data) setLiquidAssets(data)
    setLiquidLoading(false)
  }

  function openAddLiquidDialog() {
    setLiquidEditingId(null)
    setLiquidForm(emptyLiquidForm)
    setLiquidDialogOpen(true)
  }

  function openEditLiquidDialog(asset: AssetLiquid) {
    setLiquidEditingId(asset.id)
    setLiquidForm({
      name: asset.name,
      type: asset.type,
      balance: asset.balance,
    })
    setLiquidDialogOpen(true)
  }

  async function handleSaveLiquid() {
    setLiquidSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const now = new Date()
    const payload = {
      user_id: user.id,
      name: liquidForm.name,
      type: liquidForm.type,
      balance: liquidForm.balance,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    }

    if (liquidEditingId) {
      await supabase.from('assets_liquid').update(payload).eq('id', liquidEditingId)
    } else {
      await supabase.from('assets_liquid').insert(payload)
    }

    setLiquidSaving(false)
    setLiquidDialogOpen(false)
    fetchLiquidAssets()
  }

  async function handleDeleteLiquid(id: string) {
    await supabase.from('assets_liquid').delete().eq('id', id)
    fetchLiquidAssets()
  }

  const totalLiquid = liquidAssets.reduce((sum, a) => sum + a.balance, 0)

  // ─── Non-Liquid Assets CRUD ───

  async function fetchNonLiquidAssets() {
    setNonLiquidLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('assets_non_liquid')
      .select('*')
      .eq('user_id', user.id)
      .order('name')

    if (data) setNonLiquidAssets(data)
    setNonLiquidLoading(false)
  }

  function openAddNonLiquidDialog() {
    setNonLiquidEditingId(null)
    setNonLiquidForm(emptyNonLiquidForm)
    setNonLiquidDialogOpen(true)
  }

  function openEditNonLiquidDialog(asset: AssetNonLiquid) {
    setNonLiquidEditingId(asset.id)
    setNonLiquidForm({
      name: asset.name,
      category: asset.category,
      type: asset.type,
      purchase_value: asset.purchase_value,
      current_value: asset.current_value,
      purchase_date: asset.purchase_date,
      notes: asset.notes,
    })
    setNonLiquidDialogOpen(true)
  }

  async function handleSaveNonLiquid() {
    setNonLiquidSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      name: nonLiquidForm.name,
      category: nonLiquidForm.category,
      type: nonLiquidForm.type,
      purchase_value: nonLiquidForm.purchase_value,
      current_value: nonLiquidForm.current_value,
      purchase_date: nonLiquidForm.purchase_date,
      notes: nonLiquidForm.notes,
    }

    if (nonLiquidEditingId) {
      await supabase.from('assets_non_liquid').update(payload).eq('id', nonLiquidEditingId)
    } else {
      await supabase.from('assets_non_liquid').insert(payload)
    }

    setNonLiquidSaving(false)
    setNonLiquidDialogOpen(false)
    fetchNonLiquidAssets()
  }

  async function handleDeleteNonLiquid(id: string) {
    await supabase.from('assets_non_liquid').delete().eq('id', id)
    fetchNonLiquidAssets()
  }

  // Group non-liquid by category
  const nonLiquidByCategory = nonLiquidAssets.reduce(
    (acc, asset) => {
      if (!acc[asset.category]) acc[asset.category] = []
      acc[asset.category].push(asset)
      return acc
    },
    {} as Record<string, AssetNonLiquid[]>,
  )

  // ─── Investments CRUD ───

  async function fetchInvestments() {
    setInvestmentLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', user.id)
      .order('name')

    if (data) setInvestments(data)
    setInvestmentLoading(false)
  }

  function openAddInvestmentDialog() {
    setInvestmentEditingId(null)
    setInvestmentForm(emptyInvestmentForm)
    setInvestmentDialogOpen(true)
  }

  function openEditInvestmentDialog(inv: Investment) {
    setInvestmentEditingId(inv.id)
    setInvestmentForm({
      category: inv.category,
      name: inv.name,
      platform: inv.platform,
      quantity: inv.quantity,
      avg_cost: inv.avg_cost,
      current_price: inv.current_price,
      total_value: inv.total_value,
      type: inv.type,
    })
    setInvestmentDialogOpen(true)
  }

  async function handleSaveInvestment() {
    setInvestmentSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const totalValue = investmentForm.quantity * investmentForm.current_price

    const payload = {
      user_id: user.id,
      category: investmentForm.category,
      name: investmentForm.name,
      platform: investmentForm.platform,
      quantity: investmentForm.quantity,
      avg_cost: investmentForm.avg_cost,
      current_price: investmentForm.current_price,
      total_value: totalValue,
      type: investmentForm.type,
    }

    if (investmentEditingId) {
      await supabase.from('investments').update(payload).eq('id', investmentEditingId)
    } else {
      await supabase.from('investments').insert(payload)
    }

    setInvestmentSaving(false)
    setInvestmentDialogOpen(false)
    fetchInvestments()
  }

  async function handleDeleteInvestment(id: string) {
    await supabase.from('investments').delete().eq('id', id)
    fetchInvestments()
  }

  // Investment summaries by category
  const investmentByCategory = investments.reduce(
    (acc, inv) => {
      acc[inv.category] = (acc[inv.category] || 0) + inv.total_value
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manajemen Aset</h1>
        <p className="text-sm text-gray-500">Kelola semua aset dan investasi Anda</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="liquid">
        <TabsList>
          <TabsTrigger value="liquid">Aset Likuid</TabsTrigger>
          <TabsTrigger value="non-liquid">Aset Non-Likuid</TabsTrigger>
          <TabsTrigger value="investment">Investasi</TabsTrigger>
        </TabsList>

        {/* ═══ Tab 1: Aset Likuid ═══ */}
        <TabsContent value="liquid">
          <div className="space-y-4 pt-4">
            {/* Summary Card */}
            <Card className="border-teal-200 bg-teal-50">
              <CardHeader>
                <CardTitle className="text-teal-800">Total Aset Likuid</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-teal-900">
                  {formatCurrency(totalLiquid)}
                </p>
              </CardContent>
            </Card>

            {/* Add Button */}
            <div className="flex justify-end">
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white"
                onClick={openAddLiquidDialog}
              >
                <Plus className="size-4" data-icon="inline-start" />
                Tambah Aset
              </Button>
            </div>

            {/* Table */}
            {liquidLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-teal-600" />
                <span className="ml-2 text-gray-500">Memuat data...</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liquidAssets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-400 py-10">
                        Belum ada aset likuid.
                      </TableCell>
                    </TableRow>
                  ) : (
                    liquidAssets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">{asset.name}</TableCell>
                        <TableCell>
                          <Badge className="bg-teal-100 text-teal-700">
                            {LIQUID_TYPE_LABELS[asset.type] || asset.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(asset.balance)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEditLiquidDialog(asset)}
                            >
                              <Pencil className="size-4 text-gray-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDeleteLiquid(asset.id)}
                            >
                              <Trash2 className="size-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ═══ Tab 2: Aset Non-Likuid ═══ */}
        <TabsContent value="non-liquid">
          <div className="space-y-4 pt-4">
            {/* Cards grouped by category */}
            <div className="grid gap-4 md:grid-cols-3">
              {(['property', 'vehicle', 'personal_item'] as const).map((cat) => {
                const assets = nonLiquidByCategory[cat] || []
                const total = assets.reduce((s, a) => s + a.current_value, 0)
                return (
                  <Card key={cat} className="border-teal-200">
                    <CardHeader>
                      <CardTitle className="text-teal-800">
                        {NON_LIQUID_CATEGORY_LABELS[cat]}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold text-teal-900">
                        {formatCurrency(total)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {assets.length} aset
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Add Button */}
            <div className="flex justify-end">
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white"
                onClick={openAddNonLiquidDialog}
              >
                <Plus className="size-4" data-icon="inline-start" />
                Tambah Aset
              </Button>
            </div>

            {/* Table */}
            {nonLiquidLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-teal-600" />
                <span className="ml-2 text-gray-500">Memuat data...</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead className="text-right">Nilai Beli</TableHead>
                    <TableHead className="text-right">Nilai Saat Ini</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonLiquidAssets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-400 py-10">
                        Belum ada aset non-likuid.
                      </TableCell>
                    </TableRow>
                  ) : (
                    nonLiquidAssets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">{asset.name}</TableCell>
                        <TableCell>
                          <Badge className="bg-teal-100 text-teal-700">
                            {NON_LIQUID_CATEGORY_LABELS[asset.category] || asset.category}
                          </Badge>
                        </TableCell>
                        <TableCell>{getNonLiquidTypeLabel(asset.type)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(asset.purchase_value)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(asset.current_value)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEditNonLiquidDialog(asset)}
                            >
                              <Pencil className="size-4 text-gray-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDeleteNonLiquid(asset.id)}
                            >
                              <Trash2 className="size-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ═══ Tab 3: Investasi ═══ */}
        <TabsContent value="investment">
          <div className="space-y-4 pt-4">
            {/* Summary Cards per category */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(INVESTMENT_CATEGORY_LABELS).map(([key, label]) => {
                const total = investmentByCategory[key] || 0
                return (
                  <Card key={key} className="border-teal-200">
                    <CardHeader>
                      <CardTitle className="text-sm text-teal-800">{label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-bold text-teal-900">
                        {formatCurrency(total)}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Add Button */}
            <div className="flex justify-end">
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white"
                onClick={openAddInvestmentDialog}
              >
                <Plus className="size-4" data-icon="inline-start" />
                Tambah Investasi
              </Button>
            </div>

            {/* Table */}
            {investmentLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-teal-600" />
                <span className="ml-2 text-gray-500">Memuat data...</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Jumlah Unit</TableHead>
                    <TableHead className="text-right">Harga Rata-rata</TableHead>
                    <TableHead className="text-right">Harga Saat Ini</TableHead>
                    <TableHead className="text-right">Total Nilai</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-gray-400 py-10">
                        Belum ada investasi.
                      </TableCell>
                    </TableRow>
                  ) : (
                    investments.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.name}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              INVESTMENT_BADGE_COLORS[inv.category] ||
                              'bg-gray-100 text-gray-700'
                            }
                          >
                            {INVESTMENT_CATEGORY_LABELS[inv.category] || inv.category}
                          </Badge>
                        </TableCell>
                        <TableCell>{inv.platform}</TableCell>
                        <TableCell className="text-right">
                          {inv.quantity.toLocaleString('id-ID')}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(inv.avg_cost)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(inv.current_price)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(inv.total_value)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEditInvestmentDialog(inv)}
                            >
                              <Pencil className="size-4 text-gray-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDeleteInvestment(inv.id)}
                            >
                              <Trash2 className="size-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══ Liquid Asset Dialog ═══ */}
      <Dialog open={liquidDialogOpen} onOpenChange={setLiquidDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {liquidEditingId ? 'Edit Aset Likuid' : 'Tambah Aset Likuid'}
            </DialogTitle>
            <DialogDescription>
              {liquidEditingId
                ? 'Ubah detail aset likuid di bawah ini.'
                : 'Isi detail aset likuid baru di bawah ini.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="liquid-name">Nama</Label>
              <Input
                id="liquid-name"
                value={liquidForm.name}
                onChange={(e) => setLiquidForm({ ...liquidForm, name: e.target.value })}
                placeholder="Contoh: BCA, GoPay, dll"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Tipe</Label>
              <Select
                value={liquidForm.type}
                onValueChange={(v) => setLiquidForm({ ...liquidForm, type: v ?? '' })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih tipe" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LIQUID_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="liquid-balance">Saldo (Rp)</Label>
              <Input
                id="liquid-balance"
                type="number"
                min={0}
                value={liquidForm.balance || ''}
                onChange={(e) =>
                  setLiquidForm({ ...liquidForm, balance: Number(e.target.value) })
                }
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLiquidDialogOpen(false)}>
              Batal
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={handleSaveLiquid}
              disabled={liquidSaving}
            >
              {liquidSaving && <Loader2 className="size-4 animate-spin mr-1" />}
              {liquidEditingId ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Non-Liquid Asset Dialog ═══ */}
      <Dialog open={nonLiquidDialogOpen} onOpenChange={setNonLiquidDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {nonLiquidEditingId ? 'Edit Aset Non-Likuid' : 'Tambah Aset Non-Likuid'}
            </DialogTitle>
            <DialogDescription>
              {nonLiquidEditingId
                ? 'Ubah detail aset non-likuid di bawah ini.'
                : 'Isi detail aset non-likuid baru di bawah ini.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="nonliquid-name">Nama</Label>
              <Input
                id="nonliquid-name"
                value={nonLiquidForm.name}
                onChange={(e) =>
                  setNonLiquidForm({ ...nonLiquidForm, name: e.target.value })
                }
                placeholder="Contoh: Rumah Jakarta, Honda Vario"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Kategori</Label>
              <Select
                value={nonLiquidForm.category}
                onValueChange={(v) =>
                  setNonLiquidForm({ ...nonLiquidForm, category: v ?? '', type: '' })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(NON_LIQUID_CATEGORY_LABELS).map(([value, label]) => (
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
                value={nonLiquidForm.type}
                onValueChange={(v) =>
                  setNonLiquidForm({ ...nonLiquidForm, type: v ?? '' })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih tipe" />
                </SelectTrigger>
                <SelectContent>
                  {(NON_LIQUID_TYPES[nonLiquidForm.category] || []).map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="nonliquid-purchase">Nilai Beli (Rp)</Label>
              <Input
                id="nonliquid-purchase"
                type="number"
                min={0}
                value={nonLiquidForm.purchase_value || ''}
                onChange={(e) =>
                  setNonLiquidForm({
                    ...nonLiquidForm,
                    purchase_value: Number(e.target.value),
                  })
                }
                placeholder="0"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="nonliquid-current">Nilai Saat Ini (Rp)</Label>
              <Input
                id="nonliquid-current"
                type="number"
                min={0}
                value={nonLiquidForm.current_value || ''}
                onChange={(e) =>
                  setNonLiquidForm({
                    ...nonLiquidForm,
                    current_value: Number(e.target.value),
                  })
                }
                placeholder="0"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="nonliquid-date">Tanggal Beli</Label>
              <Input
                id="nonliquid-date"
                type="date"
                value={nonLiquidForm.purchase_date}
                onChange={(e) =>
                  setNonLiquidForm({
                    ...nonLiquidForm,
                    purchase_date: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="nonliquid-notes">Catatan</Label>
              <Input
                id="nonliquid-notes"
                value={nonLiquidForm.notes}
                onChange={(e) =>
                  setNonLiquidForm({ ...nonLiquidForm, notes: e.target.value })
                }
                placeholder="Catatan tambahan (opsional)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNonLiquidDialogOpen(false)}>
              Batal
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={handleSaveNonLiquid}
              disabled={nonLiquidSaving}
            >
              {nonLiquidSaving && <Loader2 className="size-4 animate-spin mr-1" />}
              {nonLiquidEditingId ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Investment Dialog ═══ */}
      <Dialog open={investmentDialogOpen} onOpenChange={setInvestmentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {investmentEditingId ? 'Edit Investasi' : 'Tambah Investasi'}
            </DialogTitle>
            <DialogDescription>
              {investmentEditingId
                ? 'Ubah detail investasi di bawah ini.'
                : 'Isi detail investasi baru di bawah ini.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="inv-name">Nama</Label>
              <Input
                id="inv-name"
                value={investmentForm.name}
                onChange={(e) =>
                  setInvestmentForm({ ...investmentForm, name: e.target.value })
                }
                placeholder="Contoh: BBCA, Bitcoin, dll"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Kategori</Label>
              <Select
                value={investmentForm.category}
                onValueChange={(v) =>
                  setInvestmentForm({ ...investmentForm, category: v ?? '' })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INVESTMENT_CATEGORY_LABELS).map(([value, label]) => (
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
                value={investmentForm.type}
                onValueChange={(v) =>
                  setInvestmentForm({ ...investmentForm, type: v ?? '' })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih tipe" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INVESTMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="inv-platform">Platform</Label>
              <Input
                id="inv-platform"
                value={investmentForm.platform}
                onChange={(e) =>
                  setInvestmentForm({ ...investmentForm, platform: e.target.value })
                }
                placeholder="Contoh: Stockbit, Bibit, Tokocrypto"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="inv-quantity">Jumlah Unit</Label>
              <Input
                id="inv-quantity"
                type="number"
                min={0}
                step="any"
                value={investmentForm.quantity || ''}
                onChange={(e) =>
                  setInvestmentForm({
                    ...investmentForm,
                    quantity: Number(e.target.value),
                  })
                }
                placeholder="0"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="inv-avg-cost">Harga Rata-rata (Rp)</Label>
              <Input
                id="inv-avg-cost"
                type="number"
                min={0}
                step="any"
                value={investmentForm.avg_cost || ''}
                onChange={(e) =>
                  setInvestmentForm({
                    ...investmentForm,
                    avg_cost: Number(e.target.value),
                  })
                }
                placeholder="0"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="inv-current-price">Harga Saat Ini (Rp)</Label>
              <Input
                id="inv-current-price"
                type="number"
                min={0}
                step="any"
                value={investmentForm.current_price || ''}
                onChange={(e) =>
                  setInvestmentForm({
                    ...investmentForm,
                    current_price: Number(e.target.value),
                  })
                }
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInvestmentDialogOpen(false)}>
              Batal
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={handleSaveInvestment}
              disabled={investmentSaving}
            >
              {investmentSaving && <Loader2 className="size-4 animate-spin mr-1" />}
              {investmentEditingId ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
