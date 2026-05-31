'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { AssetNonLiquid } from '@/types'
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
  Plus, Pencil, Trash2, Loader2, MapPin, ExternalLink, Home, Car, Gem,
  RefreshCw, type LucideIcon,
} from 'lucide-react'
import { LeafletMap } from '@/components/map/map-client'
import { WealthHero } from '@/components/wealth/wealth-ui'

type Category = 'property' | 'vehicle' | 'personal_item'

const CAT: Record<Category, { label: string; note: string; icon: LucideIcon; color: string }> = {
  property:      { label: 'Properti',          note: 'Rumah, apartemen, tanah',     icon: Home, color: '#8B5CF6' },
  vehicle:       { label: 'Kendaraan',         note: 'Mobil, motor, dll',           icon: Car,  color: '#F59E0B' },
  personal_item: { label: 'Pribadi & Lainnya', note: 'Elektronik, perhiasan, seni', icon: Gem,  color: '#10B981' },
}

const monthYear = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) : '—'

interface FormState {
  id: string | null
  name: string
  category: Category
  type: string
  purchase_value: number
  current_value: number
  purchase_date: string
  notes: string
  latitude: number | null
  longitude: number | null
  address: string
}
const EMPTY: FormState = {
  id: null, name: '', category: 'property', type: '',
  purchase_value: 0, current_value: 0,
  purchase_date: new Date().toISOString().split('T')[0], notes: '',
  latitude: null, longitude: null, address: '',
}

