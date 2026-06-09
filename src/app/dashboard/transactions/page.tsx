'use client'

import { useEffect, useState, Fragment } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { notifyAICreditsChanged } from '@/components/layout/ai-credits-badge'
import {
  ReflectiveSpendingModal,
  shouldTriggerReflection,
} from '@/components/reflective/reflective-spending-modal'
import { formatCurrency } from '@/lib/utils'
import { useCategoryOptions } from '@/lib/use-category-options'
import { useT, useI18n } from '@/lib/i18n/context'
import { formatDateShort } from '@/lib/i18n/dates'
import type { Transaction, Account, CreditCard, CategorizationRule } from '@/types'
import Papa from 'papaparse'
import { RangePicker, type DateRange } from '@/components/transactions/range-picker'
import { CategoryIcon } from '@/components/transactions/category-icon'

import { Button } from '@/components/ui/button'
import { QuietPageHeader } from '@/components/layout/quiet-page-header'
import { Popover } from '@base-ui/react/popover'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
import { Pencil, Trash2, Plus, Loader2, ArrowLeftRight, Download, Upload, Sparkles, Camera, X, ScanLine, Star, Wallet, Search, MoreHorizontal } from 'lucide-react'
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
  investment: { bg: 'var(--c-violet-soft)', color: 'var(--c-violet)' },
}

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  account_id: '',
  type: 'expense' as TransactionType,
  category: '',
  description: '',
  amount: 0,
  tags: [] as string[],
}

