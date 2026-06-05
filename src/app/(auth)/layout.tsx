import Link from 'next/link'

/**
 * Shared auth shell — centering + emerald ambient glow + brand lock-up.
 * Login / Register / Forgot render only their header + card inside this, so the
 * brand mark stays consistent (no more 3× duplication / shadow drift).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="absolute pointer-events-none"
        style={{
          top: '18%', left: '50%', transform: 'translateX(-50%)',
          width: 540, height: 540, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.08), transparent 65%)',
        }}
      />
      <div className="relative w-full" style={{ maxWidth: 400 }}>
        <div className="flex justify-center mb-7">
          <Link
            href="/"
            aria-label="Klunting"
            className="grid place-items-center"
            style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'var(--c-primary)', color: 'var(--c-primary-foreground)',
              boxShadow: '0 8px 24px -8px rgba(16,24,40,0.18)',
              fontWeight: 800, fontSize: 28, letterSpacing: '-0.04em',
            }}
          >
            K
          </Link>
        </div>
        {children}
      </div>
    </div>
  )
}
