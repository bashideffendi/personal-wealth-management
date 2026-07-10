'use client'

import { useEffect, useState, useMemo, useDeferredValue, useRef, Fragment } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { notifyAICreditsChanged } from '@/components/layout/ai-credits-badge'
import {
  ReflectiveSpendingModal,
  shouldTriggerReflection,
} from '@/components/reflective/reflective-spending-modal'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { useCategoryOptions } from '@/lib/use-category-options'
import { useT, useI18n } from '@/lib/i18n/context'
import { formatDateShort } from '@/lib/i18n/dates'
import type { Transaction, Account, CreditCard, CategorizationRule } from '@/types'
import { RangePicker, type DateRange } from '@/components/transactions/range-picker'
import { CategoryIcon } from '@/components/transactions/category-icon'
import { categoryHue } from '@/lib/category-hue'
import { MobileMonthCalendar } from '@/components/transactions/mobile-month-calendar'
import { MobileStatsView } from '@/components/transactions/mobile-stats-view'
import { monthLong } from '@/lib/i18n/dates'
import { adjustCardBalance } from '@/lib/data/balances'

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
import { Pencil, Trash2, Plus, Loader2, ArrowLeftRight, Download, Upload, Sparkles, Camera, X, ScanLine, Star, Wallet, Search, ArrowDownToLine, ArrowUpFromLine, Hash, SlidersHorizontal, MoreHorizontal, Split } from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { toast } from 'sonner'

type TransactionType = 'income' | 'expense' | 'saving' | 'investment'

const TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Pemasukan',
  expense: 'Pengeluaran',
  saving: 'Tabungan',
  investment: 'Investasi',
}