export default function NonLiquidAssetsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AssetNonLiquid[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [revalOpen, setRevalOpen] = useState(false)
  const [revalValues, setRevalValues] = useState<Record<string, number>>({})
  const [revalSaving, setRevalSaving] = useState(false)

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('assets_non_liquid').select('*').eq('user_id', user.id).order('current_value', { ascending: false })
    setItems((data ?? []) as AssetNonLiquid[])
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = {
      user_id: user.id, name: form.name, category: form.category, type: form.type,
      purchase_value: form.purchase_value, current_value: form.current_value,
      purchase_date: form.purchase_date, notes: form.notes,
      latitude: form.category === 'property' ? form.latitude : null,
      longitude: form.category === 'property' ? form.longitude : null,
      address: form.category === 'property' ? form.address : '',
    }
    if (form.id) await supabase.from('assets_non_liquid').update(payload).eq('id', form.id)
    else await supabase.from('assets_non_liquid').insert(payload)
    setSaving(false)
    setDialogOpen(false)
    void load()
  }

  async function remove(id: string) {
    if (!confirm('Hapus aset ini?')) return
    await supabase.from('assets_non_liquid').delete().eq('id', id)
    void load()
  }

  function openEdit(a: AssetNonLiquid) {
    setForm({
      id: a.id, name: a.name, category: a.category as Category, type: a.type,
      purchase_value: a.purchase_value, current_value: a.current_value,
      purchase_date: a.purchase_date, notes: a.notes,
      latitude: a.latitude ?? null, longitude: a.longitude ?? null, address: a.address ?? '',
    })
    setDialogOpen(true)
  }

  function openReval() {
    const init: Record<string, number> = {}
    for (const a of items) init[a.id] = a.current_value
    setRevalValues(init)
    setRevalOpen(true)
  }
  async function saveReval() {
    setRevalSaving(true)
    for (const a of items.filter((x) => revalValues[x.id] !== x.current_value)) {
      await supabase.from('assets_non_liquid').update({ current_value: revalValues[a.id] }).eq('id', a.id)
    }
    setRevalSaving(false); setRevalOpen(false); void load()
  }

  const total = useMemo(() => items.reduce((s, a) => s + a.current_value, 0), [items])
  const totalPurchase = useMemo(() => items.reduce((s, a) => s + a.purchase_value, 0), [items])
  const totalDelta = total - totalPurchase

  const grouped = useMemo(() => {
    const out: Record<Category, AssetNonLiquid[]> = { property: [], vehicle: [], personal_item: [] }
    for (const a of items) if (a.category in out) out[a.category as Category].push(a)
    return out
  }, [items])

  function catStat(cat: Category) {
    const list = grouped[cat]
    const cur = list.reduce((s, a) => s + a.current_value, 0)
    const buy = list.reduce((s, a) => s + a.purchase_value, 0)
    return { cur, count: list.length, pct: buy > 0 ? ((cur - buy) / buy) * 100 : 0 }
  }

  // Stat pendukung — cuma kategori yg PUNYA aset (gak nampilin Rp0 kosong).
  const secondary = (Object.keys(CAT) as Category[])
    .map((cat) => ({ cat, s: catStat(cat) }))
    .filter((x) => x.s.count > 0)
    .map((x) => ({
      label: CAT[x.cat].label,
      color: CAT[x.cat].color,
      value: (
        <>{formatCurrency(x.s.cur)}{' '}
          <span className="text-[11px] font-normal" style={{ color: x.s.pct >= 0 ? '#10B981' : '#F43F5E' }}>
            {x.s.pct >= 0 ? '+' : ''}{x.s.pct.toFixed(1)}%
          </span>
        </>
      ),
    }))

  return (
    <div className="space-y-6">
      <WealthHero
        eyebrow={`${items.length} aset tercatat`}
        title="Aset Non-Likuid"
        accent="#8B5CF6"
        headline={{
          label: 'Nilai Pasar Saat Ini',
          value: formatCurrency(total),
          sub: items.length > 0
            ? (<>Modal awal <span className="num">{formatCurrency(totalPurchase)}</span>{' · '}
                <span className="num font-semibold" style={{ color: totalDelta >= 0 ? '#10B981' : '#F43F5E' }}>{totalDelta >= 0 ? '+' : ''}{formatCurrency(totalDelta)}</span></>)
            : 'Properti, kendaraan, dan barang pribadi bernilai. Update penilaian berkala biar net worth akurat.',
        }}
        secondary={secondary}
        actions={<>
          {items.length > 0 && <Button variant="outline" onClick={openReval}><RefreshCw className="h-4 w-4" /> Revaluasi semua</Button>}
          <Button onClick={() => { setForm(EMPTY); setDialogOpen(true) }}><Plus className="h-4 w-4" /> Tambah aset</Button>
        </>}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="s-card p-12 text-center">
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>Belum ada aset non-likuid</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>Tambahkan properti, kendaraan, atau barang berharga kamu.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => {
            const cat = (a.category in CAT ? a.category : 'personal_item') as Category
            const meta = CAT[cat]
            const Icon = meta.icon
            const delta = a.current_value - a.purchase_value
            const pct = a.purchase_value > 0 ? (delta / a.purchase_value) * 100 : 0
            const up = delta >= 0
            const hasMap = cat === 'property' && a.latitude != null && a.longitude != null
            return (
              <div key={a.id} className="group relative overflow-hidden rounded-xl bg-[var(--surface)] border border-[var(--border-soft)] hover:border-[var(--ink)] transition-colors">
                {hasMap && (
                  <div className="h-28 w-full border-b" style={{ borderColor: 'var(--border-soft)' }}>
                    <LeafletMap lat={a.latitude!} lng={a.longitude!} readOnly height={112} />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="size-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${meta.color}1A` }}>
                      <Icon className="size-4" style={{ color: meta.color }} />
                    </div>
                    <div className="relative">
                      <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium group-hover:opacity-0 transition" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>{meta.label}</span>
                      <div className="absolute right-0 top-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => remove(a.id)}><Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} /></Button>
                      </div>
                    </div>
                  </div>
                  <p className="font-semibold mt-3 truncate" style={{ color: 'var(--ink)' }}>{a.name}</p>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--ink-muted)' }}>{a.type || meta.note}</p>
                  {cat === 'property' && a.address && (
                    <p className="text-[11px] mt-1 flex items-start gap-1" style={{ color: 'var(--ink-soft)' }}>
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" /><span className="truncate">{a.address}</span>
                    </p>
                  )}
                  <p className="num text-2xl mt-3 tabular font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(a.current_value)}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                    <span className="num px-1.5 py-0.5 rounded font-semibold" style={{ background: `${up ? '#10B981' : '#F43F5E'}1A`, color: up ? '#10B981' : '#F43F5E' }}>{up ? '+' : ''}{pct.toFixed(1)}%</span>
                    <span style={{ color: 'var(--ink-muted)' }}>dari <span className="num">{formatCurrency(a.purchase_value)}</span></span>
                  </div>
                  <div className="mt-4 pt-3 border-t flex items-center justify-between text-[11px]" style={{ borderColor: 'var(--border-soft)' }}>
                    <span style={{ color: 'var(--ink-soft)' }}>Dibeli {monthYear(a.purchase_date)}</span>
                    {hasMap && (
                      <a href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--ink-muted)' }}>
                        Buka Maps <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Aset Non-Likuid' : 'Tambah Aset Non-Likuid'}</DialogTitle>
            <DialogDescription>Properti, kendaraan, atau barang berharga.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Nama</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Kategori</Label>
                <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v as Category })}>
                  <SelectTrigger><SelectValue placeholder="Pilih kategori">{(v) => CAT[v as Category]?.label ?? 'Pilih kategori'}</SelectValue></SelectTrigger>
                  <SelectContent>{(Object.keys(CAT) as Category[]).map((k) => (<SelectItem key={k} value={k}>{CAT[k].label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Tipe</Label>
                <Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Rumah, Apartemen, Mobil..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Harga Beli</Label><NumberInput value={form.purchase_value} onChange={(n) => setForm({ ...form, purchase_value: n })} placeholder="0" /></div>
              <div className="grid gap-1.5"><Label>Nilai Sekarang</Label><NumberInput value={form.current_value} onChange={(n) => setForm({ ...form, current_value: n })} placeholder="0" /></div>
            </div>
            <div className="grid gap-1.5"><Label>Tanggal Beli</Label><Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Catatan</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            {form.category === 'property' && (
              <div className="grid gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-soft)' }}>
                <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Lokasi di Peta</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Alamat lengkap (opsional)" />
                <LeafletMap lat={form.latitude} lng={form.longitude} onPick={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })} height={180} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving || !form.name}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{form.id ? 'Simpan' : 'Tambah'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revaluasi semua */}
      <Dialog open={revalOpen} onOpenChange={setRevalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revaluasi semua aset</DialogTitle>
            <DialogDescription>Update nilai pasar terkini tiap aset. Yang gak diubah dilewati.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {items.map((a) => (
              <div key={a.id} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{a.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Lama: <span className="num">{formatCurrency(a.current_value)}</span></p>
                </div>
                <div className="w-40"><NumberInput value={revalValues[a.id] ?? a.current_value} onChange={(n) => setRevalValues((p) => ({ ...p, [a.id]: n }))} placeholder="0" /></div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevalOpen(false)}>Batal</Button>
            <Button onClick={saveReval} disabled={revalSaving}>{revalSaving && <Loader2 className="h-4 w-4 animate-spin" />}Simpan semua</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