export default function TransactionsPage() {
  const supabase = createClient()
  const { optionsForType } = useCategoryOptions()
  const t = useT()
  const { locale } = useI18n()

  const TYPE_LABEL_KEYS: Record<TransactionType, string> = {
    income: 'transactions.type_income',
    expense: 'transactions.type_expense',
    saving: 'transactions.type_saving',
    investment: 'transactions.type_investment',
  }

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
  const [tagDraft, setTagDraft] = useState('') // input tag di form add/edit

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
      toast.error(t('transactions.toast_set_default_failed'), { description: error.message })
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
      setExtractError(t('transactions.error_not_image'))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setExtractError(t('transactions.error_too_large'))
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
        setExtractError(json.error ?? `${t('transactions.error_failed')}: ${res.status}`)
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
      setExtractError(err instanceof Error ? err.message : t('transactions.error_process_receipt'))
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
    if (transferForm.from_account_id === transferForm.to_account_id) { toast.error(t('transactions.toast_same_account')); return }
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
    const header = [t('transactions.col_date'), t('transactions.col_account'), t('transactions.col_type'), t('transactions.col_category'), t('transactions.col_description'), t('transactions.col_amount')]
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
  const [dateRange, setDateRange] = useState<DateRange>(null)
  const [filterAccount, setFilterAccount] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterTag, setFilterTag] = useState<string>('all')
  const [search, setSearch] = useState<string>('')
  // Quick-add inline row is hidden by default; the toolbar "+ Tambah" toggles it.
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  // Overflow menu (import/export/transfer) — controlled so item clicks close it.
  const [overflowOpen, setOverflowOpen] = useState(false)

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
      toast.error(t('transactions.toast_no_account_title'), {
        description: t('transactions.toast_no_account_desc'),
      })
      return
    }
    setEditingId(null)
    const picked = pickAccount()
    setForm({ ...emptyForm, account_id: picked?.id ?? '' })
    setTagDraft('')
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
      tags: tx.tags ?? [],
    })
    setTagDraft('')
    setAccountSource(null)
    resetReceipt()
    setDialogOpen(true)
  }

  // Reflective spending (Kakeibo) — anti-impulse modal for big expenses
  const [reflectionOpen, setReflectionOpen] = useState(false)

  async function handleSave() {
    // Client-side validation with clear messages
    if (!form.account_id) {
      toast.error(t('transactions.toast_pick_account'))
      return
    }
    if (!form.category) {
      toast.error(t('transactions.toast_pick_category'))
      return
    }
    if (!form.amount || form.amount <= 0) {
      toast.error(t('transactions.toast_amount_positive'))
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
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    const mem = memRes.data as { household_id: string; role?: string; can_edit?: boolean } | null
    const householdId = mem && (mem.role === 'owner' || (mem.can_edit ?? true)) ? mem.household_id : null

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
        toast.warning(t('transactions.toast_receipt_upload_failed'), {
          description: `${t('transactions.toast_saved_without_photo')} ${upErr.message}`,
        })
      } else {
        receiptPath = path
      }
    }

    // Flush tag yang udah diketik di input tapi belum di-commit (belum Enter/koma)
    // — biar gak ke-drop diam-diam pas user langsung klik Simpan.
    const pendingTag = tagDraft.trim().replace(/,+$/, '').trim()
    const tags = pendingTag && !form.tags.includes(pendingTag) ? [...form.tags, pendingTag] : form.tags

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
    if (tags.length) payload.tags = tags

    const saveTx = () =>
      editingId
        ? supabase.from('transactions').update(payload).eq('id', editingId)
        : supabase.from('transactions').insert(payload)
    let { error: saveErr } = await saveTx()
    // Retry tanpa tags HANYA kalau errornya kolom-belum-ada (pre-migrasi 038),
    // bukan SEMUA error — biar tag user gak ke-buang diam-diam pas error lain (RLS/network).
    const isMissingTagsCol = !!saveErr && !!payload.tags &&
      (saveErr.code === '42703' || /column .*tags.* does not exist/i.test(saveErr.message ?? ''))
    if (isMissingTagsCol) {
      delete payload.tags
      ;({ error: saveErr } = await saveTx())
    }

    if (saveErr) {
      setSaving(false)
      toast.error(t('transactions.toast_save_failed'), { description: saveErr.message })
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
    if (!quickForm.account_id) { toast.error(t('transactions.toast_pick_account_short')); return }
    if (!quickForm.category) { toast.error(t('transactions.toast_pick_category_short')); return }
    if (!quickForm.amount || quickForm.amount <= 0) { toast.error(t('transactions.toast_amount_positive')); return }
    setQuickSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setQuickSaving(false); return }
    // Auto-tag household if member
    const memRes = await supabase.from('household_members').select('*').eq('user_id', user.id).maybeSingle()
    const mem = memRes.data as { household_id: string; role?: string; can_edit?: boolean } | null
    const householdId = mem && (mem.role === 'owner' || (mem.can_edit ?? true)) ? mem.household_id : null

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
    if (error) { toast.error(t('transactions.toast_save_failed_short'), { description: error.message }); return }
    toast.success(t('transactions.toast_recorded'))

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
    if (dateRange) {
      const d = new Date(tx.date)
      if (d < dateRange.from || d > dateRange.to) return false
    }
    if (filterAccount !== 'all' && tx.account_id !== filterAccount) return false
    if (filterType !== 'all' && tx.type !== filterType) return false
    if (filterCategory !== 'all' && tx.category !== filterCategory) return false
    if (filterTag !== 'all' && !(tx.tags ?? []).includes(filterTag)) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const hay = `${tx.description ?? ''} ${tx.category} ${tx.amount} ${formatCurrency(tx.amount)}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  // Daftar kategori filter — diturunkan dari tree user (induk + subkategori).
  const allTags = Array.from(new Set(transactions.flatMap((t) => t.tags ?? []))).sort((a, b) =>
    a.localeCompare(b, 'id'),
  )

  const activeFilterCount = [
    dateRange !== null,
    filterAccount !== 'all',
    filterType !== 'all',
    filterCategory !== 'all',
    filterTag !== 'all',
  ].filter(Boolean).length

  function resetFilters() {
    setDateRange(null)
    setFilterAccount('all')
    setFilterType('all')
    setFilterCategory('all')
    setFilterTag('all')
  }

  const filterCategoryOptions: string[] =
    filterType !== 'all'
      ? optionsForType(filterType as TransactionType).map((o) => o.value)
      : [
          ...new Set(
            (['income', 'expense', 'saving', 'investment'] as TransactionType[]).flatMap((t) =>
              optionsForType(t).map((o) => o.value),
            ),
          ),
        ]

  const menuRow =
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-left transition-colors hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <div className="space-y-4">
      {/* Quiet header (Monarch/YNAB minimal-chrome) — compact label + ⓘ tooltip,
          primary action + overflow on the right. Orientation via top-nav. */}
      <QuietPageHeader
        title={t('transactions.page_title')}
        info={t('transactions.page_subtitle')}
        actions={
          <>
            {/* Overflow — import / export / transfer (secondary, low-frequency) */}
            <Popover.Root open={overflowOpen} onOpenChange={setOverflowOpen}>
              <Popover.Trigger
                className="grid h-9 w-9 place-items-center rounded-lg border transition-colors hover:bg-[var(--surface-2)]"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-soft)' }}
                aria-label={t('transactions.more_actions')}
              >
                <MoreHorizontal className="size-4" />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
                  <Popover.Popup
                    className="rounded-xl border p-1.5 outline-none"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)', width: 224, boxShadow: '0 16px 48px -16px rgba(16,24,40,0.30), 0 2px 8px rgba(16,24,40,0.06)' }}
                  >
                    <Link href="/dashboard/transactions/import" onClick={() => setOverflowOpen(false)} className={menuRow} style={{ color: 'var(--ink)' }}>
                      <Sparkles className="size-4" style={{ color: 'var(--ink-soft)' }} /> {t('transactions.import_ai')}
                    </Link>
                    <button type="button" className={menuRow} style={{ color: 'var(--ink)' }} onClick={() => { setOverflowOpen(false); setImportOpen(true) }}>
                      <Upload className="size-4" style={{ color: 'var(--ink-soft)' }} /> {t('transactions.import_csv')}
                    </button>
                    <button type="button" className={menuRow} style={{ color: 'var(--ink)' }} disabled={filteredTransactions.length === 0} onClick={() => { setOverflowOpen(false); exportCSV(filteredTransactions) }}>
                      <Download className="size-4" style={{ color: 'var(--ink-soft)' }} /> {t('transactions.export_csv')}
                    </button>
                    <div className="my-1 h-px" style={{ background: 'var(--border-soft)' }} />
                    <button type="button" className={menuRow} style={{ color: 'var(--ink)' }} onClick={() => { setOverflowOpen(false); setTransferDialogOpen(true) }}>
                      <ArrowLeftRight className="size-4" style={{ color: 'var(--ink-soft)' }} /> {t('transactions.transfer')}
                    </button>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>

            {/* Primary — toggles the inline quick-add row above the table */}
            <Button variant={showQuickAdd ? 'outline' : 'default'} onClick={() => setShowQuickAdd((v) => !v)}>
              {showQuickAdd ? (
                <><X className="size-4" data-icon="inline-start" />{t('transactions.close')}</>
              ) : (
                <><Plus className="size-4" data-icon="inline-start" />{t('transactions.add_transaction')}</>
              )}
            </Button>
          </>
        }
      />

      {/* Ikhtisar — strip tipis (density-first), bukan 4 kartu gede */}
      {!loading && filteredTransactions.length > 0 && (() => {
        const inc = filteredTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
        const exp = filteredTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
        const net = filteredTransactions.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
        const stats = [
          { label: t('transactions.summary_income'), dot: '#10B981', val: formatCurrency(inc), color: 'var(--ink)' },
          { label: t('transactions.summary_expense'), dot: '#F43F5E', val: formatCurrency(exp), color: 'var(--ink)' },
          { label: t('transactions.summary_net_cashflow'), dot: net >= 0 ? '#10B981' : '#F43F5E', val: `${net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(net))}`, color: net >= 0 ? 'var(--c-mint)' : 'var(--c-coral)' },
          { label: t('transactions.summary_total_count'), dot: '#8B5CF6', val: String(filteredTransactions.length), color: 'var(--ink)' },
        ]
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border px-4 py-3" style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)' }}>
                <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'var(--ink-muted)' }}>
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
                  {s.label}
                </span>
                <p className="num tabular font-semibold mt-1.5" style={{ fontSize: 20, letterSpacing: '-0.02em', color: s.color }}>{s.val}</p>
              </div>
            ))}
          </div>
        )
      })()}

      {!loading && accounts.length === 0 && creditCards.length === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <Wallet className="size-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-amber-900">{t('transactions.no_account_title')}</p>
            <p className="mt-1 text-amber-800">
              {t('transactions.no_account_desc')}
            </p>
            <Link
              href="/dashboard/accounts"
              className="mt-2 inline-flex items-center gap-1 font-semibold text-amber-900 hover:underline"
            >
              {t('transactions.create_first_account')} →
            </Link>
          </div>
        </div>
      )}

      {/* Search + filters — satu card: search di atas, filter di bawahnya */}
      <div className="rounded-xl border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)', boxShadow: '0 1px 3px rgba(16,24,40,0.05), 0 10px 24px -10px rgba(16,24,40,0.12)' }}>
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ink-soft)' }} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('transactions.search_placeholder')}
            className="h-9 w-full pl-9 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 mt-3">
        <div className="flex flex-col gap-1">
          <label className="eyebrow" style={{ fontSize: '0.625rem' }}>{t('transactions.filter_range')}</label>
          <RangePicker value={dateRange} onChange={setDateRange} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="eyebrow" style={{ fontSize: '0.625rem' }}>{t('transactions.filter_account')}</label>
          <Select value={filterAccount} onValueChange={(v) => setFilterAccount(v ?? 'all')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('transactions.all_accounts')}>
                {(v) => v === 'all'
                  ? t('transactions.all_accounts')
                  : accounts.find((a) => a.id === v)?.name?.trim()
                    || creditCards.find((c) => c.id === v)?.name
                    || t('transactions.account')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('transactions.all_accounts')}</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name?.trim() || `Akun tanpa nama (${a.type})`}
                </SelectItem>
              ))}
              {creditCards.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {t('transactions.credit_prefix')} · {c.name}{c.last_four ? ` ••${c.last_four}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>


        <div className="flex flex-col gap-1">
          <label className="eyebrow" style={{ fontSize: '0.625rem' }}>{t('transactions.filter_type')}</label>
          <Select value={filterType} onValueChange={(v) => { setFilterType(v ?? 'all'); setFilterCategory('all') }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('transactions.all_types')}>
                {(v) => v === 'all' ? t('transactions.all_types') : (v in TYPE_LABEL_KEYS ? t(TYPE_LABEL_KEYS[v as TransactionType]) : v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('transactions.all_types')}</SelectItem>
              {(Object.keys(TYPE_LABELS) as TransactionType[]).map((ty) => (
                <SelectItem key={ty} value={ty}>{t(TYPE_LABEL_KEYS[ty])}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="eyebrow" style={{ fontSize: '0.625rem' }}>{t('transactions.filter_category')}</label>
          <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v ?? 'all')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('transactions.all_categories')}>
                {(v) => v === 'all' ? t('transactions.all_categories') : v}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('transactions.all_categories')}</SelectItem>
              {filterCategoryOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="eyebrow" style={{ fontSize: '0.625rem' }}>{t('transactions.filter_tag')}</label>
            <Select value={filterTag} onValueChange={(v) => setFilterTag(v ?? 'all')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('transactions.all_tags')}>
                  {(v) => (v === 'all' ? t('transactions.all_tags') : v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('transactions.all_tags')}</SelectItem>
                {allTags.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium"
            style={{ color: 'var(--c-primary)' }}
          >
            <X className="size-3.5" /> {t('transactions.reset_filters')}
          </button>
        )}
      </div>

      {/* Quick-add inline row — toggled by the toolbar "+ Tambah" (hidden by default).
          Fast path: Tab between fields, Enter to submit. Full modal (struk OCR + tags)
          via the "Detail" button. */}
      {showQuickAdd && !loading && accounts.length + creditCards.length > 0 && (
        <div className="rounded-xl border bg-[var(--surface)] p-3" style={{ borderColor: 'var(--c-primary)' }}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Plus className="size-3.5" style={{ color: 'var(--ink-muted)' }} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-muted)' }}>
              {t('transactions.quick_add')}
            </p>
            <span className="text-[10px] hidden sm:inline" style={{ color: 'var(--ink-soft)' }}>
              · {t('transactions.quick_add_hint')}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={openAddDialog}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--surface-2)]"
                style={{ color: 'var(--ink-muted)' }}
              >
                <ScanLine className="size-3.5" /> {t('transactions.add_detail')}
              </button>
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="grid size-6 place-items-center rounded-md transition-colors hover:bg-[var(--surface-2)]"
                style={{ color: 'var(--ink-soft)' }}
                aria-label={t('transactions.close')}
              >
                <X className="size-3.5" />
              </button>
            </div>
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
              className="h-9 col-span-1 sm:col-span-2 min-w-0"
            />
            {/* Account */}
            <Select
              value={quickForm.account_id}
              onValueChange={(v) => setQuickForm({ ...quickForm, account_id: v ?? '' })}
            >
              <SelectTrigger className="h-9 w-full text-sm col-span-1 sm:col-span-2 min-w-0">
                <SelectValue placeholder={t('transactions.account')}>
                  {(v) => {
                    const acc = accounts.find((a) => a.id === v)
                    if (acc) return acc.name?.trim() || `${t('transactions.account')} (${acc.type})`
                    const cc = creditCards.find((c) => c.id === v)
                    if (cc) return cc.name?.trim() || t('transactions.credit_card')
                    return t('transactions.account')
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name?.trim() || `${t('transactions.unnamed_account')} (${a.type})`}
                  </SelectItem>
                ))}
                {creditCards.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {t('transactions.credit_prefix')} · {c.name}{c.last_four ? ` ••${c.last_four}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Type */}
            <Select
              value={quickForm.type}
              onValueChange={(v) => setQuickForm({ ...quickForm, type: (v ?? 'expense') as TransactionType, category: '' })}
            >
              <SelectTrigger className="h-9 w-full text-sm col-span-1 sm:col-span-2 min-w-0">
                <SelectValue placeholder={t('transactions.filter_type')}>
                  {(v) => v in TYPE_LABEL_KEYS ? t(TYPE_LABEL_KEYS[v as TransactionType]) : t('transactions.filter_type')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as TransactionType[]).map((ty) => (
                  <SelectItem key={ty} value={ty}>{t(TYPE_LABEL_KEYS[ty])}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Category */}
            <Select
              value={quickForm.category}
              onValueChange={(v) => setQuickForm({ ...quickForm, category: v ?? '' })}
            >
              <SelectTrigger className="h-9 w-full text-sm col-span-1 sm:col-span-2 min-w-0">
                <SelectValue placeholder={t('transactions.filter_category')}>
                  {(v) => v || t('transactions.filter_category')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {optionsForType(quickForm.type).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.depth > 0 ? (
                      <span className="pl-3.5" style={{ color: 'var(--ink-muted)' }}>↳ {o.label}</span>
                    ) : (
                      o.label
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Description */}
            <Input
              value={quickForm.description}
              onChange={(e) => setQuickForm({ ...quickForm, description: e.target.value })}
              placeholder={t('transactions.description_optional')}
              className="h-9 col-span-2 sm:col-span-2 min-w-0"
            />
            {/* Amount */}
            <NumberInput
              value={quickForm.amount}
              onChange={(n) => setQuickForm({ ...quickForm, amount: n })}
              placeholder={t('transactions.amount')}
              className="h-9 w-full col-span-2 sm:col-span-1 min-w-0 text-right tabular-nums"
            />
            {/* Submit */}
            <Button
              type="submit"
              disabled={quickSaving || !quickForm.account_id || !quickForm.category || quickForm.amount <= 0}
              className="h-9 w-full text-sm col-span-1 sm:col-span-1 min-w-0"
            >
              {quickSaving ? <Loader2 className="size-3.5 animate-spin" /> : <><Plus className="size-3.5" />{t('transactions.save')}</>}
            </Button>
          </form>
          <p className="text-[10px] mt-1.5 px-1" style={{ color: 'var(--ink-soft)' }}>
            {t('transactions.quick_add_tip_prefix')} <kbd className="font-mono px-1 rounded" style={{ background: 'var(--surface-2)' }}>⌘K</kbd> {t('transactions.quick_add_tip_suffix')}
          </p>
        </div>
      )}

      {/* Transactions list — table on md+, cards on mobile */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin" style={{ color: 'var(--ink)' }} />
          <span className="ml-2" style={{ color: 'var(--ink-soft)' }}>{t('transactions.loading')}</span>
        </div>
      ) : filteredTransactions.length === 0 ? (
        // Empty state — clean centered card with icon + headline + sub
        <div className="s-card flex flex-col items-center text-center py-16 px-8">
          <div
            className="size-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--surface-2)' }}
          >
            <Wallet className="size-7" style={{ color: 'var(--ink-muted)' }} />
          </div>
          <h3 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: 'var(--ink)' }}>
            {t('transactions.empty_title')}
          </h3>
          <p className="text-sm max-w-xs" style={{ color: 'var(--ink-muted)' }}>
            {t('transactions.empty_desc')}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: per-day grouped table, in a card */}
          <div className="hidden md:block overflow-hidden rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border-soft)', boxShadow: '0 1px 3px rgba(16,24,40,0.05), 0 10px 24px -10px rgba(16,24,40,0.12)' }}>
            <Table className="border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <TableHeader>
                <TableRow className="bg-[var(--surface-3)] hover:bg-[var(--surface-3)]">
                  <TableHead className="text-[11px] uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>{t('transactions.col_account')}</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>{t('transactions.col_type')}</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>{t('transactions.col_category')}</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>{t('transactions.col_description')}</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>{t('transactions.col_amount')}</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>{t('transactions.col_action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const groups: { date: string; items: typeof filteredTransactions }[] = []
                  filteredTransactions.forEach((tx) => {
                    const last = groups[groups.length - 1]
                    if (last && last.date === tx.date) last.items.push(tx)
                    else groups.push({ date: tx.date, items: [tx] })
                  })
                  return groups.map((g) => (
                    <Fragment key={g.date}>
                      <TableRow className="hover:bg-transparent border-[color:var(--border-soft)]">
                        <TableCell
                          colSpan={6}
                          className="px-3 py-2 text-[12px] font-semibold"
                          style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span>
                              {formatDateShort(g.date, locale)}
                              <span className="ml-2 font-normal" style={{ color: 'var(--ink-soft)' }}>
                                · {g.items.length} {t('transactions.transactions_word')}
                              </span>
                            </span>
                            {(() => {
                              const net = g.items.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
                              return (
                                <span className="tabular-nums" style={{ color: net >= 0 ? 'var(--c-mint)' : 'var(--ink-muted)' }}>
                                  {t('transactions.net')} {net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(net))}
                                </span>
                              )
                            })()}
                          </div>
                        </TableCell>
                      </TableRow>
                      {g.items.map((tx) => (
                        <TableRow key={tx.id} className="border-[color:var(--border-soft)] hover:bg-[var(--surface-2)]">
                          <TableCell className="text-[13px] whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                            {getAccountName(tx.account_id)}
                          </TableCell>
                          <TableCell>
                            <span
                              className="chip"
                              style={{
                                background: TYPE_BADGE_STYLES[tx.type].bg,
                                color: TYPE_BADGE_STYLES[tx.type].color,
                              }}
                            >
                              {t(TYPE_LABEL_KEYS[tx.type])}
                            </span>
                          </TableCell>
                          <TableCell className="text-[13px] whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                            <span className="flex items-center gap-2">
                              <span className="grid size-7 shrink-0 place-items-center rounded-full" style={{ background: TYPE_BADGE_STYLES[tx.type].bg, color: TYPE_BADGE_STYLES[tx.type].color }}>
                                <CategoryIcon category={tx.category} className="size-3.5" />
                              </span>
                              {tx.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-[13px]" style={{ color: 'var(--ink)' }}>
                            {tx.description}
                            {tx.tags && tx.tags.length > 0 && (
                              <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                                {tx.tags.map((t) => (
                                  <span key={t} className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--c-violet-soft)', color: 'var(--c-violet)' }}>
                                    {t}
                                  </span>
                                ))}
                              </span>
                            )}
                          </TableCell>
                          <TableCell
                            className={`text-right text-[13px] font-medium tabular-nums whitespace-nowrap ${
                              tx.type === 'income'
                                ? 'text-[var(--c-mint)]'
                                : tx.type === 'expense'
                                  ? 'text-[var(--c-coral)]'
                                  : 'text-[var(--ink)]'
                            }`}
                          >
                            {formatCurrency(tx.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(tx)}>
                                <Pencil className="size-4" style={{ color: 'var(--ink-soft)' }} />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(tx.id)}>
                                <Trash2 className="size-4" style={{ color: 'var(--c-coral)' }} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))
                })()}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent" style={{ background: 'var(--surface-2)' }}>
                  <TableCell colSpan={4} className="text-[12px] font-semibold" style={{ color: 'var(--ink-muted)' }}>
                    {t('transactions.total')} · {filteredTransactions.length} {t('transactions.transactions_word')}
                  </TableCell>
                  <TableCell className="text-right text-[13px] font-bold tabular-nums">
                    {(() => {
                      const n = filteredTransactions.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
                      return <span style={{ color: n >= 0 ? 'var(--c-mint)' : 'var(--c-coral)' }}>{n >= 0 ? '+' : '−'}{formatCurrency(Math.abs(n))}</span>
                    })()}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
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
                  className="rounded-xl border bg-[var(--surface)] p-3 active:bg-[var(--surface-2)] transition"
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
                          {t(TYPE_LABEL_KEYS[tx.type])}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                          {formatDateShort(tx.date, locale)}
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
                        <Trash2 className="size-3" /> {t('transactions.delete')}
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
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(16,185,129,0.12)' }}><Wallet className="size-5" style={{ color: '#10B981' }} /></div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>{editingId ? t('transactions.dialog_edit_title') : t('transactions.dialog_add_title')}</DialogTitle>
                <DialogDescription>{editingId ? t('transactions.dialog_edit_desc') : t('transactions.dialog_add_desc')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Receipt Upload (only for new transactions) */}
            {!editingId && (
              <div className="grid gap-1.5">
                <Label className="flex items-center gap-1.5">
                  <ScanLine className="size-4" />
                  {t('transactions.upload_receipt')} <span className="text-xs font-normal text-muted-foreground">{t('transactions.upload_receipt_hint')}</span>
                </Label>
                {!receiptPreviewUrl ? (
                  <label
                    htmlFor="receipt-upload"
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-6 text-center transition hover:border-muted-foreground/60 hover:bg-muted/40"
                  >
                    <Camera className="size-6 text-muted-foreground" />
                    <span className="text-sm">{t('transactions.receipt_dropzone')}</span>
                    <span className="text-xs text-muted-foreground">{t('transactions.receipt_formats')}</span>
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
                        alt={t('transactions.receipt_preview_alt')}
                        className="h-20 w-20 rounded object-cover"
                      />
                      <div className="flex-1 text-xs">
                        {extracting && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Loader2 className="size-3 animate-spin" />
                            {t('transactions.reading_receipt')}
                          </div>
                        )}
                        {!extracting && extractError && (
                          <div style={{ color: 'var(--c-coral)' }}>{extractError}</div>
                        )}
                        {!extracting && !extractError && extractConfidence && (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-[var(--c-mint)]">
                              <Sparkles className="size-3" />
                              <span className="font-medium">{t('transactions.form_autofilled')}</span>
                            </div>
                            <div className="text-muted-foreground">
                              {t('transactions.accuracy')}: <span className="font-medium">{extractConfidence === 'high' ? t('transactions.accuracy_high') : extractConfidence === 'medium' ? t('transactions.accuracy_medium') : t('transactions.accuracy_low')}</span>
                            </div>
                            <div className="text-muted-foreground">{t('transactions.check_fields')}</div>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={resetReceipt}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={t('transactions.remove_receipt')}
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
              <Label htmlFor="tx-date">{t('transactions.label_date')}</Label>
              <Input
                id="tx-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>

            {/* Account */}
            <div className="grid gap-1.5">
              <Label>{t('transactions.label_account')}</Label>
              <Select
                value={form.account_id}
                onValueChange={(v) => {
                  setForm({ ...form, account_id: v ?? '' })
                  setAccountSource(null) // user manually picked
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('transactions.select_account')}>
                    {(v) => {
                      const acc = accounts.find((a) => a.id === v)
                      if (acc) return acc.name?.trim() || `${t('transactions.unnamed_account')} (${acc.type})`
                      const cc = creditCards.find((c) => c.id === v)
                      if (cc) return `${t('transactions.credit_prefix')} · ${cc.name}${cc.last_four ? ` ••${cc.last_four}` : ''}`
                      return t('transactions.select_account')
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name?.trim() || `${t('transactions.unnamed_account')} (${a.type})`}
                    </SelectItem>
                  ))}
                  {creditCards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {t('transactions.credit_prefix')} · {c.name}{c.last_four ? ` ••${c.last_four}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Source pill + Set-as-default link */}
              {!editingId && form.account_id && (
                <div className="flex items-center justify-between text-xs">
                  <span>
                    {accountSource === 'ai' && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                        style={{ background: 'var(--c-violet-soft)', color: 'var(--c-violet)' }}
                      >
                        <Sparkles className="size-3" /> {t('transactions.source_ai')}
                      </span>
                    )}
                    {accountSource === 'default' && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                        style={{ background: 'var(--sky-50)', color: 'var(--sky-600)' }}
                      >
                        <Star className="size-3" style={{ fill: 'var(--sky-600)' }} /> {t('transactions.source_default')}
                      </span>
                    )}
                    {accountSource === 'last_used' && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                        style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
                      >
                        {t('transactions.source_last_used')}
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
                      {settingDefault ? t('transactions.saving') : t('transactions.set_as_default')}
                    </button>
                  )}
                  {form.account_id === defaultAccountId && accountSource !== 'default' && (
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <Star className="size-3 fill-current" /> {t('transactions.default')}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Type — segmented colored chips */}
            <div className="grid gap-1.5">
              <Label>{t('transactions.label_type')}</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(TYPE_LABELS) as TransactionType[]).map((ty) => {
                  const active = form.type === ty
                  const c = TYPE_BADGE_STYLES[ty]
                  return (
                    <button
                      key={ty}
                      type="button"
                      onClick={() => setForm({ ...form, type: ty, category: '' })}
                      className="rounded-lg border py-2 text-xs font-semibold transition-colors"
                      style={active
                        ? { background: c.bg, color: c.color, borderColor: c.color }
                        : { background: 'var(--surface)', color: 'var(--ink-muted)', borderColor: 'var(--border-soft)' }}
                    >
                      {t(TYPE_LABEL_KEYS[ty])}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Category */}
            <div className="grid gap-1.5">
              <Label>{t('transactions.label_category')}</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v ?? '' })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('transactions.select_category')}>
                    {(v) => v || t('transactions.select_category')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {optionsForType(form.type).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.depth > 0 ? (
                        <span className="pl-3.5" style={{ color: 'var(--ink-muted)' }}>
                          ↳ {o.label}
                        </span>
                      ) : (
                        o.label
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="tx-desc">{t('transactions.label_description')}</Label>
              <Input
                id="tx-desc"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder={t('transactions.description_placeholder')}
              />
            </div>

            {/* Tags (opsional) — label lintas-kategori (Lebaran, Liburan, Renovasi…) */}
            <div className="grid gap-1.5">
              <Label htmlFor="tx-tags">{t('transactions.label_tag')} <span className="font-normal" style={{ color: 'var(--ink-soft)' }}>{t('transactions.optional')}</span></Label>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--c-violet-soft)', color: 'var(--c-violet)' }}>
                      {tag}
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== tag) })}
                        className="opacity-70 hover:opacity-100"
                        aria-label={`${t('transactions.remove_tag')} ${tag}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Input
                id="tx-tags"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    const tag = tagDraft.trim().replace(/,+$/, '').trim()
                    if (tag && !form.tags.includes(tag)) setForm({ ...form, tags: [...form.tags, tag] })
                    setTagDraft('')
                  }
                }}
                placeholder={t('transactions.tag_placeholder')}
              />
            </div>

            {/* Amount — prominent */}
            <div className="grid gap-1.5">
              <Label htmlFor="tx-amount">{t('transactions.label_amount')}</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-semibold" style={{ color: 'var(--ink-soft)' }}>Rp</span>
                <NumberInput
                  id="tx-amount"
                  value={form.amount}
                  onChange={(n) => setForm({ ...form, amount: n })}
                  placeholder="0"
                  className="h-12 pl-11 text-xl md:text-xl font-bold tabular-nums"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('transactions.cancel')}
            </Button>
            <Button
              className=""
              onClick={handleSave}
              disabled={saving}
            >
              {saving && <Loader2 className="size-4 animate-spin mr-1" />}
              {editingId ? t('transactions.save') : t('transactions.add')}
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
            <DialogTitle>{t('transactions.csv_title')}</DialogTitle>
            <DialogDescription>
              {t('transactions.csv_desc_prefix')} <span className="num">date/Tanggal</span>, <span className="num">description/Keterangan</span>, <span className="num">amount/Jumlah</span>. {t('transactions.csv_desc_suffix')}
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
                <Sparkles className="h-3 w-3 inline" /> {rules.filter((r) => r.is_active).length} {t('transactions.csv_rules_applied')}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                {t('transactions.csv_preview_prefix')} {importRows.length} {t('transactions.csv_preview_suffix')}
              </p>
              <div className="text-xs">
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 px-2 py-1 font-semibold border-b" style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-muted)' }}>
                  <div className="col-span-1">✓</div>
                  <div className="col-span-2">{t('transactions.col_date')}</div>
                  <div className="col-span-4">{t('transactions.col_description')}</div>
                  <div className="col-span-2">{t('transactions.col_type_category')}</div>
                  <div className="col-span-2">{t('transactions.col_account')}</div>
                  <div className="col-span-1 text-right">{t('transactions.col_amount')}</div>
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
                        style={{ accentColor: 'var(--c-mint)' }}
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
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportRows([]) }}>{t('transactions.cancel')}</Button>
            {importRows.length > 0 && (
              <Button onClick={commitImport} disabled={importing || importRows.filter((r) => r.apply).length === 0}>
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('transactions.import')} {importRows.filter((r) => r.apply).length} {t('transactions.transactions_word')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('transactions.transfer_title')}</DialogTitle>
            <DialogDescription>
              {t('transactions.transfer_desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t('transactions.from_account')}</Label>
                <Select value={transferForm.from_account_id} onValueChange={(v) => setTransferForm({ ...transferForm, from_account_id: v ?? '' })}>
                  <SelectTrigger><SelectValue placeholder={t('transactions.select')} /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name?.trim() || `${t('transactions.unnamed_account')} (${a.type})`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t('transactions.to_account')}</Label>
                <Select value={transferForm.to_account_id} onValueChange={(v) => setTransferForm({ ...transferForm, to_account_id: v ?? '' })}>
                  <SelectTrigger><SelectValue placeholder={t('transactions.select')} /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name?.trim() || `${t('transactions.unnamed_account')} (${a.type})`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t('transactions.amount_rp')}</Label>
                <NumberInput value={transferForm.amount} onChange={(n) => setTransferForm({ ...transferForm, amount: n })} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('transactions.label_date')}</Label>
                <Input type="date" value={transferForm.date} onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('transactions.notes')}</Label>
              <Input value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>{t('transactions.cancel')}</Button>
            <Button
              onClick={saveTransfer}
              disabled={transferSaving || !transferForm.from_account_id || !transferForm.to_account_id || transferForm.amount <= 0}
            >
              {transferSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('transactions.transfer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
