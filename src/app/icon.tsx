import { ImageResponse } from 'next/og'

// Favicon — 32x32 ink tile + mark 4-warna Klunting (plus-layout).
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

const TILES = [
  { c: '#17b890', left: 12.5, top: 4 },    // atas — teal
  { c: '#f0664f', left: 4, top: 12.5 },    // kiri — coral
  { c: '#5d6fe0', left: 21, top: 12.5 },   // kanan — biru
  { c: '#8b4fb0', left: 12.5, top: 21 },   // bawah — ungu
]

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#18181b',
          borderRadius: 7,
        }}
      >
        {TILES.map((t) => (
          <div
            key={t.c}
            style={{
              position: 'absolute',
              left: t.left,
              top: t.top,
              width: 7,
              height: 7,
              borderRadius: 2,
              background: t.c,
            }}
          />
        ))}
      </div>
    ),
    { ...size },
  )
}
