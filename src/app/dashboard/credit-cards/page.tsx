'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Account, CreditCard as CreditCardType, CreditCardPayment } from '@/types'
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
  Plus, Pencil, Trash2, Loader2, Wallet, CreditCard, ArrowUpRight,
  CheckCircle2, ReceiptText, ShieldCheck, type LucideIcon,
} from 'lucide-react'

interface CardFormState {
  id: string | null
  name: string
  issuer: string
  last_four: string
  credit_limit: number
  current_balance: number
  billing_day: number
  due_day: number
  interest_rate: number
  is_active: boolean
}
const EMPTY_CARD: CardFormState = {
  id: null, name: '', issuer: '', last_four: '',
  credit_limit: 0, current_balance: 0,
  billing_day: 1, due_day: 15, interest_rate: 2.25, is_active: true,
}

interface PayFormState {
  card_id: string
  amount: number
  from_account_id: string
  date: string
  notes: string
}
const EMPTY_PAY: PayFormState = {
  card_id: '', amount: 0, from_account_id: '',
  date: new Date().toISOString().split('T')[0], notes: '',
}

/** Issuer → gradient (match substring, fallback ink slate). */
function issuerGradient(issuer: string): string {
  const i = (issuer ?? '').toLowerCase()
  if (i.includes('bca'))     return 'linear-gradient(135deg, #1E3A8A, #1E40AF 60%, #3B82F6)'
  if (i.includes('mandiri')) return 'linear-gradient(135deg, #064E3B, #047857 60%, #10B981)'
  if (i.includes('jenius') || i.includes('btpn')) return 'linear-gradient(135deg, #0F172A, #1E293B 60%, #334155)'
  if (i.includes('bni'))     return 'linear-gradient(135deg, #7C2D12, #9A3412 60%, #EA580C)'
  if (i.includes('bri'))     return 'linear-gradient(135deg, #0C4A6E, #0369A1 60%, #0EA5E9)'
  if (i.includes('cimb'))    return 'linear-gradient(135deg, #881337, #9F1239 60%, #E11D48)'
  if (i.includes('danamon')) return 'linear-gradient(135deg, #422006, #713F12 60%, #CA8A04)'
  if (i.includes('permata') || i.includes('hsbc') || i.includes('uob')) {
    return 'linear-gradient(135deg, #3B0764, #581C87 60%, #9333EA)'
  }
  return 'linear-gradient(135deg, #18181B, #27272A 60%, #3F3F46)'
}

/** Minimum payment heuristik: ~10% tagihan, lantai Rp 50rb, gak lebih dari tagihan. */
function minPayment(balance: number): number {
  if (balance <= 0) return 0
  return Math.min(balance, Math.max(50_000, Math.round(balance * 0.1)))
}

const MINT = '#10B981', AMBER = '#F59E0B', CORAL = '#F43F5E'

