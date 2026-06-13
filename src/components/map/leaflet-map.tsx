'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type MapStyle = 'streets' | 'satellite' | 'terrain' | 'dark'

const TILE_LAYERS: Record<MapStyle, { label: string; url: string; attribution: string; maxZoom?: number }> = {
  streets: {
    label: 'Peta',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    label: 'Satelit',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri · World Imagery',
    maxZoom: 19,
  },
  terrain: {
    label: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxZoom: 17,
  },
  dark: {
    label: 'Gelap',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  },
}

// Fix Leaflet's default icon in bundlers — use a simple inline SVG data URI so
// we don't depend on external icon assets.
const pinIcon = L.divIcon({
  className: '',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 8.5 14 22 14 22s14-13.5 14-22c0-7.732-6.268-14-14-14z" fill="#0A0A0A"/>
      <circle cx="14" cy="14" r="5.5" fill="#C9F05A"/>
    </svg>
  `,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
})

interface GeoResult { label: string; lat: number; lon: number }
interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    name?: string; street?: string; locality?: string; district?: string
    city?: string; county?: string; state?: string; country?: string
  }
}

interface LeafletMapProps {
  lat: number | null
  lng: number | null
  onPick?: (lat: number, lng: number) => void
  readOnly?: boolean
  height?: number
}

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function Recenter({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap()
  useEffect(() => {
    if (lat != null && lng != null) {
      map.setView([lat, lng], map.getZoom() < 13 ? 14 : map.getZoom(), { animate: true })
    }
  }, [lat, lng, map])
  return null
}

export default function LeafletMap({
  lat, lng, onPick, readOnly = false, height = 240,
}: LeafletMapProps) {
  const defaultCenter: [number, number] = [lat ?? -6.2088, lng ?? 106.8456] // Jakarta
  const zoom = lat != null && lng != null ? 14 : 11

  const [mapStyle, setMapStyle] = useState<MapStyle>('streets')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<GeoResult[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const layer = TILE_LAYERS[mapStyle]

  async function search() {
    if (!onPick || !query.trim()) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setSearching(true)
    setResults([])
    try {
      // Photon (OSM-based, lebih jago alamat ID + bias ke pin/Jakarta).
      const bias = lat != null && lng != null ? `&lat=${lat}&lon=${lng}` : '&lat=-6.2&lon=106.84'
      let out: GeoResult[] = []
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6${bias}`, { signal: ctrl.signal })
        if (res.ok) {
          const data = (await res.json()) as { features?: PhotonFeature[] }
          out = (data.features ?? [])
            .map((f): GeoResult | null => {
              const p = f.properties ?? {}
              const c = f.geometry?.coordinates
              if (!c) return null
              const main = p.name || p.street || p.locality || ''
              const ctx = [p.district || p.city || p.county, p.state, p.country].filter(Boolean).join(', ')
              const label = [main, ctx].filter(Boolean).join(main && ctx ? ' — ' : '')
              return label ? { label, lat: c[1], lon: c[0] } : null
            })
            .filter((r): r is GeoResult => r != null)
        }
      } catch { /* lanjut fallback */ }

      // Fallback Nominatim kalau Photon kosong/gagal.
      if (out.length === 0) {
        const nres = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=id&q=${encodeURIComponent(query)}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
        if (nres.ok) {
          const ndata = (await nres.json()) as Array<{ lat: string; lon: string; display_name: string }>
          out = ndata.map((d) => ({ label: d.display_name, lat: parseFloat(d.lat), lon: parseFloat(d.lon) }))
        }
      }
      setResults(out)
    } catch {
      // ignore
    } finally {
      setSearching(false)
    }
  }

  function selectResult(r: GeoResult) {
    onPick?.(r.lat, r.lon)
    setQuery(r.label.split(' — ')[0])
    setResults([])
  }

  return (
    <div className="space-y-2">
      {!readOnly && onPick && (
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())}
            placeholder="Cari alamat... (mis. Bintaro, Kemang)"
            className="flex-1 h-8 px-2 text-sm rounded border bg-[var(--surface)] outline-none focus:border-[var(--ink)]"
            style={{ borderColor: 'var(--border-soft)', color: 'var(--ink)' }}
          />
          <button
            type="button"
            onClick={search}
            disabled={searching || !query.trim()}
            className="h-8 px-3 text-xs font-medium rounded border transition disabled:opacity-40"
            style={{ background: 'var(--c-mint)', borderColor: 'transparent', color: 'var(--ink)' }}
          >
            {searching ? 'Mencari…' : 'Cari'}
          </button>
        </div>
      )}

      {!readOnly && results.length > 0 && (
        <div className="rounded-lg border overflow-hidden max-h-52 overflow-y-auto" style={{ borderColor: 'var(--border-soft)', background: 'var(--surface)' }}>
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectResult(r)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--surface-2)] transition-colors border-b last:border-b-0"
              style={{ borderColor: 'var(--border-soft)', color: 'var(--ink)' }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      <div
        className="relative isolate w-full rounded-lg overflow-hidden border"
        style={{ height, borderColor: 'var(--border-soft)' }}
      >
        <MapContainer
          center={defaultCenter}
          zoom={zoom}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={!readOnly}
          dragging={!readOnly}
          zoomControl={!readOnly}
        >
          <TileLayer
            key={mapStyle}
            attribution={layer.attribution}
            url={layer.url}
            maxZoom={layer.maxZoom ?? 19}
          />
          {lat != null && lng != null && (
            <Marker position={[lat, lng]} icon={pinIcon} />
          )}
          {!readOnly && onPick && <ClickCapture onPick={onPick} />}
          <Recenter lat={lat} lng={lng} />
        </MapContainer>

        {/* Layer switcher — disembunyiin di mode readOnly (thumbnail kartu jadi bersih) */}
        {!readOnly && (
        <div
          className="absolute top-2 right-2 z-[500] flex rounded-lg shadow-[var(--card-shadow)] overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {(Object.keys(TILE_LAYERS) as MapStyle[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setMapStyle(key)
              }}
              className="px-2 py-1 text-[10px] font-semibold transition-colors uppercase tracking-wider"
              style={{
                background: mapStyle === key ? 'var(--ink)' : 'transparent',
                color: mapStyle === key ? 'var(--c-mint)' : 'var(--ink-muted)',
              }}
              title={TILE_LAYERS[key].label}
            >
              {TILE_LAYERS[key].label}
            </button>
          ))}
        </div>
        )}
      </div>

      {!readOnly && (
        <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
          Klik peta untuk set lokasi, atau cari alamat di atas.
          {lat != null && lng != null && (
            <span className="num ml-2" style={{ color: 'var(--ink-muted)' }}>
              {lat.toFixed(4)}, {lng.toFixed(4)}
            </span>
          )}
        </p>
      )}
    </div>
  )
}
