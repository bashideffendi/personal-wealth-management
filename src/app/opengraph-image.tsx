import { ImageResponse } from 'next/og'

// Social share card — App Router file convention. Served at /opengraph-image
// dan auto-wired oleh Next.js ke og:image DAN twitter:image (twitter card di
// layout.tsx = 'summary_large_image', yang butuh gambar). 1200x630 = ukuran
// OG kanonis. Kanvas terang #FAFAFA polos + mark 4-warna Klunting
// (plus-layout, proporsi sama dengan icon.tsx/apple-icon.tsx) + wordmark
// "klunting" lowercase ink. Tagline & footer ngikutin metadata di layout.tsx.
// Pakai system-ui aja — tanpa fetch font eksternal — biar build tetap
// self-contained dan reliable.

export const alt = 'Klunting — Atur uang tanpa drama'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Mark 4-warna plus-layout — tile 40px, jarak antar-pusat 46px (rasio sama
// dengan icon.tsx: teal atas, coral kiri, biru kanan, ungu bawah).
const TILES = [
  { c: '#17b890', left: 46, top: 0 },   // atas — teal
  { c: '#f0664f', left: 0, top: 46 },   // kiri — coral
  { c: '#5d6fe0', left: 92, top: 46 },  // kanan — biru
  { c: '#8b4fb0', left: 46, top: 92 },  // bawah — ungu
]

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#FAFAFA',
          color: '#18181b',
          fontFamily: 'system-ui',
        }}
      >
        {/* Lockup mark + wordmark + tagline, vertikal di tengah */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            justifyContent: 'center',
            padding: '0 80px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 44,
            }}
          >
            <div
              style={{
                display: 'flex',
                position: 'relative',
                width: 132,
                height: 132,
              }}
            >
              {TILES.map((t) => (
                <div
                  key={t.c}
                  style={{
                    position: 'absolute',
                    left: t.left,
                    top: t.top,
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: t.c,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                marginLeft: 40,
                fontSize: 96,
                fontWeight: 800,
                letterSpacing: '-0.04em',
                color: '#18181b',
              }}
            >
              klunting
            </div>
          </div>

          {/* Aksen teal halus — garis pendek pemisah lockup dan tagline */}
          <div
            style={{
              display: 'flex',
              width: 72,
              height: 6,
              borderRadius: 3,
              background: '#17b890',
              marginBottom: 32,
            }}
          />

          <div
            style={{
              fontSize: 40,
              fontWeight: 500,
              lineHeight: 1.3,
              color: '#52525b',
              maxWidth: 940,
            }}
          >
            Atur uang tanpa drama
          </div>
        </div>

        {/* Footer — domain + kata kunci fitur */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 104,
            padding: '0 80px',
            borderTop: '1px solid #e4e4e7',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 600, color: '#18181b' }}>
            klunting.com
          </div>
          <div style={{ fontSize: 24, color: '#71717a' }}>
            Pemasukan · Pengeluaran · Aset · Investasi
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
