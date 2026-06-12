import { ImageResponse } from 'next/og'

// Favicon — 32x32 emerald square with "K" monogram (Klunting)
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
          background: 'linear-gradient(135deg, #129B69 0%, #0B6E4D 100%)',
          color: '#FFFFFF',
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
