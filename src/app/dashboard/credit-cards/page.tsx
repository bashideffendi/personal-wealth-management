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
  CheckCircle2, CalendarClock, ShieldCheck, Check, type LucideIcon,
} from 'lucide-react'
import { InstitutionSearch } from '@/components/accounts/institution-search'
import { InstitutionLogo } from '@/components/accounts/institution-logo'
import { identifyInstitution } from '@/lib/indonesian-institutions'
import { CompoundDebtWarning } from '@/components/debt/compound-debt-warning'
import { useT } from '@/lib/i18n/context'

interface CardFormState {
  id: string | null
  name: string
  issuer: string
  network: string
  last_four: string
  credit_limit: number
  current_balance: number
  billing_day: number
  due_day: number
  interest_rate: number
  is_active: boolean
}
const EMPTY_CARD: CardFormState = {
  id: null, name: '', issuer: '', network: '', last_four: '',
  credit_limit: 0, current_balance: 0,
  billing_day: 1, due_day: 15, interest_rate: 2.25, is_active: true,
}

const NETWORKS: { value: string; label: string }[] = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'gpn', label: 'GPN' },
  { value: 'jcb', label: 'JCB' },
  { value: 'amex', label: 'Amex' },
]

/** Logo jaringan kartu, ditaruh di pojok kanan-bawah visual kartu (putih, di atas gradient). */
function NetworkMark({ network, size = 22 }: { network?: string | null; size?: number }) {
  const n = (network || '').toLowerCase()
  if (!n) return null
  if (n === 'mastercard') {
    const d = size
    return (
      <span className="inline-flex items-center" aria-label="Mastercard">
        <span className="rounded-full" style={{ width: d, height: d, background: '#EB001B' }} />
        <span className="rounded-full" style={{ width: d, height: d, background: '#F79E1B', marginLeft: -d * 0.42, opacity: 0.9 }} />
      </span>
    )
  }
  if (n === 'visa') {
    return <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800, fontSize: size, color: '#FFFFFF', letterSpacing: '0.01em', lineHeight: 1 }}>VISA</span>
  }
  const label = n === 'gpn' ? 'GPN' : n === 'jcb' ? 'JCB' : n === 'amex' ? 'AMEX' : (network || '').toUpperCase()
  return <span style={{ fontWeight: 800, fontSize: size * 0.72, color: '#FFFFFF', letterSpacing: '0.1em', lineHeight: 1 }}>{label}</span>
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
  const t = useT()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState<CreditCardType[]>([])
  const [payments, setPayments] = useState<CreditCardPayment[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])

  const [cardDialogOpen, setCardDialogOpen] = useState(false)
  const [cardForm, setCardForm] = useState<CardFormState>(EMPTY_CARD)
  const [cardSaving, setCardSaving] = useState(false)
  const [issuerQuery, setIssuerQuery] = useState('')

  function openAddCard() { setCardForm(EMPTY_CARD); setIssuerQuery(''); setCardDialogOpen(true) }

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
    const base = {
      user_id: user.id, name: cardForm.name, issuer: cardForm.issuer,
      last_four: cardForm.last_four,
      credit_limit: cardForm.credit_limit, current_balance: cardForm.current_balance,
      billing_day: cardForm.billing_day, due_day: cardForm.due_day,
      interest_rate: cardForm.interest_rate, is_active: cardForm.is_active,
    }
    const withNet = { ...base, network: cardForm.network || null }
    const write = (p: Record<string, unknown>) =>
      cardForm.id
        ? supabase.from('credit_cards').update(p).eq('id', cardForm.id as string)
        : supabase.from('credit_cards').insert(p)
    // Coba simpan dengan network; kalau kolomnya belum di-migrate (035), simpan
    // tanpa network biar gak gagal total (logo jaringan baru muncul stlh migrate).
    let { error } = await write(withNet)
    if (error && /network/i.test(error.message || '')) ({ error } = await write(base))
    setCardSaving(false); setCardDialogOpen(false); void load()
  }

  async function removeCard(id: string) {
    if (!confirm(t('credit_cards.confirm_delete'))) return
    await supabase.from('credit_cards').delete().eq('id', id); void load()
  }

  function openEditCard(c: CreditCardType) {
    setCardForm({
      id: c.id, name: c.name, issuer: c.issuer, network: c.network ?? '', last_four: c.last_four,
      credit_limit: c.credit_limit, current_balance: c.current_balance,
      billing_day: c.billing_day, due_day: c.due_day,
      interest_rate: c.interest_rate, is_active: c.is_active,
    })
    setIssuerQuery('')
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
    // Bayar kartu = uang KELUAR dari rekening sumber → kurangi saldonya biar masuk
    // cash flow & net worth gak naik gratis. CC payment = transfer (bukan expense
    // baru), jadi sengaja TIDAK bikin transaksi (belanja kartu udah jadi expense).
    if (payForm.from_account_id) {
      const acc = accounts.find((a) => a.id === payForm.from_account_id)
      if (acc) {
        await supabase.from('accounts')
          .update({ current_balance: acc.current_balance - payForm.amount })
          .eq('id', acc.id)
      }
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
  const utilZone = totals.utilization < 30 ? t('credit_cards.util_zone_safe') : totals.utilization < 70 ? t('credit_cards.util_zone_high') : t('credit_cards.util_zone_too_high')

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

  // Tagihan terdekat (buat tile #4 + nudge) — kartu ber-saldo, diurut hari terdekat
  const dueList = active
    .filter((c) => c.current_balance > 0)
    .map((c) => { const due = nextDueDate(c.due_day); return { c, due, days: daysUntil(due) } })
    .sort((a, b) => a.days - b.days)
  const nearest = dueList[0]
  // Rate gabungan tertimbang saldo buat warning bunga. interest_rate = %/BULAN → ×12 jadi tahunan.
  const blendedAnnualRate = totals.outstanding > 0
    ? (active.reduce((s, c) => s + c.current_balance * (c.interest_rate || 0), 0) / totals.outstanding) * 12
    : 0
  const payCard = cards.find((c) => c.id === payForm.card_id)
  const dueSoon = dueList.filter((d) => d.days <= 7)

  const stats: { label: string; value: string; sub: string; icon: LucideIcon; color: string; tint: string }[] = [
    { label: t('credit_cards.stat_total_limit'), value: formatCurrency(totals.limit), sub: `${t('credit_cards.stat_from_n_cards_prefix')} ${totals.count} ${t('credit_cards.cards_unit')}`, icon: CreditCard, color: '#64748B', tint: 'rgba(100,116,139,0.12)' },
    { label: t('credit_cards.stat_total_used'), value: formatCurrency(totals.outstanding), sub: `${totals.utilization.toFixed(0)}% ${t('credit_cards.stat_of_limit_suffix')}`, icon: ArrowUpRight, color: CORAL, tint: 'rgba(244,63,94,0.12)' },
    { label: t('credit_cards.stat_available_limit'), value: formatCurrency(totals.available), sub: t('credit_cards.stat_ready_to_use'), icon: CheckCircle2, color: MINT, tint: 'rgba(16,185,129,0.12)' },
    { label: t('credit_cards.stat_nearest_due'), value: nearest ? formatDate(nearest.due.toISOString()) : '—', sub: nearest ? `${nearest.days} ${t('credit_cards.days_left_suffix')}` : t('credit_cards.no_bills'), icon: CalendarClock, color: AMBER, tint: 'rgba(245,158,11,0.12)' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">{totals.count} {t('credit_cards.active_cards_suffix')}</p>
          <h1 className="leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 38px)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            {t('credit_cards.title')}
          </h1>
          <p className="text-sm mt-2 max-w-xl" style={{ color: 'var(--ink-muted)' }}>
            {t('credit_cards.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => openPayCard()} disabled={active.length === 0}>
            <Wallet className="h-4 w-4" /> {t('credit_cards.pay_bill')}
          </Button>
          <Button onClick={openAddCard}>
            <Plus className="h-4 w-4" /> {t('credit_cards.add_card')}
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
          <p className="font-semibold mt-3" style={{ color: 'var(--ink)' }}>{t('credit_cards.empty_title')}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>{t('credit_cards.empty_desc')}</p>
          <Button className="mt-4" onClick={openAddCard}><Plus className="h-4 w-4" /> {t('credit_cards.add_card')}</Button>
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

          {/* Nudge jatuh tempo terdekat */}
          {dueSoon.length > 0 && (
            <button
              type="button"
              onClick={() => openPayCard(dueSoon[0].c)}
              className="w-full flex items-center gap-3 rounded-xl border p-3 text-left transition hover:brightness-[0.99]"
              style={{ borderColor: `${dueSoon[0].days <= 3 ? CORAL : AMBER}55`, background: `${dueSoon[0].days <= 3 ? CORAL : AMBER}0F` }}
            >
              <CalendarClock className="size-4 shrink-0" style={{ color: dueSoon[0].days <= 3 ? CORAL : AMBER }} />
              <p className="text-[13px] flex-1 min-w-0" style={{ color: 'var(--ink)' }}>
                <strong>{dueSoon.length} {t('credit_cards.cards_unit')}</strong> {t('credit_cards.nudge_due_within_7d')} — <strong>{dueSoon[0].c.name}</strong> {dueSoon[0].days} {t('credit_cards.days_left_suffix')} ({formatCurrency(dueSoon[0].c.current_balance)}).
              </p>
              <span className="text-[12px] font-semibold shrink-0" style={{ color: dueSoon[0].days <= 3 ? CORAL : AMBER }}>{t('credit_cards.pay_arrow')}</span>
            </button>
          )}

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
                    {/* Bank logo chip (white frame → kebaca di gradient apapun) */}
                    <div className="absolute top-4 left-4 grid place-items-center rounded-lg bg-white" style={{ width: 34, height: 34, boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                      <InstitutionLogo accountName={c.issuer} size={26} shape="rounded" />
                    </div>
                    {/* Hover actions */}
                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => openEditCard(c)} aria-label={t('credit_cards.aria_edit')} className="grid place-items-center rounded-md" style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.22)', color: '#FFF', backdropFilter: 'blur(4px)' }}><Pencil className="h-3 w-3" /></button>
                      <button onClick={() => removeCard(c.id)} aria-label={t('credit_cards.aria_delete')} className="grid place-items-center rounded-md" style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.22)', color: '#FFF', backdropFilter: 'blur(4px)' }}><Trash2 className="h-3 w-3" /></button>
                    </div>
                    <p className="absolute left-5" style={{ top: 56, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 19, color: '#FFFFFF', letterSpacing: '-0.01em' }}>{c.name}</p>
                    <div className="absolute bottom-5 left-5" style={{ fontFamily: 'var(--font-mono)', fontSize: 15, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.92)' }}>
                      •••• •••• •••• {c.last_four || '••••'}
                    </div>
                    {/* Logo jaringan (Visa/Mastercard/GPN/...) pojok kanan-bawah */}
                    <div className="absolute bottom-4 right-5">
                      <NetworkMark network={c.network} size={22} />
                    </div>
                  </div>
                  {/* Stats bottom */}
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('credit_cards.utilization')}</p>
                      <p className="num tabular text-[12px] font-semibold" style={{ color: uColor }}>{util.toFixed(0)}%</p>
                    </div>
                    <div className="kl-bar mt-2" style={{ color: uColor }}><i style={{ width: `${Math.min(util, 100)}%` }} /></div>
                    <p className="num tabular mt-1.5 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                      {formatCurrency(c.current_balance)} / {formatCurrency(c.credit_limit)}
                    </p>
                    <div className="mt-3 pt-3 border-t flex items-end justify-between gap-2" style={{ borderColor: 'var(--border-soft)' }}>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('credit_cards.bill')}</p>
                        <p className="num tabular font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{formatCurrency(c.current_balance)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('credit_cards.due_date')}</p>
                        <p className="num tabular font-medium mt-0.5 text-[12px]" style={{ color: urgency }}>{formatDate(due.toISOString())} <span className="opacity-70">({daysLeft}{t('credit_cards.days_short')})</span></p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => openPayCard(c)} disabled={c.current_balance === 0}>{t('credit_cards.pay_bill')}</Button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tagihan Bulanan + Utilization */}
          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
            <div className="s-card p-5">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('credit_cards.monthly_bills')}</p>
              <div className="mt-3 divide-y" style={{ borderColor: 'var(--border-soft)' }}>
                {active.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                    <div className="min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{c.name}</p>
                      <p className="text-[11px] num" style={{ color: 'var(--ink-soft)' }}>•••• {c.last_four || '••••'} · {t('credit_cards.statement_day_prefix')} {c.billing_day}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('credit_cards.minimum')}</p>
                        <p className="num tabular text-[12px]" style={{ color: 'var(--ink-muted)' }}>{formatCurrency(minPayment(c.current_balance))}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{t('credit_cards.bill')}</p>
                        <p className="num tabular text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(c.current_balance)}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openPayCard(c)} disabled={c.current_balance === 0}>{t('credit_cards.pay')}</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="s-card p-5" style={{ background: `color-mix(in srgb, ${utilColor} 7%, var(--surface))`, borderColor: `color-mix(in srgb, ${utilColor} 25%, var(--border-soft))` }}>
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: utilColor }}>{t('credit_cards.utilization_rate')}</p>
              <p className="num tabular font-bold leading-none mt-3" style={{ fontSize: 52, color: utilColor, letterSpacing: '-0.03em' }}>{totals.utilization.toFixed(0)}%</p>
              <p className="text-sm mt-3" style={{ color: 'var(--ink-muted)' }}>
                <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(totals.outstanding)}</span> {t('credit_cards.of_total_limit')} <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(totals.limit)}</span>
              </p>
              <div className="mt-4 flex items-start gap-2 rounded-xl p-3" style={{ background: 'var(--surface)' }}>
                <ShieldCheck className="size-4 mt-0.5 shrink-0" style={{ color: utilColor }} />
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                  {t('credit_cards.advice_prefix')} <strong style={{ color: 'var(--ink)' }}>{t('credit_cards.advice_below_30')}</strong>. {t('credit_cards.advice_you_are')} <strong style={{ color: utilColor }}>{utilZone}</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Bunga berbunga — wake-up call kalau cuma bayar minimum (pakai bunga kartu) */}
          <CompoundDebtWarning balance={totals.outstanding} annualRate={blendedAnnualRate} label={t('credit_cards.total_credit_card')} />

          {/* Riwayat pembayaran */}
          <div className="s-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-5 pb-3">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('credit_cards.payment_history')}</p>
            </div>
            {payments.length === 0 ? (
              <p className="px-5 pb-5 text-[12px]" style={{ color: 'var(--ink-soft)' }}>{t('credit_cards.no_payments')}</p>
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
                        <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{formatDate(p.date)}{a ? ` · ${t('credit_cards.from_prefix')} ${a.name}` : ''}{p.notes ? ` · ${p.notes}` : ''}</p>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(244,63,94,0.12)' }}>
                <CreditCard className="size-5" style={{ color: CORAL }} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>{cardForm.id ? t('credit_cards.dialog_edit_title') : t('credit_cards.dialog_add_title')}</DialogTitle>
                <DialogDescription>{t('credit_cards.dialog_card_desc')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Bank penerbit — pemilih berlogo (kayak di Akun) */}
            <div className="grid gap-1.5">
              <Label>{t('credit_cards.issuer_bank')}</Label>
              {cardForm.issuer ? (
                <div className="flex items-center gap-3 rounded-xl border p-2.5" style={{ borderColor: 'var(--border-soft)', background: 'var(--surface-2)' }}>
                  <InstitutionLogo accountName={cardForm.issuer} size={38} shape="rounded" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{cardForm.issuer}</p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--ink-soft)' }}>{identifyInstitution(cardForm.issuer)?.legal ?? t('credit_cards.card_issuer_bank')}</p>
                  </div>
                  <button type="button" onClick={() => { setCardForm({ ...cardForm, issuer: '' }); setIssuerQuery('') }} className="text-[12px] font-medium px-2 py-1 rounded-md transition hover:bg-[var(--surface)]" style={{ color: 'var(--ink-muted)' }}>{t('credit_cards.change')}</button>
                </div>
              ) : (
                <InstitutionSearch
                  value={issuerQuery}
                  onTextChange={setIssuerQuery}
                  onPick={(inst) => { setCardForm((f) => ({ ...f, issuer: inst.brand, name: f.name || inst.brand })); setIssuerQuery('') }}
                  restrictTypes={['bank']}
                  placeholder={t('credit_cards.search_bank_placeholder')}
                />
              )}
            </div>
            {/* Nama kartu + 4 digit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t('credit_cards.card_name')}</Label>
                <Input value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} placeholder={t('credit_cards.card_name_placeholder')} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('credit_cards.last_four')}</Label>
                <Input value={cardForm.last_four} maxLength={4} inputMode="numeric" onChange={(e) => setCardForm({ ...cardForm, last_four: e.target.value.replace(/\D/g, '') })} placeholder="1234" />
              </div>
            </div>
            {/* Jaringan kartu — logonya muncul di kartu */}
            <div className="grid gap-1.5">
              <Label>{t('credit_cards.network')}</Label>
              <div className="flex flex-wrap gap-2">
                {NETWORKS.map((net) => {
                  const on = cardForm.network === net.value
                  return (
                    <button
                      key={net.value}
                      type="button"
                      onClick={() => setCardForm({ ...cardForm, network: on ? '' : net.value })}
                      className="rounded-lg border px-3 py-2 text-[12px] font-medium transition"
                      style={{ borderColor: on ? CORAL : 'var(--border-soft)', background: on ? 'rgba(244,63,94,0.08)' : 'var(--surface)', color: on ? '#9F1239' : 'var(--ink-muted)' }}
                    >
                      {net.label}
                    </button>
                  )
                })}
              </div>
            </div>
            {/* Limit + tagihan */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>{t('credit_cards.limit_field')}</Label><NumberInput value={cardForm.credit_limit} onChange={(n) => setCardForm({ ...cardForm, credit_limit: n })} placeholder="0" /></div>
              <div className="grid gap-1.5"><Label>{t('credit_cards.current_bill_field')}</Label><NumberInput value={cardForm.current_balance} onChange={(n) => setCardForm({ ...cardForm, current_balance: n })} placeholder="0" /></div>
            </div>
            {/* Tanggal cetak / jatuh tempo / bunga */}
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5"><Label>{t('credit_cards.statement_day')}</Label><Input type="number" min={1} max={31} value={cardForm.billing_day} onChange={(e) => setCardForm({ ...cardForm, billing_day: Number(e.target.value) || 1 })} /></div>
              <div className="grid gap-1.5"><Label>{t('credit_cards.due_date')}</Label><Input type="number" min={1} max={31} value={cardForm.due_day} onChange={(e) => setCardForm({ ...cardForm, due_day: Number(e.target.value) || 1 })} /></div>
              <div className="grid gap-1.5"><Label>{t('credit_cards.interest_per_month')}</Label><Input type="number" step="any" min={0} value={cardForm.interest_rate || ''} onChange={(e) => setCardForm({ ...cardForm, interest_rate: Number(e.target.value) || 0 })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDialogOpen(false)}>{t('credit_cards.cancel')}</Button>
            <Button onClick={saveCard} disabled={cardSaving || !cardForm.name || !cardForm.issuer}>
              {cardSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{t('credit_cards.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('credit_cards.pay_dialog_title')}</DialogTitle>
            <DialogDescription>{t('credit_cards.pay_dialog_desc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>{t('credit_cards.card')}</Label>
              <Select value={payForm.card_id} onValueChange={(v) => setPayForm({ ...payForm, card_id: v ?? '' })}>
                <SelectTrigger><SelectValue placeholder={t('credit_cards.select_card')} /></SelectTrigger>
                <SelectContent>
                  {active.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {t('credit_cards.outstanding')} {formatCurrency(c.current_balance)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t('credit_cards.amount')}</Label>
                <NumberInput value={payForm.amount} onChange={(n) => setPayForm({ ...payForm, amount: n })} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('credit_cards.date')}</Label>
                <Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
              </div>
            </div>
            {payCard && payCard.current_balance > 0 && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setPayForm({ ...payForm, amount: minPayment(payCard.current_balance) })} className="rounded-full px-3 py-1.5 text-[12px] font-medium transition hover:brightness-95" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>{t('credit_cards.minimum')} {formatCurrency(minPayment(payCard.current_balance))}</button>
                <button type="button" onClick={() => setPayForm({ ...payForm, amount: payCard.current_balance })} className="rounded-full px-3 py-1.5 text-[12px] font-medium transition hover:brightness-95" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>{t('credit_cards.full')} {formatCurrency(payCard.current_balance)}</button>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>{t('credit_cards.from_account')}</Label>
              <Select value={payForm.from_account_id} onValueChange={(v) => setPayForm({ ...payForm, from_account_id: v ?? '' })}>
                <SelectTrigger><SelectValue placeholder={t('credit_cards.from_account_placeholder')} /></SelectTrigger>
                <SelectContent>
                  {accounts.filter((a) => a.type !== 'investment').map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('credit_cards.notes')}</Label>
              <Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder={t('credit_cards.optional')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>{t('credit_cards.cancel')}</Button>
            <Button onClick={savePayment} disabled={paySaving || !payForm.card_id || payForm.amount <= 0}>
              {paySaving && <Loader2 className="h-4 w-4 animate-spin" />}{t('credit_cards.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
