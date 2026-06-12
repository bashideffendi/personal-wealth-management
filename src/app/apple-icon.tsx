import { ImageResponse } from 'next/og'

// iOS apple-touch-icon — 180x180 (standard size for newer iPhones).
// iOS auto-rounds corners, so we use a flat fill instead of a rounded rect.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
          fontSize: 120,
          fontWeight: 800,
          fontFamily: 'system-ui',
          letterSpacing: '-0.05em',
        }}
      >
        K
      </div>
    ),
    { ...size },
  )
}
