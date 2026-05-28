'use client'

/**
 * Watchlist tab di halaman Saham — pantau emiten IDX yang lagi diincar
 * tanpa harus dimiliki dulu. Harga live dari Yahoo (.JK suffix), cached 5 min.
 *
 * Data source: src/data/invest/emitten-info.json (~990 emiten) — dipake
 * buat autocomplete. Live price via /api/quotes.
 *
 * Server actions ada di stock-actions.ts (sibling file di [slug] route).
 */

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Search, Loader2, Star, TrendingUp, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'

interface WatchlistRow {
  ticker: string
  note: string | null
  target_price: number | null
  created_at: string
}

interface EmittenSlim {
  ticker: string
  name: string
  sector: string | null
}

interface Quote {
  ticker: string
  price: number
  currency: string
  changePct: number | null
  marketState: string | null
}

export function StockWatchlistTab() {
  const supabase = createClient()
  const router = useRouter()

  const [emiten, setEmiten] = useState<EmittenSlim[]>([])
  const [rows, setRows] = useState<WatchlistRow[]>([])
  const [loadingRows, setLoadingRows] = useState(true)
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map())
  const [loadingQuotes, setLoadingQuotes] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editTicker, setEditTicker] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Load IDX emiten list once (cached by browser for 1 hour)
  useEffect(() => {
    let cancelled = false
    fetch('/api/idx-emiten')
      .then((r) => r.json())
      .then((data: { emiten?: EmittenSlim[] }) => {
        if (!cancelled) setEmiten(data.emiten ?? [])
      })
      .catch((err) => console.error('Failed to load emiten:', err))
    return () => {
      cancelled = true
    }
  }, [])

  // Load watchlist rows on mount
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadingRows(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setLoadingRows(false)
        return
      }
      const { data } = await supabase
        .from('watchlist')
        .select('ticker, note, target_price, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      if (!cancelled) {
        setRows((data ?? []) as WatchlistRow[])
        setLoadingRows(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  // Fetch live prices for all watchlist tickers (Yahoo .JK suffix)
  useEffect(() => {
    if (rows.length === 0) {
      setQuotes(new Map())
      return
    }
    let cancelled = false
    const yahooTickers = rows.map((r) => `${r.ticker}.JK`).join(',')
    setLoadingQuotes(true)
    fetch(`/api/quotes?tickers=${encodeURIComponent(yahooTickers)}`)
      .then((r) => r.json())
      .then((data: { quotes?: Quote[] }) => {
        if (cancelled) return
        const map = new Map<string, Quote>()
        for (const q of data.quotes ?? []) {
          const t = q.ticker.replace(/\.JK$/, '')
          map.set(t, q)
        }
        setQuotes(map)
      })
      .catch((err) => {
        console.error('Failed to fetch quotes:', err)
      })
      .finally(() => {
        if (!cancelled) setLoadingQuotes(false)
      })
    return () => {
      cancelled = true
    }
  }, [rows])

  async function refresh() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('watchlist')
      .select('ticker, note, target_price, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    setRows((data ?? []) as WatchlistRow[])
    router.refresh()
  }

  function add(ticker: string) {
    startTransition(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Belum login')
        return
      }
      const t = ticker.trim().toUpperCase()
      const { error } = await supabase
        .from('watchlist')
        .upsert(
          { user_id: user.id, ticker: t, note: null },
          { onConflict: 'user_id,ticker', ignoreDuplicates: true },
        )
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success(`${t} ditambah ke watchlist`)
      setAddOpen(false)
      await refresh()
    })
  }

  function remove(ticker: string) {
    startTransition(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', user.id)
        .eq('ticker', ticker.toUpperCase())
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success(`${ticker} dihapus`)
      await refresh()
    })
  }

  if (loadingRows) {
    return (
      <div className="py-16 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        <Loader2 className="size-5 mx-auto animate-spin mb-2" />
        Memuat watchlist…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Button
          onClick={() => setAddOpen(true)}
          disabled={pending}
          style={{ background: 'var(--emerald-600)', color: '#FFFFFF' }}
        >
          <Plus className="size-4" /> Tambah saham
        </Button>
        <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          {rows.length} saham · {loadingQuotes ? 'memuat harga…' : 'harga live (cache 5 menit)'}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState onAdd={() => setAddOpen(true)} />
      ) : (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-[10px] uppercase tracking-[0.08em] font-semibold border-b"
                  style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}
                >
                  <th className="px-3 py-2.5">Ticker</th>
                  <th className="px-3 py-2.5">Nama</th>
                  <th className="px-3 py-2.5 text-right">Harga</th>
                  <th className="px-3 py-2.5 text-right">Perubahan</th>
                  <th className="px-3 py-2.5 text-right">Target</th>
                  <th className="px-3 py-2.5">Catatan</th>
                  <th className="px-3 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const meta = emiten.find((e) => e.ticker === row.ticker)
                  const quote = quotes.get(row.ticker)
                  const price = quote?.price ?? null
                  const changePct = quote?.changePct ?? null
                  const reachedTarget =
                    row.target_price != null &&
                    price != null &&
                    price <= row.target_price
                  return (
                    <tr
                      key={row.ticker}
                      className="border-t transition hover:bg-[var(--surface-2)]"
                      style={{ borderColor: 'var(--border-soft)' }}
                    >
                      <td className="px-3 py-2.5 font-mono font-semibold" style={{ color: 'var(--ink)' }}>
                        {row.ticker}
                      </td>
                      <td className="px-3 py-2.5 max-w-[220px] truncate text-xs" style={{ color: 'var(--ink-muted)' }}>
                        {meta?.name ?? '—'}
                        {meta?.sector && (
                          <span className="block text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                            {meta.sector}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right num tabular text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                        {price != null ? formatCurrency(price) : <span style={{ color: 'var(--ink-soft)' }}>—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right num tabular text-xs">
                        {changePct != null ? (
                          <span
                            className="inline-flex items-center gap-0.5 font-semibold"
                            style={{
                              color: changePct >= 0 ? 'var(--emerald-600)' : 'var(--coral-600)',
                            }}
                          >
                            {changePct >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                            {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                          </span>
                        ) : (
                          <span style={{ color: 'var(--ink-soft)' }}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right num tabular text-xs">
                        {row.target_price ? (
                          <span style={{ color: reachedTarget ? 'var(--emerald-700)' : 'var(--ink-muted)' }}>
                            {formatCurrency(row.target_price)}
                            {reachedTarget && (
                              <Badge className="ml-1 bg-emerald-100 text-emerald-700">tercapai</Badge>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--ink-soft)' }}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 max-w-[240px] text-xs truncate" style={{ color: 'var(--ink-muted)' }}>
                        {row.note ? (
                          <button
                            type="button"
                            onClick={() => setEditTicker(row.ticker)}
                            className="hover:underline text-left truncate"
                          >
                            {row.note}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditTicker(row.ticker)}
                            className="text-[var(--ink-soft)] hover:underline"
                          >
                            + tambah
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => remove(row.ticker)}
                          disabled={pending}
                          className="text-[var(--ink-soft)] hover:text-[var(--danger)] transition"
                          aria-label={`Hapus ${row.ticker}`}
                        >
                          <X className="size-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        emiten={emiten}
        existing={new Set(rows.map((r) => r.ticker))}
        onAdd={add}
        pending={pending}
      />

      {editTicker && (
        <EditNoteDialog
          ticker={editTicker}
          initialNote={rows.find((r) => r.ticker === editTicker)?.note ?? ''}
          initialTarget={rows.find((r) => r.ticker === editTicker)?.target_price ?? null}
          onClose={() => setEditTicker(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      className="rounded-2xl border p-10 text-center"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: 'var(--surface-2)' }}
      >
        <Star className="size-6" style={{ color: 'var(--ink-muted)' }} />
      </div>
      <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
        Belum ada saham di watchlist
      </p>
      <p className="mt-1 text-xs max-w-sm mx-auto" style={{ color: 'var(--ink-muted)' }}>
        Tambah saham yang lagi kamu incar — bisa kasih target harga, catatan, dan lihat
        harga live tanpa perlu beli dulu.
      </p>
      <Button
        onClick={onAdd}
        className="mt-4"
        style={{ background: 'var(--emerald-600)', color: '#FFFFFF' }}
      >
        <Plus className="size-4" /> Tambah saham pertama
      </Button>
    </div>
  )
}

function AddDialog({
  open, onClose, emiten, existing, onAdd, pending,
}: {
  open: boolean
  onClose: () => void
  emiten: EmittenSlim[]
  existing: Set<string>
  onAdd: (ticker: string) => void
  pending: boolean
}) {
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = emiten.filter((e) => !existing.has(e.ticker))
    if (!q) return filtered.slice(0, 30)
    return filtered
      .filter(
        (e) =>
          e.ticker.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q),
      )
      .slice(0, 30)
  }, [emiten, existing, query])

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setQuery('')
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle>Tambah saham ke watchlist</DialogTitle>
          <DialogDescription>
            Ketik ticker (BBCA) atau nama emiten. Cuma saham aktif di IDX yang ditampilin.
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 pb-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
              style={{ color: 'var(--ink-soft)' }}
            />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="BBCA / Bank Central Asia"
              className="pl-9"
            />
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-2 pb-3">
          {matches.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
              Gak ada hasil.
            </p>
          ) : (
            <ul>
              {matches.map((e) => (
                <li key={e.ticker}>
                  <button
                    type="button"
                    onClick={() => onAdd(e.ticker)}
                    disabled={pending}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[var(--surface-2)] disabled:opacity-60"
                  >
                    <span
                      className="font-mono font-semibold text-sm shrink-0"
                      style={{ color: 'var(--ink)' }}
                    >
                      {e.ticker}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs truncate" style={{ color: 'var(--ink-muted)' }}>
                        {e.name}
                      </span>
                      {e.sector && (
                        <span className="block text-[10px] truncate" style={{ color: 'var(--ink-soft)' }}>
                          {e.sector}
                        </span>
                      )}
                    </span>
                    <Plus className="size-4 shrink-0" style={{ color: 'var(--emerald-600)' }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EditNoteDialog({
  ticker, initialNote, initialTarget, onClose, onSaved,
}: {
  ticker: string
  initialNote: string
  initialTarget: number | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const supabase = createClient()
  const [note, setNote] = useState(initialNote)
  const [target, setTarget] = useState<string>(initialTarget ? String(initialTarget) : '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      toast.error('Belum login')
      return
    }
    const targetNum = target.trim() ? parseFloat(target) : null
    const { error } = await supabase
      .from('watchlist')
      .update({
        note: note.trim() || null,
        target_price: Number.isFinite(targetNum) ? targetNum : null,
      })
      .eq('user_id', user.id)
      .eq('ticker', ticker.toUpperCase())
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Tersimpan.')
    await onSaved()
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {ticker}</DialogTitle>
          <DialogDescription>
            Tambah catatan + target harga (opsional). Kalau harga live turun ke
            target, dapet badge &ldquo;tercapai&rdquo;.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="wl-target">Target harga (Rp)</Label>
            <Input
              id="wl-target"
              type="number"
              inputMode="numeric"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="contoh: 5500"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wl-note">Catatan</Label>
            <Input
              id="wl-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="contoh: nunggu earnings Q1"
              maxLength={200}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={save} disabled={saving} style={{ background: 'var(--emerald-600)', color: '#FFFFFF' }}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
