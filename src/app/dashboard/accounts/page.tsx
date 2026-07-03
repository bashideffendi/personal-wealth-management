'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatCompactCurrency, formatDate } from '@/lib/utils'
import { fetchLiquidEntries, sumLiquid } from '@/lib/liquid'
import { ACCOUNT_TYPES } from '@/lib/constants'
import type { Account, AllocationPurpose } from '@/types'
import { usePrivacy } from '@/components/privacy/privacy-provider'
import { useT } from '@/lib/i18n/context'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  Pencil, Trash2, Plus, Loader2, Wallet, Star, Layers,
  LayoutGrid, List, ArrowDownLeft, ArrowUpRight,
  Eye, EyeOff, LineChart, ChevronRight,
} from 'lucide-react'
import { AccountAllocationsDialog } from '@/components/accounts/allocations-dialog'
import { InstitutionLogo } from '@/components/accounts/institution-logo'
import { InstitutionSearch } from '@/components/accounts/institution-search'

type AccountType = keyof typeof ACCOUNT_TYPES

// Accent stripe per account type — Klunting tokens (theme-aware), never raw hex.
const TYPE_ACCENT: Record<string, string> = {
  bank: 'var(--c-mint)',
  cash: 'var(--c-amber)',
  digital_wallet: 'var(--c-violet)',
  rdn: 'var(--info)',
  investment: 'var(--info)',
}
const accentFor = (t: string) => TYPE_ACCENT[t] ?? 'var(--ink-soft)'

// Allocation pill colors — token-based so the text stays legible in dark mode
// (the old hardcoded dark hex on a translucent bg was invisible in dark).
const ALLOC_PILL: Record<AllocationPurpose, { bg: string; fg: string }> = {
  emergency_fund: { bg: 'var(--c-mint-soft)',   fg: 'var(--c-mint-ink)' },
  goal:           { bg: 'var(--c-violet-soft)', fg: 'var(--c-violet-ink)' },
  sinking_fund:   { bg: 'var(--c-amber-soft)',  fg: 'var(--c-amber-ink)' },
  other:          { bg: 'var(--surface-2)',     fg: 'var(--ink-muted)' },
}

/** Mask an account number for display: •••• last4 (fully hidden in privacy mode). */
function maskAccountNumber(num: string | null | undefined, hidden: boolean): string | null {
  const clean = (num ?? '').trim()
  if (!clean) return null
  if (hidden) return '•••• ••••'
  if (clean.length <= 4) return clean
  return `•••• ${clean.slice(-4)}`
}

type ActivityStat = { count: number; inSum: number; outSum: number }

const emptyForm = {
  name: '',
  type: 'bank' as AccountType,
  starting_balance: 0,
  account_number: '',
}

type AllocationSummary = {
  purpose_kind: AllocationPurpose
  label: string
  amount: number
}

