'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { EmergencyFund, EmergencyFundLocation } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
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
import { EduTip } from '@/components/edu/edu-tip'

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

  // Account allocations earmarked for EF — sum'd into the dashboard headline.
  // Pulled from /dashboard/accounts → "Atur Alokasi" dialog.
  type AccAlloc = { account_id: string; amount: number; accounts: { name: string } | null }
  const [accountAllocations, setAccountAllocations] = useState<AccAlloc[]>([])
  const allocatedFromAccounts = accountAllocations.reduce((s, a) => s + a.amount, 0)

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

    const [fundRes, locRes, allocRes] = await Promise.all([
      supabase.from('emergency_funds').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('emergency_fund_locations').select('*, emergency_funds!inner(user_id)').eq('emergency_funds.user_id', user.id),
      // Account allocations earmarked for emergency_fund. Tolerant of the
      // table not existing yet (migration 016 unapplied).
      supabase
        .from('account_allocations')
        .select('account_id, amount, accounts!inner(name)')
        .eq('user_id', user.id)
        .eq('purpose_kind', 'emergency_fund')
        .then(
          (r: { data: unknown; error: unknown }) => r,
          () => ({ data: [] as unknown[], error: null as unknown }),
        ),
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

    type Alloc = { account_id: string; amount: number; accounts: { name: string } | null }
    setAccountAllocations((allocRes.data ?? []) as Alloc[])

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
      await supabase.from('emergency_funds').update(payload).eq('id', fund.id)
    } else {
      await supabase.from('emergency_funds').insert(payload)
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
        <Loader2 className="size-6 animate-spin" style={{ color: 'var(--burgundy-700)' }} />
        <span className="ml-2" style={{ color: 'var(--ink-muted)' }}>Memuat data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="dark-card p-6 sm:p-7">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="caps">Proteksi Finansial</p>
            <div className="mt-2 flex items-end gap-3">
              <Shield className="h-7 w-7" style={{ color: 'var(--emerald-400)' }} />
              <h2
                className="text-3xl sm:text-4xl font-semibold tracking-tight flex items-center gap-2"
                style={{ color: 'var(--on-black)' }}
              >
                Dana Darurat
                <EduTip topic="emergency-fund" side="bottom" iconSize={18} />
              </h2>
            </div>
            <p className="text-sm mt-3" style={{ color: 'var(--on-black-mut)' }}>{today}</p>
          </div>
          <div
            className="rounded-lg px-5 py-3 border"
            style={{ background: 'var(--black-2)', borderColor: 'var(--black-line)' }}
          >
            <p className="caps">Progress</p>
            <p className="num mt-1 text-2xl font-semibold" style={{ color: 'var(--lime-400)' }}>
              {progressPercent}%
            </p>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Calculator */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif" style={{ color: 'var(--burgundy-700)' }}>Kalkulator Dana Darurat</CardTitle>
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
              <NumberInput
                id="monthly-expenses"
                value={monthlyExpenses}
                onChange={(n) => setMonthlyExpenses(n)}
                placeholder="0"
              />
            </div>

            {/* Recommendation */}
            <div className="rounded-lg p-4 space-y-1 border" style={{ backgroundColor: 'var(--indigo-50)', borderColor: 'var(--indigo-100)' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>Rekomendasi</span>
                <span className="text-sm font-semibold tabular" style={{ color: 'var(--indigo-700)' }}>{formatCurrency(recommendation)}</span>
              </div>
              <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                {multiplier}× pengeluaran bulanan
              </p>
            </div>

            {/* Target */}
            <div className="grid gap-1.5">
              <Label htmlFor="target">Target Anda (Rp)</Label>
              <NumberInput
                id="target"
                value={targetAmount}
                onChange={(n) => setTargetAmount(n)}
                placeholder="0"
              />
            </div>

            {/* Accumulated */}
            <div className="flex items-center justify-between py-2 border-t" style={{ borderColor: 'var(--border-soft)' }}>
              <span className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>Dana Terkumpul</span>
              <span className="text-sm font-semibold tabular" style={{ color: 'var(--ink)' }}>{formatCurrency(accumulatedFund)}</span>
            </div>

            {/* Deficit */}
            <div className="flex items-center justify-between py-2 border-t" style={{ borderColor: 'var(--border-soft)' }}>
              <span className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>Kekurangan Dana</span>
              <span
                className="text-sm font-semibold tabular"
                style={{ color: deficit > 0 ? 'var(--danger)' : 'var(--c-mint)' }}
              >
                {formatCurrency(Math.abs(deficit))}
                {deficit <= 0 && ' (Tercapai)'}
              </span>
            </div>

            <Button
              className="w-full"
              onClick={handleSaveSettings}
              disabled={saving}
            >
              {saving && <Loader2 className="size-4 animate-spin mr-1" />}
              Simpan Pengaturan
            </Button>
          </CardContent>
        </Card>

        {/* Right Column - Locations + new Account Allocations summary */}
        <div className="space-y-4">
        {accountAllocations.length > 0 && (
          <Card style={{ background: 'rgba(16,185,129,0.04)', borderColor: 'rgba(16,185,129,0.20)' }}>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-base" style={{ color: 'var(--emerald-700, #047857)' }}>
                Dari Akun ({formatCurrency(allocatedFromAccounts)})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs mb-2" style={{ color: 'var(--ink-muted)' }}>
                Akun yang sudah kamu tandai berisi Dana Darurat. Kelola di
                halaman <Link href="/dashboard/accounts" className="underline">Akun</Link>.
              </p>
              <ul className="space-y-1.5">
                {accountAllocations.map((a, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--ink)' }}>{a.accounts?.name ?? 'Akun'}</span>
                    <span className="num tabular font-medium" style={{ color: 'var(--ink)' }}>
                      {formatCurrency(a.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-serif" style={{ color: 'var(--burgundy-700)' }}>Lokasi Dana Darurat (Manual)</CardTitle>
            <Button
              size="sm"
              className=""
              onClick={openAddLocation}
              disabled={!fund}
            >
              <Plus className="size-4 mr-1" />
              Tambah Lokasi
            </Button>
          </CardHeader>
          <CardContent>
            {!fund ? (
              <p className="text-sm text-center py-6" style={{ color: 'var(--ink-soft)' }}>
                Simpan pengaturan terlebih dahulu untuk menambahkan lokasi dana.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Akun</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Jumlah (Rp)</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6" style={{ color: 'var(--ink-soft)' }}>
                        Belum ada lokasi dana darurat.
                      </TableCell>
                    </TableRow>
                  ) : (
                    locations.map((loc) => (
                      <TableRow key={loc.id}>
                        <TableCell>{loc.account_name}</TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">
                          {formatCurrency(loc.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEditLocation(loc)}
                            >
                              <Pencil className="size-4" style={{ color: 'var(--ink-muted)' }} />
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
              <NumberInput
                id="loc-amount"
                value={locationForm.amount}
                onChange={(n) => setLocationForm({ ...locationForm, amount: n })}
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationDialogOpen(false)}>
              Batal
            </Button>
            <Button
              className=""
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
