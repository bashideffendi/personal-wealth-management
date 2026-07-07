'use client'

/**
 * MobileQuickEntry — layar input cepat ala app "Budget" iOS (F13, mockup
 * di-approve). Tap kartu kategori di Beranda → sheet ini:
 *
 *   [X]        Nama Kategori        [→ Transaksi]
 *              Rp 75.000            ← angka besar yang diketik
 *   [ Rp1jt · 51% terpakai | Rp925rb · 49% sisa ]   ← strip anggaran live
 *   (GoFood) (Warung) (Groceries)   ← chip sub-kategori (opsional)
 *   [Akun ▾] [Tanggal] [Catatan]    ← meta chips
 *   numpad 1-9 · 000 · 0 · ⌫ · ✓    ← simpan = insert transaksi
 *
 * Insert mengikuti pola quick-add-launcher (supabase insert + toast +
 * dispatch 'klunting:data-changed' — dashboard & budgeting refetch sendiri).
 * Sub disimpan sebagai key komposit `Induk › Sub` (konvensi budget-categories).
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { X, Check, Delete, Wallet, CalendarDays, StickyNote, ArrowUpRight } from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { subKey } from '@/lib/budget-categories'
import { useI18n } from '@/lib/i18n/context'
import { enqueue, isNetworkError } from '@/lib/offline-queue'

interface QuickEntryProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** kategori INDUK (kartu yang di-tap) */
  category: string
  type: 'expense' | 'income'
  /** anggaran & realisasi bulan berjalan buat strip (0 = tanpa strip) */
  budget: number
  spent: number
  /** nama sub-kategori (tanpa induk) — kosong = chips disembunyikan */
  subs: string[]
}

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function MobileQuickEntry({ open, onOpenChange, category, type, budget, spent, subs }: QuickEntryProps) {
  const { t, locale } = useI18n()
  const supabase = createClient()
  const [amount, setAmount] = useState(0)
  const [sub, setSub] = useState<string | null>(null)
  const [date, setDate] = useState(todayIso)
  const [note, setNote] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset tiap kali sheet dibuka buat kategori (bisa beda) — amount bersih.
  useEffect(() => {
    if (open) {
      setAmount(0)
      setSub(null)
      setDate(todayIso())
      setNote('')
      setNoteOpen(false)
    }
  }, [open, category])

  const accountsQ = useQuery({
    queryKey: ['quick-entry-accounts'],
    enabled: open,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const { data } = await supabase.from('accounts').select('id, name').eq('user_id', user.id).order('name')
      return (data ?? []) as { id: string; name: string }[]
    },
  })
  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data])
  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id)
  }, [accounts, accountId])

  const remaining = budget - spent - amount
  const spentPct = budget > 0 ? Math.min(((spent + amount) / budget) * 100, 999) : 0

  const press = (d: string) => {
    setAmount((a) => {
      const next = d === '000' ? a * 1000 : a * 10 + Number(d)
      return next > 99_999_999_999 ? a : next
    })
  }
  const backspace = () => setAmount((a) => Math.floor(a / 10))

  async function save() {
    if (amount <= 0) { toast.error(t('quickadd.amount_gt_zero')); return }
    if (!accountId) { toast.error(t('quickadd.pick_account_first')); return }
    setSaving(true)
    // getUser() butuh network — saat offline balikannya null. Fallback ke
    // session lokal (getSession baca storage, gak fetch) biar entri offline
    // tetap bisa diantre dengan user_id yang benar.
    const { data: { user } } = await supabase.auth.getUser()
    let userId: string | null = user?.id ?? null
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession()
      userId = session?.user?.id ?? null
    }
    if (!userId) { setSaving(false); return }
    const cat = sub ? subKey(category, sub) : category
    const payload = {
      user_id: userId,
      date,
      account_id: accountId,
      type,
      category: cat,
      description: note,
      amount,
    }
    let error: { message?: string } | null = null
    try {
      ;({ error } = await supabase.from('transactions').insert(payload))
    } catch (err) {
      error = { message: err instanceof Error ? err.message : String(err) }
    }
    setSaving(false)
    if (error) {
      // Gagal karena jaringan → antre offline, JANGAN error merah. Sengaja
      // TANPA dispatch 'klunting:data-changed': transaksi belum ada di DB,
      // refetch cuma bikin angka "hantu" yang hilang lagi. Toast cukup.
      if (isNetworkError(error) && enqueue(payload)) {
        toast.info(
          locale === 'id' ? 'Tersimpan offline, akan disinkron saat online' : 'Saved offline, will sync when online',
          { description: `${cat} · ${formatCurrency(amount)}` },
        )
        onOpenChange(false)
        return
      }
      toast.error(t('quickadd.save_failed'), { description: error.message })
      return
    }
    toast.success(t('quickadd.saved'), { description: `${cat} · ${formatCurrency(amount)}` })
    onOpenChange(false)
    window.dispatchEvent(new CustomEvent('klunting:data-changed'))
  }

  const keyBtn = 'rounded-[12px] py-3 text-center text-[17px] font-medium active:opacity-60 transition-opacity'

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={category} hideTitle className="h-[92dvh]">
      {/* Konten full-height: angka dapet flex-1 di tengah, numpad kedorong ke bawah.
          minHeight ngikutin maxHeight sheet (88dvh) minus handle+padding sheet. */}
      <div className="flex flex-col" style={{ minHeight: 'calc(88dvh - 64px)' }}>
      {/* Header: X · kategori · lompat ke Transaksi */}
      <div className="flex items-center justify-between px-1 pb-1">
        <button type="button" onClick={() => onOpenChange(false)} aria-label={t('common.close')} className="grid place-items-center size-8 rounded-full" style={{ color: 'var(--ink)' }}>
          <X className="size-[17px]" />
        </button>
        <span className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>{category}</span>
        <Link href="/dashboard/transactions" aria-label={t('nav.transactions')} onClick={() => onOpenChange(false)} className="grid place-items-center size-8 rounded-full" style={{ color: 'var(--c-mint-ink)' }}>
          <ArrowUpRight className="size-[16px]" />
        </Link>
      </div>

      {/* Angka besar — dominan, whitespace luas (flex-1 dorong sisa ke bawah) */}
      <div className="flex-1 grid place-items-center min-h-[120px]">
        <p className="num tabular text-center font-medium" style={{ fontSize: amount >= 10_000_000 ? 40 : 56, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          {formatCurrency(amount)}
        </p>
      </div>

      {/* Strip anggaran live — ikut nominal yang lagi diketik */}
      {budget > 0 && (
        <div className="flex justify-between -mx-3 px-4 py-2.5 mb-2.5" style={{ background: remaining < 0 ? 'var(--c-coral-soft)' : 'var(--c-mint-soft)' }}>
          <span>
            <b className="num tabular text-[17px] font-bold" style={{ color: remaining < 0 ? 'var(--c-coral-ink)' : 'var(--c-mint-ink)' }}>{formatCompactCurrency(spent + amount)}</b>
            <span className="block text-[12px]" style={{ color: remaining < 0 ? 'var(--c-coral-ink)' : 'var(--c-mint-ink)' }}>{spentPct.toFixed(0)}% {t('safe_card.spent').toLowerCase()}</span>
          </span>
          <span className="text-right">
            <b className="num tabular text-[17px] font-bold" style={{ color: remaining < 0 ? 'var(--c-coral-ink)' : 'var(--c-mint-ink)' }}>{remaining < 0 ? '−' : ''}{formatCompactCurrency(Math.abs(remaining))}</b>
            <span className="block text-[12px]" style={{ color: remaining < 0 ? 'var(--c-coral-ink)' : 'var(--c-mint-ink)' }}>{t('month_budget.stat_remaining')}</span>
          </span>
        </div>
      )}

      {/* Chip sub-kategori */}
      {subs.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2">
          {subs.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSub((cur) => (cur === s ? null : s))}
              className="shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors"
              style={{
                background: sub === s ? 'var(--ink)' : 'var(--surface-2)',
                color: sub === s ? 'var(--surface)' : 'var(--ink-muted)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Meta chips: akun · tanggal · catatan */}
      <div className="flex gap-1.5 items-center pb-2.5 flex-wrap">
        <label className="relative shrink-0 flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[11.5px] font-medium" style={{ background: 'var(--c-coral-soft)', color: 'var(--c-coral-ink)' }}>
          <Wallet className="size-3.5" />
          {accounts.find((a) => a.id === accountId)?.name ?? t('quickadd.pick_account_first')}
          <select
            aria-label="Akun"
            value={accountId ?? ''}
            onChange={(e) => setAccountId(e.target.value)}
            className="absolute inset-0 opacity-0"
          >
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="relative shrink-0 flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[11.5px] font-medium" style={{ background: 'var(--c-coral-soft)', color: 'var(--c-coral-ink)' }}>
          <CalendarDays className="size-3.5" />
          {date === todayIso() ? 'Hari ini' : new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
          <input type="date" aria-label="Tanggal" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 opacity-0" />
        </label>
        <button type="button" onClick={() => setNoteOpen((v) => !v)} className="shrink-0 flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[11.5px] font-medium" style={{ background: 'var(--c-coral-soft)', color: 'var(--c-coral-ink)' }}>
          <StickyNote className="size-3.5" />
          {note ? note.slice(0, 14) + (note.length > 14 ? '…' : '') : t('quickadd.note_label')}
        </button>
      </div>
      {noteOpen && (
        <input
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('quickadd.description')}
          className="w-full rounded-[10px] px-3 py-2 mb-2.5 text-[13px] outline-none"
          style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
        />
      )}

      {/* Numpad — layout kalkulator ala Budget: 7-8-9 di atas, kolom kanan ⌫,
          baris bawah [Rp]-0-000-✓ (✓ coral satu sel pojok kanan-bawah) */}
      <div className="mt-auto grid grid-cols-4 gap-1.5 rounded-[16px] p-2 -mx-1" style={{ background: 'var(--bg-2)' }}>
        {(['7', '8', '9'] as const).map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className={keyBtn} style={{ background: 'var(--surface)', color: 'var(--ink)' }}>{d}</button>
        ))}
        <button type="button" onClick={backspace} aria-label="Hapus" className={keyBtn} style={{ background: 'var(--surface)', color: 'var(--ink)' }}><Delete className="size-[18px] mx-auto" /></button>
        {(['4', '5', '6'] as const).map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className={keyBtn} style={{ background: 'var(--surface)', color: 'var(--ink)' }}>{d}</button>
        ))}
        <span aria-hidden="true" />
        {(['1', '2', '3'] as const).map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className={keyBtn} style={{ background: 'var(--surface)', color: 'var(--ink)' }}>{d}</button>
        ))}
        <span aria-hidden="true" />
        <span aria-hidden="true" className="grid place-items-center text-[15px] font-medium select-none" style={{ color: 'var(--ink-soft)' }}>Rp</span>
        <button type="button" onClick={() => press('0')} className={keyBtn} style={{ background: 'var(--surface)', color: 'var(--ink)' }}>0</button>
        <button type="button" onClick={() => press('000')} className={`${keyBtn} text-[13px]`} style={{ background: 'var(--surface)', color: 'var(--ink)' }}>000</button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          aria-label={t('common.save')}
          className="rounded-[12px] grid place-items-center active:opacity-70 transition-opacity disabled:opacity-40"
          style={{ background: 'var(--c-coral)', color: '#fff' }}
        >
          <Check className="size-6" />
        </button>
      </div>
      </div>
    </BottomSheet>
  )
}