export default function AccountsPage() {
  const supabase = createClient()
  const qc = useQueryClient()
  const { hidden: privacyHidden, toggle: togglePrivacy } = usePrivacy()
  const t = useT()

  const [allocAccount, setAllocAccount] = useState<Account | null>(null)

  const [saving, setSaving] = useState(false)
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [view, setView] = useState<'card' | 'table'>('card')

  useEffect(() => {
    const v = typeof window !== 'undefined' ? localStorage.getItem('pwm.accounts.view') : null
    if (v === 'table' || v === 'card') setView(v)
  }, [])
  function changeView(v: 'card' | 'table') {
    setView(v)
    try { localStorage.setItem('pwm.accounts.view', v) } catch { /* ignore */ }
  }

  const pageQuery = useQuery({
    queryKey: ['accounts-page'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('unauthenticated')

      // Jendela aktivitas: transaksi 30 hari terakhir, diagregasi per akun.
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 30)
      const cutoffISO = cutoff.toISOString().slice(0, 10)

      const [accRes, profRes, allocRes, goalsRes, txRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
        supabase.from('profiles').select('default_account_id').eq('id', user.id).maybeSingle(),
        // Tabel alokasi bisa belum ada (migration 016) — degrade halus.
        supabase
          .from('account_allocations')
          .select('account_id, purpose_kind, goal_id, custom_label, amount')
          .eq('user_id', user.id)
          .then(
            (r: { data: unknown; error: unknown }) => r,
            () => ({ data: [] as unknown[], error: null as unknown }),
          ),
        supabase.from('goals').select('id, name').eq('user_id', user.id),
        supabase.from('transactions').select('account_id, type, amount').eq('user_id', user.id).gte('date', cutoffISO),
      ])
      if (accRes.error) throw accRes.error

      type AllocRow = {
        account_id: string
        purpose_kind: AllocationPurpose
        goal_id: string | null
        custom_label: string | null
        amount: number
      }
      const goalNameById: Record<string, string> = {}
      ;((goalsRes.data ?? []) as { id: string; name: string }[]).forEach((g) => { goalNameById[g.id] = g.name })
      const allocMap: Record<string, AllocationSummary[]> = {}
      ;((allocRes.data ?? []) as AllocRow[]).forEach((row) => {
        const label =
          row.purpose_kind === 'emergency_fund' ? t('accounts.alloc_emergency_fund')
          : row.purpose_kind === 'goal' ? (goalNameById[row.goal_id ?? ''] ?? t('accounts.alloc_goal'))
          : (row.custom_label?.trim() || t('accounts.alloc_sinking_fund'))
        if (!allocMap[row.account_id]) allocMap[row.account_id] = []
        allocMap[row.account_id].push({ purpose_kind: row.purpose_kind, label, amount: row.amount })
      })

      // Peta aktivitas (30 hari): in = income, out = sisanya.
      const act: Record<string, ActivityStat> = {}
      ;((txRes.data ?? []) as { account_id: string | null; type: string; amount: number }[]).forEach((tx) => {
        if (!tx.account_id) return
        const a = (act[tx.account_id] ??= { count: 0, inSum: 0, outSum: 0 })
        a.count += 1
        if (tx.type === 'income') a.inSum += tx.amount ?? 0
        else a.outSum += tx.amount ?? 0
      })

      return {
        accounts: (accRes.data ?? []) as Account[],
        defaultAccountId: (profRes.data?.default_account_id as string | null) ?? null,
        allocationsByAccount: allocMap,
        activityByAccount: act,
      }
    },
  })
  const loading = pageQuery.isLoading
  const accounts = useMemo(() => pageQuery.data?.accounts ?? [], [pageQuery.data])
  const defaultAccountId = pageQuery.data?.defaultAccountId ?? null
  const allocationsByAccount = pageQuery.data?.allocationsByAccount ?? {}
  const activityByAccount = useMemo(() => pageQuery.data?.activityByAccount ?? {}, [pageQuery.data])
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['accounts-page'] })
    qc.invalidateQueries({ queryKey: ['accounts-networth-lite'] }) // hero mobile
    qc.invalidateQueries({ queryKey: ['liquid-assets'] }) // saldo akun = aset likuid
    qc.invalidateQueries({ queryKey: ['net-worth'] })
    qc.invalidateQueries({ queryKey: ['debts-page'] }) // rasio utang pakai likuid
  }

  // ── Kekayaan bersih ringkas (hero + grup mobile) ─────────────────────────
  // Komponen DISAMAKAN dengan halaman Net Worth biar angkanya konsisten:
  // aset = fetchLiquidEntries + assets_non_liquid.current_value +
  //        investments.total_value; kewajiban = debts.remaining (aktif) +
  //        credit_cards.current_balance (aktif).
  const nwLite = useQuery({
    queryKey: ['accounts-networth-lite'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('unauthenticated')
      const [liquidEntries, nlqRes, invRes, debtRes, ccRes] = await Promise.all([
        fetchLiquidEntries(supabase, user.id, { strict: true }),
        supabase.from('assets_non_liquid').select('category, current_value').eq('user_id', user.id),
        supabase.from('investments').select('id, name, category, quantity, avg_cost, total_value').eq('user_id', user.id),
        supabase.from('debts').select('remaining').eq('user_id', user.id).eq('is_active', true),
        supabase.from('credit_cards').select('id, name, last_four, current_balance').eq('user_id', user.id).eq('is_active', true).order('current_balance', { ascending: false }),
      ])
      if (nlqRes.error) throw nlqRes.error
      if (debtRes.error) throw debtRes.error

      type InvRow = { id: string; name: string | null; category: string; quantity: number; avg_cost: number; total_value: number }
      type CardRow = { id: string; name: string; last_four: string | null; current_balance: number }
      const nonLiquid = (nlqRes.data ?? []) as { category: string; current_value: number }[]
      const investments = (invRes.data ?? []) as InvRow[]
      const cards = (ccRes.data ?? []) as CardRow[]

      const invTotal = investments.reduce((s, i) => s + (i.total_value || 0), 0)
      const ccTotal = cards.reduce((s, c) => s + (c.current_balance || 0), 0)
      const debtTotal = ((debtRes.data ?? []) as { remaining: number }[]).reduce((s, d) => s + (d.remaining || 0), 0)
      const assets = sumLiquid(liquidEntries)
        + nonLiquid.reduce((s, a) => s + (a.current_value || 0), 0)
        + invTotal
      const liabilities = debtTotal + ccTotal
      return {
        assets,
        liabilities,
        netWorth: assets - liabilities,
        invTotal,
        ccTotal,
        cards,
        topHoldings: [...investments].sort((a, b) => (b.total_value || 0) - (a.total_value || 0)).slice(0, 5),
      }
    },
  })
  const nw = nwLite.data

  // Label kategori investasi — pakai key assets.cat_* yang sudah ada.
  const invCatKey: Record<string, string> = {
    stock: 'assets.cat_stock', mutual_fund: 'assets.cat_mutual_fund', crypto: 'assets.cat_crypto',
    gold: 'assets.cat_gold', bond: 'assets.cat_bond', sbn: 'assets.cat_sbn',
    time_deposit: 'assets.cat_time_deposit', forex: 'assets.cat_forex', p2p: 'assets.cat_p2p',
    pension: 'assets.cat_pension', business: 'assets.cat_business',
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
      account_number: acc.account_number ?? '',
    })
    setDialogOpen(true)
  }

  // Write that tolerates the account_number column not existing yet (pre-045):
  // on a column-missing error, retry without it so the core save still works.
  async function writeAccount(
    mode: 'insert' | 'update',
    payload: Record<string, unknown>,
    id?: string,
  ): Promise<{ error: { message: string } | null }> {
    const exec = async (p: Record<string, unknown>): Promise<{ message: string } | null> => {
      const res = mode === 'insert'
        ? await supabase.from('accounts').insert(p)
        : await supabase.from('accounts').update(p).eq('id', id as string)
      return (res.error as { message: string } | null) ?? null
    }
    let error = await exec(payload)
    if (error && /account_number/i.test(error.message)) {
      const { account_number, ...rest } = payload
      void account_number
      error = await exec(rest)
      if (!error) toast(t('accounts.toast_saved_no_number'))
    }
    return { error }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error(t('accounts.toast_name_required'))
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const accountNumber = form.account_number.trim() || null

    if (editingId) {
      // Adjust current_balance by the delta of starting_balance so tx-driven
      // adjustments stay intact.
      const original = accounts.find((a) => a.id === editingId)
      const startingDelta = form.starting_balance - (original?.starting_balance ?? 0)
      const newCurrent = (original?.current_balance ?? 0) + startingDelta

      const { error } = await writeAccount('update', {
        name: form.name.trim(),
        type: form.type,
        starting_balance: form.starting_balance,
        current_balance: newCurrent,
        account_number: accountNumber,
      }, editingId)
      if (error) { setSaving(false); toast.error(`${t('accounts.toast_update_failed')}: ${error.message}`); return }
    } else {
      // Auto-tag household_id if the user is an owner or edit-capable member.
      const memRes = await supabase
        .from('household_members')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      const mem = memRes.data as { household_id: string; role?: string; can_edit?: boolean } | null
      const householdId = mem && (mem.role === 'owner' || (mem.can_edit ?? true)) ? mem.household_id : null

      const insertPayload: Record<string, unknown> = {
        user_id: user.id,
        name: form.name.trim(),
        type: form.type,
        starting_balance: form.starting_balance,
        current_balance: form.starting_balance,
        account_number: accountNumber,
      }
      if (householdId) insertPayload.household_id = householdId

      const { error } = await writeAccount('insert', insertPayload)
      if (error) { setSaving(false); toast.error(`${t('accounts.toast_create_failed')}: ${error.message}`); return }
    }

    setSaving(false)
    setDialogOpen(false)
    refresh()
  }

  async function handleDelete() {
    if (!deleteId) return
    const { error } = await supabase.from('accounts').delete().eq('id', deleteId)
    if (error) {
      toast.error(t('accounts.toast_delete_failed'))
      setDeleteId(null)
      return
    }
    // Akun default yang dihapus jangan ninggalin referensi nyangkut di profil.
    if (deleteId === defaultAccountId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await supabase.from('profiles').update({ default_account_id: null }).eq('id', user.id)
    }
    setDeleteId(null)
    refresh()
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
    if (error) { toast.error(`${t('accounts.toast_set_default_failed')}: ${error.message}`); return }
    toast.success(t('accounts.toast_default_updated'))
    refresh()
  }

  const today = formatDate(new Date())
  const totalBalance = accounts.reduce((sum, a) => sum + (a.current_balance ?? 0), 0)
  const totals30d = useMemo(() => {
    let inSum = 0, outSum = 0
    for (const v of Object.values(activityByAccount)) { inSum += v.inSum; outSum += v.outSum }
    return { inSum, outSum }
  }, [activityByAccount])

  // Row actions — plain render fn (not a nested component) so it's reused by
  // both the card and table views without re-mounting.
  const renderRowActions = (a: Account) => (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={t('accounts.action_set_allocation')} onClick={() => setAllocAccount(a)} title={t('accounts.action_set_allocation')}>
        <Layers className="size-3.5" />
      </Button>
      {a.id !== defaultAccountId && (
        <Button variant="ghost" size="icon-sm" aria-label={t('accounts.action_make_default')} onClick={() => handleSetDefault(a.id)} disabled={settingDefaultId === a.id} title={t('accounts.action_make_default')}>
          {settingDefaultId === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Star className="size-3.5" />}
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" aria-label={t('accounts.action_edit')} onClick={() => openEditDialog(a)} title={t('accounts.action_edit_short')}>
        <Pencil className="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t('accounts.action_delete')} onClick={() => setDeleteId(a.id)} title={t('accounts.action_delete_short')}>
        <Trash2 className="size-3.5" style={{ color: 'var(--c-coral-ink)' }} />
      </Button>
    </>
  )

  const renderActivity = (a: Account, opts?: { muted?: boolean; showWindow?: boolean }) => {
    const act = activityByAccount[a.id]
    const color = opts?.muted ? 'var(--ink-soft)' : 'var(--ink-muted)'
    if (!act || act.count === 0) {
      return <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{opts?.showWindow ? `${t('accounts.no_activity')} · ${t('accounts.days_30')}` : t('accounts.none_yet')}</span>
    }
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]" style={{ color }}>
        <span>{act.count} {t('accounts.trx')}{opts?.showWindow ? ` · ${t('accounts.days_30')}` : ''}</span>
        {act.inSum > 0 && <span className="num" style={{ color: 'var(--c-mint-ink)' }}>+{formatCurrency(act.inSum)}</span>}
        {act.outSum > 0 && <span className="num" style={{ color: 'var(--c-coral-ink)' }}>−{formatCurrency(act.outSum)}</span>}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* ═══ MOBILE (<md): hero teal ala Budget — kekayaan bersih ═══ */}
      <section
        className="md:hidden rounded-[20px] px-5 pt-3.5 pb-5"
        style={{ background: '#128a6d', boxShadow: '0 10px 24px rgba(18,138,109,.28)' }}
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={togglePrivacy}
            aria-label={privacyHidden ? t('budgeting.show') : t('budgeting.hide')}
            className="size-8 -ml-1.5 grid place-items-center rounded-full active:opacity-70"
            style={{ color: 'rgba(255,255,255,.85)' }}
          >
            {privacyHidden ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
          <p className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,.92)' }}>{t('networth.net_worth')}</p>
          <Link
            href="/dashboard/net-worth"
            aria-label={t('networth.net_worth')}
            className="size-8 -mr-1.5 grid place-items-center rounded-full active:opacity-70"
            style={{ color: 'rgba(255,255,255,.85)' }}
          >
            <LineChart className="size-[18px]" />
          </Link>
        </div>
        {nw ? (
          <p
            className="num tabular text-center font-bold mt-1.5 whitespace-nowrap"
            style={{ color: '#FFFFFF', fontSize: 'clamp(22px, 7vw, 27px)', letterSpacing: '-0.02em', lineHeight: 1.15 }}
          >
            {formatCurrency(nw.netWorth)}
          </p>
        ) : (
          <div className="mx-auto mt-2.5 h-[27px] w-44 rounded-md animate-pulse" style={{ background: 'rgba(255,255,255,.22)' }} />
        )}
        <div className="mt-3.5 grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,.75)' }}>{t('networth.assets')}</p>
            <p className="num tabular text-[14px] font-semibold mt-0.5" title={nw ? formatCurrency(nw.assets) : undefined} style={{ color: '#FFFFFF' }}>
              {nw ? formatCompactCurrency(nw.assets) : '—'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,.75)' }}>{t('networth.debt')}</p>
            <p className="num tabular text-[14px] font-semibold mt-0.5" title={nw ? formatCurrency(nw.liabilities) : undefined} style={{ color: '#ffd9cf' }}>
              {nw ? formatCompactCurrency(nw.liabilities) : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* Dark gradient hero — intentionally always-dark (theme-independent). Desktop only. */}
      <section
        className="relative overflow-hidden rounded-3xl hidden md:block"
        style={{
          background: 'linear-gradient(135deg, var(--hero-bg) 0%, var(--hero-mid) 50%, var(--hero-soft) 100%)', border: 'var(--outline-w) solid var(--outline)', boxShadow: 'var(--card-shadow)',
          color: 'var(--on-hero)',
          
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{ top: -120, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255, 255, 255, 0.05), transparent 65%)' }}
        />
        <div className="relative p-6 sm:p-9">
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: 'var(--on-hero-mut)' }}>
            {t('accounts.hero_label')}
          </p>
          {!loading && accounts.length > 0 ? (
            <>
              <p
                className="num tabular font-bold mt-3 leading-none whitespace-nowrap"
                title={formatCurrency(totalBalance)}
                style={{ color: 'var(--on-hero)', fontSize: 'clamp(24px, 5vw, 30px)', letterSpacing: '-0.04em' }}
              >
                {formatCompactCurrency(totalBalance)}
              </p>
              <p className="text-sm mt-3" style={{ color: 'var(--on-hero-mut)' }}>
                {t('accounts.total_balance_from')} {accounts.length} {t('accounts.accounts_word')} · {today}
              </p>
              {(totals30d.inSum > 0 || totals30d.outSum > 0) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: 'var(--hero-chip-pos-bg)', color: 'var(--hero-chip-pos-fg)' }}>
                    <ArrowDownLeft className="size-3.5" /> {t('accounts.in')} <span className="num font-semibold">+{formatCurrency(totals30d.inSum)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: 'var(--hero-chip-neg-bg)', color: 'var(--hero-chip-neg-fg)' }}>
                    <ArrowUpRight className="size-3.5" /> {t('accounts.out')} <span className="num font-semibold">−{formatCurrency(totals30d.outSum)}</span>
                  </span>
                  <span style={{ color: 'var(--on-hero-mut)' }}>· {t('accounts.last_30_days')}</span>
                </div>
              )}
            </>
          ) : (
            <h1 className="font-bold mt-2" style={{ fontSize: 'clamp(28px, 4vw, 40px)', color: 'var(--on-hero)', letterSpacing: '-0.035em' }}>
              {t('accounts.manage_title')}
            </h1>
          )}
        </div>
      </section>

      {/* Toolbar: label + view toggle + add — desktop only (mobile: grup di bawah) */}
      {!loading && accounts.length > 0 && (
        <div className="hidden md:flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--ink-soft)' }}>{t('accounts.list_label')}</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border overflow-hidden" style={{ borderColor: 'var(--outline)' }}>
              <button type="button" onClick={() => changeView('card')} className="size-8 flex items-center justify-center transition" style={{ background: view === 'card' ? 'var(--ink)' : 'var(--surface)', color: view === 'card' ? 'var(--surface)' : 'var(--ink-muted)' }} title={t('accounts.view_card')} aria-label={t('accounts.view_card')}><LayoutGrid className="size-4" /></button>
              <button type="button" onClick={() => changeView('table')} className="size-8 flex items-center justify-center transition" style={{ background: view === 'table' ? 'var(--ink)' : 'var(--surface)', color: view === 'table' ? 'var(--surface)' : 'var(--ink-muted)' }} title={t('accounts.view_table')} aria-label={t('accounts.view_table')}><List className="size-4" /></button>
            </div>
            <Button onClick={openAddDialog}><Plus className="size-4" data-icon="inline-start" /> {t('accounts.add_account')}</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12" style={{ color: 'var(--ink-muted)' }}>
          <Loader2 className="size-5 animate-spin mr-2" /> {t('accounts.loading')}
        </div>
      ) : pageQuery.isError ? (
        <div className="s-card flex flex-col items-center text-center py-14 px-8 gap-3">
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{t('common.load_failed')}</p>
          <Button variant="outline" onClick={() => pageQuery.refetch()}>{t('common.retry')}</Button>
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
          <Wallet className="size-12 mx-auto" style={{ color: 'var(--ink-soft)' }} />
          <h3 className="mt-4 text-lg font-semibold" style={{ color: 'var(--ink)' }}>{t('accounts.empty_title')}</h3>
          <p className="hidden md:block md:mt-2 text-sm max-w-md mx-auto" style={{ color: 'var(--ink-muted)' }}>
            {t('accounts.empty_desc')}
          </p>
          <Button onClick={openAddDialog} className="mt-5"><Plus className="size-4" data-icon="inline-start" /> {t('accounts.create_first')}</Button>
        </div>
      ) : (
        <>
        {/* ═══ MOBILE (<md): grup list ala Budget — Akun / Kartu Kredit / Investasi ═══ */}
        <div className="md:hidden space-y-3">
          {/* a. Akun — data existing, restyle grup */}
          <section className="s-card overflow-hidden pb-1">
            <div className="flex items-center justify-between pl-4 pr-2.5 pt-3 pb-1">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--c-mint-ink)' }}>{t('accounts.col_account')}</p>
              <div className="flex items-center gap-1.5">
                <p className="num tabular text-[13px] font-semibold" title={formatCurrency(totalBalance)} style={{ color: 'var(--c-mint-ink)' }}>
                  {formatCompactCurrency(totalBalance)}
                </p>
                <button
                  type="button"
                  onClick={openAddDialog}
                  aria-label={t('accounts.add_account')}
                  className="size-7 grid place-items-center rounded-full active:opacity-70"
                  style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
            {accounts.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 px-4" style={{ minHeight: 52, borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
                <InstitutionLogo accountName={a.name} size={30} shape="circle" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium truncate leading-tight inline-flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
                    {a.name?.trim() || t('accounts.unnamed_account')}
                    {a.id === defaultAccountId && <Star className="size-3 fill-current shrink-0" style={{ color: 'var(--info)' }} />}
                  </p>
                  <p className="text-[11px] truncate leading-tight mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                    {ACCOUNT_TYPES[a.type as AccountType] ?? a.type}
                  </p>
                </div>
                <p className="num tabular text-[13.5px] font-semibold leading-tight shrink-0" style={{ color: 'var(--ink)' }}>
                  {formatCurrency(a.current_balance ?? 0)}
                </p>
              </div>
            ))}
          </section>

          {/* b. Kartu Kredit — dari query lite */}
          {nw && nw.cards.length > 0 && (
            <section className="s-card overflow-hidden pb-1">
              <Link href="/dashboard/credit-cards" className="flex items-center justify-between px-4 pt-3 pb-1 active:opacity-70">
                <p className="text-[13px] font-semibold inline-flex items-center gap-0.5" style={{ color: 'var(--c-coral-ink)' }}>
                  {t('accounts.footer_credit_cards')} <ChevronRight className="size-3.5" />
                </p>
                <p className="num tabular text-[13px] font-semibold" title={formatCurrency(nw.ccTotal)} style={{ color: 'var(--c-coral-ink)' }}>
                  {t('networth.debt')} {formatCompactCurrency(nw.ccTotal)}
                </p>
              </Link>
              {nw.cards.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 px-4" style={{ minHeight: 50, borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
                  <InstitutionLogo accountName={c.name} size={30} shape="circle" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium truncate leading-tight" style={{ color: 'var(--ink)' }}>{c.name}</p>
                    {(c.last_four ?? '').trim() !== '' && (
                      <p className="num text-[11px] leading-tight mt-0.5" style={{ color: 'var(--ink-soft)' }}>•••• {c.last_four}</p>
                    )}
                  </div>
                  <p className="num tabular text-[13.5px] font-semibold leading-tight shrink-0" style={{ color: (c.current_balance || 0) > 0 ? 'var(--c-coral-ink)' : 'var(--ink-soft)' }}>
                    {(c.current_balance || 0) > 0 ? `−${formatCurrency(c.current_balance)}` : formatCurrency(0)}
                  </p>
                </div>
              ))}
            </section>
          )}

          {/* c. Investasi — top-5 holdings by nilai */}
          {nw && nw.topHoldings.length > 0 && (
            <section className="s-card overflow-hidden pb-1">
              <Link href="/dashboard/assets/investment" className="flex items-center justify-between px-4 pt-3 pb-1 active:opacity-70">
                <p className="text-[13px] font-semibold inline-flex items-center gap-0.5" style={{ color: 'var(--c-violet-ink)' }}>
                  {t('assets.investments')} <ChevronRight className="size-3.5" />
                </p>
                <p className="num tabular text-[13px] font-semibold" title={formatCurrency(nw.invTotal)} style={{ color: 'var(--c-violet-ink)' }}>
                  {formatCompactCurrency(nw.invTotal)}
                </p>
              </Link>
              {nw.topHoldings.map((h, i) => {
                const catLabel = t(invCatKey[h.category] ?? 'assets.investments')
                const cost = (h.quantity || 0) * (h.avg_cost || 0)
                const pl = cost > 0 ? (((h.total_value || 0) - cost) / cost) * 100 : null
                return (
                  <div key={h.id} className="flex items-center gap-3 px-4" style={{ minHeight: 50, borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium truncate leading-tight" style={{ color: 'var(--ink)' }}>
                        {h.name?.trim() || catLabel}
                      </p>
                      <p className="text-[11px] truncate leading-tight mt-0.5" style={{ color: 'var(--ink-soft)' }}>{catLabel}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="num tabular text-[13.5px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                        {formatCurrency(h.total_value || 0)}
                      </p>
                      {pl !== null && (
                        <p className="num tabular text-[11px] font-medium leading-tight mt-0.5" style={{ color: pl >= 0 ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
                          {pl >= 0 ? '+' : ''}{pl.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </section>
          )}
        </div>

        {view === 'table' ? (
        /* ─── TABLE VIEW (md+) ─── */
        <div className="hidden md:block overflow-x-auto rounded-xl border bg-[var(--surface)]" style={{ borderColor: 'var(--outline)' }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--outline)', color: 'var(--ink-soft)' }}>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium">{t('accounts.col_account')}</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium">{t('accounts.col_type')}</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium">{t('accounts.col_number')}</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium">{t('accounts.col_activity_30')}</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium">{t('accounts.col_balance')}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const masked = maskAccountNumber(a.account_number, privacyHidden)
                const typeLabel = ACCOUNT_TYPES[a.type as AccountType] ?? a.type
                return (
                  <tr key={a.id} className="group border-b last:border-b-0 transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: 'var(--outline)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <InstitutionLogo accountName={a.name} size={32} shape="circle" />
                        <p className="font-medium truncate inline-flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
                          {a.name?.trim() || t('accounts.unnamed_account')}
                          {a.id === defaultAccountId && <Star className="size-3 fill-current shrink-0" style={{ color: 'var(--info)' }} />}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}><span className="size-1.5 rounded-full" style={{ background: accentFor(a.type) }} />{typeLabel}</span></td>
                    <td className="px-3 py-3 num whitespace-nowrap" style={{ color: masked ? 'var(--ink-muted)' : 'var(--ink-soft)' }}>{masked ?? '—'}</td>
                    <td className="px-3 py-3">{renderActivity(a)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">{renderRowActions(a)}</div>
                        <span className="num font-semibold whitespace-nowrap" style={{ color: 'var(--ink)' }}>{formatCurrency(a.current_balance ?? 0)}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        ) : (
        /* ─── CARD VIEW (md+): kartu kaya (alokasi + aktivitas 30h) ─── */
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map((a) => {
            const allocs = allocationsByAccount[a.id] ?? []
            const totalAllocated = allocs.reduce((s, x) => s + x.amount, 0)
            const free = (a.current_balance ?? 0) - totalAllocated
            const typeLabel = ACCOUNT_TYPES[a.type as AccountType] ?? a.type
            const masked = maskAccountNumber(a.account_number, privacyHidden)
            return (
              <div key={a.id} className="group relative rounded-xl border bg-[var(--surface)] p-4 transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden" style={{ borderColor: 'var(--outline)' }}>
                <div className="flex items-start gap-3">
                  <InstitutionLogo accountName={a.name} size={48} shape="circle" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>{a.name?.trim() || t('accounts.unnamed_account')}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                          {typeLabel}
                          {masked && <span className="num"> · {masked}</span>}
                          {a.id === defaultAccountId && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px]" style={{ color: 'var(--info)' }}><Star className="size-2.5 fill-current" /> {t('accounts.default')}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">{renderRowActions(a)}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="num tabular text-xl font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(a.current_balance ?? 0)}</p>
                  {totalAllocated > 0 && (
                    <p className="text-[11px] mt-0.5" style={{ color: free < 0 ? 'var(--c-coral)' : 'var(--ink-soft)' }}>
                      {t('accounts.free')} {formatCurrency(free)} · {t('accounts.allocated')} {formatCurrency(totalAllocated)}
                    </p>
                  )}
                </div>

                {allocs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {allocs.map((al, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: ALLOC_PILL[al.purpose_kind].bg, color: ALLOC_PILL[al.purpose_kind].fg }} title={privacyHidden ? al.label : `${al.label}: ${formatCurrency(al.amount)}`}>
                        {al.label} · {formatCurrency(al.amount)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--outline)' }}>
                  {renderActivity(a, { muted: true, showWindow: true })}
                </div>
              </div>
            )
          })}
        </div>
        )}
        </>
      )}

      <AccountAllocationsDialog
        open={allocAccount !== null}
        onClose={() => setAllocAccount(null)}
        account={allocAccount}
        onSaved={() => refresh()}
      />

      {!loading && accounts.length > 0 && (
        <p className="hidden md:block text-xs" style={{ color: 'var(--ink-soft)' }}>
          {t('accounts.footer_note')}{' '}
          <Link href="/dashboard/assets/liquid" className="hover:underline" style={{ color: 'var(--ink-muted)' }}>{t('accounts.footer_liquidity')}</Link>
          {' · '}
          <Link href="/dashboard/transactions" className="hover:underline" style={{ color: 'var(--ink-muted)' }}>{t('accounts.footer_transactions')}</Link>
          {' · '}
          <Link href="/dashboard/credit-cards" className="hover:underline" style={{ color: 'var(--ink-muted)' }}>{t('accounts.footer_credit_cards')}</Link>
        </p>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'var(--c-mint-soft)' }}><Wallet className="size-5" style={{ color: 'var(--c-mint-ink)' }} /></div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>{editingId ? t('accounts.dialog_edit_title') : t('accounts.dialog_add_title')}</DialogTitle>
                <DialogDescription>
                  {editingId
                    ? t('accounts.dialog_edit_desc')
                    : t('accounts.dialog_add_desc')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="acc-name">{t('accounts.field_name')}</Label>
              <InstitutionSearch
                value={form.name}
                onTextChange={(text) => setForm({ ...form, name: text })}
                onPick={(inst) => setForm({ ...form, name: inst.brand, type: inst.type as AccountType })}
                placeholder={t('accounts.field_name_placeholder')}
              />
              <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{t('accounts.field_name_hint')}</p>
            </div>

            <div className="grid gap-1.5">
              <Label>{t('accounts.field_type')}</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: (v ?? 'bank') as AccountType })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('accounts.field_type_placeholder')}>{(v) => ACCOUNT_TYPES[v as AccountType] ?? t('accounts.field_type_placeholder')}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ACCOUNT_TYPES) as AccountType[]).map((k) => (<SelectItem key={k} value={k}>{ACCOUNT_TYPES[k]}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="acc-number">
                {t('accounts.field_number')}
                <span className="text-xs font-normal ml-1" style={{ color: 'var(--ink-soft)' }}>{t('accounts.field_number_hint')}</span>
              </Label>
              <Input
                id="acc-number"
                value={form.account_number}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                placeholder={t('accounts.field_number_placeholder')}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="acc-balance">
                {t('accounts.field_starting_balance')}
                <span className="text-xs font-normal ml-1" style={{ color: 'var(--ink-soft)' }}>{t('accounts.field_starting_balance_hint')}</span>
              </Label>
              <NumberInput id="acc-balance" value={form.starting_balance} onChange={(n) => setForm({ ...form, starting_balance: n })} placeholder="0" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('accounts.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
              {editingId ? t('accounts.save') : t('accounts.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('accounts.delete_title')}</DialogTitle>
            <DialogDescription>
              {t('accounts.delete_desc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t('accounts.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t('accounts.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
