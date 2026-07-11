'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { formatCurrency } from '@/lib/utils'
import { pinIcon } from './leaflet-map'

// PortfolioMap — SATU peta Leaflet berisi semua properti ber-koordinat
// (pengganti pola lama: satu instance peta per kartu). Jangan import file ini
// langsung dari halaman — Leaflet nyentuh `window` pas import; pakai wrapper
// SSR-safe `PortfolioMap` dari './map-client'.

export interface PortfolioMapItem {
  id: string
  name: string
  /** Nilai sekarang aset — tampil di popup marker. */
  value: number
  lat: number
  lng: number
}

export interface PortfolioMapProps {
  items: PortfolioMapItem[]
  height?: number
  /** Dipanggil pas tombol 'Lihat' di popup diklik (mis. buka dialog edit). */
  onView?: (id: string) => void
}

// Auto-frame: zoom/pan peta biar semua marker kelihatan.
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  // Key stabil biar gak refit tiap render kalau koordinat gak berubah.
  const key = points.map((p) => p.join(',')).join(';')
  useEffect(() => {
    if (points.length === 0) return
    const fit = () => {
      // Container bisa 0-size pas mount (section hidden md:block di mobile) —
      // fitBounds di ukuran nol ngaco; tunda sampai peta dapat ukuran.
      if (map.getSize().x === 0) return false
      if (points.length === 1) map.setView(points[0], 15)
      else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 })
      return true
    }
    if (fit()) return
    // Leaflet (trackResize default) emit 'resize' begitu container dapat ukuran.
    const onResize = () => { if (fit()) map.off('resize', onResize) }
    map.on('resize', onResize)
    return () => { map.off('resize', onResize) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

export default function PortfolioMap({ items, height = 380, onView }: PortfolioMapProps) {
  const points = useMemo(() => items.map((it): [number, number] => [it.lat, it.lng]), [items])
  if (items.length === 0) return null

  return (
    <div className="relative isolate w-full overflow-hidden" style={{ height }}>
      <MapContainer
        center={points[0]}
        zoom={12}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={false} // jangan bajak scroll halaman; zoom via kontrol +/-
      >
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {items.map((it) => (
          <Marker key={it.id} position={[it.lat, it.lng]} icon={pinIcon}>
            <Popup>
              <div className="min-w-36">
                <p className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--ink)' }}>{it.name}</p>
                <p className="num tabular text-[12px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>{formatCurrency(it.value)}</p>
                {onView && (
                  <button
                    type="button"
                    onClick={() => onView(it.id)}
                    className="mt-2 h-6 rounded px-2 text-[11px] font-medium transition-opacity duration-150 hover:opacity-85"
                    style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}
                  >
                    Lihat
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  )
}
