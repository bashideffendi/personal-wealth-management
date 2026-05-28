'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { notifyAICreditsChanged } from '@/components/layout/ai-credits-badge'
import {
  ReflectiveSpendingModal,
  shouldTriggerReflection,
} from '@/components/reflective/reflective-spending-modal'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  SAVING_CATEGORIES,
  INVESTMENT_CATEGORIES,
  MONTHS,
} from '@/lib/constants'
import type { Transaction, Account, CreditCard, CategorizationRule } from '@/types'
import Papa from 'papaparse'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { Pencil, Trash2, Plus, Loader2, ArrowLeftRight, Download, Upload, Sparkles, Camera, X, ScanLine, Star, Wallet } from 'lucide-react'
import { toast } from 'sonner'

type TransactionType = 'income' | 'expense' | 'saving' | 'investment'

const TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Pemasukan',
  expense: 'Pengeluaran',
  saving: 'Tabungan',
  investment: 'Investasi',
}

// Editorial semantic chips per design handoff (mint=income, coral=expense,
// amber=saving/streak, primary indigo=investment/akumulasi).
const TYPE_BADGE_STYLES: Record<TransactionType, { bg: string; color: string }> = {
  income:     { bg: 'var(--c-mint-soft)',    color: 'var(--c-mint)' },
  expense:    { bg: 'var(--c-coral-soft)',   color: 'var(--c-coral)' },
  saving:     { bg: 'var(--c-amber-soft)',   color: 'var(--c-amber)' },
  investment: { bg: 'var(--c-primary-soft)', color: 'var(--c-primary)' },
}

function getCategoriesForType(type: TransactionType): readonly string[] {
  switch (type) {
    case 'income':
      return INCOME_CATEGORIES
    case 'expense':
      return EXPENSE_CATEGORIES
    case 'saving':
      return SAVING_CATEGORIES
    case 'investment':
      return INVESTMENT_CATEGORIES
  }
}

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  account_id: '',
  type: 'expense' as TransactionType,
  category: '',
  description: '',
  amount: 0,
}

