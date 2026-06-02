'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { Debt } from '@/types'
import { simulatePayoff, type PayoffResult } from '@/lib/debt-payoff'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Plus, Pencil, Trash2, Loader2, PartyPopper, Receipt, Home, CreditCard, Banknote,
  type LucideIcon,
} from 'lucide-react'
import { WealthHero } from '@/components/wealth/wealth-ui'
import { CreditCardsSection } from '@/components/wealth/credit-cards-section'

const CAT: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  consumer:  { label: 'Konsumtif',      color: '#F43F5E', icon: CreditCard },
  cash_loan: { label: 'Pinjaman Tunai', color: '#F59E0B', icon: Banknote },
  long_term: { label: 'Jangka Panjang', color: '#8B5CF6', icon: Home },
}

const DEBT_TYPE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  consumer: [
    { value: 'kartu_kredit', label: 'Kartu Kredit' }, { value: 'paylater', label: 'Paylater' },
    { value: 'kta', label: 'KTA' }, { value: 'pembiayaan_konsumer', label: 'Pembiayaan Konsumer' },
  ],
  cash_loan: [
    { value: 'pinjaman_pribadi', label: 'Pinjaman Pribadi' }, { value: 'pinjaman_dana_tunai', label: 'Pinjaman Dana Tunai' },
  ],
  long_term: [
    { value: 'kpr', label: 'KPR' }, { value: 'kpa', label: 'KPA' }, { value: 'kpt', label: 'KPT' },
    { value: 'hutang_kendaraan', label: 'Hutang Kendaraan' }, { value: 'pinjaman_bisnis', label: 'Pinjaman Bisnis' },
  ],
}
const getTypeLabel = (type: string) => {
  for (const arr of Object.values(DEBT_TYPE_OPTIONS)) { const f = arr.find((t) => t.value === type); if (f) return f.label }
  return type
}
const isRevolving = (type: string) => type === 'kartu_kredit' || type === 'paylater'

function payoffDate(months: number): string {
  if (months <= 0 || months >= 600) return '—'
  const d = new Date(); d.setMonth(d.getMonth() + months)
  return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
}
const dayMonth = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

const emptyForm = {
  id: null as string | null, name: '', category: 'consumer', type: '',
  principal: 0, remaining: 0, interest_rate: 0, monthly_payment: 0,
  due_date: new Date().toISOString().split('T')[0], is_active: true,
}

