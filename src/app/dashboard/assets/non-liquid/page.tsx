'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { AssetNonLiquid } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, Loader2, MapPin, ExternalLink } from 'lucide-react'
import { LeafletMap } from '@/components/map/map-client'

type Category = 'property' | 'vehicle' | 'personal_item'

const CAT: Record<Category, { label: string; note: string }> = {
  property:      { label: 'Properti',       note: 'Rumah, apartemen, tanah' },
  vehicle:       { label: 'Kendaraan',      note: 'Mobil, motor, kendaraan lain' },
  personal_item: { label: 'Barang Pribadi', note: 'Elektronik, perhiasan, seni' },
}

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

  const total = useMemo(() => items.reduce((s, a) => s + a.current_value, 0), [items])

  const grouped = useMemo(() => {
    const out: Record<Category, AssetNonLiquid[]> = {
      property: [], vehicle: [], personal_item: [],
    }
    for (const a of items) {
      if (a.category in out) out[a.category as Category].push(a)
    }
    return out
  }, [items])

  function totalOf(cat: Category) {
    return grouped[cat].reduce((s, a) => s + a.current_value, 0)
  }

  return (
    <div className="space-y-6">
      <div className="dark-card p-6 sm:p-7">
        <p className="caps">Aset Non-Likuid</p>
        <p className="num tabular mt-3 text-4xl sm:text-5xl font-semibold" style={{ color: 'var(--ink)' }}>
          {formatCurrency(total)}
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--on-black-mut)' }}>
          {items.length} aset · nilai fluktuatif
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {(Object.keys(CAT) as Category[]).map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ background: 'var(--black-2)', color: 'var(--on-black)', border: '1px solid var(--black-line)' }}
            >
              {CAT[c].label} <span className="num opacity-70">· {formatCurrency(totalOf(c))}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Dikelompokkan per kategori. Properti bisa set lokasi di peta.
        </p>
        <Button onClick={() => { setForm(EMPTY); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" /> Tambah Aset
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="s-card p-12 text-center">
          <p className="font-semibold">Belum ada aset non-likuid</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
            Tambahkan properti, kendaraan, atau barang berharga Anda.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {(Object.keys(CAT) as Category[]).map((cat) => {
            const list = grouped[cat]
            if (list.length === 0) return null
            return (
              <section key={cat}>
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p className="caps">{CAT[cat].note}</p>
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                      {CAT[cat].label}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="num text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                      {formatCurrency(totalOf(cat))}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                      {list.length} aset
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((a) => {
                    const delta = a.current_value - a.purchase_value
                    const deltaPct = a.purchase_value > 0 ? (delta / a.purchase_value) * 100 : 0
                    const up = delta >= 0
                    const hasMap = cat === 'property' && a.latitude != null && a.longitude != null
                    return (
                      <div
                        key={a.id}
                        className="group relative overflow-hidden rounded-lg bg-white border border-[var(--border-soft)] hover:border-[var(--ink)] transition-colors"
                      >
                        {hasMap && (
                          <div className="h-28 w-full border-b" style={{ borderColor: 'var(--border-soft)' }}>
                            <LeafletMap lat={a.latitude!} lng={a.longitude!} readOnly height={112} />
                          </div>
                        )}
                        <div className="p-5">
                          <div className="flex items-start justify-between">
                            <div className="min-w-0">
                              <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{a.name}</p>
                              <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                                {a.type || '—'}
                              </p>
                              {cat === 'property' && a.address && (
                                <p className="text-[11px] mt-1 flex items-start gap-1" style={{ color: 'var(--ink-soft)' }}>
                                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                                  <span className="truncate">{a.address}</span>
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  setForm({
                                    id: a.id, name: a.name, category: a.category, type: a.type,
                                    purchase_value: a.purchase_value, current_value: a.current_value,
                                    purchase_date: a.purchase_date, notes: a.notes,
                                    latitude: a.latitude ?? null,
                                    longitude: a.longitude ?? null,
                                    address: a.address ?? '',
                                  })
                                  setDialogOpen(true)
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => remove(a.id)}>
                                <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
                              </Button>
                            </div>
                          </div>
                          <p className="num text-2xl mt-4 tabular font-semibold" style={{ color: 'var(--ink)' }}>
                            {formatCurrency(a.current_value)}
                          </p>
                          <div className="flex items-center justify-between mt-2 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                            <span>Beli {formatDate(a.purchase_date)}</span>
                            <Badge
                              className="rounded-sm px-1.5 py-0 border-0 font-semibold"
                              style={{
                                background: up ? 'var(--lime-100)' : '#FBE5E1',
                                color: up ? 'var(--lime-700)' : 'var(--danger)',
                              }}
                            >
                              {up ? '+' : ''}{deltaPct.toFixed(1)}%
                            </Badge>
                          </div>
                          {hasMap && (
                            <a
                              href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 pt-3 border-t flex items-center gap-1 text-[11px] hover:underline"
                              style={{ color: 'var(--ink-muted)', borderColor: 'var(--border-soft)' }}
                            >
                              Buka di Google Maps <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CAT) as Category[]).map((k) => (
                      <SelectItem key={k} value={k}>{CAT[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Tipe</Label>
                <Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Rumah, Apartemen, Mobil..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Harga Beli</Label>
                <Input type="number" value={form.purchase_value || ''} onChange={(e) => setForm({ ...form, purchase_value: Number(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Nilai Sekarang</Label>
                <Input type="number" value={form.current_value || ''} onChange={(e) => setForm({ ...form, current_value: Number(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Tanggal Beli</Label>
              <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Catatan</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            {form.category === 'property' && (
              <div className="grid gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-soft)' }}>
                <Label className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Lokasi di Peta
                </Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Alamat lengkap (opsional)"
                />
                <LeafletMap
                  lat={form.latitude}
                  lng={form.longitude}
                  onPick={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })}
                  height={220}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving || !form.name}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
