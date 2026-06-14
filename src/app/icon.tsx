import { ImageResponse } from 'next/og'

// Favicon — 32x32 gold square with dark "K" monogram (Klunting brand)
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FFD15C 0%, #E8A100 100%)',
          color: '#1E1B16',
          fontSize: 22,
          fontWeight: 800,
          fontFamily: 'system-ui',
          borderRadius: 6,
          letterSpacing: '-0.05em',
        }}
      >
        K
      </div>
    ),
    { ...size },
  )
}