export default function CreditCardsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState<CreditCardType[]>([])
  const [payments, setPayments] = useState<CreditCardPayment[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])

  const [cardDialogOpen, setCardDialogOpen] = useState(false)
  const [cardForm, setCardForm] = useState<CardFormState>(EMPTY_CARD)
  const [cardSaving, setCardSaving] = useState(false)

  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payForm, setPayForm] = useState<PayFormState>(EMPTY_PAY)
  const [paySaving, setPaySaving] = useState(false)

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [cR, pR, aR] = await Promise.all([
      supabase.from('credit_cards').select('*').eq('user_id', user.id).order('current_balance', { ascending: false }),
      supabase.from('credit_card_payments').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
    ])
    setCards((cR.data ?? []) as CreditCardType[])
    setPayments((pR.data ?? []) as CreditCardPayment[])
    setAccounts((aR.data ?? []) as Account[])
    setLoading(false)
  }

  async function saveCard() {
    setCardSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCardSaving(false); return }
    const payload = {
      user_id: user.id, name: cardForm.name, issuer: cardForm.issuer, last_four: cardForm.last_four,
      credit_limit: cardForm.credit_limit, current_balance: cardForm.current_balance,
      billing_day: cardForm.billing_day, due_day: cardForm.due_day,
      interest_rate: cardForm.interest_rate, is_active: cardForm.is_active,
    }
    if (cardForm.id) await supabase.from('credit_cards').update(payload).eq('id', cardForm.id)
    else await supabase.from('credit_cards').insert(payload)
    setCardSaving(false); setCardDialogOpen(false); void load()
  }

  async function removeCard(id: string) {
    if (!confirm('Hapus kartu ini?')) return
    await supabase.from('credit_cards').delete().eq('id', id); void load()
  }

  function openEditCard(c: CreditCardType) {
    setCardForm({
      id: c.id, name: c.name, issuer: c.issuer, last_four: c.last_four,
      credit_limit: c.credit_limit, current_balance: c.current_balance,
      billing_day: c.billing_day, due_day: c.due_day,
      interest_rate: c.interest_rate, is_active: c.is_active,
    })
    setCardDialogOpen(true)
  }

  function openPayCard(c?: CreditCardType) {
    setPayForm({ ...EMPTY_PAY, card_id: c?.id ?? '', amount: c?.current_balance ?? 0 })
    setPayDialogOpen(true)
  }

  async function savePayment() {
    if (!payForm.card_id || payForm.amount <= 0) return
    setPaySaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPaySaving(false); return }
    await supabase.from('credit_card_payments').insert({
      user_id: user.id, card_id: payForm.card_id, amount: payForm.amount,
      from_account_id: payForm.from_account_id || null, date: payForm.date, notes: payForm.notes,
    })
    const card = cards.find((x) => x.id === payForm.card_id)
    if (card) {
      await supabase.from('credit_cards')
        .update({ current_balance: Math.max(0, card.current_balance - payForm.amount) })
        .eq('id', card.id)
    }
    setPaySaving(false); setPayDialogOpen(false); void load()
  }

  const active = useMemo(() => cards.filter((c) => c.is_active), [cards])
  const totals = useMemo(() => {
    const outstanding = active.reduce((s, c) => s + c.current_balance, 0)
    const limit = active.reduce((s, c) => s + c.credit_limit, 0)
    const utilization = limit > 0 ? (outstanding / limit) * 100 : 0
    return { outstanding, limit, available: Math.max(0, limit - outstanding), utilization, count: active.length }
  }, [active])

  const utilColor = totals.utilization < 30 ? MINT : totals.utilization < 70 ? AMBER : CORAL
  const utilZone = totals.utilization < 30 ? 'di zona aman' : totals.utilization < 70 ? 'mulai tinggi' : 'terlalu tinggi'

  const today = new Date()
  function nextDueDate(dueDay: number) {
    const y = today.getFullYear(); const m = today.getMonth()
    const thisMonthDue = new Date(y, m, dueDay)
    if (thisMonthDue >= new Date(y, m, today.getDate())) return thisMonthDue
    return new Date(y, m + 1, dueDay)
  }
  function daysUntil(due: Date) {
    const ms = due.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    return Math.round(ms / 86_400_000)
  }

  const stats: { label: string; value: string; sub: string; icon: LucideIcon; color: string; tint: string }[] = [
    { label: 'Total Limit', value: formatCurrency(totals.limit), sub: `Dari ${totals.count} kartu`, icon: CreditCard, color: '#6366F1', tint: 'rgba(99,102,241,0.12)' },
    { label: 'Total Terpakai', value: formatCurrency(totals.outstanding), sub: `${totals.utilization.toFixed(0)}% dari limit`, icon: ArrowUpRight, color: CORAL, tint: 'rgba(244,63,94,0.12)' },
    { label: 'Limit Tersedia', value: formatCurrency(totals.available), sub: 'Siap dipakai', icon: CheckCircle2, color: MINT, tint: 'rgba(16,185,129,0.12)' },
    { label: 'Total Tagihan', value: formatCurrency(totals.outstanding), sub: 'Bulan ini', icon: ReceiptText, color: AMBER, tint: 'rgba(245,158,11,0.12)' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">{totals.count} kartu aktif</p>
          <h1 className="leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 38px)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            Kartu Kredit
          </h1>
          <p className="text-sm mt-2 max-w-xl" style={{ color: 'var(--ink-muted)' }}>
            Pantau limit, tagihan &amp; jatuh tempo. Klunting bantu jaga utilization di bawah 30%.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => openPayCard()} disabled={active.length === 0}>
            <Wallet className="h-4 w-4" /> Bayar Tagihan
          </Button>
          <Button onClick={() => { setCardForm(EMPTY_CARD); setCardDialogOpen(true) }}>
            <Plus className="h-4 w-4" /> Tambah Kartu
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--ink-soft)' }} /></div>
      ) : active.length === 0 ? (
        <div className="s-card p-12 text-center">
          <div className="size-12 rounded-2xl grid place-items-center mx-auto" style={{ background: 'var(--surface-2)' }}>
            <CreditCard className="size-6" style={{ color: 'var(--ink-soft)' }} />
          </div>
          <p className="font-semibold mt-3" style={{ color: 'var(--ink)' }}>Belum ada kartu kredit</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Tambah kartu pertama buat lacak tagihan, limit &amp; jatuh tempo.</p>
          <Button className="mt-4" onClick={() => { setCardForm(EMPTY_CARD); setCardDialogOpen(true) }}><Plus className="h-4 w-4" /> Tambah Kartu</Button>
        </div>
      ) : (
        <>
          {/* Stat strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="s-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: 'var(--ink-soft)' }}>
                      <span className="size-1.5 rounded-full" style={{ background: s.color }} />{s.label}
                    </p>
                    <p className="num tabular text-2xl font-bold mt-1.5 whitespace-nowrap" style={{ color: 'var(--ink)' }}>{s.value}</p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>{s.sub}</p>
                  </div>
                  <div className="size-8 rounded-lg grid place-items-center shrink-0" style={{ background: s.tint }}>
                    <s.icon className="size-4" style={{ color: s.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Gradient cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((c) => {
              const util = c.credit_limit > 0 ? (c.current_balance / c.credit_limit) * 100 : 0
              const due = nextDueDate(c.due_day)
              const daysLeft = daysUntil(due)
              const urgency = daysLeft <= 3 ? CORAL : daysLeft <= 7 ? AMBER : 'var(--ink-muted)'
              const uColor = util > 80 ? CORAL : util > 50 ? AMBER : MINT
              return (
                <div key={c.id} className="s-card overflow-hidden p-0 group">
                  {/* Visual gradient top */}
                  <div className="relative p-5 overflow-hidden" style={{ background: issuerGradient(c.issuer), color: '#FFFFFF', aspectRatio: '1.9 / 1' }}>
                    <div className="absolute top-4 right-5" style={{ width: 38, height: 28, borderRadius: 5, background: 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,255,255,0.45))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)' }} />
                    <div className="absolute top-3 left-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => openEditCard(c)} aria-label="Edit" className="grid place-items-center rounded-md" style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.18)', color: '#FFF', backdropFilter: 'blur(4px)' }}><Pencil className="h-3 w-3" /></button>
                      <button onClick={() => removeCard(c.id)} aria-label="Hapus" className="grid place-items-center rounded-md" style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.18)', color: '#FFF', backdropFilter: 'blur(4px)' }}><Trash2 className="h-3 w-3" /></button>
                    </div>
                    <p className="absolute top-5 left-5" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>{c.issuer}</p>
                    <p className="absolute left-5" style={{ top: 38, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 19, color: '#FFFFFF', letterSpacing: '-0.01em' }}>{c.name}</p>
                    <div className="absolute bottom-5 left-5 right-5" style={{ fontFamily: 'var(--font-mono)', fontSize: 15, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.92)' }}>
                      •••• •••• •••• {c.last_four || '••••'}
                    </div>
                  </div>
                  {/* Stats bottom */}
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Utilization</p>
                      <p className="num tabular text-[12px] font-semibold" style={{ color: uColor }}>{util.toFixed(0)}%</p>
                    </div>
                    <div className="kl-bar mt-2" style={{ color: uColor }}><i style={{ width: `${Math.min(util, 100)}%` }} /></div>
                    <p className="num tabular mt-1.5 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                      {formatCurrency(c.current_balance)} / {formatCurrency(c.credit_limit)}
                    </p>
                    <div className="mt-3 pt-3 border-t flex items-end justify-between gap-2" style={{ borderColor: 'var(--border-soft)' }}>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Tagihan</p>
                        <p className="num tabular font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{formatCurrency(c.current_balance)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Jatuh Tempo</p>
                        <p className="num tabular font-medium mt-0.5 text-[12px]" style={{ color: urgency }}>{formatDate(due.toISOString())} <span className="opacity-70">({daysLeft}h)</span></p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => openPayCard(c)} disabled={c.current_balance === 0}>Bayar Tagihan</Button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tagihan Bulanan + Utilization */}
          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
            <div className="s-card p-5">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Tagihan Bulanan</p>
              <div className="mt-3 divide-y" style={{ borderColor: 'var(--border-soft)' }}>
                {active.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                    <div className="min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{c.name}</p>
                      <p className="text-[11px] num" style={{ color: 'var(--ink-soft)' }}>•••• {c.last_four || '••••'} · cetak tgl {c.billing_day}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Minimum</p>
                        <p className="num tabular text-[12px]" style={{ color: 'var(--ink-muted)' }}>{formatCurrency(minPayment(c.current_balance))}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Tagihan</p>
                        <p className="num tabular text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(c.current_balance)}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openPayCard(c)} disabled={c.current_balance === 0}>Bayar</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="s-card p-5" style={{ background: `color-mix(in srgb, ${utilColor} 7%, var(--surface))`, borderColor: `color-mix(in srgb, ${utilColor} 25%, var(--border-soft))` }}>
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: utilColor }}>Utilization Rate</p>
              <p className="num tabular font-bold leading-none mt-3" style={{ fontSize: 52, color: utilColor, letterSpacing: '-0.03em' }}>{totals.utilization.toFixed(0)}%</p>
              <p className="text-sm mt-3" style={{ color: 'var(--ink-muted)' }}>
                <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(totals.outstanding)}</span> dari limit total <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(totals.limit)}</span>
              </p>
              <div className="mt-4 flex items-start gap-2 rounded-xl p-3" style={{ background: 'var(--surface)' }}>
                <ShieldCheck className="size-4 mt-0.5 shrink-0" style={{ color: utilColor }} />
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                  Buat skor kredit terbaik, jaga utilization <strong style={{ color: 'var(--ink)' }}>di bawah 30%</strong>. Kamu saat ini <strong style={{ color: utilColor }}>{utilZone}</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Riwayat pembayaran */}
          <div className="s-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-5 pb-3">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>Riwayat Pembayaran</p>
            </div>
            {payments.length === 0 ? (
              <p className="px-5 pb-5 text-[12px]" style={{ color: 'var(--ink-soft)' }}>Belum ada pembayaran tercatat. Pembayaran tagihan bakal muncul di sini.</p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
                {payments.slice(0, 8).map((p) => {
                  const c = cards.find((x) => x.id === p.card_id)
                  const a = accounts.find((x) => x.id === p.from_account_id)
                  return (
                    <div key={p.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--surface-2)]">
                      <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: MINT }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{c?.name ?? '—'}</p>
                        <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{formatDate(p.date)}{a ? ` · dari ${a.name}` : ''}{p.notes ? ` · ${p.notes}` : ''}</p>
                      </div>
                      <p className="num font-semibold tabular" style={{ color: MINT }}>−{formatCurrency(p.amount)}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Card Dialog */}
      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cardForm.id ? 'Edit Kartu Kredit' : 'Tambah Kartu Kredit'}</DialogTitle>
            <DialogDescription>Detail kartu, limit, tanggal billing &amp; jatuh tempo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Nama Kartu</Label>
                <Input value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} placeholder="BCA Platinum" />
              </div>
              <div className="grid gap-1.5">
                <Label>Issuer / Bank</Label>
                <Input value={cardForm.issuer} onChange={(e) => setCardForm({ ...cardForm, issuer: e.target.value })} placeholder="BCA" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>4 Digit Terakhir</Label>
              <Input value={cardForm.last_four} maxLength={4} onChange={(e) => setCardForm({ ...cardForm, last_four: e.target.value.replace(/\D/g, '') })} placeholder="1234" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Limit (Rp)</Label>
                <NumberInput value={cardForm.credit_limit} onChange={(n) => setCardForm({ ...cardForm, credit_limit: n })} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label>Outstanding (Rp)</Label>
                <NumberInput value={cardForm.current_balance} onChange={(n) => setCardForm({ ...cardForm, current_balance: n })} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Tgl Billing</Label>
                <Input type="number" min={1} max={31} value={cardForm.billing_day} onChange={(e) => setCardForm({ ...cardForm, billing_day: Number(e.target.value) || 1 })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Tgl Jatuh Tempo</Label>
                <Input type="number" min={1} max={31} value={cardForm.due_day} onChange={(e) => setCardForm({ ...cardForm, due_day: Number(e.target.value) || 1 })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Bunga %</Label>
                <Input type="number" step="any" min={0} value={cardForm.interest_rate || ''} onChange={(e) => setCardForm({ ...cardForm, interest_rate: Number(e.target.value) || 0 })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDialogOpen(false)}>Batal</Button>
            <Button onClick={saveCard} disabled={cardSaving || !cardForm.name || !cardForm.issuer}>
              {cardSaving && <Loader2 className="h-4 w-4 animate-spin" />}{cardForm.id ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bayar Tagihan Kartu</DialogTitle>
            <DialogDescription>Kurangi outstanding kartu — transfer dari rekening bank.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Kartu</Label>
              <Select value={payForm.card_id} onValueChange={(v) => setPayForm({ ...payForm, card_id: v ?? '' })}>
                <SelectTrigger><SelectValue placeholder="Pilih kartu" /></SelectTrigger>
                <SelectContent>
                  {active.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — outstanding {formatCurrency(c.current_balance)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Jumlah Bayar</Label>
                <NumberInput value={payForm.amount} onChange={(n) => setPayForm({ ...payForm, amount: n })} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label>Tanggal</Label>
                <Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Dari Rekening</Label>
              <Select value={payForm.from_account_id} onValueChange={(v) => setPayForm({ ...payForm, from_account_id: v ?? '' })}>
                <SelectTrigger><SelectValue placeholder="Opsional — rekening asal" /></SelectTrigger>
                <SelectContent>
                  {accounts.filter((a) => a.type !== 'investment').map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Catatan</Label>
              <Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Opsional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Batal</Button>
            <Button onClick={savePayment} disabled={paySaving || !payForm.card_id || payForm.amount <= 0}>
              {paySaving && <Loader2 className="h-4 w-4 animate-spin" />}Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
