'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
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

type TransactionType = 'income' | 'expense' | 'saving' | 'investment'

const TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Pemasukan',
  expense: 'Pengeluaran',
  saving: 'Tabungan',
  investment: 'Investasi',
}

const TYPE_BADGE_COLORS: Record<TransactionType, string> = {
  income: 'bg-emerald-100 text-emerald-700',
  expense: 'bg-red-100 text-red-700',
  saving: 'bg-amber-100 text-amber-700',
  investment: 'bg-blue-100 text-blue-700',
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

    // Layer 2: User's saved default
    if (defaultAccountId && allAccounts.some((a) => a.id === defaultAccountId)) {
      return { id: defaultAccountId, source: 'default' }
    }

    // Layer 3: Last used (from most recent transaction)
    const lastTx = transactions.find((tx) => tx.account_id)
    if (lastTx?.account_id && allAccounts.some((a) => a.id === lastTx.account_id)) {
      return { id: lastTx.account_id, source: 'last_used' }
    }

    // Layer 4: First in list
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
      alert(`Gagal set default: ${error.message}`)
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
    if (transferForm.from_account_id === transferForm.to_account_id) { alert('Akun asal & tujuan tidak boleh sama'); return }
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
      alert('Belum ada akun. Bikin akun dulu di menu "Akun" sebelum mencatat transaksi.')
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

  async function handleSave() {
    // Client-side validation with clear messages
    if (!form.account_id) {
      alert('Pilih akun dulu sebelum simpan transaksi.')
      return
    }
    if (!form.category) {
      alert('Pilih kategori dulu sebelum simpan transaksi.')
      return
    }
    if (!form.amount || form.amount <= 0) {
      alert('Jumlah harus lebih dari 0.')
      return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

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
        alert(`Gagal upload struk ke Storage: ${upErr.message}\nTransaksi tetap disimpan tanpa foto.`)
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

    const { error: saveErr } = editingId
      ? await supabase.from('transactions').update(payload).eq('id', editingId)
      : await supabase.from('transactions').insert(payload)

    if (saveErr) {
      setSaving(false)
      alert(`Gagal simpan transaksi: ${saveErr.message}`)
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

  function getAccountName(accountId: string) {
    const acc = accounts.find((a) => a.id === accountId)
    if (acc) return acc.name
    const cc = creditCards.find((c) => c.id === accountId)
    if (cc) return `${cc.name}${cc.last_four ? ` ••${cc.last_four}` : ''}`
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
      <div className="dark-card p-6 sm:p-7">
        <p className="caps">Log Transaksi</p>
        <div className="mt-2 flex items-end gap-4">
          <h2 className="text-white text-3xl sm:text-4xl font-semibold tracking-tight">
            Semua Aktivitas Finansial
          </h2>
          <span className="accent-underline mb-2" />
        </div>
        <p className="text-sm mt-2" style={{ color: 'var(--on-black-mut)' }}>{today}</p>
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
              <SelectValue placeholder="Semua" />
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
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Akun</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
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
              <SelectValue placeholder="Semua" />
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
              <SelectValue placeholder="Semua" />
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

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin" style={{ color: 'var(--burgundy-700)' }} />
          <span className="ml-2 text-gray-500">Memuat data...</span>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Akun</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-400 py-10">
                  Tidak ada transaksi ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{formatDate(tx.date)}</TableCell>
                  <TableCell>{getAccountName(tx.account_id)}</TableCell>
                  <TableCell>
                    <Badge
                      className={TYPE_BADGE_COLORS[tx.type]}
                    >
                      {TYPE_LABELS[tx.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>{tx.category}</TableCell>
                  <TableCell>{tx.description}</TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      tx.type === 'income'
                        ? 'text-emerald-600'
                        : tx.type === 'expense'
                          ? 'text-red-600'
                          : 'text-gray-700'
                    }`}
                  >
                    {formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEditDialog(tx)}
                      >
                        <Pencil className="size-4 text-gray-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(tx.id)}
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
                            <div className="flex items-center gap-1 text-emerald-700">
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
                  <SelectValue placeholder="Pilih akun" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
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
                  <SelectValue placeholder="Pilih tipe" />
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
                  <SelectValue placeholder="Pilih kategori" />
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
                placeholder="Catatan transaksi"
              />
            </div>

            {/* Amount */}
            <div className="grid gap-1.5">
              <Label htmlFor="tx-amount">Jumlah (Rp)</Label>
              <Input
                id="tx-amount"
                type="number"
                min={0}
                value={form.amount || ''}
                onChange={(e) =>
                  setForm({ ...form, amount: Number(e.target.value) })
                }
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
                <div className="grid grid-cols-12 gap-1 px-2 py-1 font-semibold border-b" style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-muted)' }}>
                  <div className="col-span-1">✓</div>
                  <div className="col-span-2">Tanggal</div>
                  <div className="col-span-4">Deskripsi</div>
                  <div className="col-span-2">Tipe/Kategori</div>
                  <div className="col-span-2">Akun</div>
                  <div className="col-span-1 text-right">Jumlah</div>
                </div>
                {importRows.map((r, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1 px-2 py-1.5 border-b items-center" style={{ borderColor: 'var(--border-soft)' }}>
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
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Ke Akun</Label>
                <Select value={transferForm.to_account_id} onValueChange={(v) => setTransferForm({ ...transferForm, to_account_id: v ?? '' })}>
                  <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Jumlah (Rp)</Label>
                <Input type="number" min={0} value={transferForm.amount || ''} onChange={(e) => setTransferForm({ ...transferForm, amount: Number(e.target.value) || 0 })} />
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