// Semantic chips: mint=income, coral=expense, amber=saving, violet=investment.
// Foreground uses the -ink (AA-contrast) variants — the full-saturation hues fail
// WCAG AA on their own soft tints (amber worst, ~2:1).
const TYPE_BADGE_STYLES: Record<TransactionType, { bg: string; color: string }> = {
  income:     { bg: 'var(--c-mint-soft)',    color: 'var(--c-mint-ink)' },
  expense:    { bg: 'var(--c-coral-soft)',   color: 'var(--c-coral-ink)' },
  saving:     { bg: 'var(--c-amber-soft)',   color: 'var(--c-amber-ink)' },
  investment: { bg: 'var(--c-violet-soft)',  color: 'var(--c-violet-ink)' },
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

  async function handleCsvUpload(file: File) {
    // Lazy-load papaparse — cuma kepakai di handler import CSV ini,
    // gak perlu ikut bundle awal halaman transaksi.
    const Papa = (await import('papaparse')).default
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data.map((row) => {
          // Try to detect common column names (flexible)
          const desc = (row.description ?? row.Deskripsi ?? row.Description ?? row.Keterangan ?? row.keterangan ?? '').trim()
          const dateRaw = row.date ?? row.Tanggal ?? row.Date ?? row.tanggal ?? ''
          const amountRaw = row.amount ?? row.Jumlah ?? row.Amount ?? row.Nominal ?? '0'
          const amountSigned = Number(String(amountRaw).replace(/[^0-9.-]/g, '')) || 0
          const amount = Math.abs(amountSigned)
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
          // Expense if: a rule says so, OR the raw amount is negative, OR the
          // description has a whole-word debit cue. Anchored \b so "Checkout",
          // "Takeout", "payout" don't get misread as expenses.
          const isExpense = matched?.type === 'expense' || amountSigned < 0 || /\b(debit|keluar|withdraw|dr)\b/i.test(desc)
          return {
            date,
            description: desc,
            amount,
            type: (matched?.type ?? (isExpense ? 'expense' : 'income')) as 'income' | 'expense' | 'saving' | 'investment',
            category: matched?.category ?? (isExpense ? 'Lainnya' : 'Gaji'),
            account_id: accounts[0]?.id ?? creditCards[0]?.id ?? '',
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
    if (toInsert.length === 0) {
      setImporting(false)
      toast.warning(t('transactions.toast_no_eligible_rows'))
      return
    }
    const { error } = await supabase.from('transactions').insert(toInsert)
    setImporting(false)
    if (error) {
      toast.error(t('transactions.toast_import_failed'), { description: error.message })
      return
    }
    toast.success(`${toInsert.length} ${t('transactions.toast_imported')}`)
    setImportOpen(false)
    setImportRows([])
    fetchData()
  }
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
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

  // Lampiran struk transaksi lama — bucket 'receipts' privat, jadi buka lewat
  // signed URL berumur 1 jam di tab baru (path storage yang disimpan, bukan URL).
  async function openReceiptAttachment(path: string) {
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600)
    if (error || !data?.signedUrl) {
      toast.error(locale === 'id' ? 'Gagal membuka struk' : 'Failed to open receipt')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
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

  // Quick access transfer dari FAB (QuickAddLauncher):
  // (a) event 'klunting:open-transfer' — dipakai kalau user sudah di halaman ini;
  // (b) param ?transfer=1 — dipakai kalau FAB navigasi ke sini dulu. Param
  //     dibersihkan via history.replaceState (pola sama dgn PWA shortcut
  //     quickadd=1) biar refresh gak re-buka dialog & gak butuh Suspense
  //     boundary useSearchParams.
  useEffect(() => {
    function onOpenTransfer() {
      setTransferDialogOpen(true)
    }
    window.addEventListener('klunting:open-transfer', onOpenTransfer)

    const sp = new URLSearchParams(window.location.search)
    if (sp.get('transfer') === '1') {
      setTransferDialogOpen(true)
      sp.delete('transfer')
      const newQs = sp.toString()
      const newUrl = window.location.pathname + (newQs ? `?${newQs}` : '') + window.location.hash
      window.history.replaceState({}, '', newUrl)
    }

    return () => window.removeEventListener('klunting:open-transfer', onOpenTransfer)
  }, [])

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
    const { error: transferErr } = await supabase.from('transactions').insert([
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
    if (transferErr) {
      toast.error(t('transactions.toast_save_failed'), { description: transferErr.message })
      return
    }
    toast.success(t('transactions.toast_transfer_recorded'))
    setTransferDialogOpen(false)
    setTransferForm({
      date: new Date().toISOString().split('T')[0],
      from_account_id: '', to_account_id: '', amount: 0, notes: '',
    })
    fetchData()
  }

  function exportCSV(rows: Transaction[]) {
    const header = [t('transactions.col_date'), t('transactions.col_account'), t('transactions.col_type'), t('transactions.col_category'), t('transactions.col_description'), t('transactions.col_amount')]
    // Quote + escape EVERY cell (account/category are free-text too) and neutralize
    // spreadsheet formula injection (cells starting with =,+,-,@) with a leading quote.
    const cell = (v: unknown) => {
      let s = String(v ?? '')
      if (/^[=+\-@]/.test(s)) s = `'${s}`
      return `"${s.replace(/"/g, '""')}"`
    }
    const csvRows = [
      header,
      ...rows.map((tx) => [
        tx.date,
        getAccountName(tx.account_id),
        tx.type,
        tx.category,
        tx.description ?? '',
        String(tx.amount),
      ]),
    ]
    const csv = csvRows.map((r) => r.map(cell).join(',')).join('\n')
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
  // F12: kalender mobile — bulan yang dilihat + hari terpilih (filter list).
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [filterAccount, setFilterAccount] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterTag, setFilterTag] = useState<string>('all')
  const [search, setSearch] = useState<string>('')
  // Deep-link pencarian dari command palette (⌘K), pola sama dgn ?transfer=1:
  // (a) event 'klunting:search-transactions' — dipakai kalau user sudah di
  //     halaman ini (router.push ke route sama gak nge-remount, effect on-mount
  //     gak jalan lagi);
  // (b) param ?q=<term> — dipakai kalau palette navigasi ke sini dulu. Param
  //     dibersihkan via history.replaceState biar refresh gak nge-lock
  //     pencarian & gak butuh Suspense boundary useSearchParams.
  useEffect(() => {
    function onPaletteSearch(e: Event) {
      const q = (e as CustomEvent<string>).detail
      if (q) setSearch(q)
    }
    window.addEventListener('klunting:search-transactions', onPaletteSearch)

    const sp = new URLSearchParams(window.location.search)
    const q = sp.get('q')
    if (q) {
      setSearch(q)
      sp.delete('q')
      const newQs = sp.toString()
      const newUrl = window.location.pathname + (newQs ? `?${newQs}` : '') + window.location.hash
      window.history.replaceState({}, '', newUrl)
    }

    return () => window.removeEventListener('klunting:search-transactions', onPaletteSearch)
  }, [])
  // Quick-add inline row is hidden by default; the toolbar "+ Tambah" toggles it.
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  // Mobile chrome: filter grid collapsed by default; aksi sekunder toolbar masuk sheet "⋯".
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false)
  // F13c: toggle Catatan|Statistik ala app Budget (Record|Stats) — mobile only.
  // 'stats' hide kalender+search+list, tampilkan MobileStatsView bulan aktif.
  const [mobileView, setMobileView] = useState<'record' | 'stats'>('record')
  // Form "Tambah Cepat" muncul di bawah filter — scroll ke tengah pas dibuka
  // biar user gak ketinggalan / harus scroll cari sendiri.
  const quickAddRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showQuickAdd) return
    const id = setTimeout(() => quickAddRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
    return () => clearTimeout(id)
  }, [showQuickAdd])
  // Bulk edit + inline category (desktop table power features)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [inlineCatId, setInlineCatId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkCatOpen, setBulkCatOpen] = useState(false)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch saat ada mutasi data dari FAB/command palette.
  useEffect(() => {
    const h = () => { void fetchData() }
    window.addEventListener('klunting:data-changed', h)
    return () => window.removeEventListener('klunting:data-changed', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ⌘ on Mac, Ctrl elsewhere — the command palette binds metaKey || ctrlKey.
  const [isMac, setIsMac] = useState(false)
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent))
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

    // Fetch utama gagal = bilang terus terang, jangan render daftar kosong
    // seolah transaksinya memang nol.
    if (txRes.error || accRes.error) {
      setLoadError(true)
      setLoading(false)
      return
    }
    setLoadError(false)
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
    setNewSplitOn(false)
    setNewSplitRows(emptyNewSplitRows())
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
    setNewSplitOn(false)
    resetReceipt()
    setDialogOpen(true)
  }

  // ─── Pecah transaksi (split) ────────────────────────────────
  // 1 transaksi dipecah ke beberapa kategori: baris pertama nge-UPDATE
  // transaksi asli (id/struk/created_at kepertahan), sisanya INSERT baru;
  // semua bagian share satu split_group_id (migrasi 064). Total pecahan
  // WAJIB = jumlah asli, makanya saldo kartu kredit gak perlu di-adjust
  // (akun/tipe/total gak berubah). Label pakai literal locale ternary —
  // JANGAN nambah key ke messages.ts.
  const [splitDialogOpen, setSplitDialogOpen] = useState(false)
  const [splitRows, setSplitRows] = useState<{ category: string; amount: number }[]>([])
  const [splitSaving, setSplitSaving] = useState(false)
  const splitSourceTx = editingId ? transactions.find((x) => x.id === editingId) ?? null : null

  function openSplitDialog() {
    if (!splitSourceTx) return
    // Baris 1 prefilled kategori + jumlah TERSIMPAN — user tinggal mindahin
    // sebagian ke baris berikutnya sampai "Sisa" nol.
    setSplitRows([
      { category: splitSourceTx.category, amount: splitSourceTx.amount },
      { category: '', amount: 0 },
    ])
    setDialogOpen(false) // tutup dialog edit — hindari dialog numpuk
    setSplitDialogOpen(true)
  }

  function closeSplitDialog() {
    setSplitDialogOpen(false)
    setDialogOpen(true) // batal → balik ke dialog edit
  }

  const splitAllocated = splitRows.reduce((s, r) => s + r.amount, 0)
  const splitRemaining = (splitSourceTx?.amount ?? 0) - splitAllocated
  const splitValid =
    !!splitSourceTx &&
    splitRows.length >= 2 &&
    splitRows.every((r) => r.category && r.amount > 0) &&
    splitRemaining === 0

  async function saveSplit() {
    const tx = splitSourceTx
    if (!tx || !splitValid) return
    setSplitSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSplitSaving(false); return }

    const groupId = crypto.randomUUID()
    const base: Record<string, unknown> = {
      user_id: user.id,
      date: tx.date,
      account_id: tx.account_id,
      type: tx.type,
      description: tx.description,
    }
    const householdId = (tx as { household_id?: string | null }).household_id
    if (householdId) base.household_id = householdId
    if (tx.tags?.length) base.tags = tx.tags

    // INSERT bagian 2..N dulu, UPDATE transaksi asli (bagian 1) TERAKHIR:
    // kalau insert gagal → belum ada yang berubah; kalau update gagal →
    // hapus lagi baris yang barusan di-insert (best-effort rollback).
    const missingCol = (e: { code?: string; message?: string | null } | null) =>
      !!e && (e.code === '42703' || /column .*split_group_id.* does not exist/i.test(e.message ?? ''))
    const buildInserts = (withGroup: boolean) =>
      splitRows.slice(1).map((r) => ({
        ...base,
        category: r.category,
        amount: r.amount,
        ...(withGroup ? { split_group_id: groupId } : {}),
      }))
    let groupLinked = true
    let { data: insData, error: insErr } = await supabase
      .from('transactions').insert(buildInserts(true)).select('id')
    // Kolom belum ada (pre-migrasi 064) → retry tanpa split_group_id, biar
    // fitur tetap jalan; bagian pecahan cuma gak saling ter-link (pola sama
    // dgn retry tags pre-migrasi 038 di actuallySave).
    if (missingCol(insErr)) {
      groupLinked = false
      ;({ data: insData, error: insErr } = await supabase
        .from('transactions').insert(buildInserts(false)).select('id'))
    }
    if (insErr) {
      setSplitSaving(false)
      toast.error(locale === 'id' ? 'Gagal memecah transaksi' : 'Failed to split transaction', { description: insErr.message })
      return
    }
    const insertedIds = ((insData ?? []) as { id: string }[]).map((d) => d.id)

    const updPayload: Record<string, unknown> = { category: splitRows[0].category, amount: splitRows[0].amount }
    if (groupLinked) updPayload.split_group_id = groupId
    const { error: updErr } = await supabase.from('transactions').update(updPayload).eq('id', tx.id)
    if (updErr) {
      if (insertedIds.length) await supabase.from('transactions').delete().in('id', insertedIds)
      setSplitSaving(false)
      toast.error(locale === 'id' ? 'Gagal memecah transaksi' : 'Failed to split transaction', { description: updErr.message })
      return
    }

    setSplitSaving(false)
    setSplitDialogOpen(false) // sukses: dialog edit GAK dibuka lagi
    toast.success(locale === 'id'
      ? `Transaksi dipecah jadi ${splitRows.length} bagian`
      : `Transaction split into ${splitRows.length} parts`)
    fetchData()
  }

  // ─── Split saat TAMBAH (add-dialog) ─────────────────────────
  // Toggle "Bagi ke beberapa kategori" di dialog tambah: user isi TOTAL di
  // field Jumlah + beberapa baris {kategori, nominal, catatan opsional}.
  // Tiap baris disimpan sebagai transaksi PENUH yang share split_group_id
  // (migrasi 064) — jadi agregasi/anggaran/stats existing otomatis benar
  // tanpa diubah. Label literal locale ternary (JANGAN nambah key messages.ts).
  const emptyNewSplitRows = () => [
    { category: '', amount: 0, description: '' },
    { category: '', amount: 0, description: '' },
  ]
  const [newSplitOn, setNewSplitOn] = useState(false)
  const [newSplitRows, setNewSplitRows] = useState<{ category: string; amount: number; description: string }[]>(emptyNewSplitRows)
  const newSplitAllocated = newSplitRows.reduce((s, r) => s + r.amount, 0)
  const newSplitRemaining = form.amount - newSplitAllocated
  const newSplitReady =
    newSplitRows.length >= 2 &&
    newSplitRows.every((r) => r.category && r.amount > 0) &&
    form.amount > 0 &&
    newSplitRemaining === 0

  // Reflective spending (Kakeibo) — anti-impulse modal for big expenses
  const [reflectionOpen, setReflectionOpen] = useState(false)

  async function handleSave() {
    // Client-side validation with clear messages
    if (!form.account_id) {
      toast.error(t('transactions.toast_pick_account'))
      return
    }
    const splittingNew = newSplitOn && !editingId
    if (!splittingNew && !form.category) {
      toast.error(t('transactions.toast_pick_category'))
      return
    }
    if (!form.amount || form.amount <= 0) {
      toast.error(t('transactions.toast_amount_positive'))
      return
    }
    if (splittingNew && !newSplitReady) {
      // Tombol simpan harusnya udah disabled — toast ini backstop.
      toast.error(locale === 'id'
        ? 'Lengkapi baris split — jumlah semua potongan harus sama dengan total.'
        : 'Complete the split rows — all parts must add up to the total.')
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

    let saveErr: { code?: string; message?: string } | null = null

    if (newSplitOn && !editingId) {
      // SPLIT SAAT TAMBAH: satu belanja → N baris transaksi biasa (kategori +
      // nominal per potongan; date/akun/tipe sama) yang share split_group_id.
      const groupId = crypto.randomUUID()
      const buildRows = (withGroup: boolean) =>
        newSplitRows.map((r, i) => {
          const row: Record<string, unknown> = {
            user_id: user.id,
            date: form.date,
            account_id: form.account_id,
            type: form.type,
            category: r.category,
            description: r.description || form.description,
            amount: r.amount,
            ...(withGroup ? { split_group_id: groupId } : {}),
          }
          // Lampiran struk cuma di potongan pertama (satu foto = satu belanja).
          if (receiptPath && i === 0) row.receipt_url = receiptPath
          if (householdId) row.household_id = householdId
          if (tags.length) row.tags = tags
          return row
        })
      ;({ error: saveErr } = await supabase.from('transactions').insert(buildRows(true)))
      // Graceful pre-migrasi 064: kolom split_group_id belum ada (42703) →
      // fallback insert TANPA grup — potongan tetap kesimpan sebagai transaksi
      // terpisah, cuma gak ter-link (tiru pola auto_post di recurring/page.tsx).
      if (saveErr && (saveErr.code === '42703' || /column .*split_group_id.* does not exist/i.test(saveErr.message ?? ''))) {
        console.warn('[transactions] Kolom split_group_id belum ada (pre-migrasi 064) — simpan tanpa grup split:', saveErr.message)
        ;({ error: saveErr } = await supabase.from('transactions').insert(buildRows(false)))
      }
    } else {
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
      ;({ error: saveErr } = await saveTx())
      // Retry tanpa tags HANYA kalau errornya kolom-belum-ada (pre-migrasi 038),
      // bukan SEMUA error — biar tag user gak ke-buang diam-diam pas error lain (RLS/network).
      const isMissingTagsCol = !!saveErr && !!payload.tags &&
        (saveErr.code === '42703' || /column .*tags.* does not exist/i.test(saveErr.message ?? ''))
      if (isMissingTagsCol) {
        delete payload.tags
        ;({ error: saveErr } = await saveTx())
      }
    }

    if (saveErr) {
      setSaving(false)
      toast.error(t('transactions.toast_save_failed'), { description: saveErr.message })
      return
    }

    // Keep credit-card outstanding in sync — SYMMETRICALLY. A CC expense adds to
    // the card; editing or moving it must subtract the OLD contribution and add the
    // new one, else the balance only ever grows (it was add-on-create-only before).
    // Net per-card delta avoids a double-read race when one card is on both sides.
    const ccContribution = (txType: TransactionType, accountId: string, amount: number) =>
      txType === 'expense' && amount > 0 && creditCards.some((c) => c.id === accountId) ? amount : 0
    const prevTx = editingId ? transactions.find((tx) => tx.id === editingId) : null
    const cardDeltas: Record<string, number> = {}
    if (prevTx) {
      const old = ccContribution(prevTx.type, prevTx.account_id, prevTx.amount)
      if (old) cardDeltas[prevTx.account_id] = (cardDeltas[prevTx.account_id] ?? 0) - old
    }
    const nu = ccContribution(form.type, form.account_id, form.amount)
    if (nu) cardDeltas[form.account_id] = (cardDeltas[form.account_id] ?? 0) + nu
    let ccSyncFailed = false
    for (const [cardId, delta] of Object.entries(cardDeltas)) {
      if (delta === 0) continue
      const card = creditCards.find((c) => c.id === cardId)
      if (card) {
        const { ok: ccOk } = await adjustCardBalance(supabase, cardId, delta, card.current_balance)
        if (!ccOk) ccSyncFailed = true
      }
    }

    setSaving(false)
    setDialogOpen(false)
    // Surface kegagalan sync saldo kartu (jangan diam-diam — biar user bisa koreksi).
    if (ccSyncFailed) toast.warning('Transaksi tersimpan, tapi saldo kartu kredit gagal diperbarui. Cek & sesuaikan di halaman Kartu Kredit.')
    fetchData()
  }

  async function handleDelete(id: string) {
    if (!confirm(t('transactions.confirm_delete_tx'))) return
    const tx = transactions.find((x) => x.id === id)
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) { toast.error(t('transactions.toast_delete_failed'), { description: error.message }); return }
    // Reverse the CC outstanding this expense had added.
    if (tx && tx.type === 'expense' && creditCards.some((c) => c.id === tx.account_id)) {
      const card = creditCards.find((c) => c.id === tx.account_id)
      if (card) {
        const { ok: ccOk } = await adjustCardBalance(supabase, card.id, -tx.amount, card.current_balance)
        if (!ccOk) toast.warning('Transaksi dihapus, tapi saldo kartu kredit gagal diperbarui. Cek di halaman Kartu Kredit.')
      }
    }
    toast.success(t('transactions.toast_deleted'))
    fetchData()
  }

  // ─── Bulk edit + inline category ────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return
    // Only act on rows still VISIBLE under the current filter — selection persists
    // across filter changes, so without this a narrowed filter would still delete
    // the now-hidden rows the user can no longer see.
    const ids = [...selectedIds].filter((id) => filteredTransactions.some((tx) => tx.id === id))
    if (ids.length === 0) { setSelectedIds(new Set()); return }
    if (!confirm(t('transactions.bulk_delete_confirm'))) return
    setBulkBusy(true)
    const removed = transactions.filter((tx) => ids.includes(tx.id))
    const { error } = await supabase.from('transactions').delete().in('id', ids)
    setBulkBusy(false)
    if (error) { toast.error(t('transactions.toast_delete_failed'), { description: error.message }); return }
    // Reverse CC outstanding for every deleted expense (net per card).
    const cardDeltas: Record<string, number> = {}
    for (const tx of removed) {
      if (tx.type === 'expense' && creditCards.some((c) => c.id === tx.account_id)) {
        cardDeltas[tx.account_id] = (cardDeltas[tx.account_id] ?? 0) - tx.amount
      }
    }
    let ccSyncFailed = false
    for (const [cardId, delta] of Object.entries(cardDeltas)) {
      const card = creditCards.find((c) => c.id === cardId)
      if (card && delta !== 0) {
        const { ok: ccOk } = await adjustCardBalance(supabase, cardId, delta, card.current_balance)
        if (!ccOk) ccSyncFailed = true
      }
    }
    if (ccSyncFailed) toast.warning('Saldo kartu kredit gagal diperbarui untuk sebagian item. Cek di halaman Kartu Kredit.')
    toast.success(`${ids.length} ${t('transactions.bulk_deleted')}`)
    setSelectedIds(new Set())
    fetchData()
  }

  async function bulkSetCategory(category: string) {
    if (selectedIds.size === 0 || !category) return
    const ids = [...selectedIds].filter((id) => filteredTransactions.some((tx) => tx.id === id))
    if (ids.length === 0) { setSelectedIds(new Set()); return }
    setBulkBusy(true)
    const { error } = await supabase.from('transactions').update({ category }).in('id', ids)
    setBulkBusy(false)
    if (error) { toast.error(t('transactions.toast_save_failed_short'), { description: error.message }); return }
    toast.success(t('transactions.bulk_recategorized'))
    setSelectedIds(new Set())
    fetchData()
  }

  async function inlineSetCategory(id: string, category: string) {
    setInlineCatId(null)
    const { error } = await supabase.from('transactions').update({ category }).eq('id', id)
    if (error) { toast.error(t('transactions.toast_save_failed_short'), { description: error.message }); return }
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

  // Filter logic — memoized + deferred search so typing stays smooth on big lists
  // (was re-filtering every row AND rebuilding an Intl currency string per row on
  // every keystroke). Dates parsed as LOCAL midnight to match the picker's bounds.
  const deferredSearch = useDeferredValue(search)
  const filteredTransactions = useMemo(() => transactions.filter((tx) => {
    if (dateRange) {
      const [yy, mm, dd] = tx.date.split('-').map(Number)
      const d = new Date(yy, (mm || 1) - 1, dd || 1)
      if (d < dateRange.from || d > dateRange.to) return false
    }
    if (filterAccount !== 'all' && tx.account_id !== filterAccount) return false
    if (filterType !== 'all' && tx.type !== filterType) return false
    if (filterCategory !== 'all' && tx.category !== filterCategory) return false
    if (filterTag !== 'all' && !(tx.tags ?? []).includes(filterTag)) return false
    const q = deferredSearch.trim().toLowerCase()
    if (q) {
      const hay = `${tx.description ?? ''} ${tx.category} ${tx.amount}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }), [transactions, dateRange, filterAccount, filterType, filterCategory, filterTag, deferredSearch])

  // F12: data kalender mobile — net per hari + total bulan yang dilihat.
  // Dari SEMUA transaksi (independen filter); Transfer & saving/investment
  // di-skip dari sel (ikut konvensi ringkasan masuk/keluar).
  const calData = useMemo(() => {
    const ym = `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, '0')}`
    const perDay = new Map<string, number>()
    let income = 0
    let expense = 0
    for (const tx of transactions) {
      if (tx.category === 'Transfer' || !tx.date.startsWith(ym)) continue
      if (tx.type === 'income') {
        income += tx.amount
        perDay.set(tx.date, (perDay.get(tx.date) ?? 0) + tx.amount)
      } else if (tx.type === 'expense') {
        expense += tx.amount
        perDay.set(tx.date, (perDay.get(tx.date) ?? 0) - tx.amount)
      }
    }
    return { perDay, income, expense }
  }, [transactions, calMonth])

  // F13c: transaksi bulan kalender aktif — input MobileStatsView (agregasi
  // per kategori dihitung internal komponen; Transfer di-skip di sana).
  const statsMonthTx = useMemo(() => {
    const ym = `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, '0')}`
    return transactions.filter((tx) => tx.date.startsWith(ym))
  }, [transactions, calMonth])

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

  const allVisibleSelected =
    filteredTransactions.length > 0 && filteredTransactions.every((tx) => selectedIds.has(tx.id))
  function toggleSelectAll() {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(filteredTransactions.map((tx) => tx.id)))
  }
  const allCategoryOptions: string[] = [
    ...new Set(
      (['income', 'expense', 'saving', 'investment'] as TransactionType[]).flatMap((ty) =>
        optionsForType(ty).map((o) => o.value),
      ),
    ),
  ]

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

  return (
    <div className="space-y-4">
      {/* Quiet header (Monarch/YNAB minimal-chrome) — compact label + ⓘ tooltip,
          primary action + overflow on the right. Orientation via top-nav. */}
      <QuietPageHeader
        title={t('transactions.page_title')}
        info={t('transactions.page_subtitle')}
        actions={
          <>
            {/* Quick actions — desktop: tombol terlihat semua; mobile: masuk sheet "⋯"
                (5 tombol wrap 2-3 baris di 375px = toolbar web, bukan app-bar). */}
            <div className="hidden sm:contents">
              <Link href="/dashboard/transactions/import">
                <Button variant="outline" size="sm">
                  <Sparkles className="size-4" data-icon="inline-start" /> {t('transactions.import_ai')}
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="size-4" data-icon="inline-start" /> {t('transactions.import_csv')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCSV(filteredTransactions)} disabled={filteredTransactions.length === 0}>
                <Download className="size-4" data-icon="inline-start" /> {t('transactions.export_csv')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setTransferDialogOpen(true)}>
                <ArrowLeftRight className="size-4" data-icon="inline-start" /> {t('transactions.transfer')}
              </Button>
            </div>
            <Button variant="outline" size="sm" className="sm:hidden" aria-label={t('transactions.actions_sheet_title')} onClick={() => setActionsSheetOpen(true)}>
              <MoreHorizontal className="size-4" />
            </Button>

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

      {/* Sheet aksi sekunder (mobile) — isi = tombol yang di desktop tampil di header */}
      <BottomSheet open={actionsSheetOpen} onOpenChange={setActionsSheetOpen} title={t('transactions.actions_sheet_title')}>
        <div className="pb-2">
          {[
            { icon: Sparkles, label: t('transactions.import_ai'), onClick: () => { setActionsSheetOpen(false); window.location.href = '/dashboard/transactions/import' } },
            { icon: Upload, label: t('transactions.import_csv'), onClick: () => { setActionsSheetOpen(false); setImportOpen(true) } },
            { icon: Download, label: t('transactions.export_csv'), onClick: () => { setActionsSheetOpen(false); exportCSV(filteredTransactions) }, disabled: filteredTransactions.length === 0 },
            { icon: ArrowLeftRight, label: t('transactions.transfer'), onClick: () => { setActionsSheetOpen(false); setTransferDialogOpen(true) } },
          ].map((a, i) => (
            <button
              key={a.label}
              type="button"
              disabled={a.disabled}
              onClick={a.onClick}
              className="w-full flex items-center gap-3 px-2 text-left disabled:opacity-40"
              style={{ minHeight: 52, borderTop: i ? '1px solid var(--border-soft)' : 'none' }}
            >
              <span className="grid place-items-center size-8 rounded-lg shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                <a.icon className="size-4" />
              </span>
              <span className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>{a.label}</span>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* F12: kalender bulan ala Budget (mobile) — gantiin chip bulan F9c.
          Kalender = lensa (gak nyentuh dateRange); tap tanggal → list di
          bawah difilter ke hari itu. Data sel dari SEMUA transaksi. */}
      <div className={mobileView === 'stats' ? 'hidden' : 'md:hidden'}>
        <MobileMonthCalendar
          monthDate={calMonth}
          data={calData}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onPrev={() => { setSelectedDay(null); setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1)) }}
          onNext={() => { setSelectedDay(null); setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1)) }}
          locale={locale}
          labels={{
            income: t('transactions.summary_income'),
            expense: t('transactions.summary_expense'),
            net: t('transactions.summary_net_cashflow'),
          }}
        />
      </div>

      {/* F13c: panel Statistik (mobile) — gantiin kalender+search+list pas
          toggle di posisi Statistik. Data = bulan kalender aktif (calMonth). */}
      {mobileView === 'stats' && !loading && !loadError && (
        <div className="md:hidden">
          <MobileStatsView
            transactions={statsMonthTx}
            monthLabel={`${monthLong(calMonth.getMonth(), locale)} ${calMonth.getFullYear()}`}
          />
        </div>
      )}

      {/* Ikhtisar — strip tipis (density-first), bukan 4 kartu gede */}
      {!loading && filteredTransactions.length > 0 && (() => {
        const inc = filteredTransactions.filter((t) => t.type === 'income' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0)
        const exp = filteredTransactions.filter((t) => t.type === 'expense' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0)
        const net = filteredTransactions.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
        // Angka compact ala kpi-card Beranda — full digit tetap kebaca via title.
        const stats = [
          { label: t('transactions.summary_income'), dot: 'var(--c-mint)', Icon: ArrowDownToLine, val: formatCompactCurrency(inc), full: formatCurrency(inc) as string | undefined, color: 'var(--ink)' },
          { label: t('transactions.summary_expense'), dot: 'var(--c-coral)', Icon: ArrowUpFromLine, val: formatCompactCurrency(exp), full: formatCurrency(exp) as string | undefined, color: 'var(--ink)' },
          { label: t('transactions.summary_net_cashflow'), dot: net >= 0 ? 'var(--c-mint)' : 'var(--c-coral)', Icon: ArrowLeftRight, val: `${net >= 0 ? '+' : '−'}${formatCompactCurrency(Math.abs(net))}`, full: `${net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(net))}` as string | undefined, color: net >= 0 ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' },
          { label: t('transactions.summary_total_count'), dot: 'var(--c-violet)', Icon: Hash, val: String(filteredTransactions.length), full: undefined as string | undefined, color: 'var(--ink)' },
        ]
        return (
          <>
            {/* F12: ringkasan mobile pindah ke footer kalender — di sini
                cuma versi desktop */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border px-4 py-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2.5">
                    <span className="grid place-items-center shrink-0" style={{ width: 32, height: 32, borderRadius: 9, background: `color-mix(in srgb, ${s.dot} 15%, var(--surface))`, color: s.dot }}>
                      <s.Icon className="size-4" />
                    </span>
                    <span className="text-[11px] font-medium leading-tight" style={{ color: 'var(--ink-muted)' }}>{s.label}</span>
                  </div>
                  <p className="num tabular font-semibold mt-2" title={s.full} style={{ fontSize: 19, letterSpacing: '-0.02em', color: s.color }}>{s.val}</p>
                </div>
              ))}
            </div>
          </>
        )
      })()}

      {!loading && accounts.length === 0 && creditCards.length === 0 && (
        <div className="flex items-start gap-3 rounded-lg border p-4" style={{ background: 'var(--c-amber-soft)', borderColor: 'color-mix(in srgb, var(--c-amber) 35%, transparent)' }}>
          <Wallet className="size-5 shrink-0 mt-0.5" style={{ color: 'var(--c-amber-ink)' }} />
          <div className="flex-1 text-sm">
            <p className="font-medium" style={{ color: 'var(--ink)' }}>{t('transactions.no_account_title')}</p>
            <p className="mt-1" style={{ color: 'var(--ink-muted)' }}>
              {t('transactions.no_account_desc')}
            </p>
            <Link
              href="/dashboard/accounts"
              className="mt-2 inline-flex items-center gap-1 font-semibold hover:underline"
              style={{ color: 'var(--c-amber-ink)' }}
            >
              {t('transactions.create_first_account')} →
            </Link>
          </div>
        </div>
      )}

      {/* Search + filters — satu card: search di atas, filter di bawahnya.
          Mobile: grid filter collapsed (panel 4 dropdown makan setengah layar) —
          toggle lewat tombol "Filter (n)" di samping search. Desktop: selalu tampil. */}
      <div className={`rounded-xl border p-3 ${mobileView === 'stats' ? 'hidden md:block' : ''}`} style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ink-soft)' }} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('transactions.search_placeholder')}
              aria-label={t('transactions.search_placeholder')}
              className="h-9 w-full pl-9 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="sm:hidden h-9 shrink-0"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <SlidersHorizontal className="size-4" data-icon="inline-start" />
            {t('transactions.filter_button')}
            {activeFilterCount > 0 && <span className="num">({activeFilterCount})</span>}
          </Button>
        </div>
        <div className={`${filtersOpen ? 'grid' : 'hidden sm:grid'} w-full grid-cols-2 gap-3 sm:grid-cols-4 ${allTags.length > 0 ? 'xl:grid-cols-5' : ''} mt-3`}>
        <div className="flex flex-col gap-1">
          <label className="eyebrow" style={{ fontSize: '0.625rem' }}>{t('transactions.filter_range')}</label>
          <RangePicker value={dateRange} onChange={setDateRange} />
        </div>

        <div className="flex flex-col gap-1">
          <label id="flt-account-label" className="eyebrow" style={{ fontSize: '0.625rem' }}>{t('transactions.filter_account')}</label>
          <Select value={filterAccount} onValueChange={(v) => setFilterAccount(v ?? 'all')}>
            <SelectTrigger aria-labelledby="flt-account-label" className="w-full">
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
          <label id="flt-type-label" className="eyebrow" style={{ fontSize: '0.625rem' }}>{t('transactions.filter_type')}</label>
          <Select value={filterType} onValueChange={(v) => { setFilterType(v ?? 'all'); setFilterCategory('all') }}>
            <SelectTrigger aria-labelledby="flt-type-label" className="w-full">
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
          <label id="flt-category-label" className="eyebrow" style={{ fontSize: '0.625rem' }}>{t('transactions.filter_category')}</label>
          <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v ?? 'all')}>
            <SelectTrigger aria-labelledby="flt-category-label" className="w-full">
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
            <label id="flt-tag-label" className="eyebrow" style={{ fontSize: '0.625rem' }}>{t('transactions.filter_tag')}</label>
            <Select value={filterTag} onValueChange={(v) => setFilterTag(v ?? 'all')}>
              <SelectTrigger aria-labelledby="flt-tag-label" className="w-full">
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
            style={{ color: 'var(--c-primary-ink)' }}
          >
            <X className="size-3.5" /> {t('transactions.reset_filters')}
          </button>
        )}
      </div>

      {/* Quick-add inline row — toggled by the toolbar "+ Tambah" (hidden by default).
          Fast path: Tab between fields, Enter to submit. Full modal (struk OCR + tags)
          via the "Detail" button. */}
      {showQuickAdd && !loading && accounts.length + creditCards.length > 0 && (
        <div ref={quickAddRef} className="rounded-xl border bg-[var(--surface)] p-3" style={{ borderColor: 'var(--accent, var(--c-mint))' }}>
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
              aria-label={t('transactions.label_date')}
              className="h-9 w-full text-sm col-span-1 sm:col-span-2 min-w-0"
            />
            {/* Account */}
            <Select
              value={quickForm.account_id}
              onValueChange={(v) => setQuickForm({ ...quickForm, account_id: v ?? '' })}
            >
              <SelectTrigger aria-label={t('transactions.account')} className="h-9 w-full text-sm col-span-1 sm:col-span-2 min-w-0">
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
              <SelectTrigger aria-label={t('transactions.filter_type')} className="h-9 w-full text-sm col-span-1 sm:col-span-2 min-w-0">
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
              <SelectTrigger aria-label={t('transactions.filter_category')} className="h-9 w-full text-sm col-span-1 sm:col-span-2 min-w-0">
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
              aria-label={t('transactions.col_description')}
              className="h-9 col-span-2 sm:col-span-2 min-w-0"
            />
            {/* Amount */}
            <NumberInput
              value={quickForm.amount}
              onChange={(n) => setQuickForm({ ...quickForm, amount: n })}
              placeholder={t('transactions.amount')}
              aria-label={t('transactions.amount')}
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
          {/* Tip shortcut keyboard cuma relevan di desktop; di HP arahkan ke tombol +. */}
          <p className="hidden sm:block text-[10px] mt-1.5 px-1" style={{ color: 'var(--ink-soft)' }}>
            {t('transactions.quick_add_tip_prefix')} <kbd className="font-mono px-1 rounded" style={{ background: 'var(--surface-2)' }}>{isMac ? '⌘K' : 'Ctrl K'}</kbd> {t('transactions.quick_add_tip_suffix')}
          </p>
          <p className="sm:hidden text-[10px] mt-1.5 px-1" style={{ color: 'var(--ink-soft)' }}>
            {t('transactions.quick_add_tip_mobile')}
          </p>
        </div>
      )}

      {/* Bulk-action bar — appears when rows are selected (desktop) */}
      {selectedIds.size > 0 && (
        <div className="hidden md:flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2" style={{ background: 'var(--surface)', borderColor: 'var(--c-primary)' }}>
          <span className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
            {selectedIds.size} {t('transactions.selected_count')}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Popover.Root open={bulkCatOpen} onOpenChange={setBulkCatOpen}>
              <Popover.Trigger
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] transition-colors hover:bg-[var(--surface-2)]"
                style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: 'var(--surface)' }}
              >
                <Pencil className="size-3.5" style={{ color: 'var(--ink-soft)' }} /> {t('transactions.bulk_recategorize')}
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
                  <Popover.Popup className="max-h-72 overflow-y-auto rounded-xl border p-1.5 outline-none" style={{ background: 'var(--surface)', borderColor: 'var(--outline)', width: 220, boxShadow: 'var(--card-shadow)' }}>
                    {allCategoryOptions.map((c) => (
                      <button key={c} type="button" onClick={() => { setBulkCatOpen(false); void bulkSetCategory(c) }} className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--surface-2)]" style={{ color: 'var(--ink-muted)' }}>
                        {c}
                      </button>
                    ))}
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
            <button
              type="button"
              onClick={() => void bulkDelete()}
              disabled={bulkBusy}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors disabled:opacity-50"
              style={{ borderColor: 'var(--c-coral)', color: 'var(--c-coral-ink)', background: 'var(--surface)' }}
            >
              {bulkBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} {t('transactions.bulk_delete')}
            </button>
            <button type="button" onClick={() => setSelectedIds(new Set())} className="px-2 text-[13px] font-medium" style={{ color: 'var(--ink-muted)' }}>
              {t('transactions.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Transactions list — table on md+, cards on mobile */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin" style={{ color: 'var(--ink)' }} />
          <span className="ml-2" style={{ color: 'var(--ink-soft)' }}>{t('transactions.loading')}</span>
        </div>
      ) : loadError ? (
        <div className="s-card flex flex-col items-center text-center py-14 px-8 gap-3">
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{t('common.load_failed')}</p>
          <Button variant="outline" onClick={() => { setLoading(true); void fetchData() }}>{t('common.retry')}</Button>
        </div>
      ) : filteredTransactions.length === 0 ? (
        // Empty state — clean centered card with icon + headline + sub
        // (di mobile mode Statistik: hide — panel stats punya empty message sendiri)
        <div className={`s-card ${mobileView === 'stats' ? 'hidden md:flex' : 'flex'} flex-col items-center text-center py-16 px-8`}>
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
          {/* Desktop: per-day grouped table, in a card.
              JANGAN overflow-hidden di sini — ancestor overflow!=visible
              mematahkan position:sticky thead (bug 2026-06-13). */}
          <div className="hidden md:block s-card" style={{ padding: 0, borderColor: 'var(--border)', boxShadow: 'none' }}>
            {/* Mengalir penuh — thead sticky nempel di bawah TopNav (.tx-scroll
                di globals), jadi header kolom gak ikut ter-scroll. */}
            <div className="tx-scroll">
            <Table className="border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '4%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <TableHeader>
                <TableRow className="bg-[var(--surface-2)] hover:bg-[var(--surface-2)]">
                  <TableHead className="pl-3 pr-0">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label={t('transactions.select_all')} style={{ accentColor: 'var(--c-primary)', width: 15, height: 15, cursor: 'pointer' }} />
                  </TableHead>
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
                          colSpan={7}
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
                                <span className="num tabular-nums" style={{ color: net >= 0 ? 'var(--c-mint)' : 'var(--ink-muted)' }}>
                                  {t('transactions.net')} {net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(net))}
                                </span>
                              )
                            })()}
                          </div>
                        </TableCell>
                      </TableRow>
                      {g.items.map((tx) => {
                        const selected = selectedIds.has(tx.id)
                        return (
                        <TableRow key={tx.id} className="tx-row border-[color:var(--border-soft)]" style={selected ? { background: 'color-mix(in srgb, var(--c-mint) 16%, var(--surface))' } : undefined}>
                          <TableCell className="pl-3 pr-0">
                            <input type="checkbox" checked={selected} onChange={() => toggleSelect(tx.id)} aria-label={t('transactions.select_row')} style={{ accentColor: 'var(--c-primary)', width: 15, height: 15, cursor: 'pointer' }} />
                          </TableCell>
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
                            <Popover.Root open={inlineCatId === tx.id} onOpenChange={(o) => setInlineCatId(o ? tx.id : null)}>
                              <Popover.Trigger className="flex items-center gap-2 -ml-1 rounded-md px-1 py-0.5 transition-colors hover:bg-[var(--surface-3)]" title={t('transactions.edit_category_inline')} aria-label={`${tx.category} — ${t('transactions.edit_category_inline')}`}>
                                <span className="grid size-7 shrink-0 place-items-center rounded-full" style={{ background: TYPE_BADGE_STYLES[tx.type].bg, color: TYPE_BADGE_STYLES[tx.type].color }}>
                                  <CategoryIcon category={tx.category} className="size-3.5" />
                                </span>
                                {tx.category}
                              </Popover.Trigger>
                              <Popover.Portal>
                                <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
                                  <Popover.Popup className="max-h-72 overflow-y-auto rounded-xl border p-1.5 outline-none" style={{ background: 'var(--surface)', borderColor: 'var(--outline)', width: 220, boxShadow: 'var(--card-shadow)' }}>
                                    {optionsForType(tx.type).map((o) => (
                                      <button
                                        key={o.value}
                                        type="button"
                                        onClick={() => inlineSetCategory(tx.id, o.value)}
                                        className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--surface-2)]"
                                        style={{ color: o.value === tx.category ? 'var(--ink)' : 'var(--ink-muted)', fontWeight: o.value === tx.category ? 600 : 400, paddingLeft: o.depth > 0 ? 22 : 10 }}
                                      >
                                        {o.depth > 0 ? `↳ ${o.label}` : o.label}
                                      </button>
                                    ))}
                                  </Popover.Popup>
                                </Popover.Positioner>
                              </Popover.Portal>
                            </Popover.Root>
                          </TableCell>
                          <TableCell className="text-[13px]" style={{ color: 'var(--ink)' }}>
                            {tx.description}
                            {/* Penanda hasil Pecah Transaksi (migrasi 064) */}
                            {tx.split_group_id && (
                              <span
                                className="ml-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium align-middle"
                                style={{ background: 'var(--c-violet-soft)', color: 'var(--c-violet-ink)' }}
                                title={locale === 'id' ? 'Bagian dari transaksi yang dipecah' : 'Part of a split transaction'}
                              >
                                <Split className="size-2.5" /> {locale === 'id' ? 'Pecahan' : 'Split'}
                              </span>
                            )}
                            {tx.tags && tx.tags.length > 0 && (
                              <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                                {tx.tags.slice(0, 2).map((tg) => (
                                  <span key={tg} className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                                    {tg}
                                  </span>
                                ))}
                                {tx.tags.length > 2 && (
                                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>
                                    +{tx.tags.length - 2}
                                  </span>
                                )}
                              </span>
                            )}
                          </TableCell>
                          <TableCell
                            className={`num text-right text-[13px] font-medium tabular-nums whitespace-nowrap ${
                              tx.type === 'income'
                                ? 'text-[var(--c-mint-ink)]'
                                : tx.type === 'expense'
                                  ? 'text-[var(--c-coral-ink)]'
                                  : 'text-[var(--ink)]'
                            }`}
                          >
                            {formatCurrency(tx.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon-sm" aria-label={`${t('transactions.edit_transaction')}: ${tx.description || tx.category}`} onClick={() => openEditDialog(tx)}>
                                <Pencil className="size-4" style={{ color: 'var(--ink-soft)' }} />
                              </Button>
                              <Button variant="ghost" size="icon-sm" aria-label={`${t('transactions.delete')}: ${tx.description || tx.category}`} onClick={() => handleDelete(tx.id)}>
                                <Trash2 className="size-4" style={{ color: 'var(--c-coral-ink)' }} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        )
                      })}
                    </Fragment>
                  ))
                })()}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent" style={{ background: 'var(--surface-2)' }}>
                  <TableCell colSpan={5} className="text-[12px] font-semibold" style={{ color: 'var(--ink-muted)' }}>
                    {t('transactions.total')} · {filteredTransactions.length} {t('transactions.transactions_word')}
                  </TableCell>
                  <TableCell className="num text-right text-[13px] font-bold tabular-nums">
                    {(() => {
                      const n = filteredTransactions.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
                      return <span style={{ color: n >= 0 ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>{n >= 0 ? '+' : '−'}{formatCurrency(Math.abs(n))}</span>
                    })()}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
            </div>
          </div>

          {/* Mobile (F9c): grouped per HARI — header tanggal + net harian nempel
              kanvas, baris dalam kartu per hari (pola app keuangan native).
              Tap baris = edit; tombol hapus kecil di kanan (stopPropagation).
              F13c: di mode Statistik list di-hide (diganti MobileStatsView). */}
          <div className={mobileView === 'stats' ? 'hidden' : 'md:hidden'}>
            {(() => {
              const byDate = new Map<string, typeof filteredTransactions>()
              for (const tx of filteredTransactions) {
                const arr = byDate.get(tx.date)
                if (arr) arr.push(tx)
                else byDate.set(tx.date, [tx])
              }
              // F12: tap tanggal di kalender → cuma hari itu yang tampil.
              const dates = [...byDate.keys()]
                .filter((d) => !selectedDay || d === selectedDay)
                .sort((a, b) => (a < b ? 1 : -1))
              if (dates.length === 0) {
                return (
                  <p className="text-[12.5px] text-center py-8" style={{ color: 'var(--ink-soft)' }}>
                    {t('transactions.empty_title')}
                  </p>
                )
              }
              return dates.map((date) => {
                const items = byDate.get(date)!
                const net = items.reduce((s, x) => s + (x.type === 'income' ? x.amount : x.type === 'expense' ? -x.amount : 0), 0)
                return (
                  <div key={date}>
                    <div className="flex items-baseline justify-between px-1 mt-3 mb-1.5">
                      <span className="text-[11.5px] font-medium" style={{ color: 'var(--ink-soft)' }}>
                        {new Date(`${date}T00:00:00`).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                      </span>
                      {net !== 0 && (
                        <span className="num tabular text-[11.5px] font-medium" style={{ color: 'var(--ink-soft)' }}>
                          {net > 0 ? '+' : '−'}{formatCompactCurrency(Math.abs(net))}
                        </span>
                      )}
                    </div>
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                      {items.map((tx, i) => {
                        // AA-contrast ink variants; saving/investment stay neutral.
                        const amountColor = tx.type === 'income'
                          ? 'var(--c-mint-ink)'
                          : tx.type === 'expense'
                            ? 'var(--c-coral-ink)'
                            : 'var(--ink)'
                        // F10: chip ikon = hue KATEGORI (konsisten Beranda/Anggaran);
                        // pemasukan tetap mint (semantik masuk lebih penting).
                        const hue = categoryHue(tx.category)
                        const tint = tx.type === 'income'
                          ? { bg: 'var(--c-mint-soft)', color: 'var(--c-mint-ink)' }
                          : { bg: hue.soft, color: hue.ink }
                        return (
                          <div
                            key={tx.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => openEditDialog(tx)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditDialog(tx) } }}
                            aria-label={`${t('transactions.edit')}: ${tx.description || tx.category}`}
                            className="flex items-center gap-3 px-3.5 transition-colors active:bg-[var(--surface-2)] cursor-pointer"
                            style={{ minHeight: 54, borderTop: i ? '1px solid var(--border-soft)' : 'none' }}
                          >
                            <div
                              className="grid place-items-center shrink-0"
                              style={{ width: 30, height: 30, borderRadius: 8, background: tint.bg, color: tint.color }}
                            >
                              <CategoryIcon category={tx.category} className="size-[15px]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[14px] font-medium truncate leading-tight" style={{ color: 'var(--ink)' }}>
                                {tx.split_group_id && (
                                  <span className="mr-1 inline-flex items-center rounded-full px-1.5 align-middle text-[9px] font-semibold uppercase" style={{ background: 'var(--c-violet-soft)', color: 'var(--c-violet-ink)' }}>
                                    {locale === 'id' ? 'Pecahan' : 'Split'}
                                  </span>
                                )}
                                {tx.description || tx.category}
                              </p>
                              <p className="text-[11px] truncate leading-tight mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                                {/* Ikon kecil = bagian dari transaksi yang dipecah */}
                                {tx.split_group_id && (
                                  <Split className="size-3 inline align-[-2px] mr-1" aria-hidden style={{ color: 'var(--c-violet)' }} />
                                )}
                                {tx.category} · {getAccountName(tx.account_id)}
                              </p>
                            </div>
                            <p className="num text-[14px] font-semibold tabular-nums leading-tight shrink-0" style={{ color: amountColor }}>
                              {tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''}{formatCurrency(tx.amount)}
                            </p>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDelete(tx.id) }}
                              aria-label={`${t('transactions.delete')}: ${tx.description || tx.category}`}
                              className="grid place-items-center size-7 rounded-md shrink-0 -mr-1 transition-colors active:bg-[var(--surface-2)]"
                              style={{ color: 'var(--ink-soft)' }}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: TYPE_BADGE_STYLES[form.type].bg }}><Wallet className="size-5" style={{ color: TYPE_BADGE_STYLES[form.type].color }} /></div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>{editingId ? t('transactions.dialog_edit_title') : t('transactions.dialog_add_title')}</DialogTitle>
                <DialogDescription>{editingId ? t('transactions.dialog_edit_desc') : t('transactions.dialog_add_desc')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable body so the pinned footer (Save) never escapes the viewport
              on short laptops / mobile + keyboard. dvh tracks the mobile keyboard. */}
          <div className="grid gap-4 py-2 px-0.5 max-h-[70dvh] overflow-y-auto">
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
                          <div style={{ color: 'var(--c-coral-ink)' }}>{extractError}</div>
                        )}
                        {!extracting && !extractError && extractConfidence && (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-[var(--c-mint-ink)]">
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

            {/* Lampiran struk (mode edit) — tampil kalau transaksi punya foto tersimpan */}
            {editingId && (() => {
              const receiptPath = transactions.find((x) => x.id === editingId)?.receipt_url
              if (!receiptPath) return null
              return (
                <button
                  type="button"
                  onClick={() => void openReceiptAttachment(receiptPath)}
                  className="inline-flex w-fit items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition hover:bg-[var(--surface-2)]"
                  style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-muted)' }}
                >
                  <ScanLine className="size-3.5" />
                  {locale === 'id' ? 'Lihat struk' : 'View receipt'}
                </button>
              )
            })()}

            {/* Info split (mode edit) — transaksi ini bagian dari satu belanja
                yang dipecah; edit di sini cuma nyentuh potongan yang dipilih. */}
            {editingId && splitSourceTx?.split_group_id && (
              <div
                className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs"
                style={{ background: 'var(--c-violet-soft)', borderColor: 'color-mix(in srgb, var(--c-violet) 30%, transparent)', color: 'var(--c-violet-ink)' }}
              >
                <Split className="size-3.5 shrink-0" />
                {(() => {
                  const parts = transactions.filter((x) => x.split_group_id === splitSourceTx.split_group_id).length
                  return locale === 'id'
                    ? `Bagian dari transaksi yang dipecah (${parts} potongan) — edit ini cuma mengubah potongan yang dipilih.`
                    : `Part of a split transaction (${parts} parts) — editing only changes this part.`
                })()}
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
              <Label id="tx-account-label">{t('transactions.label_account')}</Label>
              <Select
                value={form.account_id}
                onValueChange={(v) => {
                  setForm({ ...form, account_id: v ?? '' })
                  setAccountSource(null) // user manually picked
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby="tx-account-label">
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
                        style={{ background: 'var(--c-violet-soft)', color: 'var(--c-violet-ink)' }}
                      >
                        <Sparkles className="size-3" /> {t('transactions.source_ai')}
                      </span>
                    )}
                    {accountSource === 'default' && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                        style={{ background: 'var(--c-amber-soft)', color: 'var(--c-amber-ink)' }}
                      >
                        <Star className="size-3" style={{ fill: 'var(--c-amber-ink)' }} /> {t('transactions.source_default')}
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
              <Label id="tx-type-label">{t('transactions.label_type')}</Label>
              <div className="grid grid-cols-4 gap-1.5" role="group" aria-labelledby="tx-type-label">
                {(Object.keys(TYPE_LABELS) as TransactionType[]).map((ty) => {
                  const active = form.type === ty
                  const c = TYPE_BADGE_STYLES[ty]
                  return (
                    <button
                      key={ty}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setForm({ ...form, type: ty, category: '' })
                        // Kategori baris split ikut di-reset — opsi kategori beda per tipe.
                        setNewSplitRows((rows) => rows.map((r) => ({ ...r, category: '' })))
                      }}
                      className="rounded-lg border py-2 text-xs font-semibold transition-colors"
                      style={active
                        ? { background: c.bg, color: c.color, borderColor: c.color }
                        : { background: 'var(--surface)', color: 'var(--ink-muted)', borderColor: 'var(--outline)' }}
                    >
                      {t(TYPE_LABEL_KEYS[ty])}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Split toggle (mode tambah) — bagi 1 belanja ke beberapa kategori.
                Affordance jelas: tombol ber-border + aria-pressed + status teks.
                Label literal locale ternary (JANGAN nambah key messages.ts). */}
            {!editingId && (
              <button
                type="button"
                aria-pressed={newSplitOn}
                onClick={() => setNewSplitOn((v) => !v)}
                className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors"
                style={newSplitOn
                  ? { background: 'var(--c-violet-soft)', color: 'var(--c-violet-ink)', borderColor: 'var(--c-violet-ink)' }
                  : { background: 'var(--surface)', color: 'var(--ink-muted)', borderColor: 'var(--outline)' }}
              >
                <Split className="size-4 shrink-0" />
                {locale === 'id' ? 'Bagi ke beberapa kategori' : 'Split across categories'}
                <span className="ml-auto font-normal">
                  {newSplitOn ? (locale === 'id' ? 'Aktif' : 'On') : (locale === 'id' ? 'Nonaktif' : 'Off')}
                </span>
              </button>
            )}

            {/* Category — di mode split diganti editor baris {kategori, nominal,
                catatan}; tiap baris jadi transaksi sendiri yang share grup split. */}
            {!(newSplitOn && !editingId) ? (
              <div className="grid gap-1.5">
                <Label id="tx-category-label">{t('transactions.label_category')}</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v ?? '' })}
                >
                  <SelectTrigger className="w-full" aria-labelledby="tx-category-label">
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
            ) : (
              <div className="grid gap-2 rounded-lg border p-2.5" style={{ borderColor: 'var(--outline)', background: 'var(--surface-2)' }}>
                {newSplitRows.map((r, i) => (
                  <div key={i} className="grid gap-1.5 rounded-lg border p-2" style={{ borderColor: 'var(--border-soft)', background: 'var(--surface)' }}>
                    <div className="flex items-center gap-2">
                      <Select
                        value={r.category}
                        onValueChange={(v) => setNewSplitRows((rows) => rows.map((x, j) => (j === i ? { ...x, category: v ?? '' } : x)))}
                      >
                        <SelectTrigger className="h-9 flex-1 min-w-0 text-sm" aria-label={`${t('transactions.label_category')} ${i + 1}`}>
                          <SelectValue placeholder={t('transactions.select_category')}>
                            {(v) => v || t('transactions.select_category')}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {optionsForType(form.type).map((o) => (
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
                      <NumberInput
                        value={r.amount}
                        onChange={(n) => setNewSplitRows((rows) => rows.map((x, j) => (j === i ? { ...x, amount: n } : x)))}
                        placeholder="0"
                        aria-label={`${t('transactions.label_amount')} ${i + 1}`}
                        className="h-9 w-28 shrink-0 text-right tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => setNewSplitRows((rows) => rows.filter((_, j) => j !== i))}
                        disabled={newSplitRows.length <= 2}
                        className="grid size-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-[var(--surface-2)] disabled:opacity-30"
                        style={{ color: 'var(--ink-soft)' }}
                        aria-label={`${locale === 'id' ? 'Hapus baris' : 'Remove row'} ${i + 1}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <Input
                      value={r.description}
                      onChange={(e) => setNewSplitRows((rows) => rows.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                      placeholder={t('transactions.description_optional')}
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => setNewSplitRows((rows) => [...rows, { category: '', amount: 0, description: '' }])}
                >
                  <Plus className="size-3.5" data-icon="inline-start" /> {locale === 'id' ? 'Tambah baris' : 'Add row'}
                </Button>
                {/* Sisa vs total (field Jumlah di bawah) — live; nol + total>0 = balance */}
                <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ background: newSplitRemaining === 0 && form.amount > 0 ? 'var(--c-mint-soft)' : 'var(--c-coral-soft)' }}>
                  <span className="font-medium" style={{ color: newSplitRemaining === 0 && form.amount > 0 ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
                    {locale === 'id' ? 'Sisa dari total' : 'Remaining of total'}
                  </span>
                  <span className="num font-bold tabular-nums" style={{ color: newSplitRemaining === 0 && form.amount > 0 ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
                    {newSplitRemaining < 0 ? '−' : ''}{formatCurrency(Math.abs(newSplitRemaining))}
                  </span>
                </div>
              </div>
            )}

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
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
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

            {/* Amount — prominent. Mode edit: tombol kecil "Pecah" (split ke
                beberapa kategori). Transfer di-skip — legnya berpasangan. */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="tx-amount">
                  {t('transactions.label_amount')}
                  {/* Mode split: field ini = TOTAL belanja yang dibagi ke baris-baris */}
                  {newSplitOn && !editingId && (
                    <span className="ml-1 font-normal" style={{ color: 'var(--ink-soft)' }}>(Total)</span>
                  )}
                </Label>
                {editingId && splitSourceTx && form.category !== 'Transfer' && (
                  <button
                    type="button"
                    onClick={openSplitDialog}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--surface-2)]"
                    style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-muted)' }}
                    title={locale === 'id' ? 'Pecah transaksi ini ke beberapa kategori' : 'Split this transaction into several categories'}
                  >
                    <Split className="size-3.5" /> {locale === 'id' ? 'Pecah' : 'Split'}
                  </button>
                )}
              </div>
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
              disabled={saving || (newSplitOn && !editingId && !newSplitReady)}
            >
              {saving && <Loader2 className="size-4 animate-spin mr-1" />}
              {editingId ? t('transactions.save') : t('transactions.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pecah Transaksi — 1 transaksi → beberapa kategori, semua bagian share
          split_group_id (migrasi 064). Dibuka dari dialog edit; batal/ESC balik
          ke dialog edit. Label literal locale ternary (JANGAN ke messages.ts). */}
      <Dialog open={splitDialogOpen} onOpenChange={(o) => { if (o) setSplitDialogOpen(true); else closeSplitDialog() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'var(--c-violet-soft)' }}>
                <Split className="size-5" style={{ color: 'var(--c-violet-ink)' }} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg" style={{ fontFamily: 'var(--font-display)' }}>
                  {locale === 'id' ? 'Pecah transaksi' : 'Split transaction'}
                </DialogTitle>
                <DialogDescription>
                  {locale === 'id'
                    ? 'Bagi satu transaksi ke beberapa kategori. Total semua bagian harus sama dengan jumlah asli.'
                    : 'Divide one transaction into several categories. All parts must add up to the original amount.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {splitSourceTx && (
            <div className="grid gap-3 py-2 px-0.5 max-h-[65dvh] overflow-y-auto">
              {/* Ringkasan transaksi asal — jumlah TERSIMPAN jadi acuan total */}
              <div className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-soft)', background: 'var(--surface-2)' }}>
                <div className="min-w-0 text-xs">
                  <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>
                    {splitSourceTx.description || splitSourceTx.category}
                  </p>
                  <p style={{ color: 'var(--ink-soft)' }}>
                    {formatDateShort(splitSourceTx.date, locale)} · {getAccountName(splitSourceTx.account_id)}
                  </p>
                </div>
                <p className="num text-sm font-bold tabular-nums shrink-0 ml-3" style={{ color: 'var(--ink)' }}>
                  {formatCurrency(splitSourceTx.amount)}
                </p>
              </div>

              {/* Baris pecahan: kategori + jumlah + hapus (min. 2 baris) */}
              {splitRows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    value={r.category}
                    onValueChange={(v) => {
                      const next = [...splitRows]
                      next[i] = { ...r, category: v ?? '' }
                      setSplitRows(next)
                    }}
                  >
                    <SelectTrigger className="h-9 flex-1 min-w-0 text-sm" aria-label={`${locale === 'id' ? 'Kategori bagian' : 'Part category'} ${i + 1}`}>
                      <SelectValue placeholder={t('transactions.select_category')}>
                        {(v) => v || t('transactions.select_category')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {optionsForType(splitSourceTx.type).map((o) => (
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
                  <NumberInput
                    value={r.amount}
                    onChange={(n) => {
                      const next = [...splitRows]
                      next[i] = { ...r, amount: n }
                      setSplitRows(next)
                    }}
                    placeholder="0"
                    aria-label={`${locale === 'id' ? 'Jumlah bagian' : 'Part amount'} ${i + 1}`}
                    className="h-9 w-28 shrink-0 text-right tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setSplitRows(splitRows.filter((_, j) => j !== i))}
                    disabled={splitRows.length <= 2}
                    className="grid size-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-[var(--surface-2)] disabled:opacity-30"
                    style={{ color: 'var(--ink-soft)' }}
                    aria-label={`${locale === 'id' ? 'Hapus baris' : 'Remove row'} ${i + 1}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => setSplitRows([...splitRows, { category: '', amount: 0 }])}
              >
                <Plus className="size-3.5" data-icon="inline-start" /> {locale === 'id' ? 'Tambah baris' : 'Add row'}
              </Button>

              {/* Sisa alokasi — nol = siap disimpan (mint), selain itu coral */}
              <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ background: splitRemaining === 0 ? 'var(--c-mint-soft)' : 'var(--c-coral-soft)' }}>
                <span className="font-medium" style={{ color: splitRemaining === 0 ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
                  {locale === 'id' ? 'Sisa' : 'Remaining'}
                </span>
                <span className="num font-bold tabular-nums" style={{ color: splitRemaining === 0 ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}>
                  {splitRemaining < 0 ? '−' : ''}{formatCurrency(Math.abs(splitRemaining))}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeSplitDialog} disabled={splitSaving}>
              {t('transactions.cancel')}
            </Button>
            <Button onClick={() => void saveSplit()} disabled={splitSaving || !splitValid}>
              {splitSaving && <Loader2 className="size-4 animate-spin mr-1" />}
              {locale === 'id' ? 'Pecah' : 'Split'}
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
                aria-label={t('transactions.csv_title')}
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
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 px-2 py-1 text-[11px] uppercase tracking-wider font-medium border-b bg-[var(--surface-2)]" style={{ borderColor: 'var(--outline)', color: 'var(--ink-soft)' }}>
                  <div className="col-span-1">✓</div>
                  <div className="col-span-2">{t('transactions.col_date')}</div>
                  <div className="col-span-4 sm:col-span-3">{t('transactions.col_description')}</div>
                  <div className="col-span-2">{t('transactions.col_type_category')}</div>
                  <div className="col-span-2">{t('transactions.col_account')}</div>
                  <div className="col-span-1 sm:col-span-2 text-right">{t('transactions.col_amount')}</div>
                </div>
                {importRows.map((r, i) => (
                  <div key={i} className="grid grid-cols-6 sm:grid-cols-12 gap-1 px-2 py-1.5 border-b items-center hover:bg-[var(--surface-2)] transition-colors" style={{ borderColor: 'var(--outline)' }}>
                    <div className="col-span-1">
                      <input
                        type="checkbox"
                        checked={r.apply}
                        aria-label={r.description || r.date}
                        onChange={(e) => {
                          const next = [...importRows]
                          next[i] = { ...r, apply: e.target.checked }
                          setImportRows(next)
                        }}
                        style={{ accentColor: 'var(--c-mint)' }}
                      />
                    </div>
                    <div className="col-span-2 num">{r.date}</div>
                    <div className="col-span-4 sm:col-span-3 truncate">{r.description}</div>
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
                        className="text-xs w-full bg-transparent md:h-7 md:rounded-lg md:border md:border-input md:pl-2 md:pr-1 md:outline-none md:transition-[color,box-shadow,border-color] md:hover:border-ring/60 md:focus-visible:border-ring md:focus-visible:ring-3 md:focus-visible:ring-ring/50"
                        aria-label={`${t('transactions.col_account')}: ${r.description}`}
                      >
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        {creditCards.map((c) => <option key={c.id} value={c.id}>{t('transactions.credit_prefix')} · {c.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1 sm:col-span-2 text-right num tabular whitespace-nowrap">{formatCurrency(r.amount)}</div>
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
                  <SelectTrigger aria-label={t('transactions.from_account')}><SelectValue placeholder={t('transactions.select')} /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name?.trim() || `${t('transactions.unnamed_account')} (${a.type})`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t('transactions.to_account')}</Label>
                <Select value={transferForm.to_account_id} onValueChange={(v) => setTransferForm({ ...transferForm, to_account_id: v ?? '' })}>
                  <SelectTrigger aria-label={t('transactions.to_account')}><SelectValue placeholder={t('transactions.select')} /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name?.trim() || `${t('transactions.unnamed_account')} (${a.type})`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t('transactions.amount_rp')}</Label>
                <NumberInput value={transferForm.amount} onChange={(n) => setTransferForm({ ...transferForm, amount: n })} placeholder="0" aria-label={t('transactions.amount_rp')} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('transactions.label_date')}</Label>
                <Input type="date" value={transferForm.date} onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })} aria-label={t('transactions.label_date')} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('transactions.notes')}</Label>
              <Input value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} aria-label={t('transactions.notes')} />
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

      {/* F13c: toggle Catatan|Statistik ala app Budget — pill floating di atas
          dock (dock z-30, bottom 10+safe-area, tinggi 64 → pill di ~88px).
          z-40 = di atas konten, di bawah dialog/sheet (z-50). Mobile only.
          Label: gak ada key i18n yang pas ("Catatan"/"Statistik" standalone)
          → literal locale ternary, JANGAN nambah key ke messages.ts. */}
      <div
        className="md:hidden fixed left-1/2 -translate-x-1/2 z-40 flex items-center rounded-full p-1"
        style={{
          bottom: 'calc(88px + env(safe-area-inset-bottom))',
          background: 'var(--surface)',
          border: '1px solid var(--border-soft)',
          boxShadow: '0 4px 14px rgba(24,24,27,.10)',
        }}
        role="group"
        aria-label={`${locale === 'en' ? 'Record' : 'Catatan'} | ${locale === 'en' ? 'Stats' : 'Statistik'}`}
      >
        {([
          ['record', locale === 'en' ? 'Record' : 'Catatan'],
          ['stats', locale === 'en' ? 'Stats' : 'Statistik'],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setMobileView(v)}
            aria-pressed={mobileView === v}
            className="rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors"
            style={mobileView === v
              ? { background: 'var(--ink)', color: 'var(--surface)' }
              : { color: 'var(--ink-soft)' }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