export default function DebtsOverviewPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [debts, setDebts] = useState<Debt[]>([])
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<typeof emptyForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('Semua')
  const [tlStrategy, setTlStrategy] = useState<'snowball' | 'avalanche'>('avalanche')

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90)
    const [debtsRes, txRes] = await Promise.all([
      supabase.from('debts').select('*').eq('user_id', user.id).order('remaining', { ascending: false }),
      supabase.from('transactions').select('amount').eq('user_id', user.id).eq('type', 'income').gte('date', cutoff.toISOString().slice(0, 10)),
    ])
    setDebts((debtsRes.data ?? []) as Debt[])
    const incomeRows = (txRes.data ?? []) as { amount: number }[]
    const totalIncome = incomeRows.reduce((s, t) => s + (t.amount || 0), 0)
    setMonthlyIncome(incomeRows.length > 0 ? totalIncome / 3 : 0)
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = {
      user_id: user.id, name: form.name, category: form.category, type: form.type,
      principal: form.principal, remaining: form.remaining,
      interest_rate: form.interest_rate, monthly_payment: form.monthly_payment,
      due_date: form.due_date, is_active: form.is_active,
    }
    if (form.id) await supabase.from('debts').update(payload).eq('id', form.id)
    else await supabase.from('debts').insert(payload)
    setSaving(false); setDialogOpen(false); void load()
  }
  async function remove(id: string) {
    if (!confirm('Hapus utang ini?')) return
    await supabase.from('debts').delete().eq('id', id); void load()
  }
  function openEdit(d: Debt) {
    setForm({ id: d.id, name: d.name, category: d.category, type: d.type,
      principal: d.principal, remaining: d.remaining, interest_rate: d.interest_rate,
      monthly_payment: d.monthly_payment, due_date: d.due_date, is_active: d.is_active })
    setDialogOpen(true)
  }

  const active = useMemo(() => debts.filter((d) => d.is_active && d.remaining > 0), [debts])
  const totalRemaining = active.reduce((s, d) => s + d.remaining, 0)
  const totalPrincipal = active.reduce((s, d) => s + d.principal, 0)
  const totalMonthly = active.reduce((s, d) => s + d.monthly_payment, 0)
  const totalPaid = Math.max(0, totalPrincipal - totalRemaining)
  const paidPct = totalPrincipal > 0 ? (totalPaid / totalPrincipal) * 100 : 0
  const dti = monthlyIncome > 0 ? (totalMonthly / monthlyIncome) * 100 : null
  const housingMonthly = active.filter((d) => d.category === 'long_term').reduce((s, d) => s + d.monthly_payment, 0)
  const frontEnd = monthlyIncome > 0 ? (housingMonthly / monthlyIncome) * 100 : null

  const snowball = useMemo(() => simulatePayoff(active, 'snowball'), [active])
  const avalanche = useMemo(() => simulatePayoff(active, 'avalanche'), [active])

  const jenisPresent = useMemo(() => ['Semua', ...Array.from(new Set(active.map((d) => CAT[d.category]?.label ?? d.category)))], [active])
  const visible = filter === 'Semua' ? active : active.filter((d) => (CAT[d.category]?.label ?? d.category) === filter)
  const upcoming = useMemo(() => [...active].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).slice(0, 4), [active])

  return (
    <div className="space-y-6">
      <WealthHero
        eyebrow={`${active.length} utang aktif`}
        title="Utang & Strategi Pelunasan"
        accent="#F43F5E"
        headline={{
          label: 'Sisa Total Utang',
          value: totalRemaining > 0 ? `−${formatCurrency(totalRemaining)}` : formatCurrency(0),
          color: totalRemaining > 0 ? '#F43F5E' : '#10B981',
          sub: totalPrincipal > 0
            ? (<>Dibayar <span className="num" style={{ color: '#10B981' }}>{formatCurrency(totalPaid)}</span> dari pokok <span className="num">{formatCurrency(totalPrincipal)}</span> · {paidPct.toFixed(0)}% lunas</>)
            : 'Konsolidasi semua kewajiban + dua strategi pelunasan buat dibandingkan.',
        }}
        secondary={active.length > 0 ? [
          { label: 'Cicilan / Bulan', value: formatCurrency(totalMonthly) },
          { label: 'Debt-to-Income', value: dti != null ? `${dti.toFixed(1)}%` : '—', color: dti == null ? undefined : dti <= 36 ? '#10B981' : dti <= 50 ? '#F59E0B' : '#F43F5E' },
        ] : []}
        actions={<>
          <Link href="/dashboard/debts/payments"><Button variant="outline"><Receipt className="h-4 w-4" /> Pembayaran</Button></Link>
          <Button onClick={() => { setForm(emptyForm); setDialogOpen(true) }}><Plus className="h-4 w-4" /> Utang baru</Button>
        </>}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : active.length === 0 ? (
        <div className="s-card p-12 text-center">
          <PartyPopper className="size-12 mx-auto" style={{ color: '#10B981' }} />
          <p className="mt-3 font-semibold" style={{ color: 'var(--ink)' }}>Bebas utang</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Gak ada utang aktif. Mantap — jaga terus.</p>
        </div>
      ) : (
        <>
          {/* Tabel utang */}
          <div className="s-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Daftar Utang</p>
              <div className="flex flex-wrap gap-1.5">
                {jenisPresent.map((j) => (
                  <button key={j} onClick={() => setFilter(j)} className="rounded-full px-2.5 py-1 text-[11px] font-medium transition"
                    style={{ background: filter === j ? 'var(--ink)' : 'var(--surface-2)', color: filter === j ? 'var(--surface)' : 'var(--ink-muted)' }}>
                    {j}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                    <th className="text-left font-medium px-4 py-2.5">Utang</th>
                    <th className="text-left font-medium px-3 py-2.5">Jenis</th>
                    <th className="text-right font-medium px-3 py-2.5">Sisa / Pokok</th>
                    <th className="text-right font-medium px-3 py-2.5">Bunga</th>
                    <th className="text-right font-medium px-3 py-2.5">Cicilan</th>
                    <th className="text-right font-medium px-4 py-2.5">Tenor</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((d) => {
                    const meta = CAT[d.category] ?? CAT.consumer
                    const Icon = meta.icon
                    const paid = d.principal > 0 ? ((d.principal - d.remaining) / d.principal) * 100 : 0
                    const tenor = isRevolving(d.type) ? 'Revolving' : (d.monthly_payment > 0 ? `± ${Math.ceil(d.remaining / d.monthly_payment)} bln` : '—')
                    return (
                      <tr key={d.id} className="group border-t align-top" style={{ borderColor: 'var(--border-soft)' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${meta.color}1A` }}>
                              <Icon className="size-4" style={{ color: meta.color }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{d.name}</p>
                              <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{getTypeLabel(d.type)} · jatuh tempo {d.due_date ? dayMonth(d.due_date) : '—'}</p>
                              <div className="mt-1.5 h-1 w-28 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                                <div className="h-full rounded-full" style={{ width: `${paid}%`, background: meta.color }} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3"><span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${meta.color}1A`, color: meta.color }}>{meta.label}</span></td>
                        <td className="px-3 py-3 text-right">
                          <p className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(d.remaining)}</p>
                          <p className="num text-[10px]" style={{ color: 'var(--ink-soft)' }}>dari {formatCurrency(d.principal)}</p>
                        </td>
                        <td className="px-3 py-3 text-right num" style={{ color: d.interest_rate >= 18 ? '#F43F5E' : 'var(--ink)' }}>{d.interest_rate}%</td>
                        <td className="px-3 py-3 text-right">
                          <span className="num" style={{ color: 'var(--ink)' }}>{formatCurrency(d.monthly_payment)}</span>
                          <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition mt-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(d)}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => remove(d.id)}><Trash2 className="h-3 w-3" style={{ color: 'var(--danger)' }} /></Button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right num text-[12px]" style={{ color: 'var(--ink-muted)' }}>{tenor}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2 strategi */}
          <div className="grid gap-3 lg:grid-cols-2">
            <StrategyPanel title="Strategi Snowball" tagline="Lunasi saldo terkecil dulu. Cepat dapat 'menang' kecil, momentum motivasi." cocok="Cocok kalau butuh dorongan emosional & disiplin baru." result={snowball} accent="#10B981" karakter="Cepat" />
            <StrategyPanel title="Strategi Avalanche" tagline="Lunasi bunga tertinggi dulu. Total bunga paling hemat secara matematika." cocok="Cocok kalau kuat nahan diri & ngejar efisiensi maksimum." result={avalanche} accent="#8B5CF6" karakter="Efisien" />
          </div>

          {/* Timeline */}
          <div className="s-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Timeline Pelunasan</p>
                <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
                  Estimasi lunas total <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{payoffDate((tlStrategy === 'snowball' ? snowball : avalanche).months)}</span>
                  {' · '}total bunga <span className="num font-semibold" style={{ color: '#F43F5E' }}>{formatCurrency(Math.round((tlStrategy === 'snowball' ? snowball : avalanche).totalInterest))}</span>
                </p>
              </div>
              <div className="flex gap-1.5">
                {(['snowball', 'avalanche'] as const).map((s) => (
                  <button key={s} onClick={() => setTlStrategy(s)} className="rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition"
                    style={{ background: tlStrategy === s ? 'var(--ink)' : 'var(--surface-2)', color: tlStrategy === s ? 'var(--surface)' : 'var(--ink-muted)' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <PayoffTimeline result={tlStrategy === 'snowball' ? snowball : avalanche} />
          </div>

          {/* Pembayaran mendatang + Rasio */}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="s-card p-5">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Pembayaran Mendatang</p>
              <div className="mt-3 space-y-2.5">
                {upcoming.map((d, i) => (
                  <div key={d.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-lg flex flex-col items-center justify-center shrink-0" style={{ background: 'var(--surface-2)' }}>
                        <span className="text-[8px] uppercase leading-none" style={{ color: 'var(--ink-soft)' }}>{d.due_date ? new Date(d.due_date).toLocaleDateString('id-ID', { month: 'short' }) : '—'}</span>
                        <span className="text-sm font-bold leading-none num" style={{ color: 'var(--ink)' }}>{d.due_date ? new Date(d.due_date).getDate() : ''}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{d.name}</p>
                        {i === 0 && <p className="text-[10px]" style={{ color: '#F43F5E' }}>Paling dekat</p>}
                      </div>
                    </div>
                    <span className="num font-semibold text-sm" style={{ color: 'var(--ink)' }}>{formatCurrency(d.monthly_payment)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="s-card p-5">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Rasio Utang</p>
              <div className="mt-3 space-y-3">
                <RatioRow label="Debt-to-Income (DTI)" ideal="Ideal < 36%" value={dti} good={(v) => v < 36} />
                <RatioRow label="Front-End (cicilan rumah / pendapatan)" ideal="Ideal < 28%" value={frontEnd} good={(v) => v < 28} />
                <RatioRow label="Back-End (total cicilan / pendapatan)" ideal="Ideal < 36%" value={dti} good={(v) => v < 36} />
              </div>
              <p className="mt-3 text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                Solvabilitas (utang/aset) ada di halaman <Link href="/dashboard/net-worth" className="hover:underline" style={{ color: 'var(--ink-muted)' }}>Net Worth</Link>.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Kartu kredit = utang revolving → dikelola sebagai section di halaman Utang */}
      {!loading && <CreditCardsSection />}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Utang' : 'Utang baru'}</DialogTitle>
            <DialogDescription>Isi detail utang kamu.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Nama</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Kategori</Label>
                <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v, type: '' })}>
                  <SelectTrigger><SelectValue placeholder="Pilih kategori">{(v) => CAT[v as string]?.label ?? 'Pilih kategori'}</SelectValue></SelectTrigger>
                  <SelectContent>{Object.entries(CAT).map(([k, v]) => (<SelectItem key={k} value={k}>{v.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Tipe</Label>
                <Select value={form.type} onValueChange={(v) => v && setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih tipe" /></SelectTrigger>
                  <SelectContent>{(DEBT_TYPE_OPTIONS[form.category] ?? []).map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Pokok Awal</Label><NumberInput value={form.principal} onChange={(n) => setForm({ ...form, principal: n })} placeholder="0" /></div>
              <div className="grid gap-1.5"><Label>Sisa</Label><NumberInput value={form.remaining} onChange={(n) => setForm({ ...form, remaining: n })} placeholder="0" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="grid gap-1.5"><Label>Bunga %</Label><Input type="number" step="any" value={form.interest_rate || ''} onChange={(e) => setForm({ ...form, interest_rate: Number(e.target.value) || 0 })} /></div>
              <div className="grid gap-1.5"><Label>Cicilan/bln</Label><NumberInput value={form.monthly_payment} onChange={(n) => setForm({ ...form, monthly_payment: n })} placeholder="0" /></div>
              <div className="grid gap-1.5"><Label>Jatuh Tempo</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving || !form.name || !form.type}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}{form.id ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StrategyPanel({ title, tagline, cocok, result, accent, karakter }: {
  title: string; tagline: string; cocok: string; result: PayoffResult; accent: string; karakter: string
}) {
  return (
    <div className="s-card p-5">
      <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: accent }}>{title}</p>
      <p className="mt-2 text-base leading-snug" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>{tagline}</p>
      <p className="text-xs mt-1.5" style={{ color: 'var(--ink-muted)' }}>{cocok}</p>
      <div className="mt-4 space-y-1.5">
        {result.order.slice(0, 5).map((o, i) => (
          <div key={o.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: i === 0 ? `${accent}14` : 'var(--surface-2)' }}>
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="num size-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: i === 0 ? accent : 'var(--surface)', color: i === 0 ? '#FFF' : 'var(--ink-muted)' }}>{i + 1}</span>
              <span className="text-sm truncate" style={{ color: 'var(--ink)' }}>{o.name}</span>
            </span>
            <span className="num text-[12px] shrink-0" style={{ color: 'var(--ink-muted)' }}>{o.key}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t" style={{ borderColor: 'var(--border-soft)' }}>
        <div><p className="text-[10px] uppercase" style={{ color: 'var(--ink-soft)' }}>Lunas</p><p className="num text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{payoffDate(result.months)}</p></div>
        <div><p className="text-[10px] uppercase" style={{ color: 'var(--ink-soft)' }}>Total Bunga</p><p className="num text-sm font-semibold mt-0.5" style={{ color: accent }}>{formatCurrency(Math.round(result.totalInterest))}</p></div>
        <div><p className="text-[10px] uppercase" style={{ color: 'var(--ink-soft)' }}>Karakter</p><p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{karakter}</p></div>
      </div>
    </div>
  )
}

function PayoffTimeline({ result }: { result: PayoffResult }) {
  const tl = result.timeline
  if (tl.length < 2) return <p className="mt-4 text-sm" style={{ color: 'var(--ink-soft)' }}>Timeline belum bisa dihitung (cek cicilan vs bunga).</p>
  const maxM = tl[tl.length - 1].month
  const maxR = tl[0].remaining || 1
  const xs = (m: number) => (m / maxM) * 100
  const ys = (r: number) => 100 - (r / maxR) * 100
  const pts = tl.map((p) => `${xs(p.month).toFixed(2)},${ys(p.remaining).toFixed(2)}`).join(' ')
  const axisMarks = [12, 24, 36, 48, 60].filter((m) => m <= maxM)
  return (
    <div className="mt-4">
      <div className="relative" style={{ height: 130 }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polygon points={`0,100 ${pts} 100,100`} fill="#F43F5E14" />
          <polyline points={pts} fill="none" stroke="#F43F5E" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        {result.events.map((e) => {
          const rAt = tl.find((p) => p.month === e.month)?.remaining ?? 0
          return (
            <div key={`${e.name}-${e.month}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${xs(e.month)}%`, top: `${ys(rAt)}%` }}>
              <div className="size-2 rounded-full ring-2 ring-[var(--surface)]" style={{ background: '#10B981' }} title={`${e.name} lunas`} />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px]" style={{ color: 'var(--ink-soft)' }}>
        <span>Sekarang</span>
        {axisMarks.map((m) => (<span key={m} className="num">{m} bln</span>))}
      </div>
    </div>
  )
}

function RatioRow({ label, ideal, value, good }: { label: string; ideal: string; value: number | null; good: (v: number) => boolean }) {
  const ok = value != null && good(value)
  return (
    <div className="flex items-center justify-between">
      <div className="min-w-0">
        <p className="text-sm" style={{ color: 'var(--ink)' }}>{label}</p>
        <p className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{ideal}</p>
      </div>
      {value != null ? (
        <span className="num font-semibold text-sm flex items-center gap-1.5" style={{ color: ok ? '#10B981' : '#F59E0B' }}>
          {value.toFixed(1)}% <span className="size-1.5 rounded-full" style={{ background: ok ? '#10B981' : '#F59E0B' }} />
        </span>
      ) : <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>—</span>}
    </div>
  )
}
