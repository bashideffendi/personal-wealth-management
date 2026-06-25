import { ImageResponse } from 'next/og'

// iOS apple-touch-icon — 180x180. iOS auto-rounds corners, jadi ink tile
// flat + mark 4-warna Klunting (plus-layout) di tengah.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const TILES = [
  { c: '#17b890', left: 72, top: 30 },    // atas — teal
  { c: '#f0664f', left: 30, top: 72 },    // kiri — coral
  { c: '#5d6fe0', left: 114, top: 72 },   // kanan — biru
  { c: '#8b4fb0', left: 72, top: 114 },   // bawah — ungu
]

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#18181b',
        }}
      >
        {TILES.map((t) => (
          <div
            key={t.c}
            style={{
              position: 'absolute',
              left: t.left,
              top: t.top,
              width: 36,
              height: 36,
              borderRadius: 11,
              background: t.c,
            }}
          />
        ))}
      </div>
    ),
    { ...size },
  )
}
