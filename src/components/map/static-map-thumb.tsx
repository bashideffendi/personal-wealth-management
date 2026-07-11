// Thumbnail peta STATIS — tile basemap langsung sebagai <img>, TANPA instance
// Leaflet (sebelumnya tiap kartu properti me-render MapContainer hidup hanya
// untuk thumbnail readOnly 112px). Tile digeser supaya koordinat aset persis
// di pusat container; marker = dot CSS di tengah.
//
// PROVIDER = Carto light_all (BUKAN tile.openstreetmap.org): kebijakan tile
// OSM men-degradasi request hotlink ber-Referer situs — terukur tile yang sama
// 35,6KB (UA polos) vs 6,9KB (Referer klunting.com) = tile nyaris kosong,
// itulah "peta rusak" yang terlihat di kartu. Carto serve penuh (28KB/78KB @2x),
// gratis ber-atribusi, dan visual light-gray-nya pas kanvas mono. @2x = retina.

const TILE = 256
const TILE_URL = (z: number, x: number, y: number) =>
  `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}@2x.png`

// lat/lng → koordinat tile (pecahan) skema slippy-map OSM.
function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom
  const x = ((lng + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  return { x, y }
}

interface StaticMapThumbProps {
  lat: number
  lng: number
  /** Nama aset — dipakai buat alt text tile pusat. */
  name: string
  height?: number
  zoom?: number
}

export function StaticMapThumb({ lat, lng, name, height = 112, zoom = 15 }: StaticMapThumbProps) {
  const n = 2 ** zoom
  const { x, y } = latLngToTile(lat, lng, zoom)
  const tx = Math.floor(x)
  const ty = Math.floor(y)
  // Posisi titik aset di dalam tile pusat (piksel).
  const px = Math.round((x - tx) * TILE)
  const py = Math.round((y - ty) * TILE)

  // Grid tile: 3 kolom (kartu bisa lebih lebar dari 1 tile 256px) × baris
  // secukupnya (thumbnail pendek — baris ekstra cuma kalau titik dekat tepi).
  const cols = [-1, 0, 1]
  const rows: number[] = [0]
  if (py - height / 2 < 0) rows.unshift(-1)
  if (py + height / 2 > TILE) rows.push(1)

  return (
    <div className="relative w-full overflow-hidden" style={{ height, background: 'var(--surface-2)' }}>
      {rows.map((dy) =>
        cols.map((dx) => {
          const gx = (((tx + dx) % n) + n) % n // wrap antimeridian
          const gy = ty + dy
          if (gy < 0 || gy >= n) return null
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${dx},${dy}`}
              src={TILE_URL(zoom, gx, gy)}
              alt={dx === 0 && dy === 0 ? `Peta lokasi ${name}` : ''}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                width: TILE,
                height: TILE,
                // Titik aset dipatok di pusat container: tile pusat digeser -px/-py,
                // tetangga di-offset kelipatan 256.
                left: `calc(50% - ${px}px + ${dx * TILE}px)`,
                top: `calc(50% - ${py}px + ${dy * TILE}px)`,
              }}
            />
          )
        }),
      )}
      {/* Dot marker di pusat = posisi aset (ring putih biar kebaca di atas tile terang) */}
      <span
        className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white shadow"
        style={{ background: 'var(--c-mint)' }}
      />
      {/* Atribusi wajib — kecil di pojok */}
      <span
        className="absolute bottom-0.5 right-1 rounded px-1 py-0.5 text-[9px] leading-none"
        style={{ color: 'var(--ink-soft)', background: 'color-mix(in srgb, var(--surface) 75%, transparent)' }}
        title="© OpenStreetMap contributors © CARTO"
      >
        © OSM · CARTO
      </span>
    </div>
  )
}
