'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Account, CreditCard, CreditCardPayment } from '@/types'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Pencil, Trash2, Loader2, Wallet } from 'lucide-react'

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

/**
 * Issuer → gradient mapping per design handoff visual credit card.
 * Match by issuer name substring (case-insensitive), fallback ke ink dark.
 *
 * BCA Platinum → biru navy
 * Mandiri Skyz → emerald deep
 * Jenius Signature → slate dark (BTPN)
 * BNI → orange warm
 * BRI → sky blue
 * CIMB → coral
 * default → ink slate
 */
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
  // Default — ink slate
  return 'linear-gradient(135deg, #18181B, #27272A 60%, #3F3F46)'
}

export default function CreditCardsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState<CreditCard[]>([])
  const [payments, setPayments] = useState<CreditCardPayment[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])

  // Card dialog
  const [cardDialogOpen, setCardDialogOpen] = useState(false)
  const [cardForm, setCardForm] = useState<CardFormState>(EMPTY_CARD)
  const [cardSaving, setCardSaving] = useState(false)

  // Payment dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payForm, setPayForm] = useState<PayFormState>(EMPTY_PAY)
  const [paySaving, setPaySaving] = useState(false)

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [cR, pR, aR] = await Promise.all([
      supabase.from('credit_cards').select('*').eq('user_id', user.id).order('current_balance', { ascending: false }),
      supabase.from('credit_card_payments').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
    ])
    setCards((cR.data ?? []) as CreditCard[])
    setPayments((pR.data ?? []) as CreditCardPayment[])
    setAccounts((aR.data ?? []) as Account[])
    setLoading(false)
  }

  async function saveCard() {
    setCardSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCardSaving(false); return }
    const payload = {
      user_id: user.id,
      name: cardForm.name,
      issuer: cardForm.issuer,
      last_four: cardForm.last_four,
      credit_limit: cardForm.credit_limit,
      current_balance: cardForm.current_balance,
      billing_day: cardForm.billing_day,
      due_day: cardForm.due_day,
      interest_rate: cardForm.interest_rate,
      is_active: cardForm.is_active,
    }
    if (cardForm.id) await supabase.from('credit_cards').update(payload).eq('id', cardForm.id)
    else await supabase.from('credit_cards').insert(payload)
    setCardSaving(false)
    setCardDialogOpen(false)
    void load()
  }

  async function removeCard(id: string) {
    if (!confirm('Hapus kartu ini?')) return
    await supabase.from('credit_cards').delete().eq('id', id)
    void load()
  }

  function openEditCard(c: CreditCard) {
    setCardForm({
      id: c.id, name: c.name, issuer: c.issuer, last_four: c.last_four,
      credit_limit: c.credit_limit, current_balance: c.current_balance,
      billing_day: c.billing_day, due_day: c.due_day,
      interest_rate: c.interest_rate, is_active: c.is_active,
    })
    setCardDialogOpen(true)
  }

  function openPayCard(c?: CreditCard) {
    setPayForm({
      ...EMPTY_PAY,
      card_id: c?.id ?? '',
      amount: c?.current_balance ?? 0,
    })
    setPayDialogOpen(true)
  }

  async function savePayment() {
    if (!payForm.card_id || payForm.amount <= 0) return
    setPaySaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPaySaving(false); return }

    await supabase.from('credit_card_payments').insert({
      user_id: user.id,
      card_id: payForm.card_id,
      amount: payForm.amount,
      from_account_id: payForm.from_account_id || null,
      date: payForm.date,
      notes: payForm.notes,
    })

    // Reduce card balance
    const card = cards.find((x) => x.id === payForm.card_id)
    if (card) {
      await supabase.from('credit_cards')
        .update({ current_balance: Math.max(0, card.current_balance - payForm.amount) })
        .eq('id', card.id)
    }
    setPaySaving(false)
    setPayDialogOpen(false)
    void load()
  }

  // Totals
  const totals = useMemo(() => {
    const active = cards.filter((c) => c.is_active)
    const outstanding = active.reduce((s, c) => s + c.current_balance, 0)
    const limit = active.reduce((s, c) => s + c.credit_limit, 0)
    const utilization = limit > 0 ? (outstanding / limit) * 100 : 0
    return { outstanding, limit, utilization, count: active.length }
  }, [cards])

  // Next due
  const today = new Date()
  function nextDueDate(dueDay: number) {
    const y = today.getFullYear()
    const m = today.getMonth()
    const thisMonthDue = new Date(y, m, dueDay)
    if (thisMonthDue >= new Date(y, m, today.getDate())) return thisMonthDue
    return new Date(y, m + 1, dueDay)
  }
  function daysUntil(due: Date) {
    const ms = due.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    return Math.round(ms / 86_400_000)
  }

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, #0A0A0F 0%, #14141A 50%, #1C1C24 100%)',
          color: '#F5F5F7',
          boxShadow: '0 24px 60px -20px rgba(0,0,0,0.40)',
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: -100, right: -60, width: 360, height: 360,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${totals.utilization < 30 ? 'rgba(16, 185, 129, 0.18)' : totals.utilization < 70 ? 'rgba(245, 158, 11, 0.16)' : 'rgba(251, 113, 133, 0.16)'}, transparent 65%)`,
          }}
        />
        <div className="relative p-6 sm:p-8">
        <p
          className="text-[11px] font-semibold tracking-[0.18em] uppercase"
          style={{ color: totals.utilization < 30 ? '#6EE7B7' : totals.utilization < 70 ? '#FCD34D' : '#FDA4AF' }}
        >
          Kartu Kredit · Total Tagihan
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <p
            className="num tabular leading-none font-bold whitespace-nowrap"
            style={{
              color: '#FFFFFF',
              fontSize: 'clamp(40px, 6vw, 64px)',
              letterSpacing: '-0.04em',
            }}
          >
            {formatCurrency(totals.outstanding)}
          </p>
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold mb-2"
            style={{
              background: totals.utilization < 30 ? 'rgba(16,185,129,0.18)'
                : totals.utilization < 70 ? 'rgba(245,158,11,0.18)'
                : 'rgba(251,113,133,0.18)',
              color: totals.utilization < 30 ? '#6EE7B7'
                : totals.utilization < 70 ? '#FCD34D'
                : '#FDA4AF',
            }}
          >
            {totals.utilization.toFixed(0)}% utilisasi
          </span>
        </div>
        <p className="text-sm mt-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {totals.count} kartu aktif · limit total{' '}
          <span className="num font-semibold" style={{ color: '#FFFFFF' }}>
            {formatCurrency(totals.limit)}
          </span>
        </p>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--ink)' }} />
        </div>
      ) : (
        <Tabs defaultValue="cards">
          <TabsList>
            <TabsTrigger value="cards">Daftar Kartu</TabsTrigger>
            <TabsTrigger value="payments">Riwayat Pembayaran</TabsTrigger>
          </TabsList>

          <TabsContent value="cards">
            <div className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                  Kelola kartu, pantau utilisasi & jatuh tempo.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => openPayCard()} disabled={cards.length === 0}>
                    <Wallet className="h-4 w-4" /> Bayar Tagihan
                  </Button>
                  <Button onClick={() => { setCardForm(EMPTY_CARD); setCardDialogOpen(true) }}>
                    <Plus className="h-4 w-4" /> Tambah Kartu
                  </Button>
                </div>
              </div>

              {cards.length === 0 ? (
                <div className="s-card p-12 text-center">
                  <p className="font-semibold">Belum ada kartu kredit</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
                    Tambahkan kartu pertama kamu untuk mulai melacak.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cards.map((c) => {
                    const util = c.credit_limit > 0 ? (c.current_balance / c.credit_limit) * 100 : 0
                    const due = nextDueDate(c.due_day)
                    const daysLeft = daysUntil(due)
                    const urgency = daysLeft <= 3 ? 'var(--c-coral)' : daysLeft <= 7 ? 'var(--c-amber)' : 'var(--ink-muted)'
                    const gradient = issuerGradient(c.issuer)
                    return (
                      <div key={c.id} className="group flex flex-col gap-3">
                        {/* Visual gradient card per design handoff */}
                        <div
                          className="relative rounded-2xl p-5 overflow-hidden"
                          style={{
                            background: gradient,
                            color: '#FFFFFF',
                            aspectRatio: '1.6 / 1',
                            boxShadow: '0 8px 24px -8px rgba(15,23,42,0.35)',
                          }}
                        >
                          {/* Top-right chip mock */}
                          <div
                            className="absolute top-4 right-4"
                            style={{
                              width: 36,
                              height: 28,
                              borderRadius: 4,
                              background: 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,255,255,0.50))',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
                            }}
                          />

                          {/* Edit/delete actions (top-left, show on hover) */}
                          <div
                            className="absolute top-3 left-3 flex gap-1 opacity-0 group-hover:opacity-100 transition"
                          >
                            <button
                              onClick={() => openEditCard(c)}
                              aria-label="Edit"
                              className="grid place-items-center rounded-md"
                              style={{
                                width: 24,
                                height: 24,
                                background: 'rgba(255,255,255,0.18)',
                                color: '#FFFFFF',
                                backdropFilter: 'blur(4px)',
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => removeCard(c.id)}
                              aria-label="Hapus"
                              className="grid place-items-center rounded-md"
                              style={{
                                width: 24,
                                height: 24,
                                background: 'rgba(255,255,255,0.18)',
                                color: '#FFFFFF',
                                backdropFilter: 'blur(4px)',
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Issuer wordmark (top) */}
                          <p
                            className="absolute top-5 left-5"
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: '0.16em',
                              textTransform: 'uppercase',
                              color: 'rgba(255,255,255,0.85)',
                            }}
                          >
                            {c.issuer}
                          </p>

                          {/* Card number (DM Mono per design) */}
                          <div
                            className="absolute bottom-12 left-5 right-5"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 15,
                              letterSpacing: '0.08em',
                              color: 'rgba(255,255,255,0.95)',
                            }}
                          >
                            •••• •••• •••• {c.last_four || '••••'}
                          </div>

                          {/* Card name + due (bottom) */}
                          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
                            <div>
                              <p
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: '0.12em',
                                  textTransform: 'uppercase',
                                  color: 'rgba(255,255,255,0.65)',
                                }}
                              >
                                Card holder
                              </p>
                              <p
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  marginTop: 2,
                                  color: '#FFFFFF',
                                }}
                              >
                                {c.name}
                              </p>
                            </div>
                            <div className="text-right">
                              <p
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: '0.12em',
                                  textTransform: 'uppercase',
                                  color: 'rgba(255,255,255,0.65)',
                                }}
                              >
                                Tagihan
                              </p>
                              <p
                                className="num tabular"
                                style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  marginTop: 2,
                                  color: '#FFFFFF',
                                }}
                              >
                                {formatCurrency(c.current_balance).replace('Rp', 'Rp ')}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Stats card below visual */}
                        <div className="s-card px-4 py-3.5">
                          <div className="flex items-center justify-between">
                            <p className="eyebrow">Limit terpakai</p>
                            <p className="num tabular" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                              {util.toFixed(0)}% · {c.interest_rate}% bunga
                            </p>
                          </div>
                          <div
                            className="kl-bar mt-2"
                            style={{
                              color:
                                util > 80
                                  ? 'var(--c-coral)'
                                  : util > 50
                                    ? 'var(--c-amber)'
                                    : 'var(--c-mint)',
                            }}
                          >
                            <i style={{ width: `${Math.min(util, 100)}%` }} />
                          </div>
                          <p className="num tabular mt-1.5" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                            {formatCurrency(c.current_balance)} dari {formatCurrency(c.credit_limit)}
                          </p>

                          <div
                            className="mt-3 pt-3 border-t flex items-center justify-between"
                            style={{ borderColor: 'var(--line)' }}
                          >
                            <div>
                              <p className="eyebrow">Jatuh Tempo</p>
                              <p
                                className="num tabular font-medium mt-0.5"
                                style={{ fontSize: 12, color: urgency }}
                              >
                                {formatDate(due.toISOString())}
                                <span className="ml-1 opacity-70">({daysLeft}h lagi)</span>
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPayCard(c)}
                              disabled={c.current_balance === 0}
                              className="btn-outline"
                            >
                              Bayar
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="payments">
            <div className="pt-4">
              {payments.length === 0 ? (
                <div className="s-card p-12 text-center">
                  <p className="font-semibold">Belum ada riwayat pembayaran</p>
                </div>
              ) : (
                <div className="s-card overflow-hidden">
                  <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
                    {payments.map((p) => {
                      const c = cards.find((x) => x.id === p.card_id)
                      const a = accounts.find((x) => x.id === p.from_account_id)
                      return (
                        <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--surface-2)]/60 transition-colors">
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ background: 'var(--c-mint)' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>
                              {c?.name ?? '—'}
                            </p>
                            <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                              {formatDate(p.date)}{a ? ` · dari ${a.name}` : ''}{p.notes ? ` · ${p.notes}` : ''}
                            </p>
                          </div>
                          <p className="num font-semibold tabular" style={{ color: 'var(--ink)' }}>
                            {formatCurrency(p.amount)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Card Dialog */}
      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cardForm.id ? 'Edit Kartu Kredit' : 'Tambah Kartu Kredit'}</DialogTitle>
            <DialogDescription>Detail kartu, limit, tanggal billing & jatuh tempo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Nama Kartu</Label>
                <Input value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} placeholder="BCA Everyday" />
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
              {cardSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {cardForm.id ? 'Simpan' : 'Tambah'}
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
                  {cards.filter((c) => c.is_active).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — outstanding {formatCurrency(c.current_balance)}
                    </SelectItem>
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
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
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
              {paySaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
