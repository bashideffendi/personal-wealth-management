import { ImageResponse } from 'next/og'

// Social share card — App Router file convention. Served at /opengraph-image
// and auto-wired by Next.js into BOTH og:image and twitter:image (the
// layout.tsx twitter card is 'summary_large_image', which requires an image).
// 1200x630 is the canonical OG size. Dark canvas (#0A0A0F — mirrors the dark
// theme bg + manifest background_color) with the emerald brand lockup, per the
// fintech/terminal aesthetic (dense, dark) rather than a light editorial card.
// Uses system-ui only — no external font fetch — matching icon.tsx so the
// build stays self-contained and reliable.

export const alt = 'Klunting — Wealth Management App'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'linear-gradient(135deg, #0A0A0F 0%, #0A0A0F 55%, #0B231C 100%)',
          color: '#FAFAF9',
          fontFamily: 'system-ui',
        }}
      >
        {/* Top accent strip — emerald, full-bleed (trading-terminal cue) */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: 10,
            background: 'linear-gradient(90deg, #10B981 0%, #047857 100%)',
          }}
        />

        {/* Brand lockup + tagline, vertically centered */}
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
              marginBottom: 40,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 108,
                height: 108,
                borderRadius: 26,
                background:
                  'linear-gradient(135deg, #10B981 0%, #047857 100%)',
                color: '#FFFFFF',
                fontSize: 66,
                fontWeight: 800,
                letterSpacing: '-0.05em',
              }}
            >
              K
            </div>
            <div
              style={{
                marginLeft: 32,
                fontSize: 76,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: '#FAFAF9',
              }}
            >
              Klunting
            </div>
          </div>

          <div
            style={{
              fontSize: 36,
              fontWeight: 500,
              lineHeight: 1.3,
              color: '#A8A29E',
              maxWidth: 940,
            }}
          >
            Catat pendapatan, pengeluaran, aset, utang, dan investasi — pakai
            AI biar cepat.
          </div>
        </div>

        {/* Footer — domain + feature keywords */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 104,
            padding: '0 80px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                width: 14,
                height: 14,
                borderRadius: 7,
                background: '#10B981',
                marginRight: 16,
              }}
            />
            <div style={{ fontSize: 28, fontWeight: 600, color: '#E7E5E4' }}>
              klunting.com
            </div>
          </div>
          <div style={{ fontSize: 24, color: '#78716C' }}>
            Pemasukan · Pengeluaran · Aset · Investasi
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
