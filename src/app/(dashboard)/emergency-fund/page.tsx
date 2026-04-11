'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { EmergencyFund, EmergencyFundLocation } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Progress } from '@/components/ui/progress'
import { Pencil, Trash2, Plus, Loader2, Shield } from 'lucide-react'

type JobStability = 'stabil' | 'cukup_stabil' | 'tidak_stabil'

const JOB_STABILITY_LABELS: Record<JobStability, string> = {
  stabil: 'Stabil',
  cukup_stabil: 'Cukup Stabil',
  tidak_stabil: 'Tidak Stabil',
}

function calculateMultiplier(stability: JobStability, dependents: number): number {
  if (stability === 'stabil') {
    if (dependents === 0) return 3
    if (dependents <= 2) return 4
    return 5
  }
  if (stability === 'cukup_stabil') {
    if (dependents === 0) return 6
    if (dependents <= 2) return 7
    return 8
  }
  // tidak_stabil
  if (dependents === 0) return 9
  if (dependents <= 2) return 10
  return 12
}

export default function EmergencyFundPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fund, setFund] = useState<EmergencyFund | null>(null)
  const [locations, setLocations] = useState<EmergencyFundLocation[]>([])

  // Calculator form state
  const [jobStability, setJobStability] = useState<JobStability>('stabil')
  const [dependents, setDependents] = useState(0)
  const [monthlyExpenses, setMonthlyExpenses] = useState(0)
  const [targetAmount, setTargetAmount] = useState(0)

  // Location dialog state
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
  const [locationForm, setLocationForm] = useState({ account_name: '', amount: 0 })

  const multiplier = calculateMultiplier(jobStability, dependents)
  const recommendation = monthlyExpenses * multiplier
  const accumulatedFund = locations.reduce((sum, loc) => sum + loc.amount, 0)
  const deficit = targetAmount - accumulatedFund
  const progressPercent = targetAmount > 0 ? Math.min(100, Math.round((accumulatedFund / targetAmount) * 100)) : 0

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setTargetAmount(recommendation)
  }, [recommendation])

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [fundRes, locRes] = await Promise.all([
      supabase.from('emergency_fund').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('emergency_fund_locations').select('*, emergency_fund!inner(user_id)').eq('emergency_fund.user_id', user.id),
    ])

    if (fundRes.data) {
      const f = fundRes.data as EmergencyFund
      setFund(f)
      setJobStability(f.job_stability as JobStability)
      setDependents(f.dependents)
      setMonthlyExpenses(f.monthly_expenses)
      setTargetAmount(f.target_amount)
    }

    if (locRes.data) {
      setLocations(locRes.data as EmergencyFundLocation[])
    }

    setLoading(false)
  }

  async function handleSaveSettings() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      job_stability: jobStability,
      dependents,
      monthly_expenses: monthlyExpenses,
      target_amount: targetAmount,
      current_amount: accumulatedFund,
    }

    if (fund) {
      await supabase.from('emergency_fund').update(payload).eq('id', fund.id)
    } else {
      await supabase.from('emergency_fund').insert(payload)
    }

    setSaving(false)
    fetchData()
  }

  function openAddLocation() {
    setEditingLocationId(null)
    setLocationForm({ account_name: '', amount: 0 })
    setLocationDialogOpen(true)
  }

  function openEditLocation(loc: EmergencyFundLocation) {
    setEditingLocationId(loc.id)
    setLocationForm({ account_name: loc.account_name, amount: loc.amount })
    setLocationDialogOpen(true)
  }

  async function handleSaveLocation() {
    if (!fund) return
    setSaving(true)

    const payload = {
      fund_id: fund.id,
      account_name: locationForm.account_name,
      amount: locationForm.amount,
    }

    if (editingLocationId) {
      await supabase.from('emergency_fund_locations').update(payload).eq('id', editingLocationId)
    } else {
      await supabase.from('emergency_fund_locations').insert(payload)
    }

    setSaving(false)
    setLocationDialogOpen(false)
    fetchData()
  }

  async function handleDeleteLocation(id: string) {
    await supabase.from('emergency_fund_locations').delete().eq('id', id)
    fetchData()
  }

  const today = formatDate(new Date())

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-teal-600" />
        <span className="ml-2 text-gray-500">Memuat data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="size-6 text-teal-600" />
          Dana Darurat
        </h1>
        <p className="text-sm text-gray-500">{today}</p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Calculator */}
        <Card>
          <CardHeader>
            <CardTitle className="text-teal-700">Kalkulator Dana Darurat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Job Stability */}
            <div className="grid gap-1.5">
              <Label>Stabilitas Pekerjaan</Label>
              <Select
                value={jobStability}
                onValueChange={(v) => { if (v) setJobStability(v as JobStability) }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih stabilitas" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(JOB_STABILITY_LABELS) as JobStability[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {JOB_STABILITY_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dependents */}
            <div className="grid gap-1.5">
              <Label htmlFor="dependents">Jumlah Tanggungan</Label>
              <Input
                id="dependents"
                type="number"
                min={0}
                value={dependents}
                onChange={(e) => setDependents(Number(e.target.value))}
              />
            </div>

            {/* Monthly Expenses */}
            <div className="grid gap-1.5">
              <Label htmlFor="monthly-expenses">Pengeluaran Bulanan (Rp)</Label>
              <Input
                id="monthly-expenses"
                type="number"
                min={0}
                value={monthlyExpenses || ''}
                onChange={(e) => setMonthlyExpenses(Number(e.target.value))}
                placeholder="0"
              />
            </div>

            {/* Recommendation */}
            <div className="rounded-lg bg-teal-50 p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Rekomendasi (IDR):</span>
                <span className="font-semibold text-teal-700">{formatCurrency(recommendation)}</span>
              </div>
              <p className="text-xs text-gray-500">
                {multiplier}x pengeluaran bulanan
              </p>
            </div>

            {/* Target */}
            <div className="grid gap-1.5">
              <Label htmlFor="target">Target Anda (Rp)</Label>
              <Input
                id="target"
                type="number"
                min={0}
                value={targetAmount || ''}
                onChange={(e) => setTargetAmount(Number(e.target.value))}
                placeholder="0"
              />
            </div>

            {/* Accumulated */}
            <div className="flex justify-between py-2 border-t">
              <span className="text-sm font-medium text-gray-600">Dana Terkumpul:</span>
              <span className="font-semibold text-teal-700">{formatCurrency(accumulatedFund)}</span>
            </div>

            {/* Deficit */}
            <div className="flex justify-between py-2 border-t">
              <span className="text-sm font-medium text-gray-600">Kekurangan Dana:</span>
              <span className={`font-semibold ${deficit > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatCurrency(Math.abs(deficit))}
                {deficit <= 0 && ' (Tercapai)'}
              </span>
            </div>

            <Button
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              onClick={handleSaveSettings}
              disabled={saving}
            >
              {saving && <Loader2 className="size-4 animate-spin mr-1" />}
              Simpan Pengaturan
            </Button>
          </CardContent>
        </Card>

        {/* Right Column - Locations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-teal-700">Lokasi Dana Darurat</CardTitle>
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={openAddLocation}
              disabled={!fund}
            >
              <Plus className="size-4 mr-1" />
              Tambah Lokasi
            </Button>
          </CardHeader>
          <CardContent>
            {!fund ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Simpan pengaturan terlebih dahulu untuk menambahkan lokasi dana.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Akun</TableHead>
                    <TableHead className="text-right">Jumlah (Rp)</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-400 py-6">
                        Belum ada lokasi dana darurat.
                      </TableCell>
                    </TableRow>
                  ) : (
                    locations.map((loc) => (
                      <TableRow key={loc.id}>
                        <TableCell>{loc.account_name}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(loc.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEditLocation(loc)}
                            >
                              <Pencil className="size-4 text-gray-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDeleteLocation(loc.id)}
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
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Progress: {progressPercent}% dari target</span>
              <span className="text-muted-foreground">{formatCurrency(accumulatedFund)} / {formatCurrency(targetAmount)}</span>
            </div>
            <Progress value={progressPercent} />
          </div>
        </CardContent>
      </Card>

      {/* Location Dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingLocationId ? 'Edit Lokasi' : 'Tambah Lokasi'}
            </DialogTitle>
            <DialogDescription>
              {editingLocationId
                ? 'Ubah detail lokasi dana darurat.'
                : 'Tambahkan lokasi penyimpanan dana darurat.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="loc-account">Akun</Label>
              <Input
                id="loc-account"
                value={locationForm.account_name}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, account_name: e.target.value })
                }
                placeholder="Nama akun / rekening"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="loc-amount">Jumlah (Rp)</Label>
              <Input
                id="loc-amount"
                type="number"
                min={0}
                value={locationForm.amount || ''}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, amount: Number(e.target.value) })
                }
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationDialogOpen(false)}>
              Batal
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={handleSaveLocation}
              disabled={saving}
            >
              {saving && <Loader2 className="size-4 animate-spin mr-1" />}
              {editingLocationId ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