export default function TransactionsPage() {
  const supabase = createClient()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [rules, setRules] = useState<CategorizationRule[]>([])

  // CSV Import
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState<Array<{
    date: string; description: string; amount: number;
    type: 'income' | 'expense' | 'saving' | 'investment'; category: string;
    account_id: string; apply: boolean;
  }>>([])
  const [importing, setImporting] = useState(false)

  function applyRules(desc: string): { type: 'income' | 'expense' | 'saving' | 'investment'; category: string } | null {
    const text = desc.toUpperCase()
    const sorted = [...rules].filter((r) => r.is_active).sort((a, b) => b.priority - a.priority)
    for (const r of sorted) {
      if (text.includes(r.match_text.toUpperCase())) {
        return { type: r.type, category: r.category }
      }
    }
    return null
  }

  function handleCsvUpload(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data.map((row) => {
          // Try to detect common column names (flexible)
          const desc = (row.description ?? row.Deskripsi ?? row.Description ?? row.Keterangan ?? row.keterangan ?? '').trim()
          const dateRaw = row.date ?? row.Tanggal ?? row.Date ?? row.tanggal ?? ''
          const amountRaw = row.amount ?? row.Jumlah ?? row.Amount ?? row.Nominal ?? '0'
          const amount = Math.abs(Number(String(amountRaw).replace(/[^0-9.-]/g, '')) || 0)
          // Parse date — try yyyy-mm-dd or dd/mm/yyyy
          let date = new Date().toISOString().split('T')[0]
          if (dateRaw) {
            const dn = new Date(dateRaw)
            if (!isNaN(dn.getTime())) date = dn.toISOString().split('T')[0]
            else {
              const m = dateRaw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
              if (m) date = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
            }
          }
          // Auto-categorize from rules
          const matched = applyRules(desc)
          // Default: if amount is negative or desc has "debit/keluar", expense
          const isExpense = /debit|keluar|withdraw|out/i.test(String(amountRaw) + desc) || matched?.type === 'expense'
          return {
            date,
            description: desc,
            amount,
            type: (matched?.type ?? (isExpense ? 'expense' : 'income')) as 'income' | 'expense' | 'saving' | 'investment',
            category: matched?.category ?? (isExpense ? 'Lainnya' : 'Gaji'),
            account_id: accounts[0]?.id ?? '',
            apply: true,
          }
        }).filter((r) => r.amount > 0)
        setImportRows(rows)
      },
    })
  }

  async function commitImport() {
    setImporting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setImporting(false); return }
    const toInsert = importRows
      .filter((r) => r.apply && r.account_id)
      .map((r) => ({
        user_id: user.id,
        date: r.date,
        account_id: r.account_id,
        type: r.type,
        category: r.category,
        description: r.description,
        amount: r.amount,
      }))
    if (toInsert.length > 0) await supabase.from('transactions').insert(toInsert)
    setImporting(false)
    setImportOpen(false)
    setImportRows([])
    fetchData()
  }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  // Receipt OCR (struk → auto-fill)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [extractConfidence, setExtractConfidence] = useState<'high' | 'medium' | 'low' | null>(null)

  // Smart default account (3-layer fallback: AI / user-default / last-used / first)
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null)
  const [accountSource, setAccountSource] = useState<'ai' | 'default' | 'last_used' | 'first' | null>(null)
  const [settingDefault, setSettingDefault] = useState(false)

  type ExtractedPayment = { payment_method?: string; payment_detail?: string }

  function pickAccount(extracted?: ExtractedPayment): { id: string; source: 'ai' | 'default' | 'last_used' | 'first' } | null {
    if (accounts.length === 0 && creditCards.length === 0) return null
    const allAccounts = [
      ...accounts.map((a) => ({ id: a.id, name: a.name })),
      ...creditCards.map((c) => ({ id: c.id, name: `Kredit ${c.name}` })),
    ]

    // Layer 1: AI-detected payment match
    const detail = extracted?.payment_detail?.trim().toLowerCase()
    if (detail && detail.length > 1) {
      const match = allAccounts.find((a) => {
        const n = a.name.toLowerCase()
        return n.includes(detail) || detail.includes(n)
      })
      if (match) return { id: match.id, source: 'ai' }
    }
    // Also try matching credit_card method to any credit card in list
    if (extracted?.payment_method === 'credit_card' && creditCards.length > 0) {
      return { id: creditCards[0].id, source: 'ai' }
    }
    // Cash payment method → match any cash-type account
    if (extracted?.payment_method === 'cash') {
      const cashAcc = accounts.find((a) => a.type === 'cash')
      if (cashAcc) return { id: cashAcc.id, source: 'ai' }
    }

    // Layer 2: User's saved default
    if (defaultAccountId && allAccounts.some((a) => a.id === defaultAccountId)) {
      return { id: defaultAccountId, source: 'default' }
    }

    // Layer 3: Last used (from most recent transaction)
    const lastTx = transactions.find((tx) => tx.account_id)
    if (lastTx?.account_id && allAccounts.some((a) => a.id === lastTx.account_id)) {
      return { id: lastTx.account_id, source: 'last_used' }
    }

    // Layer 4: Fallback — prefer cash-type account, else first in list.
    // Most ID transactions are cash; this gives a sensible default for users
    // who haven't explicitly set one yet.
    const cashFallback = accounts.find((a) => a.type === 'cash')
    if (cashFallback) return { id: cashFallback.id, source: 'first' }
    return { id: allAccounts[0].id, source: 'first' }
  }

  async function handleSetDefault() {
    if (!form.account_id) return
    setSettingDefault(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSettingDefault(false); return }
    const { error } = await supabase
      .from('profiles')
      .update({ default_account_id: form.account_id })
      .eq('id', user.id)
    setSettingDefault(false)
    if (error) {
      toast.error('Gagal set default', { description: error.message })
      return
    }
    setDefaultAccountId(form.account_id)
    setAccountSource('default')
  }

  function resetReceipt() {
    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl)
    setReceiptFile(null)
    setReceiptPreviewUrl(null)
    setExtractError(null)
    setExtractConfidence(null)
    setExtracting(false)
  }

  async function handleReceiptUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      setExtractError('File harus berupa gambar (JPG/PNG/WebP)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setExtractError('File terlalu besar (maks 10MB)')
      return
    }

    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl)
    setReceiptFile(file)
    setReceiptPreviewUrl(URL.createObjectURL(file))
    setExtractError(null)
    setExtractConfidence(null)
    setExtracting(true)

    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/extract-receipt', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        setExtractError(json.error ?? `Gagal: ${res.status}`)
        return
      }
      const d = json.data as {
        merchant: string
        date: string
        total: number
        type: 'income' | 'expense' | 'saving' | 'investment'
        category: string
        description: string
        payment_method?: string
        payment_detail?: string
        confidence: 'high' | 'medium' | 'low'
      }
      // Re-pick account using AI-detected payment info (overrides default if matches)
      const picked = pickAccount({ payment_method: d.payment_method, payment_detail: d.payment_detail })
      setForm((prev) => ({
        ...prev,
        date: d.date || prev.date,
        type: d.type || prev.type,
        category: d.category || prev.category,
        description: d.description || d.merchant || prev.description,
        amount: d.total || prev.amount,
        // Only override account if AI-matched (don't overwrite user's existing default)
        account_id: picked?.source === 'ai' ? picked.id : prev.account_id || picked?.id || '',
      }))
      if (picked) setAccountSource(picked.source)
      setExtractConfidence(d.confidence)
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Gagal memproses struk')
    } finally {
      setExtracting(false)
      // Refresh badge — credits consumed (success) or refunded (server-side failure)
      notifyAICreditsChanged()
    }
  }

  // Transfer dialog
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [transferForm, setTransferForm] = useState({
    date: new Date().toISOString().split('T')[0],
    from_account_id: '',
    to_account_id: '',
    amount: 0,
    notes: '',
  })
  const [transferSaving, setTransferSaving] = useState(false)

  async function saveTransfer() {
    if (!transferForm.from_account_id || !transferForm.to_account_id || transferForm.amount <= 0) return
    if (transferForm.from_account_id === transferForm.to_account_id) { toast.error('Akun asal & tujuan tidak boleh sama'); return }
    setTransferSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setTransferSaving(false); return }
    const desc = transferForm.notes
      ? `Transfer: ${transferForm.notes}`
      : `Transfer antar akun`
    // Create paired transactions with special category "Transfer"
    await supabase.from('transactions').insert([
      {
        user_id: user.id, date: transferForm.date,
        account_id: transferForm.from_account_id,
        type: 'expense', category: 'Transfer',
        description: `${desc} (keluar)`,
        amount: transferForm.amount,
      },
      {
        user_id: user.id, date: transferForm.date,
        account_id: transferForm.to_account_id,
        type: 'income', category: 'Transfer',
        description: `${desc} (masuk)`,
        amount: transferForm.amount,
      },
    ])
    setTransferSaving(false)
    setTransferDialogOpen(false)
    setTransferForm({
      date: new Date().toISOString().split('T')[0],
      from_account_id: '', to_account_id: '', amount: 0, notes: '',
    })
    fetchData()
  }

  function exportCSV(rows: Transaction[]) {
    const header = ['Tanggal', 'Akun', 'Tipe', 'Kategori', 'Deskripsi', 'Jumlah']
    const csvRows = [
      header,
      ...rows.map((tx) => [
        tx.date,
        getAccountName(tx.account_id),
        tx.type,
        tx.category,
        (tx.description ?? '').replace(/"/g, '""'),
        String(tx.amount),
      ]),
    ]
    const csv = csvRows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateStr = new Date().toISOString().split('T')[0]
    link.href = url
    link.setAttribute('download', `transaksi-${dateStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Filter state
  const [filterMonth, setFilterMonth] = useState<string>('all')
  const [filterAccount, setFilterAccount] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [txRes, accRes, ccRes, rulesRes, profRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false }),
      supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('name'),
      supabase
        .from('credit_cards')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('categorization_rules')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true),
      supabase
        .from('profiles')
        .select('default_account_id')
        .eq('id', user.id)
        .maybeSingle(),
    ])

    if (txRes.data) setTransactions(txRes.data)
    if (accRes.data) setAccounts(accRes.data)
    if (ccRes.data) setCreditCards(ccRes.data as CreditCard[])
    if (rulesRes.data) setRules(rulesRes.data as CategorizationRule[])
    if (profRes.data?.default_account_id) setDefaultAccountId(profRes.data.default_account_id as string)
    setLoading(false)
  }

  function openAddDialog() {
    if (accounts.length === 0 && creditCards.length === 0) {
      toast.error('Belum ada akun', {
        description: 'Bikin akun dulu di menu "Akun" sebelum mencatat transaksi.',
      })
      return
    }
    setEditingId(null)
    const picked = pickAccount()
    setForm({ ...emptyForm, account_id: picked?.id ?? '' })
    setAccountSource(picked?.source ?? null)
    resetReceipt()
    setDialogOpen(true)
  }

  function openEditDialog(tx: Transaction) {
    setEditingId(tx.id)
    setForm({
      date: tx.date,
      account_id: tx.account_id,
      type: tx.type,
      category: tx.category,
      description: tx.description,
      amount: tx.amount,
    })
    setAccountSource(null)
    resetReceipt()
    setDialogOpen(true)
  }

  // Reflective spending (Kakeibo) — anti-impulse modal for big expenses
  const [reflectionOpen, setReflectionOpen] = useState(false)

  async function handleSave() {
    // Client-side validation with clear messages
    if (!form.account_id) {
      toast.error('Pilih akun dulu sebelum simpan transaksi.')
      return
    }
    if (!form.category) {
      toast.error('Pilih kategori dulu sebelum simpan transaksi.')
      return
    }
    if (!form.amount || form.amount <= 0) {
      toast.error('Jumlah harus lebih dari 0.')
      return
    }

    // For NEW expense transactions over threshold, ask user to reflect first
    // (not for edits — they've already committed to the spend in the past)
    if (!editingId && shouldTriggerReflection({ type: form.type, amount: form.amount })) {
      setReflectionOpen(true)
      return
    }
    await actuallySave()
  }

  async function actuallySave() {

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // Look up active household — new transactions auto-tagged so they
    // become visible to all family members (if user is in a household).
    const memRes = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const householdId = (memRes.data as { household_id: string } | null)?.household_id ?? null

    // Upload receipt to Storage first (if attached on a NEW transaction)
    let receiptPath: string | null = null
    if (receiptFile && !editingId) {
      const ext = receiptFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const path = `${user.id}/${filename}`
      const { error: upErr } = await supabase.storage
        .from('receipts')
        .upload(path, receiptFile, { contentType: receiptFile.type, upsert: false })
      if (upErr) {
        toast.warning('Foto struk gagal diupload', {
          description: `Transaksi tetap disimpan tanpa foto. ${upErr.message}`,
        })
      } else {
        receiptPath = path
      }
    }

    const payload: Record<string, unknown> = {
      user_id: user.id,
      date: form.date,
      account_id: form.account_id,
      type: form.type,
      category: form.category,
      description: form.description,
      amount: form.amount,
    }
    if (receiptPath) payload.receipt_url = receiptPath
    if (householdId && !editingId) payload.household_id = householdId

    const { error: saveErr } = editingId
      ? await supabase.from('transactions').update(payload).eq('id', editingId)
      : await supabase.from('transactions').insert(payload)

    if (saveErr) {
      setSaving(false)
      toast.error('Gagal simpan transaksi', { description: saveErr.message })
      return
    }

    // If account is a credit card and it's an expense, add to the card's outstanding.
    // (If income/saving/investment on a CC account, the CC semantic is odd; skip auto-adjust.)
    const usedCard = creditCards.find((c) => c.id === form.account_id)
    if (usedCard && !editingId && form.type === 'expense' && form.amount > 0) {
      await supabase
        .from('credit_cards')
        .update({ current_balance: usedCard.current_balance + form.amount })
        .eq('id', usedCard.id)
    }

    setSaving(false)
    setDialogOpen(false)
    fetchData()
  }

  async function handleDelete(id: string) {
    await supabase.from('transactions').delete().eq('id', id)
    fetchData()
  }

  // ─── Quick-add (inline row) ─────────────────────────────────
  // Faster than opening the modal — Tab between fields, Enter to submit.
  const [quickForm, setQuickForm] = useState({
    date: new Date().toISOString().split('T')[0],
    account_id: '',
    type: 'expense' as TransactionType,
    category: '',
    description: '',
    amount: 0,
  })
  const [quickSaving, setQuickSaving] = useState(false)

  // Pre-fill account when accounts load (use Cash/default)
  useEffect(() => {
    if (!quickForm.account_id) {
      const picked = pickAccount()
      if (picked) setQuickForm((q) => ({ ...q, account_id: picked.id }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length, creditCards.length])

  async function quickSubmit() {
    if (!quickForm.account_id) { toast.error('Pilih akun dulu.'); return }
    if (!quickForm.category) { toast.error('Pilih kategori dulu.'); return }
    if (!quickForm.amount || quickForm.amount <= 0) { toast.error('Jumlah harus lebih dari 0.'); return }
    setQuickSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setQuickSaving(false); return }
    // Auto-tag household if member
    const memRes = await supabase.from('household_members').select('household_id').eq('user_id', user.id).maybeSingle()
    const householdId = (memRes.data as { household_id: string } | null)?.household_id ?? null

    const payload: Record<string, unknown> = {
      user_id: user.id,
      date: quickForm.date,
      account_id: quickForm.account_id,
      type: quickForm.type,
      category: quickForm.category,
      description: quickForm.description,
      amount: quickForm.amount,
    }
    if (householdId) payload.household_id = householdId

    const { error } = await supabase.from('transactions').insert(payload)
    setQuickSaving(false)
    if (error) { toast.error('Gagal simpan', { description: error.message }); return }
    toast.success('Tercatat.')

    // Reset only amount + description; keep date/account/type/category
    // (most users add multiple similar transactions in a row)
    setQuickForm((q) => ({ ...q, description: '', amount: 0 }))
    fetchData()
  }

  function getAccountName(accountId: string) {
    const acc = accounts.find((a) => a.id === accountId)
    if (acc) return acc.name?.trim() || `Akun tanpa nama (${acc.type})`
    const cc = creditCards.find((c) => c.id === accountId)
    if (cc) return `${cc.name?.trim() || 'Kartu Kredit'}${cc.last_four ? ` ••${cc.last_four}` : ''}`
    return '-'
  }

  // Filter logic
  const filteredTransactions = transactions.filter((tx) => {
    if (filterMonth !== 'all') {
      const txMonth = new Date(tx.date).getMonth() + 1
      if (txMonth !== Number(filterMonth)) return false
    }
    if (filterAccount !== 'all' && tx.account_id !== filterAccount) return false
    if (filterType !== 'all' && tx.type !== filterType) return false
    if (filterCategory !== 'all' && tx.category !== filterCategory) return false
    return true
  })

  // Dynamic category list for filter
  const filterCategoryOptions: readonly string[] =
    filterType !== 'all'
      ? getCategoriesForType(filterType as TransactionType)
      : [
          ...INCOME_CATEGORIES,
          ...EXPENSE_CATEGORIES,
          ...SAVING_CATEGORIES,
          ...INVESTMENT_CATEGORIES,
        ]

  const today = formatDate(new Date())

  return (
    <div className="space-y-6">
      {/* Header per design handoff §1 — eyebrow + h1 + utility actions */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="eyebrow">
            {today}
          </p>
          <h1
            className="display mt-1"
            style={{
              fontSize: 'clamp(28px, 4vw, 40px)',
              color: 'var(--ink)',
              /* italic dropped per fintech revert */
            }}
          >
            Transaksi
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-mute)' }}>
            Semua aktivitas finansial — pemasukan, pengeluaran, tabungan, investasi.
          </p>
        </div>
      </div>

      {!loading && accounts.length === 0 && creditCards.length === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <Wallet className="size-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-amber-900">Belum ada akun terdaftar</p>
            <p className="mt-1 text-amber-800">
              Sebelum bisa nyatet transaksi, kamu harus bikin minimal 1 akun (e.g. BCA Tahapan, Cash di dompet, GoPay).
            </p>
            <Link
              href="/dashboard/accounts"
              className="mt-2 inline-flex items-center gap-1 font-semibold text-amber-900 hover:underline"
            >
              Bikin Akun Pertama →
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Link href="/dashboard/transactions/import">
          <Button variant="outline">
            <Sparkles className="size-4" /> Import mutasi AI
          </Button>
        </Link>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="size-4" /> Import CSV
        </Button>
        <Button variant="outline" onClick={() => exportCSV(filteredTransactions)} disabled={filteredTransactions.length === 0}>
          <Download className="size-4" /> Export CSV
        </Button>
        <Button variant="outline" onClick={() => setTransferDialogOpen(true)}>
          <ArrowLeftRight className="size-4" /> Transfer
        </Button>
        <Button onClick={openAddDialog}>
          <Plus className="size-4" data-icon="inline-start" />
          Tambah Transaksi
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex flex-col gap-1">
          <label className="caps" style={{ fontSize: '0.625rem' }}>Bulan</label>
          <Select value={filterMonth} onValueChange={(v) => setFilterMonth(v ?? 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Semua Bulan">
                {(v) => v === 'all' ? 'Semua Bulan' : (MONTHS[Number(v) - 1] ?? v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Bulan</SelectItem>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="caps" style={{ fontSize: '0.625rem' }}>Akun</label>
          <Select value={filterAccount} onValueChange={(v) => setFilterAccount(v ?? 'all')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Semua Akun">
                {(v) => v === 'all'
                  ? 'Semua Akun'
                  : accounts.find((a) => a.id === v)?.name?.trim()
                    || creditCards.find((c) => c.id === v)?.name
                    || 'Akun'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Akun</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name?.trim() || `Akun tanpa nama (${a.type})`}
                </SelectItem>
              ))}
              {creditCards.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  Kredit · {c.name}{c.last_four ? ` ••${c.last_four}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="caps" style={{ fontSize: '0.625rem' }}>Tipe</label>
          <Select
            value={filterType}
            onValueChange={(v) => {
              setFilterType(v ?? 'all')
              setFilterCategory('all')
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Semua Tipe">
                {(v) => v === 'all' ? 'Semua Tipe' : (TYPE_LABELS[v as TransactionType] ?? v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              {(Object.keys(TYPE_LABELS) as TransactionType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="caps" style={{ fontSize: '0.625rem' }}>Kategori</label>
          <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v ?? 'all')}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Semua Kategori">
                {(v) => v === 'all' ? 'Semua Kategori' : v}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {filterCategoryOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick-add inline bar — fastest way to log a transaction without opening modal.
          Tab between fields, Enter to submit. Modal still available for receipt OCR + edit. */}
      {!loading && accounts.length + creditCards.length > 0 && (
        <div className="rounded-xl border bg-white p-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Plus className="size-3.5" style={{ color: 'var(--c-mint)' }} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-muted)' }}>
              Tambah Cepat
            </p>
            <span className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>
              · Tab antar field, Enter untuk simpan
            </span>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); void quickSubmit() }}
            className="grid gap-2 grid-cols-2 sm:grid-cols-12 items-center"
          >
            {/* Date */}
            <Input
              type="date"
              value={quickForm.date}
              onChange={(e) => setQuickForm({ ...quickForm, date: e.target.value })}
              className="h-9 text-xs col-span-1 sm:col-span-2 min-w-0"
            />
            {/* Account */}
            <Select
              value={quickForm.account_id}
              onValueChange={(v) => setQuickForm({ ...quickForm, account_id: v ?? '' })}
            >
              <SelectTrigger className="h-9 text-xs col-span-1 sm:col-span-2 min-w-0">
                <SelectValue placeholder="Akun">
                  {(v) => {
                    const acc = accounts.find((a) => a.id === v)
                    if (acc) return acc.name?.trim() || `Akun (${acc.type})`
                    const cc = creditCards.find((c) => c.id === v)
                    if (cc) return cc.name?.trim() || 'Kartu Kredit'
                    return 'Akun'
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name?.trim() || `Akun tanpa nama (${a.type})`}
                  </SelectItem>
                ))}
                {creditCards.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    Kredit · {c.name}{c.last_four ? ` ••${c.last_four}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Type */}
            <Select
              value={quickForm.type}
              onValueChange={(v) => setQuickForm({ ...quickForm, type: (v ?? 'expense') as TransactionType, category: '' })}
            >
              <SelectTrigger className="h-9 text-xs col-span-1 sm:col-span-2 min-w-0">
                <SelectValue placeholder="Tipe">
                  {(v) => TYPE_LABELS[v as TransactionType] ?? 'Tipe'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as TransactionType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Category */}
            <Select
              value={quickForm.category}
              onValueChange={(v) => setQuickForm({ ...quickForm, category: v ?? '' })}
            >
              <SelectTrigger className="h-9 text-xs col-span-1 sm:col-span-2 min-w-0">
                <SelectValue placeholder="Kategori">
                  {(v) => v || 'Kategori'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {getCategoriesForType(quickForm.type).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Description */}
            <Input
              value={quickForm.description}
              onChange={(e) => setQuickForm({ ...quickForm, description: e.target.value })}
              placeholder="Deskripsi (opsional)"
              className="h-9 text-xs col-span-2 sm:col-span-1 min-w-0"
            />
            {/* Amount */}
            <NumberInput
              value={quickForm.amount}
              onChange={(n) => setQuickForm({ ...quickForm, amount: n })}
              placeholder="Jumlah"
              className="h-9 text-xs col-span-1 sm:col-span-2 min-w-0"
            />
            {/* Submit */}
            <Button
              type="submit"
              disabled={quickSaving || !quickForm.account_id || !quickForm.category || quickForm.amount <= 0}
              className="h-9 text-xs col-span-1 sm:col-span-1 min-w-0"
            >
              {quickSaving ? <Loader2 className="size-3.5 animate-spin" /> : <><Plus className="size-3.5" />Simpan</>}
            </Button>
          </form>
          <p className="text-[10px] mt-1.5 px-1" style={{ color: 'var(--ink-soft)' }}>
            Tip: <kbd className="font-mono px-1 rounded" style={{ background: 'var(--surface-2)' }}>⌘K</kbd> buat AI quick-add (&ldquo;indomaret 47rb&rdquo;), atau <strong>&quot;Tambah Transaksi&quot;</strong> di atas buat scan struk.
          </p>
        </div>
      )}

      {/* Transactions list — table on md+, cards on mobile */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin" style={{ color: 'var(--ink)' }} />
          <span className="ml-2 text-gray-500">Memuat data...</span>
        </div>
      ) : filteredTransactions.length === 0 ? (
        // Empty state — clean centered card with icon + headline + sub
        <div className="s-card flex flex-col items-center text-center py-16 px-8">
          <div
            className="size-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--c-mint-soft)' }}
          >
            <Wallet className="size-7" style={{ color: 'var(--c-mint)' }} />
          </div>
          <h3 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: 'var(--ink)' }}>
            Belum ada transaksi
          </h3>
          <p className="text-sm max-w-xs" style={{ color: 'var(--ink-muted)' }}>
            Tambah yang pertama — bisa lewat foto struk, biar AI yang isi.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Tanggal</TableHead>
                  <TableHead className="whitespace-nowrap">Akun</TableHead>
                  <TableHead className="whitespace-nowrap">Tipe</TableHead>
                  <TableHead className="whitespace-nowrap">Kategori</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Jumlah</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(tx.date)}</TableCell>
                    <TableCell>{getAccountName(tx.account_id)}</TableCell>
                    <TableCell>
                      <span
                        className="chip"
                        style={{
                          background: TYPE_BADGE_STYLES[tx.type].bg,
                          color: TYPE_BADGE_STYLES[tx.type].color,
                        }}
                      >
                        {TYPE_LABELS[tx.type]}
                      </span>
                    </TableCell>
                    <TableCell>{tx.category}</TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell
                      className={`text-right font-medium whitespace-nowrap ${
                        tx.type === 'income'
                          ? 'text-[var(--c-mint)]'
                          : tx.type === 'expense'
                            ? 'text-red-600'
                            : 'text-gray-700'
                      }`}
                    >
                      {formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(tx)}>
                          <Pencil className="size-4 text-gray-500" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(tx.id)}>
                          <Trash2 className="size-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: stacked card list */}
          <div className="md:hidden space-y-2">
            {filteredTransactions.map((tx) => {
              const amountColor = tx.type === 'income'
                ? 'var(--c-mint)'
                : tx.type === 'expense'
                  ? 'var(--c-coral)'
                  : tx.type === 'saving'
                    ? 'var(--amber-600)'
                    : 'var(--sky-600)'
              return (
                <div
                  key={tx.id}
                  className="rounded-xl border bg-white p-3 active:bg-[var(--surface-2)] transition"
                  style={{ borderColor: 'var(--border)' }}
                  onClick={() => openEditDialog(tx)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="chip"
                          style={{
                            background: TYPE_BADGE_STYLES[tx.type].bg,
                            color: TYPE_BADGE_STYLES[tx.type].color,
                            height: 20,
                            fontSize: 10,
                            padding: '0 8px',
                          }}
                        >
                          {TYPE_LABELS[tx.type]}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                          {formatDate(tx.date)}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                        {tx.description || tx.category}
                      </p>
                      <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                        {tx.category} · {getAccountName(tx.account_id)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular-nums" style={{ color: amountColor }}>
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''}{formatCurrency(tx.amount)}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDelete(tx.id) }}
                        className="text-[11px] mt-1 inline-flex items-center gap-0.5 font-medium"
                        style={{ color: 'var(--c-coral)' }}
                      >
                        <Trash2 className="size-3" /> Hapus
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Transaksi' : 'Tambah Transaksi'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Ubah detail transaksi di bawah ini.'
                : 'Isi detail transaksi baru di bawah ini.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Receipt Upload (only for new transactions) */}
            {!editingId && (
              <div className="grid gap-1.5">
                <Label className="flex items-center gap-1.5">
                  <ScanLine className="size-4" />
                  Upload Struk <span className="text-xs font-normal text-muted-foreground">(opsional, otomatis isi form)</span>
                </Label>
                {!receiptPreviewUrl ? (
                  <label
                    htmlFor="receipt-upload"
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-6 text-center transition hover:border-muted-foreground/60 hover:bg-muted/40"
                  >
                    <Camera className="size-6 text-muted-foreground" />
                    <span className="text-sm">Klik atau drop foto struk di sini</span>
                    <span className="text-xs text-muted-foreground">JPG/PNG/WebP, maks 10MB</span>
                    <input
                      id="receipt-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleReceiptUpload(f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                ) : (
                  <div className="relative rounded-lg border bg-muted/20 p-2">
                    <div className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={receiptPreviewUrl}
                        alt="Preview struk"
                        className="h-20 w-20 rounded object-cover"
                      />
                      <div className="flex-1 text-xs">
                        {extracting && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Loader2 className="size-3 animate-spin" />
                            Membaca struk...
                          </div>
                        )}
                        {!extracting && extractError && (
                          <div className="text-red-600">{extractError}</div>
                        )}
                        {!extracting && !extractError && extractConfidence && (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-[var(--c-mint)]">
                              <Sparkles className="size-3" />
                              <span className="font-medium">Form terisi otomatis</span>
                            </div>
                            <div className="text-muted-foreground">
                              Akurasi: <span className="font-medium">{extractConfidence === 'high' ? 'Tinggi' : extractConfidence === 'medium' ? 'Sedang' : 'Rendah — cek ulang'}</span>
                            </div>
                            <div className="text-muted-foreground">Cek field di bawah, edit kalau perlu.</div>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={resetReceipt}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Hapus struk"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Date */}
            <div className="grid gap-1.5">
              <Label htmlFor="tx-date">Tanggal</Label>
              <Input
                id="tx-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>

            {/* Account */}
            <div className="grid gap-1.5">
              <Label>Akun</Label>
              <Select
                value={form.account_id}
                onValueChange={(v) => {
                  setForm({ ...form, account_id: v ?? '' })
                  setAccountSource(null) // user manually picked
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih akun">
                    {(v) => {
                      const acc = accounts.find((a) => a.id === v)
                      if (acc) return acc.name?.trim() || `Akun tanpa nama (${acc.type})`
                      const cc = creditCards.find((c) => c.id === v)
                      if (cc) return `Kredit · ${cc.name}${cc.last_four ? ` ••${cc.last_four}` : ''}`
                      return 'Pilih akun'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name?.trim() || `Akun tanpa nama (${a.type})`}
                    </SelectItem>
                  ))}
                  {creditCards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Kredit · {c.name}{c.last_four ? ` ••${c.last_four}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Source pill + Set-as-default link */}
              {!editingId && form.account_id && (
                <div className="flex items-center justify-between text-xs">
                  <span>
                    {accountSource === 'ai' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-purple-700">
                        <Sparkles className="size-3" /> AI deteksi dari struk
                      </span>
                    )}
                    {accountSource === 'default' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">
                        <Star className="size-3 fill-blue-700" /> Akun default
                      </span>
                    )}
                    {accountSource === 'last_used' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                        Terakhir dipakai
                      </span>
                    )}
                  </span>
                  {form.account_id !== defaultAccountId && (
                    <button
                      type="button"
                      onClick={handleSetDefault}
                      disabled={settingDefault}
                      className="text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
                    >
                      {settingDefault ? 'Menyimpan...' : 'Jadikan akun default'}
                    </button>
                  )}
                  {form.account_id === defaultAccountId && accountSource !== 'default' && (
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <Star className="size-3 fill-current" /> Default
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Type */}
            <div className="grid gap-1.5">
              <Label>Tipe</Label>
              <Select
                value={form.type}
                onValueChange={(v) => {
                  const newType = (v ?? 'expense') as TransactionType
                  setForm({ ...form, type: newType, category: '' })
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih tipe">
                    {(v) => TYPE_LABELS[v as TransactionType] ?? 'Pilih tipe'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as TransactionType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="grid gap-1.5">
              <Label>Kategori</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v ?? '' })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih kategori">
                    {(v) => v || 'Pilih kategori'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {getCategoriesForType(form.type).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="tx-desc">Deskripsi</Label>
              <Input
                id="tx-desc"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="cth: Belanja groceries di Indomaret"
              />
            </div>

            {/* Amount */}
            <div className="grid gap-1.5">
              <Label htmlFor="tx-amount">Jumlah (Rp)</Label>
              <NumberInput
                id="tx-amount"
                value={form.amount}
                onChange={(n) => setForm({ ...form, amount: n })}
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button
              className=""
              onClick={handleSave}
              disabled={saving}
            >
              {saving && <Loader2 className="size-4 animate-spin mr-1" />}
              {editingId ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kakeibo reflection modal — fires for big NEW expenses */}
      <ReflectiveSpendingModal
        open={reflectionOpen}
        onClose={() => setReflectionOpen(false)}
        onConfirm={() => { void actuallySave() }}
        amount={form.amount}
        category={form.category}
        description={form.description}
      />

      {/* CSV Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) setImportRows([]) }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import CSV Mutasi Rekening</DialogTitle>
            <DialogDescription>
              Upload file CSV dari m-banking. Kolom yang dikenali: <span className="num">date/Tanggal</span>, <span className="num">description/Keterangan</span>, <span className="num">amount/Jumlah</span>. Auto-categorize pakai rule yang sudah di-set.
            </DialogDescription>
          </DialogHeader>
          {importRows.length === 0 ? (
            <div className="py-6">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleCsvUpload(f)
                }}
                className="block w-full text-sm"
              />
              <p className="text-xs mt-3" style={{ color: 'var(--ink-soft)' }}>
                <Sparkles className="h-3 w-3 inline" /> {rules.filter((r) => r.is_active).length} aturan aktif akan diterapkan saat import.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                Preview {importRows.length} baris. Uncheck yang nggak mau di-import.
              </p>
              <div className="text-xs">
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 px-2 py-1 font-semibold border-b" style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-muted)' }}>
                  <div className="col-span-1">✓</div>
                  <div className="col-span-2">Tanggal</div>
                  <div className="col-span-4">Deskripsi</div>
                  <div className="col-span-2">Tipe/Kategori</div>
                  <div className="col-span-2">Akun</div>
                  <div className="col-span-1 text-right">Jumlah</div>
                </div>
                {importRows.map((r, i) => (
                  <div key={i} className="grid grid-cols-6 sm:grid-cols-12 gap-1 px-2 py-1.5 border-b items-center" style={{ borderColor: 'var(--border-soft)' }}>
                    <div className="col-span-1">
                      <input
                        type="checkbox"
                        checked={r.apply}
                        onChange={(e) => {
                          const next = [...importRows]
                          next[i] = { ...r, apply: e.target.checked }
                          setImportRows(next)
                        }}
                        style={{ accentColor: 'var(--lime-500)' }}
                      />
                    </div>
                    <div className="col-span-2 num">{r.date}</div>
                    <div className="col-span-4 truncate">{r.description}</div>
                    <div className="col-span-2">
                      <span className="text-[10px] px-1 rounded" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>{r.type}</span>
                      {' '}{r.category}
                    </div>
                    <div className="col-span-2">
                      <select
                        value={r.account_id}
                        onChange={(e) => {
                          const next = [...importRows]
                          next[i] = { ...r, account_id: e.target.value }
                          setImportRows(next)
                        }}
                        className="text-xs w-full bg-transparent"
                      >
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1 text-right num tabular">{formatCurrency(r.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportRows([]) }}>Batal</Button>
            {importRows.length > 0 && (
              <Button onClick={commitImport} disabled={importing || importRows.filter((r) => r.apply).length === 0}>
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {importRows.filter((r) => r.apply).length} transaksi
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Antar Akun</DialogTitle>
            <DialogDescription>
              Pindahkan dana antar rekening. Tercatat sebagai 2 transaksi berkategori &ldquo;Transfer&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Dari Akun</Label>
                <Select value={transferForm.from_account_id} onValueChange={(v) => setTransferForm({ ...transferForm, from_account_id: v ?? '' })}>
                  <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name?.trim() || `Akun tanpa nama (${a.type})`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Ke Akun</Label>
                <Select value={transferForm.to_account_id} onValueChange={(v) => setTransferForm({ ...transferForm, to_account_id: v ?? '' })}>
                  <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name?.trim() || `Akun tanpa nama (${a.type})`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Jumlah (Rp)</Label>
                <NumberInput value={transferForm.amount} onChange={(n) => setTransferForm({ ...transferForm, amount: n })} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label>Tanggal</Label>
                <Input type="date" value={transferForm.date} onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Catatan</Label>
              <Input value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Batal</Button>
            <Button
              onClick={saveTransfer}
              disabled={transferSaving || !transferForm.from_account_id || !transferForm.to_account_id || transferForm.amount <= 0}
            >
              {transferSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
